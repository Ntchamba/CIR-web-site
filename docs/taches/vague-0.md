# Vague 0 : Socle

Chaque paire travaille dans sa propre fenêtre de contexte : l'agent code, puis son agent testeur relit le code, écrit et lance les tests unitaires, et renvoie ses remarques jusqu'à ce que tout passe.


## Paire `backend` + `backend-testeur`
- [x] Projet Django : `pyproject.toml`, `config/settings/{base,dev,prod}.py`, `urls.py`, `asgi.py`, `routing.py`
- [x] DRF, JWT (simplejwt), CORS, Channels, WhiteNoise, PostgreSQL en prod et SQLite en dev
- [x] Module `noyau` : permissions, pagination, conversion WebP, `/api/sante/`
- [x] Module `comptes` : utilisateur par e-mail, rôles, inscription avec adresse, connexion JWT, profil, gestion de l'équipe
- [x] `railway.toml` du back-end, `.env.example`
- [x] Tests : modèles, API d'inscription et de connexion, permissions (testeur)

## Paire `site` + `site-testeur`
- [x] `frontend/partage/` : client API avec JWT, jetons CSS (couleurs et polices CIR), composants de base
- [x] `frontend/site/` : Vite + React, routes, en-tête, pied de page, barre d'onglets mobile
- [x] Module `compte` : connexion, inscription avec adresse, profil, route protégée
- [x] Tests Vitest des composants et du client API (testeur)

## Paire `tableau-de-bord` + `tableau-de-bord-testeur`
- [x] `frontend/tableau-de-bord/` : Vite + React, coque (menu, en-tête), connexion réservée à l'équipe
- [x] Module `equipe` : liste, ajout et retrait de membres (super-admin)
- [x] Tests Vitest (testeur)


Une branche et une pull request par vague (ou par module si la vague est grande), vers `prototype-2`.
