# Site public CIR. Contexte de construction : racine du dépôt (voir railway.toml).

# 1. Build Vite
FROM node:22-alpine AS construction
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app/frontend
COPY frontend/partage partage
COPY frontend/site/package.json frontend/site/package-lock.json site/
RUN cd site && npm ci
COPY frontend/site site
RUN cd site && npm run build

# 2. Service statique : `serve -s` renvoie index.html pour toutes les routes du site
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY frontend/site/package.json frontend/site/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=construction /app/frontend/site/dist ./dist
USER node
CMD ["sh", "-c", "npx serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
