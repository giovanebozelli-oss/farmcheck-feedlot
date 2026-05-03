# FarmCheck Feedlot

App de gestão de confinamento bovino — controle de lotes, currais, dietas, tratos diários e movimentações.

**Stack:** Vite 6 + React 19 + TypeScript + Tailwind + Supabase (Postgres + Realtime + RPC) + Recharts + jsPDF.

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz com:

```
VITE_SUPABASE_URL=https://rqacehxhfvikmdtrqgqa.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_OnEJAIqd8kN2D-mwAYG6AQ_qhW4usnA
```

Em produção (Netlify) configure essas duas variáveis em **Site settings → Environment variables**.

## Rodar localmente

```
npm install
npm run dev
```

App abre em `http://localhost:3000`.

## Deploy

```
npm run build
```

Gera `dist/` que é o que o Netlify publica.

## Banco de dados

Schema com prefixo `fc_*` no projeto Supabase `rqacehxhfvikmdtrqgqa`:

- `fc_users` — usuários + PIN hasheado (bcrypt via pgcrypto)
- `fc_config` — singleton de configuração (curvas GMD, escores cocho, tratamentos)
- `fc_categories`, `fc_pens`, `fc_ingredients`, `fc_diets` — cadastros
- `fc_lots`, `fc_movements`, `fc_feed_records` — dados operacionais

Auth via PIN: front-end chama RPC `fc_validate_pin(user_id, pin)` que retorna `boolean`.

Realtime: todas as tabelas operacionais publicam mudanças via `supabase_realtime`. Os listeners no `context.tsx` são granulares — cada tabela atualiza apenas seu próprio state, sem refetch geral.
