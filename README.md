# Freelance Hub

Freelance Hub é um projeto para conectar clientes e freelancers em um só lugar. Ele reúne login, perfis profissionais, buscas por habilidades, publicação de jobs, candidaturas, mensagens e notificações.

## O que o projeto faz
- Cadastro e autenticação de usuários
- Perfis de freelancer com título, skills, portfólio e valor/hora
- Busca por profissionais
- Criação de jobs e candidatura de freelancers
- Envio de mensagens entre usuários
- Painel administrativo para gestão básica

## Tecnologias usadas
- Frontend: HTML, CSS e JavaScript (ES6 modules)
- Backend: Node.js e Express
- Banco de dados: MySQL com `mysql2`
- Autenticação: JWT
- API: arquitetura REST

## Estrutura do projeto
- `index.html` — tela de login e cadastro
- `app.html` — painel principal da aplicação
- `scripts/` — scripts do frontend
- `styles/` — estilos CSS
- `backend/src/` — código do backend (rotas, controladores, middleware)
- `backend/.env` — variáveis de ambiente (não versionar)

## Como rodar localmente
1. Clone o repositório:

```bash
git clone <repo-url>
cd auth
```

2. Vá para o backend, instale dependências e configure o `.env`:

```bash
cd backend
npm install
```

Exemplo de `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=freelancehub_user
DB_PASSWORD=SUA_SENHA_AQUI
DB_NAME=freelancehub
JWT_SECRET=uma_chave_secreta
PORT=3000
```

3. Inicie o backend:

```bash
npm start
```

4. Abra a aplicação no navegador:

- `http://localhost:3000/` (login/cadastro)
- `http://localhost:3000/app` (plataforma)

## Colocar no ar (deploy)
Recomendação prática:
- **Frontend (HTML/CSS/JS)**: hospede estático (Netlify/Vercel/Cloudflare Pages).
- **Backend (Node + MySQL)**: Render/Fly.io/Railway/VM, com variáveis de ambiente.
- **Banco (MySQL)**: serviço gerenciado (PlanetScale não é MySQL “puro”; prefira RDS/Aiven/Render/Railway) ou container.

### Railway (tudo em 1 domínio)
Este projeto está preparado para rodar **frontend + backend** no mesmo serviço (o backend serve os arquivos do frontend).

1. Crie um serviço no Railway apontando para este repositório (raiz).
2. Crie um **MySQL** no Railway no mesmo projeto.
3. Configure as variáveis de ambiente do serviço (use `backend/.env.example` como base).
4. Rotas do site:
   - `/` (login/cadastro)
   - `/app` (plataforma)
   - `/profile` (perfil)

### Subir com Docker (rápido)
Na raiz do projeto:

```bash
docker compose up --build
```

App (frontend + backend): `http://localhost:3000/`

### Variáveis de ambiente
Use `backend/.env.example` como base (não versionar segredos).

## Configuração do MySQL
O backend cria as tabelas necessárias automaticamente. Antes disso, verifique se o banco e o usuário existem.

Exemplo de criação no MySQL:

```sql
CREATE DATABASE freelancehub CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'freelancehub_user'@'localhost' IDENTIFIED BY 'SUA_SENHA_AQUI';
GRANT ALL PRIVILEGES ON freelancehub.* TO 'freelancehub_user'@'localhost';
FLUSH PRIVILEGES;
```

## Endpoints principais
- `POST /auth/register` — registrar usuário
- `POST /auth/login` — fazer login
- `GET /dashboard` — dados da sessão
- `GET /marketplace/freelancers` — buscar freelancers
- `GET /marketplace/me/freelancer-profile` — ver perfil do freelancer
- `PUT /marketplace/me/freelancer-profile` — atualizar perfil do freelancer
- `POST /marketplace/messages` — enviar mensagem
- `POST /marketplace/jobs` — criar job
- `POST /marketplace/jobs/apply` — aplicar para job
- `GET /marketplace/jobs/:jobId/applications` — ver aplicações de um job
- `PUT /marketplace/jobs/applications/status` — atualizar status da aplicação

Para mais detalhes, veja o código em `backend/src/`.

## Premium (assinatura)
O backend já tem endpoints para **assinar Premium via Stripe** e middleware que bloqueia rotas Premium.

- `POST /billing/checkout-session` (auth) → body `{ "planType": "freelancer" | "client" }` e retorna `{ url }` do Stripe Checkout
- `POST /billing/portal` (auth) → retorna `{ url }` do Portal do Stripe
- `POST /billing/webhook` (Stripe) → mantém status da assinatura no banco
- `GET /billing/status` (auth) → retorna status premium por tipo (freelancer/client)

Configuração necessária no `.env` do backend:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_FREELANCER`
- `STRIPE_PRICE_ID_CLIENT`
- `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` / `STRIPE_PORTAL_RETURN_URL`
- (Jobs) `STRIPE_JOB_SUCCESS_URL` / `STRIPE_JOB_CANCEL_URL` (opcional)

Rotas atualmente marcadas como Premium:
- Mensagens: `POST /marketplace/messages` e `GET /marketplace/messages`

Regras Premium implementadas:
- **Freelancer Premium** recebe notificação de novo job imediatamente; usuário comum recebe com atraso (padrão: 24h).
- **Cliente Premium** tem jobs com destaque na listagem para freelancers (boost de ordenação).
- **Freelancer comum** tem limite de trabalhos em andamento (padrão: 3); freelancer Premium não tem limite.
- **Cliente** pode concluir trabalho em andamento (marca `completed`).

Variáveis:
- `PREMIUM_FREELANCER_NOTIFICATION_DELAY_HOURS` (padrão: 24)
- `JOB_PREMIUM_BOOST_HOURS` (padrão: 24)
- `FREELANCER_MAX_CONCURRENT_JOBS` (padrão: 3)

## Contribuindo
- Abra issues para bugs ou sugestões
- Faça branches com nomes claros como `feature/...` ou `fix/...`
- Envie pull requests com mudanças pequenas e organizadas

## Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
