-- Quest Hall: setup completo do banco (cole TUDO no SQL Editor do Supabase e clique em Run).
-- Arquivo gerado a partir de supabase/migrations/*.sql (a fonte da verdade são as migrations).

-- =============== 20261022000001_schema.sql ===============
-- Quest Hall: schema base. Toda tabela tem RLS ligada (policies em 20261022000002).
-- Identidade = auth.users.id (Supabase Auth). Nenhum e-mail é copiado para tabelas públicas.

create schema if not exists extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Apelido: 3 a 20 caracteres, letras (com acento), números, "_", "." e "-".
-- Mesma ideia do limite de 20 do campo de apelido no front.
create or replace function public.is_valid_nickname(n text)
returns boolean
language sql
immutable
as $$
  select n ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9_.-]{3,20}$'
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   extensions.citext unique,
  created_at timestamptz not null default now(),
  constraint profiles_nickname_format check (nickname is null or public.is_valid_nickname(nickname::text))
);
alter table public.profiles enable row level security;

-- Todo usuário novo ganha um perfil sem apelido.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ groups
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 40),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;

create table public.memberships (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
alter table public.memberships enable row level security;

create table public.invites (
  token      text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  group_id   uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  max_uses   integer not null default 20 check (max_uses between 1 and 1000),
  uses       integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now(),
  constraint invites_uses_within_max check (uses <= max_uses)
);
create index invites_group_idx on public.invites (group_id);
alter table public.invites enable row level security;

-- ------------------------------------------------------------------- games
-- Regras replicam o validateGame_ do backend antigo.
create table public.games (
  id              uuid primary key, -- gerado no cliente: reenvio da fila offline é ignorado
  user_id         uuid not null references auth.users (id) on delete cascade,
  room_id         text not null check (room_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(room_id) <= 64),
  mode_id         text not null check (mode_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(mode_id) <= 64),
  style           text not null default 'obstaculos' check (style in ('obstaculos', 'tempo', 'corrida', 'pacman')),
  requested_count integer not null check (requested_count between 0 and 500),
  answered_count  integer not null check (answered_count between 0 and 500),
  correct_count   integer not null check (correct_count >= 0),
  xp              integer not null check (xp between 0 and 100000),
  result          text not null check (result in ('completed', 'gameover', 'abandoned')),
  started_at      timestamptz not null,
  ended_at        timestamptz not null,
  created_at      timestamptz not null default now(),
  constraint games_correct_within_answered check (correct_count <= answered_count),
  constraint games_time_order check (ended_at >= started_at)
);
create index games_user_room_idx on public.games (user_id, room_id, ended_at desc);
alter table public.games enable row level security;

create table public.answers (
  game_id          uuid not null references public.games (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  question_id      text not null check (question_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  chosen_choice_id text not null check (chosen_choice_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  correct          boolean not null,
  answered_at      timestamptz not null,
  primary key (game_id, question_id, answered_at)
);
create index answers_user_question_idx on public.answers (user_id, question_id, answered_at desc);
alter table public.answers enable row level security;

-- ---------------------------------------------------------------- sessions
-- Tempo de tela: acumulado por sessão e sala; o servidor guarda o maior valor.
create table public.sessions (
  session_id     uuid not null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  room_id        text not null check (room_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(room_id) <= 64),
  started_at     timestamptz not null,
  active_seconds integer not null check (active_seconds between 0 and 86400),
  updated_at     timestamptz not null default now(),
  primary key (session_id, room_id)
);
create index sessions_user_idx on public.sessions (user_id);
alter table public.sessions enable row level security;

-- ----------------------------------------------------------------- reports
create table public.reports (
  id                uuid primary key, -- gerado no cliente: reenvio é inofensivo
  user_id           uuid not null references auth.users (id) on delete cascade,
  question_id       text not null check (question_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  room_id           text not null check (room_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(room_id) <= 64),
  reason            text not null check (reason in (
    'wrong-answer', 'wrong-justification', 'many-correct', 'none-correct',
    'unclear', 'outdated', 'unrealistic', 'typo', 'other')),
  comment           text not null default '' check (char_length(comment) <= 500),
  chosen_choice_id  text not null check (chosen_choice_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  correct_choice_id text not null check (correct_choice_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  status            text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at        timestamptz not null default now()
);
create index reports_user_idx on public.reports (user_id);
alter table public.reports enable row level security;

-- =============== 20261022000002_rls_and_functions.sql ===============
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

-- =============== 20261022000003_client_support.sql ===============
-- Quest Hall: ajustes para o cliente.
-- 1) Apelido igual ao que o front já explica: 2 a 20 caracteres (letras, números,
--    espaço, ponto, traço ou sublinhado), começando por letra ou número.
-- 2) user_id com default auth.uid() em reports e sessions (o RLS continua exigindo user_id = auth.uid()).
-- 3) my_progress: situação do jogador numa sala sem esbarrar no limite de 1000 linhas da API.

create or replace function public.is_valid_nickname(n text)
returns boolean
language sql
immutable
as $$
  select n ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]{1,19}$'
$$;

alter table public.reports  alter column user_id set default auth.uid();
alter table public.sessions alter column user_id set default auth.uid();

-- statuses: última resposta de cada pergunta (true = certa); total_xp: XP de todas as partidas.
-- p_room_id nulo = todas as salas.
create or replace function public.my_progress(p_room_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'statuses', coalesce((
      select jsonb_object_agg(l.question_id, l.correct)
      from (
        select distinct on (a.question_id) a.question_id, a.correct
        from public.answers a
        join public.games g on g.id = a.game_id
        where a.user_id = auth.uid() and (p_room_id is null or g.room_id = p_room_id)
        order by a.question_id, a.answered_at desc
      ) l
    ), '{}'::jsonb),
    'totalXp', coalesce((
      select sum(g.xp) from public.games g
      where g.user_id = auth.uid() and (p_room_id is null or g.room_id = p_room_id)
    ), 0)
  )
$$;

grant execute on function public.my_progress(text) to authenticated;

