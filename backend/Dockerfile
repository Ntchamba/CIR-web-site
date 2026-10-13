# Démo en ligne du back-end (contexte de construction : racine du dépôt).
# Réglages de développement : SQLite et messagerie en mémoire, base recréée à chaque déploiement.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=config.settings.dev
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY frontend/site/public/media/sphere frontend/site/public/media/sphere
WORKDIR /app/backend
CMD python manage.py migrate --noinput && python manage.py seed_demo \
    && daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application
