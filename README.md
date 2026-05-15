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

4. Abra o frontend em `index.html`. Se quiser, rode um servidor simples na raiz do projeto:

```bash
cd ..
python3 -m http.server 8000
```

Então acesse `http://localhost:8000/index.html`.

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

## Contribuindo
- Abra issues para bugs ou sugestões
- Faça branches com nomes claros como `feature/...` ou `fix/...`
- Envie pull requests com mudanças pequenas e organizadas

## Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.