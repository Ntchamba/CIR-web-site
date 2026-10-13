# Instructions pour l'agent (Claude Code)

Lis ce fichier en entier avant de toucher au code, puis `docs/contexte-projet.md` (historique et décisions)
et `docs/architecture.md` (correspondance besoins ↔ modules).

## Le projet en bref

Application web du **Complexe Industriel Révélation SARL (CIR)**, Douala (Cameroun) : vente de
revêtements de sol en **résine époxy** (partenaire fabricant : **Jiuye**) pour la maison, l'industrie et
l'entreprise. Trois applications :

- `backend/` : Django 5.2 LTS + Django REST Framework + Channels (messagerie instantanée), JWT, PostgreSQL
  (SQLite en dev).
- `frontend/site/` : site public React 19 + Vite (port 5173).
- `frontend/dashboard/` : tableau de bord d'administration React, **application séparée** (port 5174).
- `frontend/shared/` : couleurs, polices, client API, client WebSocket, mise en forme (FCFA, dates).

Le propriétaire (Ntchamba) parle **français** : réponses, textes de l'interface, commentaires, messages
de commit et documentation **en français**. Interface sans anglicismes inutiles.

## État actuel (à lire absolument)

Le code a été écrit **sans pouvoir être exécuté** (dépendances non installables dans l'environnement
d'origine). Vérifié seulement : compilation Python et assemblage des deux applications React (esbuild,
imports et syntaxe OK). **Jamais lancé** : `pip install`, migrations, tests Django, `npm install`,
`vite build`, rendu dans un navigateur. Attends-toi à de petites erreurs au premier lancement et
corrige-les.

Ta première mission :

1. `backend/` : créer le venv, `pip install -r requirements.txt`, copier `.env.example` en `.env`,
   `python manage.py makemigrations accounts catalog showcase news site_content selection orders contact messaging`
   (les dossiers `migrations/` ne contiennent que `__init__.py`), `migrate`, `seed_demo`,
   `python manage.py test apps`. Corriger jusqu'à ce que tout passe.
2. `frontend/site/` et `frontend/dashboard/` : `package.json` n'a que les scripts. Installer :
   `npm install react react-dom react-router-dom @fontsource-variable/lora @fontsource-variable/figtree @fontsource/dm-mono`
   puis `npm install -D vite @vitejs/plugin-react`. Lancer `npm run build` dans les deux.
3. Lancer les trois serveurs et vérifier les parcours principaux (voir « Parcours à vérifier »).
4. Versionner (voir « Git »).

## Git

- Dépôt : `https://github.com/Ntchamba/CIR-web-site` (vide au départ).
- `main` : un commit initial minimal (README court + `.gitignore`), puis créer la branche **`prototype-1`**.
- Sur `prototype-1`, des commits par étape, dans cet ordre si possible :
  1. architecture (dossiers, configuration, README, docs) ;
  2. images WebP ;
  3. back-end (avec les migrations générées) ;
  4. site public (avec `package.json` et `package-lock.json`) ;
  5. tableau de bord ;
  6. corrections issues des tests.
- Ne jamais versionner : `.env`, `node_modules/`, `.venv/`, `db.sqlite3`, `backend/media/`, `dist/`
  (déjà dans `.gitignore`).

## Règles métier à respecter

- **Commande** : impossible sans compte **et** adresse complète (ville, quartier, rue/repère).
  Vérifié côté serveur (`backend/apps/orders/services.py`).
- **Étapes** : Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée (+ Annulée).
- **Négociation** : l'équipe et le client s'envoient des propositions (prix/m², total, délai,
  message) ; accepter fait passer à « Contrat signé » et fixe `montant_convenu`.
- **Prix** : facultatifs ; absent = « Prix sur devis ». Les vrais prix ne sont pas encore fournis :
  ne pas en inventer.
- Textes entre crochets `[ ]` (références, noms de clients, témoignages…) = à remplacer par l'équipe.
  Ne pas inventer de faux témoignages ni de faux noms de clients.
- Le **dashboard** n'est jamais lié depuis le site public et n'accepte que les comptes `is_staff`.

## Modules volontairement « à venir » (ne pas les développer sans demande)

- **Paiement par compte bancaire** : `backend/apps/payments`, `site/src/modules/paiement`,
  `dashboard/src/modules/paiements` → emplacements « Bientôt disponible ».
- **Appels** (téléphonie locale Orange/MTN et internationale en Afrique) : `apps/telephony`,
  `site/src/modules/appels`, `dashboard/src/modules/appels`.
- **E-mails via Gmail** (notifications, copie du formulaire de contact) : `apps/notifications/services.py`,
  qui ne fait qu'écrire dans le journal pour l'instant.
La **messagerie instantanée**, elle, est faite et doit fonctionner (WebSocket `ws/messagerie/<id>/`
et `ws/notifications/`, jeton dans `?jeton=`).

## Design (voir aussi `docs/contexte-projet.md`)

- Couleurs : encre `#0E2A38`, texte secondaire `#2F4A57`, bleu `#1177A8`, corail `#FF6D4C` (accent,
  élément actif), fond `#F3F7F9`, filets `#D5E0E6`. Jetons dans `frontend/shared/styles/tokens.css`.
- Polices : **Lora** (titres, titres de page en italique bleu), **Figtree** (texte), **DM Mono**
  (étiquettes, références). Auto-hébergées via @fontsource.
- Fond de toutes les pages : la maison de la fin de la vidéo, floutée, voile blanc 80 % (`.fond-maison`).
- Accueil : vidéo de fond jouée **une fois** (pas de boucle), rejouée à chaque visite/rechargement ;
  voile sombre à gauche pour la lisibilité ; titre « Révélation. » ; **sphère 3D de photos** à droite
  (s'arrête au survol, la photo s'agrandit, clic → produit).
- Catalogue, Réalisations, Mes commandes : grand bandeau photo sous l'en-tête **transparent**.
- Fiche produit : image sur fond flouté, panneau d'options à droite (12 actions).
- Mobile : barre d'onglets en bas (Accueil, Catalogue, Réalisations, Commandes, Compte), en-tête avec
  bouton d'appel et menu.
- Maquette de référence : `docs/reference/maquette-telephone.html` (s'ouvre dans un navigateur) et la
  maquette complète (desktop, mobile, dashboard) sur claude.ai, partagée par le propriétaire.

## Performance (exigence du propriétaire : pages très légères, viser 300 à 500 ms)

Images en WebP éclaircies (10–40 Ko), `loading="lazy"`, `srcset`, routes chargées à la demande,
préchargement de l'image de la vidéo. Toute nouvelle image passe par le même traitement ; celles
envoyées depuis le dashboard sont converties en WebP par `backend/apps/core/images.py`.

## Parcours à vérifier

1. Visiteur : accueil (vidéo, sphère cliquable), catalogue (filtres, « voir plus »), fiche produit,
   panneau d'options, ajout à la sélection, formulaire de contact.
2. Client : inscription avec adresse, sélection → nouvelle commande → détail ; envoi d'un message
   (reçu en direct côté dashboard) ; contre-proposition ; acceptation d'une proposition de l'équipe.
3. Équipe (dashboard, compte `SEED_ADMIN_EMAIL`) : statistiques, commandes (proposition, changement
   d'étape, note interne), messagerie en direct, demandes de contact, catalogue (ajout d'un produit avec
   photo), clients, contenus (sphère, réalisations, témoignages à valider, nouveautés).
4. Téléphone (largeur 390 px) : barre d'onglets, menu, pas de défilement horizontal.

## Conventions de code

- Back-end : un module par besoin (`apps/<module>/` avec `models`, `serializers`, `services`, `views`,
  `urls` publics, `urls_admin` pour `/api/admin/`). Noms en français.
- Front-end : `src/modules/<module>/` ; CSS Modules pour le site, `styles/dashboard.css` pour le
  dashboard ; composants communs dans `src/components/{layout,ui}`.
- Accessibilité : libellés de formulaires, `aria-*`, cibles tactiles ≥ 44 px, `prefers-reduced-motion`.
