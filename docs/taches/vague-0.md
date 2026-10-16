# Vague 0 : Socle

Chaque paire travaille dans sa propre fenêtre de contexte : l'agent code, puis son agent testeur relit le code, écrit et lance les tests unitaires, et renvoie ses remarques jusqu'à ce que tout passe.


## Paire `backend` + `backend-testeur`
- [ ] Projet Django : `pyproject.toml`, `config/settings/{base,dev,prod}.py`, `urls.py`, `asgi.py`, `routing.py`
- [ ] DRF, JWT (simplejwt), CORS, Channels, WhiteNoise, PostgreSQL en prod et SQLite en dev
- [ ] Module `noyau` : permissions, pagination, conversion WebP, `/api/sante/`
- [ ] Module `comptes` : utilisateur par e-mail, rôles, inscription avec adresse, connexion JWT, profil, gestion de l'équipe
- [ ] `railway.toml` du back-end, `.env.example`
- [ ] Tests : modèles, API d'inscription et de connexion, permissions (testeur)

## Paire `site` + `site-testeur`
- [ ] `frontend/partage/` : client API avec JWT, jetons CSS (couleurs et polices CIR), composants de base
- [ ] `frontend/site/` : Vite + React, routes, en-tête, pied de page, barre d'onglets mobile
- [ ] Module `compte` : connexion, inscription avec adresse, profil, route protégée
- [ ] Tests Vitest des composants et du client API (testeur)

## Paire `tableau-de-bord` + `tableau-de-bord-testeur`
- [ ] `frontend/tableau-de-bord/` : Vite + React, coque (menu, en-tête), connexion réservée à l'équipe
- [ ] Module `equipe` : liste, ajout et retrait de membres (super-admin)
- [ ] Tests Vitest (testeur)


Une branche et une pull request par vague (ou par module si la vague est grande), vers `prototype-2`.
