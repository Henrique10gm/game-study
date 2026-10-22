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
