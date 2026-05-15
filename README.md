# Freelance Hub

Freelance Hub é uma plataforma SaaS para conectar contratantes e freelancers. O sistema oferece autenticação segura, perfis profissionais, busca por habilidades, gerenciamento de trabalhos (jobs) e um painel administrativo para monitoramento e gestão de usuários.

**Principais benefícios:**
- Acesso rápido para contratar ou oferecer serviços
- Perfil freelancer com campos profissionais (contato, skills, portfólio)
- Sistema de mensagens e notificações para interações em tempo próximo
- Painel administrativo para auditoria e controle de acesso

**Tecnologias:**
- Frontend: HTML5, CSS3, JavaScript (módulos ES6)
- Backend: Node.js, Express
- Banco de dados: MySQL (utilizando `mysql2` no backend)
- Autenticação: JWT (JSON Web Tokens)
- Estrutura: arquitetura RESTful para APIs

## Estrutura do repositório
- `index.html` — página de Login / Cadastro
- `app.html` — painel principal da aplicação (dashboard)
- `scripts/` — lógica do cliente (API client, páginas JS)
- `styles/` — arquivos CSS do projeto
- `backend/src/` — código do servidor Express, rotas e controladores
- `backend/.env` — variáveis de ambiente (não versionar em repositórios públicos)

## Funcionalidades principais
- Autenticação e registro com tipagem de conta (`client` ou `freelancer`)
- Dashboard com sessão do usuário (`/dashboard`)
- CRUD de perfil freelancer e endpoint para busca de profissionais
- Envio e recebimento de mensagens entre usuários
- Criação e candidatura a trabalhos (jobs)
- Notificações para mensagens, propostas e novos trabalhos
- Auditoria de acessos por meio de eventos de login

## Instalação (desenvolvimento)
1. Clone o repositório:

```bash
git clone <repo-url>
cd auth
```

2. Backend: instale dependências e configure variáveis de ambiente

```bash
cd backend
npm install
```

Crie um arquivo `.env` em `backend/` com as seguintes variáveis mínimas:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=freelancehub_user
DB_PASSWORD=REDACTED_PASSWORD
DB_NAME=freelancehub
JWT_SECRET=uma_chave_secreta
PORT=3000
```

3. Inicie o servidor backend:

```bash
cd backend
npm start
```

4. Sirva os arquivos estáticos (frontend) a partir da raiz do projeto — por exemplo usando um servidor simples:

```bash
python3 -m http.server 8000
# então acesse http://localhost:8000/index.html
```

## Banco de dados
O servidor inicializa as tabelas essenciais automaticamente (usuários, perfis freelancers, mensagens, jobs, aplicações, notificações e eventos de login). Garanta que o usuário e o banco configurados em `.env` existam e tenham permissões apropriadas.

Se preferir criar o banco manualmente no MySQL:

```sql
CREATE DATABASE freelancehub CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'freelancehub_user'@'localhost' IDENTIFIED BY 'REDACTED_PASSWORD';
GRANT ALL PRIVILEGES ON freelancehub.* TO 'freelancehub_user'@'localhost';
FLUSH PRIVILEGES;
```

## Endpoints relevantes (resumo)
- `POST /auth/register` — registrar novo usuário
- `POST /auth/login` — autenticar e receber JWT
- `GET /dashboard` — obter dados da sessão autenticada
- `GET /marketplace/freelancers` — buscar freelancers
- `GET|PUT /marketplace/me/freelancer-profile` — ler/atualizar perfil freelancer
- `POST /marketplace/messages` — enviar mensagem
- `POST /marketplace/jobs` — criar job
- `POST /marketplace/jobs/apply` — candidatar-se a job
- `/notifications` — CRUD de notificações (implementado no backend)

Consulte o código em `backend/src/` para detalhes adicionais das rotas e payloads.

## Como contribuir
- Abra issues para bugs ou melhorias
- Crie branches com nomes claros (`feature/...`, `fix/...`) e envie pull requests
- Mantenha os commits pequenos e descritivos

## Licença
Coloque aqui a licença do projeto (ex.: MIT) ou remover esta seção se não aplicável.

---

Se quiser, eu posso também:
- Adicionar exemplos de requests curl para os endpoints mais usados
- Gerar um arquivo `POSTMAN`/`HTTP` com coleções de teste
- Ajustar o README para inglês ou múltiplos idiomas

Arquivo atualizado: [README.md](README.md)
