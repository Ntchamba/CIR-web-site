# Module `connexion` (tableau de bord)

**Vague 0, Socle** · Besoins : BF-08, BF-17, BNF-01, BNF-06

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- `ConnexionPage.jsx` : formulaire e-mail + mot de passe, retour à la page demandée (`?suite=`, `suite.js`)
- `RouteEquipe.jsx` : pages réservées à l’équipe ; `<RouteEquipe superAdmin>` pour le super-administrateur
- `AuthContext.jsx` : `AuthProvider` et `useAuth()` → `{ utilisateur, pret, connecte, superAdmin, seConnecter, seDeconnecter }`
- `api.js` : `POST /api/admin/comptes/connexion/` (403 pour un client), `GET /api/comptes/moi/`, déconnexion
- `roles.js` : rôles `membre` / `super_admin`, libellés, `estEquipe`, `estSuperAdmin`
- `validation.js`, `Connexion.module.css`

Tâches :

- [x] Page de connexion de l’équipe (route `/api/admin/comptes/connexion/`, message du serveur en français)
- [x] Contexte d’authentification : session restaurée au rechargement, compte non-équipe écarté, déconnexion
      (liste noire du jeton) même si le serveur est injoignable, déconnexion suivie entre onglets
- [x] Route réservée à l’équipe (renvoi vers `/connexion?suite=…`) et variante super-administrateur
- [x] Tests Vitest + Testing Library (agent `tableau-de-bord-testeur`)
