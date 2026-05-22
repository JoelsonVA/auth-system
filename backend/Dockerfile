FROM node:20-alpine

WORKDIR /app

# Instalar dependências do backend (monorepo sem package.json na raiz)
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci --omit=dev

# Backend
COPY backend/src ./backend/src

# Frontend (servido pelo Express)
# Copy all HTML files from root
COPY *.html ./

# Copy frontend assets
COPY scripts ./scripts
COPY styles ./styles
COPY *.jpg *.png ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "backend/src/server.js"]
