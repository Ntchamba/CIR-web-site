# Tableau de bord CIR. Contexte de construction : racine du dépôt (voir railway.toml).

# 1. Build Vite
FROM node:22-alpine AS construction
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app/frontend
COPY frontend/partage partage
COPY frontend/tableau-de-bord/package.json frontend/tableau-de-bord/package-lock.json tableau-de-bord/
RUN cd tableau-de-bord && npm ci
COPY frontend/tableau-de-bord tableau-de-bord
RUN cd tableau-de-bord && npm run build

# 2. Service statique : `serve -s` renvoie index.html pour toutes les routes ; public/serve.json ajoute
#    l’en-tête X-Robots-Tag: noindex (le tableau de bord ne doit jamais être indexé)
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY frontend/tableau-de-bord/package.json frontend/tableau-de-bord/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=construction /app/frontend/tableau-de-bord/dist ./dist
USER node
CMD ["sh", "-c", "npx serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"]
