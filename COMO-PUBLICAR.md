# GMC — Como publicar a atualização

## O que mudou

**Marca:** logo, título, ícone, PDFs e Excel agora usam **GMC** no lugar de Trato.

**Causa da perda de dados (resolvida):** o sistema tinha UM banco compartilhado entre todos os 18 usuários, e um botão "Zerar Todo o Banco de Dados" que **qualquer usuário** podia clicar — apagando os dados de TODOS. Foi isso que apagou os 15 dias de dados do seu usuário.

Correções aplicadas:

1. **Dados separados por usuário** — cada usuário agora só vê, edita e apaga o PRÓPRIO confinamento (garantido no servidor via RLS, não só no app).
2. **Botão de reset seguro** — só apaga os dados do próprio usuário e exige digitar "ZERAR" para confirmar.
3. **Perfis dos 18 usuários recuperados** — giovanebozelli@gmail.com é admin.
4. **Keepalive diário** (função agendada no Netlify) — impede o Supabase gratuito de pausar por inatividade, que era o que causava o erro "Failed to fetch" no login.
5. **Erros visíveis** — se o servidor estiver fora do ar, o app avisa claramente em vez de mostrar o sistema vazio (o que fazia parecer que os dados sumiram).

As mudanças no banco de dados (itens 1–3) **já estão ativas**. Falta só publicar o app atualizado.

## Passos para publicar

1. Acesse https://github.com/giovanebozelli-oss/farmcheck-feedlot
2. Clique em **Add file → Upload files**
3. Arraste TODO o conteúdo da pasta `gmc-feedlot` (incluindo as pastas `components`, `lib`, `utils`, `public`, `netlify`)
4. Clique em **Commit changes**
5. O Netlify builda e publica sozinho em ~1 minuto: https://farmcheck-feedlot.netlify.app

## Recomendações

- O site antigo https://farmcheckfeedlot.netlify.app ainda está no ar (versão velha, que salvava dados só no navegador). Recomendo excluí-lo no painel do Netlify para ninguém usar por engano.
- Dados de usuários que estavam no navegador (versão antiga) não são recuperáveis; os novos ficam todos no Supabase.
