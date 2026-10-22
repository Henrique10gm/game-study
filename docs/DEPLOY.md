# Deploy no Cloudflare Pages

O front é 100% estático (`dist/`). Não há servidor próprio: a lógica fica no Supabase.

## 1. Criar o projeto no Cloudflare Pages

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** e escolha o repositório.
2. Configuração de build:

| Campo | Valor |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | `24` (o arquivo `.nvmrc` já indica; se preferir, defina `NODE_VERSION=24`) |

3. **Variáveis de ambiente** (Settings → Variables and Secrets, em *Production* e *Preview*):

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` (Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | chave *publishable/anon* (pública por desenho) |
| `VITE_TURNSTILE_SITE_KEY` | *site key* do Turnstile (pública) |

**Nunca** coloque a `service_role`/*secret* key aqui nem em qualquer variável `VITE_*`: tudo que começa com `VITE_` vai para o JavaScript do navegador.

As variáveis são lidas **no build**. Mudou uma? Faça um novo deploy.

## 2. Headers de segurança

`public/_headers` é copiado para `dist/` e aplicado pelo Pages: CSP restrita, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS e `frame-ancestors 'none'`. O cache longo vale só para `/assets/*` (arquivos com hash).

Se o projeto Supabase mudar, troque o host em `connect-src` no `_headers` (e no `<meta>` do `index.html`, usado no `npm run dev`). Há um teste (`tests/unit/deploy-headers.test.ts`) que avisa se algo essencial sumir.

## 3. Depois do primeiro deploy

Troque `https://<seu-site>.pages.dev` (ou o domínio próprio) abaixo:

1. **Supabase → Authentication → URL Configuration**
   - *Site URL*: o endereço de produção.
   - *Redirect URLs*: o endereço de produção e `http://localhost:5173` (dev). Sem isso, o link de confirmação de e-mail e a recuperação de senha não voltam para o jogo.
2. **Supabase → Authentication → Sign In / Providers → Email**: "Confirm email" ligado; senha mínima 8.
3. **Turnstile (Cloudflare → Turnstile)**: crie um widget e adicione o domínio de produção em *Hostnames*. Cole a *site key* na variável `VITE_TURNSTILE_SITE_KEY` e o *secret key* em **Supabase → Authentication → Attack Protection → CAPTCHA** (provedor Turnstile). O *secret* fica só no Supabase.
4. **Supabase → Authentication → Rate Limits**: confira os limites de e-mail e de tentativas de login.

## 4. Domínio próprio (opcional)

Pages → seu projeto → **Custom domains → Set up a domain**. Depois atualize a *Site URL* e as *Redirect URLs* do Supabase e o *Hostname* do Turnstile.

## 5. Como conferir

- Abra o site em uma janela anônima: deve aparecer a tela de login.
- DevTools → Network → o documento deve trazer `Content-Security-Policy` e `X-Content-Type-Options`.
- Console sem erros de CSP.
- Crie uma conta de teste, confirme o e-mail, jogue uma partida e veja a linha em `games` no Supabase (Table Editor).
- Teste um link de convite em outra janela anônima: `https://<site>/?convite=<código>`.

## Rodar o build localmente

```bash
npm run build      # gera dist/ (usa o .env local)
npm run preview    # serve dist/ em http://localhost:4173 (sem os headers do _headers)
```
