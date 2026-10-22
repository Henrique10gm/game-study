-- Só quem está logado (authenticated) chama as funções da API; anon e public perdem o EXECUTE.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- Funções internas (gatilhos) não precisam ser chamáveis pela API.
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.sessions_keep_max() from authenticated;
-- Futuras funções nascem sem EXECUTE para anon/public.
alter default privileges in schema public revoke execute on functions from public, anon;
