FROM node:20-alpine

WORKDIR /app

# Instalar dependências do backend (monorepo sem package.json na raiz)
COPY backend/package.json ./backend/
RUN npm --prefix backend install --omit=dev

# Backend
COPY backend/src ./backend/src

# Frontend (servido pelo Express)
COPY index.html app.html profile.html login-freelancer.html ./
COPY scripts ./scripts
COPY styles ./styles
COPY img.jpg Demo.png ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "backend/src/server.js"]
