# Back-end CIR (Django)

API REST (Django REST Framework), authentification JWT, messagerie instantanée (Django Channels).
Installation et lancement : voir le [README principal](../README.md#1-back-end).

## Commandes utiles

| Commande | Rôle |
|---|---|
| `python manage.py runserver` | serveur de développement (HTTP + WebSocket grâce à Daphne) |
| `python manage.py migrate` | crée ou met à jour les tables |
| `python manage.py seed_demo` | catalogue, réalisations, sphère, comptes de démonstration |
| `python manage.py seed_demo --sans-demo` | idem, sans client ni commande d'exemple |
| `python manage.py createsuperuser` | nouveau compte administrateur |
| `python manage.py test apps` | tests automatiques |

## Réglages

- `config/settings/base.py` : réglages communs ; `dev.py` : développement ; `prod.py` : production
  (refuse de démarrer sans clé secrète solide, PostgreSQL et Redis).
- Variables d'environnement : `.env` (modèle : `.env.example`).

## Production (repères)

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod
python manage.py collectstatic --noinput
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application   # derrière un proxy HTTPS (Nginx, Caddy…)
```
Les fichiers envoyés (`media/`) doivent être sauvegardés avec la base de données (BNF-08).
