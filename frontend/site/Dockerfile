# Démo en ligne : site (contexte de construction : racine du dépôt).
FROM node:22-alpine AS construction
ARG VITE_API_URL
ARG VITE_SITE_URL
WORKDIR /app/frontend
COPY frontend/shared shared
COPY frontend/site/package.json frontend/site/package-lock.json site/
RUN cd site && npm ci
COPY frontend/site site
RUN cd site && npm run build

FROM node:22-alpine
RUN npm install -g serve@14
COPY --from=construction /app/frontend/site/dist /dist
CMD serve -s /dist -l ${PORT:-3000}
