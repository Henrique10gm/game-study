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
