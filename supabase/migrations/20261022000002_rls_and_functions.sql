-- Quest Hall: RLS e funções. O cliente só LÊ as próprias linhas; toda escrita
-- passa por função SECURITY DEFINER que valida entrada e usa auth.uid().

-- Nada de acesso por padrão: tira tudo e devolve só o necessário.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.profiles, public.groups, public.memberships, public.invites,
                public.games, public.answers, public.sessions to authenticated;
grant update (name) on public.groups to authenticated;
grant delete on public.invites to authenticated;
-- reports: só escrita para o jogador (sem select).
grant insert on public.reports to authenticated;
-- sessions: o cliente faz upsert do próprio tempo de tela.
grant insert, update on public.sessions to authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m where m.group_id = gid and m.user_id = (select auth.uid())
  )
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g where g.id = gid and g.owner_id = (select auth.uid())
  )
$$;

grant execute on function public.is_group_member(uuid), public.is_group_owner(uuid) to authenticated;

-- ---------------------------------------------------------------- policies
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy groups_select_member on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy groups_update_owner on public.groups
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy memberships_select_own_groups on public.memberships
  for select to authenticated using (public.is_group_member(group_id));

create policy invites_select_owner on public.invites
  for select to authenticated using (public.is_group_owner(group_id));
create policy invites_delete_owner on public.invites
  for delete to authenticated using (public.is_group_owner(group_id));

create policy games_select_own on public.games
  for select to authenticated using (user_id = (select auth.uid()));
create policy answers_select_own on public.answers
  for select to authenticated using (user_id = (select auth.uid()));

create policy sessions_select_own on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy sessions_insert_own on public.sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy sessions_update_own on public.sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy reports_insert_own on public.reports
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Tempo de tela só cresce (o cliente manda o acumulado).
create or replace function public.sessions_keep_max()
returns trigger
language plpgsql
as $$
begin
  new.active_seconds := greatest(new.active_seconds, old.active_seconds);
  new.user_id := old.user_id;
  new.started_at := old.started_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger sessions_keep_max_trg
  before update on public.sessions
  for each row execute function public.sessions_keep_max();

-- ------------------------------------------------------------------ perfil
create or replace function public.set_nickname(p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  nick text := btrim(p_nickname);
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_valid_nickname(nick) then raise exception 'invalid nickname' using errcode = '22023'; end if;
  begin
    update public.profiles set nickname = nick where id = uid;
  exception when unique_violation then
    raise exception 'nickname taken' using errcode = '23505';
  end;
  return nick;
end;
$$;

-- ------------------------------------------------------------------ partida
-- p_game: {id, roomId, modeId, style, requestedCount, answeredCount, correctCount, xp,
--          result, startedAt, endedAt, answers: [{questionId, chosenChoiceId, correct, answeredAt}]}
-- Idempotente: reenviar a mesma partida não faz nada.
create or replace function public.save_game(p_game jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  answer jsonb;
  n_answers integer;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if jsonb_typeof(p_game) <> 'object' then raise exception 'invalid game' using errcode = '22023'; end if;

  gid := (p_game ->> 'id')::uuid;
  if exists (select 1 from public.games where id = gid) then return; end if;

  -- Limite diário por usuário (anti-abuso).
  if (select count(*) from public.games where user_id = uid and created_at > now() - interval '1 day') >= 500 then
    raise exception 'daily game limit' using errcode = '54000';
  end if;

  n_answers := coalesce(jsonb_array_length(p_game -> 'answers'), 0);
  if n_answers > 500 then raise exception 'too many answers' using errcode = '22023'; end if;

  insert into public.games (id, user_id, room_id, mode_id, style, requested_count, answered_count,
                            correct_count, xp, result, started_at, ended_at)
  values (gid, uid,
          coalesce(p_game ->> 'roomId', 'compliance'),
          p_game ->> 'modeId',
          coalesce(p_game ->> 'style', 'obstaculos'),
          (p_game ->> 'requestedCount')::int,
          (p_game ->> 'answeredCount')::int,
          (p_game ->> 'correctCount')::int,
          (p_game ->> 'xp')::int,
          p_game ->> 'result',
          (p_game ->> 'startedAt')::timestamptz,
          (p_game ->> 'endedAt')::timestamptz)
  on conflict (id) do nothing;

  if n_answers <> (p_game ->> 'answeredCount')::int then
    raise exception 'answers do not match answeredCount' using errcode = '22023';
  end if;

  for answer in select * from jsonb_array_elements(coalesce(p_game -> 'answers', '[]'::jsonb)) loop
    insert into public.answers (game_id, user_id, question_id, chosen_choice_id, correct, answered_at)
    values (gid, uid,
            answer ->> 'questionId',
            answer ->> 'chosenChoiceId',
            (answer ->> 'correct')::boolean,
            (answer ->> 'answeredAt')::timestamptz)
    on conflict do nothing;
  end loop;

  if (select count(*) from public.answers where game_id = gid and correct) <> (p_game ->> 'correctCount')::int then
    raise exception 'answers do not match correctCount' using errcode = '22023';
  end if;
end;
$$;

-- ------------------------------------------------------------------ grupos
create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if (select count(*) from public.groups where owner_id = uid) >= 10 then
    raise exception 'group limit' using errcode = '54000';
  end if;
  insert into public.groups (name, owner_id) values (btrim(p_name), uid) returning id into gid;
  insert into public.memberships (group_id, user_id, role) values (gid, uid, 'owner');
  return gid;
end;
$$;

-- Convite: token longo e aleatório, expiração curta por padrão (72 h), só o owner gera.
create or replace function public.create_invite(p_group_id uuid, p_ttl_hours integer default 72, p_max_uses integer default 20)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
begin
  if not public.is_group_owner(p_group_id) then raise exception 'not group owner' using errcode = '42501'; end if;
  if p_ttl_hours not between 1 and 720 then raise exception 'invalid ttl' using errcode = '22023'; end if;
  insert into public.invites (group_id, created_by, expires_at, max_uses)
  values (p_group_id, auth.uid(), now() + make_interval(hours => p_ttl_hours), p_max_uses)
  returning token into tok;
  return tok;
end;
$$;

-- Entrar por convite. Quem já é membro não gasta um uso.
create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invites;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;

  select * into inv from public.invites where token = p_token for update;
  if not found then raise exception 'invalid invite' using errcode = 'QH002'; end if;
  if inv.expires_at <= now() then raise exception 'invite expired' using errcode = 'QH003'; end if;

  if exists (select 1 from public.memberships where group_id = inv.group_id and user_id = uid) then
    return inv.group_id;
  end if;
  if inv.uses >= inv.max_uses then raise exception 'invite exhausted' using errcode = 'QH004'; end if;

  insert into public.memberships (group_id, user_id, role) values (inv.group_id, uid, 'member');
  update public.invites set uses = uses + 1 where token = inv.token;
  return inv.group_id;
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_group_owner(p_group_id) then
    raise exception 'owner cannot leave' using errcode = '42501';
  end if;
  delete from public.memberships where group_id = p_group_id and user_id = auth.uid();
end;
$$;

create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(p_group_id) then raise exception 'not group owner' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'owner cannot be removed' using errcode = '42501'; end if;
  delete from public.memberships where group_id = p_group_id and user_id = p_user_id;
end;
$$;

-- Lista de membros: apelido e papel, nunca e-mail.
create or replace function public.group_members(p_group_id uuid)
returns table (user_id uuid, nickname text, role text, me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.nickname::text, m.role, m.user_id = auth.uid()
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group_id and public.is_group_member(p_group_id)
  order by m.role desc, p.nickname
$$;

-- ----------------------------------------------------------------- ranking
-- Só agregados (apelido, dominadas, XP, partidas) de membros do grupo do chamador.
-- "Dominada" = a resposta mais recente da pergunta, nessa sala, está certa.
create or replace function public.leaderboard(p_group_id uuid, p_room_id text)
returns table (rank bigint, nickname text, mastered bigint, xp bigint, games bigint, me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select m.user_id, p.nickname::text as nickname
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id and p.nickname is not null
      and public.is_group_member(p_group_id)
  ),
  latest as (
    select distinct on (a.user_id, a.question_id) a.user_id, a.correct
    from public.answers a
    join public.games g on g.id = a.game_id
    where g.room_id = p_room_id and a.user_id in (select user_id from members)
    order by a.user_id, a.question_id, a.answered_at desc
  ),
  mastered as (
    select user_id, count(*) filter (where correct) as n from latest group by user_id
  ),
  totals as (
    select user_id, coalesce(sum(xp), 0) as xp, count(*) as games
    from public.games
    where room_id = p_room_id and user_id in (select user_id from members)
    group by user_id
  )
  select row_number() over (order by coalesce(ms.n, 0) desc, coalesce(t.xp, 0) desc, mb.nickname) as rank,
         mb.nickname,
         coalesce(ms.n, 0)::bigint,
         coalesce(t.xp, 0)::bigint,
         coalesce(t.games, 0)::bigint,
         mb.user_id = auth.uid()
  from members mb
  left join mastered ms on ms.user_id = mb.user_id
  left join totals t on t.user_id = mb.user_id
  order by 1
  limit 100
$$;

-- ------------------------------------------------------ privacidade (LGPD)
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile',     (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'groups',      coalesce((select jsonb_agg(jsonb_build_object('groupId', m.group_id, 'role', m.role))
                             from public.memberships m where m.user_id = auth.uid()), '[]'::jsonb),
    'games',       coalesce((select jsonb_agg(to_jsonb(g)) from public.games g where g.user_id = auth.uid()), '[]'::jsonb),
    'answers',     coalesce((select jsonb_agg(to_jsonb(a)) from public.answers a where a.user_id = auth.uid()), '[]'::jsonb),
    'sessions',    coalesce((select jsonb_agg(to_jsonb(s)) from public.sessions s where s.user_id = auth.uid()), '[]'::jsonb),
    'reports',     coalesce((select jsonb_agg(to_jsonb(r)) from public.reports r where r.user_id = auth.uid()), '[]'::jsonb)
  )
$$;

-- Apaga a conta e, em cascata, tudo do usuário. Grupos de que ele é owner somem junto.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function
  public.set_nickname(text), public.save_game(jsonb), public.create_group(text),
  public.create_invite(uuid, integer, integer), public.redeem_invite(text),
  public.leave_group(uuid), public.remove_member(uuid, uuid), public.group_members(uuid),
  public.leaderboard(uuid, text), public.export_my_data(), public.delete_my_account()
to authenticated;
