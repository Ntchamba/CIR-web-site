# Démo en ligne : dashboard (contexte de construction : racine du dépôt).
FROM node:22-alpine AS construction
ARG VITE_API_URL
ARG VITE_SITE_URL
WORKDIR /app/frontend
COPY frontend/shared shared
COPY frontend/dashboard/package.json frontend/dashboard/package-lock.json dashboard/
RUN cd dashboard && npm ci
COPY frontend/dashboard dashboard
RUN cd dashboard && npm run build

FROM node:22-alpine
RUN npm install -g serve@14
COPY --from=construction /app/frontend/dashboard/dist /dist
CMD serve -s /dist -l ${PORT:-3000}
