# 1) Builder: compila a app Vite
FROM node:20-alpine AS builder
WORKDIR /app

# Instala dependências (usa cache de camadas)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    else npm i; fi

# Copia o código
COPY . .

# Args de build para Vite (VITE_* são embutidos no build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

# Build (saída em dist/)
RUN npm run build

# 2) Runtime: Nginx estático com fallback SPA
FROM nginx:alpine AS runtime
WORKDIR /usr/share/nginx/html

# Copia artefatos
COPY --from=builder /app/dist ./
# Config SPA (fallback para /index.html)
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]