-- Exportar meus dados (LGPD, art. 18): agora inclui os dados da própria conta (e-mail e data de
-- criação), a data da exportação e os grupos com o nome. Só devolve linhas da própria pessoa.
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exportedAt',  now(),
    'account',     (select jsonb_build_object('email', u.email, 'createdAt', u.created_at)
                    from auth.users u where u.id = auth.uid()),
    'profile',     (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'groups',      coalesce((select jsonb_agg(jsonb_build_object('groupId', m.group_id, 'name', g.name, 'role', m.role, 'joinedAt', m.created_at))
                             from public.memberships m
                             join public.groups g on g.id = m.group_id
                             where m.user_id = auth.uid()), '[]'::jsonb),
    'games',       coalesce((select jsonb_agg(to_jsonb(g)) from public.games g where g.user_id = auth.uid()), '[]'::jsonb),
    'answers',     coalesce((select jsonb_agg(to_jsonb(a)) from public.answers a where a.user_id = auth.uid()), '[]'::jsonb),
    'sessions',    coalesce((select jsonb_agg(to_jsonb(s)) from public.sessions s where s.user_id = auth.uid()), '[]'::jsonb),
    'reports',     coalesce((select jsonb_agg(to_jsonb(r)) from public.reports r where r.user_id = auth.uid()), '[]'::jsonb)
  )
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
