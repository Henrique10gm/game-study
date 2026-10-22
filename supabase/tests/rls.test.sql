-- Teste de RLS e funções com três usuários (A, B, C). Tudo roda numa transação
-- que termina em ROLLBACK: não deixa nada no banco.
-- Como rodar: cole no SQL Editor do Supabase (ou `psql -f`). Qualquer falha
-- levanta "FAIL: ..." e aborta; no fim aparece "ALL RLS TESTS PASSED".

begin;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
end $$;

create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
end $$;

-- Roda `sql` e exige que ele FALHE (erro de permissão, RLS ou validação).
create function pg_temp.must_fail(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL (deveria falhar): %', msg;
end $$;

create function pg_temp.sample_game(gid uuid, qid text, good boolean) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gid, 'roomId', 'compliance', 'modeId', 'treino', 'style', 'obstaculos',
    'requestedCount', 1, 'answeredCount', 1, 'correctCount', case when good then 1 else 0 end,
    'xp', 10, 'result', 'completed',
    'startedAt', now(), 'endedAt', now(),
    'answers', jsonb_build_array(jsonb_build_object(
      'questionId', qid, 'chosenChoiceId', 'a', 'correct', good, 'answeredAt', now())))
$$;

-- Usuários (o trigger cria os perfis).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;

-- ===================================================================== A
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select pg_temp.ok(public.set_nickname('alice') = 'alice', 'A escolhe apelido');
select pg_temp.must_fail($$select public.set_nickname('x')$$, 'apelido curto demais');
select pg_temp.must_fail($$select public.set_nickname('-ab')$$, 'apelido começando por traço');
select pg_temp.ok(public.set_nickname('ana maria') = 'ana maria', 'apelido com espaço é válido');
select public.set_nickname('alice');

insert into ctx select 'group', public.create_group('Equipe Azul')::text;
insert into ctx select 'invite', public.create_invite((select v::uuid from ctx where k = 'group'));
insert into ctx select 'invite_short', public.create_invite((select v::uuid from ctx where k = 'group'), 1, 1);

select public.save_game(pg_temp.sample_game('10000000-0000-0000-0000-000000000001', 'q1', true));
select public.save_game(pg_temp.sample_game('10000000-0000-0000-0000-000000000001', 'q1', true)); -- reenvio: ignorado
select pg_temp.ok((select count(*) from public.games) = 1, 'save_game é idempotente');
select pg_temp.ok((select count(*) from public.answers) = 1, 'resposta não duplica no reenvio');

select pg_temp.must_fail(
  $$select public.save_game(jsonb_set(pg_temp.sample_game('10000000-0000-0000-0000-000000000002', 'q2', true), '{correctCount}', '5'))$$,
  'correct_count > answered_count');
select pg_temp.must_fail(
  $$select public.save_game(jsonb_set(pg_temp.sample_game('10000000-0000-0000-0000-000000000003', 'q3', true), '{xp}', '999999'))$$,
  'xp acima do limite');
select pg_temp.ok((select count(*) from public.games) = 1, 'partida inválida não deixa resto');

select pg_temp.must_fail(
  $$insert into public.games (id, user_id, room_id, mode_id, requested_count, answered_count, correct_count, xp, result, started_at, ended_at)
    values (gen_random_uuid(), auth.uid(), 'compliance', 'x', 1, 1, 1, 99999, 'completed', now(), now())$$,
  'insert direto em games');
select pg_temp.must_fail($$insert into public.groups (name, owner_id) values ('X1', auth.uid())$$, 'insert direto em groups');
select pg_temp.must_fail($$insert into public.memberships (group_id, user_id) select v::uuid, auth.uid() from ctx where k = 'group'$$, 'insert direto em memberships');
select pg_temp.must_fail($$update public.profiles set nickname = 'hack' where id = auth.uid()$$, 'update direto em profiles');

select pg_temp.ok((select count(*) from public.leaderboard((select v::uuid from ctx where k = 'group'), 'compliance')) = 1,
  'A vê o ranking do próprio grupo');

-- ===================================================================== B
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select pg_temp.ok((select count(*) from public.games) = 0, 'B não lê partidas de A');
select pg_temp.ok((select count(*) from public.answers) = 0, 'B não lê respostas de A');
select pg_temp.ok((select count(*) from public.groups) = 0, 'B não vê grupo do qual não é membro');
select pg_temp.ok((select count(*) from public.memberships) = 0, 'B não vê membros de grupo alheio');
select pg_temp.ok((select count(*) from public.invites) = 0, 'B não vê convites');
select pg_temp.ok((select count(*) from public.profiles) = 1, 'B só vê o próprio perfil');
select pg_temp.ok((select count(*) from public.leaderboard((select v::uuid from ctx where k = 'group'), 'compliance')) = 0,
  'fora do grupo: ranking vazio');
select pg_temp.ok((select count(*) from public.group_members((select v::uuid from ctx where k = 'group'))) = 0,
  'fora do grupo: sem lista de membros');
select pg_temp.must_fail($$select public.create_invite((select v::uuid from ctx where k = 'group'))$$, 'B não gera convite');
select pg_temp.must_fail($$select public.remove_member((select v::uuid from ctx where k = 'group'), '00000000-0000-0000-0000-00000000000a')$$, 'B não remove membro');
select pg_temp.must_fail($$select public.redeem_invite('token-que-nao-existe')$$, 'convite inexistente');

select pg_temp.ok(public.redeem_invite((select v from ctx where k = 'invite')) = (select v::uuid from ctx where k = 'group'), 'B entra por convite');
select pg_temp.ok((select count(*) from public.groups) = 1, 'B agora vê o grupo');
select pg_temp.ok((select count(*) from public.group_members((select v::uuid from ctx where k = 'group'))) = 2, 'B vê os 2 membros');
select pg_temp.ok((select count(*) from public.games) = 0, 'B continua sem ler partidas de A');
select pg_temp.must_fail($$select public.set_nickname('alice')$$, 'apelido duplicado (citext)');
select pg_temp.must_fail($$select public.set_nickname('ALICE')$$, 'apelido duplicado em maiúsculas');
select public.set_nickname('bruno');

select public.save_game(pg_temp.sample_game('20000000-0000-0000-0000-000000000001', 'q1', false));
select pg_temp.ok((public.my_progress('compliance') -> 'statuses' ->> 'q1')::boolean = false, 'my_progress: ultima resposta de B em q1 e errada');
select pg_temp.ok((public.my_progress('compliance') ->> 'totalXp')::int = 10, 'my_progress: XP so de B');
select pg_temp.ok(public.my_progress('outra-sala') = '{"statuses": {}, "totalXp": 0}'::jsonb, 'my_progress: sala vazia');
select pg_temp.ok((select count(*) from public.leaderboard((select v::uuid from ctx where k = 'group'), 'compliance')) = 2, 'ranking com A e B');
select pg_temp.ok((select mastered from public.leaderboard((select v::uuid from ctx where k = 'group'), 'compliance') where me) = 0, 'B errou q1: 0 dominadas');
select pg_temp.ok((select nickname from public.leaderboard((select v::uuid from ctx where k = 'group'), 'compliance') where rank = 1) = 'alice', 'A lidera');
select pg_temp.ok((select count(*) from public.leaderboard((select v::uuid from ctx where k = 'group'), 'outra-sala')) = 2, 'sala sem jogos: todos zerados');

insert into public.reports (id, user_id, question_id, room_id, reason, chosen_choice_id, correct_choice_id)
  values (gen_random_uuid(), auth.uid(), 'q1', 'compliance', 'typo', 'a', 'b');
select pg_temp.must_fail($$select * from public.reports$$, 'reports é só escrita');
select pg_temp.must_fail(
  $$insert into public.reports (id, user_id, question_id, room_id, reason, chosen_choice_id, correct_choice_id)
    values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'q1', 'compliance', 'typo', 'a', 'b')$$,
  'report em nome de outro usuário');

select public.leave_group((select v::uuid from ctx where k = 'group'));
select pg_temp.ok((select count(*) from public.groups) = 0, 'B saiu do grupo');
select public.redeem_invite((select v from ctx where k = 'invite')); -- volta (consome 2º uso)

-- ===================================================================== C
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.set_nickname('carla');
select pg_temp.ok(public.redeem_invite((select v from ctx where k = 'invite')) is not null, 'C entra (3º uso)');

-- Convite com 1 uso: B e C disputam.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.leave_group((select v::uuid from ctx where k = 'group'));
select public.redeem_invite((select v from ctx where k = 'invite_short'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.leave_group((select v::uuid from ctx where k = 'group'));
select pg_temp.must_fail($$select public.redeem_invite((select v from ctx where k = 'invite_short'))$$, 'convite esgotado');

-- Convite expirado.
reset role;
update public.invites set expires_at = now() - interval '1 minute' where token = (select v from ctx where k = 'invite');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.must_fail($$select public.redeem_invite((select v from ctx where k = 'invite'))$$, 'convite expirado');

-- ===================================================================== A de novo
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.must_fail($$select public.leave_group((select v::uuid from ctx where k = 'group'))$$, 'owner não sai do próprio grupo');
select public.remove_member((select v::uuid from ctx where k = 'group'), '00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.group_members((select v::uuid from ctx where k = 'group'))) = 1, 'owner removeu B');
select pg_temp.ok(jsonb_array_length(public.export_my_data() -> 'games') = 1, 'export traz as partidas');
select pg_temp.ok(not (public.export_my_data()::text like '%@%'), 'export sem e-mail');
select public.delete_my_account();

reset role;
select pg_temp.ok((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'conta apagada');
select pg_temp.ok((select count(*) from public.games where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'partidas apagadas em cascata');

select 'ALL RLS TESTS PASSED' as result;
rollback;
