# Freelance Hub

Plataforma SaaS de freelancers com autenticação, perfis, busca e painel administrativo.

## Estrutura

`index.html`: página de login/cadastro  
`app.html`: página da plataforma SaaS (freelancers + admin)  
`body.html`: compatibilidade com redirecionamento para `index.html`  
`styles/auth.css`: estilos da página de acesso  
`styles/app.css`: estilos da página SaaS  
`scripts/config.js`: configuração global do frontend  
`scripts/api-client.js`: cliente HTTP da API  
`scripts/auth-page.js`: fluxo de login/cadastro e redirecionamento  
`scripts/app-page.js`: dashboard SaaS (busca, perfil freelancer e admin)  
`backend/src`: API Express + MySQL + JWT

## Fluxo

1. Cadastro e login com tipo de conta: `client` ou `freelancer`
2. Redirecionamento para `app.html` após autenticação
3. Busca de freelancers em `/marketplace/freelancers`
4. Perfil freelancer em `/marketplace/me/freelancer-profile`
5. Sessão em `/dashboard`
6. Painel admin em `/auth/admin/overview` e atualização de status em `/auth/admin/status`

![Preview](Demo.png)
