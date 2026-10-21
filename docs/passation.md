# Passation : contexte global du prototype 2

À lire en premier par tout agent qui reprend le projet. État au 16 octobre 2026, après la fusion de la vague 0
dans `prototype-2` (PR #2). À compléter à chaque fin de vague.

## 1. Où on en est

| Vague | Contenu | État |
| --- | --- | --- |
| 0 Socle | Back-end `noyau` + `comptes`, site public (`partage` + module `compte`), tableau de bord (`connexion`, `equipe`, `clients`) | **Terminée, validée, fusionnée** |
| Multilingue | Français (référence), anglais, chinois, allemand, japonais (`docs/decisions/7-multilingue.md`) | **Terminée, validée, fusionnée** |
| 1 Vitrine | `catalogue`, `vitrine`, `actualites`, `contenus` (back-end, site, tableau de bord) | **Terminée, validée, fusionnée** |
| 2 Commande | `selection`, `commandes`, `devis`, `contact` | **Terminée, validée, fusionnée** |
| 3 Échanges | `messagerie`, `appels`, `notifications`, intégrations `jaas` et `gmail` | **Terminée, validée, fusionnée** |
| 4 Argent et pilotage | `paiements`, `statistiques`, intégration `campay` | **Terminée, validée, fusionnée** |
| 5 IA | `assistant`, intégration `gemini` | **Terminée, validée, fusionnée** (21 octobre 2026) |

Chaque vague a son contrat d'API (`docs/taches/vague-<n>-contrat-api.md`) et ses décisions (`docs/decisions/`).
Les six vagues sont faites : il reste le déploiement et les confirmations avec de vraies clés (voir « Reste à faire »).

Le détail de chaque vague est dans `docs/taches/vague-<n>.md` (cases à cocher). L'architecture complète
(arborescence, modules, choix agentique pour l'assistant) est dans `docs/architecture.md`.

Tests au moment de la passation, tous verts :
- back-end : 1352 tests, dont ceux des intégrations (`cd backend && python manage.py test`, sans `--parallel`) ;
  vérifiés aussi sur PostgreSQL 16 ;
- site : 514 tests (`cd frontend/site && npm test`, build par `npm run build`) ;
- tableau de bord : 506 tests (`cd frontend/tableau-de-bord && npm test`).

Le back-end a besoin d'un environnement virtuel : `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
(dépendances dans `backend/requirements.txt`), puis `cp .env.example .env` (le fichier `.env` n'est jamais versionné).

## 2. Décisions prises avec le client (jeff)

- Repartir de zéro sur `prototype-2` ; `prototype-1` reste intact comme référence, on ne supprime rien.
- Stack : React (Vite) + Django, les deux sur Railway ; domaine revelation-sarl.com acheté sur Vercel.
  Sous-domaines prévus : `revelation-sarl.com` (site), `admin.revelation-sarl.com` (tableau de bord),
  `api.revelation-sarl.com` (back-end).
- Services : CamPay (MTN et Orange Money), Jitsi JaaS (appels), API Gmail (e-mails), **API Gemini** pour
  l'assistant IA (pas Claude).
- Architecture agentique de l'application : option A (un seul assistant client avec des outils en lecture
  seule) plus une partie de l'option C (agent de fond qui prépare des brouillons de réponse pour l'équipe).
  L'assistant ne fixe aucun prix ferme, ne signe rien, ne déclenche aucun paiement.
- Numéros de contact validés : +237 6 99 81 16 35, +237 6 78 82 93 13, +237 6 56 43 58 46
  (`frontend/site/src/layout/coordonnees.js`).
- jeff préfère des faits vérifiés en ligne plutôt que de mémoire, et des réponses courtes en français.

## 3. Méthode de travail des agents (à reproduire à l'identique)

Le principe demandé par jeff : **chaque agent qui code a un agent testeur**, chacun a ses tâches écrites et
sa propre fenêtre de contexte. Les définitions sont dans `.claude/agents/` :

| Agent qui code | Zone | Agent testeur |
| --- | --- | --- |
| `backend` | `backend/apps/`, `backend/config/` | `backend-testeur` |
| `integrations` | `backend/integrations/` (CamPay, JaaS, Gmail, Gemini) | `integrations-testeur` |
| `site` | `frontend/site/`, `frontend/partage/` | `site-testeur` |
| `tableau-de-bord` | `frontend/tableau-de-bord/` | `tableau-de-bord-testeur` |

Déroulé d'une vague, tel qu'il a été suivi pour la vague 0 :

1. L'agent principal (l'orchestrateur) lit la fiche `docs/taches/vague-<n>.md`, les README des modules et le
   cahier des charges (`docs/cahier-des-charges/cahier-des-charges-cir.tex`).
2. Il lance d'abord l'agent `backend` (en arrière-plan) et lui demande, en fin de rapport, le **contrat d'API
   exact** : chaque URL publique et admin, méthode, filtres, noms de champs JSON.
3. Avec ce contrat, il lance en parallèle `site` et `tableau-de-bord` (et `integrations` si la vague en a).
   Ne jamais deviner les noms de champs : la vague 0 a montré qu'un contrat inventé (champs en anglais)
   provoque des erreurs.
4. Quand un agent rend son rapport : l'orchestrateur relance lui-même les tests, commite **seulement la zone
   de cet agent**, puis lance son testeur.
5. Le testeur relit (erreurs, règles métier, sécurité, accessibilité), écrit les tests manquants **sans
   toucher au code applicatif**, les lance, et rend **VALIDÉ** ou **À CORRIGER** avec fichier:ligne et sortie.
6. Si À CORRIGER : l'orchestrateur renvoie la liste à l'agent qui code (en reprenant le même agent pour
   garder son contexte), qui corrige sans modifier les tests du testeur ; puis le testeur revérifie.
   On boucle jusqu'à VALIDÉ.
7. En fin de vague : cocher la fiche de la vague et les lignes « Tests » des README, mettre à jour ce fichier,
   ouvrir une PR vers `prototype-2` (une par vague, ou par module si la vague est grande).

Règles pour les sous-agents : pas de commit ni de push (c'est l'orchestrateur qui commite), ne toucher qu'à
sa zone, décrire dans le rapport tout changement nécessaire ailleurs, tout écrire en français.

## 4. Conventions déjà en place dans le code

- **Champs d'API en français** : `email`, `mot_de_passe`, `nom_complet`, `telephone`, `ville`, `quartier`,
  `rue_ou_repere`, `adresse_complete` (booléen), `adresse_formatee` (texte), `derniere_connexion`, `actif`.
  Jetons JWT : `acces`, `rafraichissement`.
- Rôles : `client`, `membre`, `super_admin`. Permissions dans `apps/noyau/permissions.py` : `EstEquipe`,
  `EstSuperAdmin`, `LectureSeule`.
- Pagination : 24 par page, `?taille=` jusqu'à 100, `?page=`.
- Connexion du site : `/api/comptes/connexion/` ; connexion du tableau de bord : `/api/admin/comptes/connexion/`
  (refuse les clients en 403). `/api/admin/comptes/equipe/` est réservé au super-admin (liste comprise).
- Images : `optimiser_champ_image` (module `noyau`) convertit en WebP et lève `ImageInvalide` au-delà de 10 Mo,
  40 mégapixels ou pour un fichier illisible. **Les sérialiseurs des vagues suivantes doivent la transformer
  en erreur de validation 400**, sinon elle donne une erreur 500.
- Front-end : `@partage/api/client.js` (`creerClientApi`, `ErreurApi`), jetons rangés sous `cir-site` (site)
  et `cir-tdb` (tableau de bord), jamais mélangés. `@partage/styles/jetons.css` (couleurs CIR,
  `--cible-tactile: 44px`). Pages chargées à la demande.
- Retour après connexion (`?suite=`) : refuser tout ce qui ne commence pas par un seul `/`, l'antislash et les
  caractères de contrôle (faille `/%09/` trouvée par les testeurs).
- Le tableau de bord n'est jamais lié depuis le site et n'est pas indexé (noindex, robots.txt, X-Frame-Options).

## 5. Points ouverts

- **Railway** : les services ne sont pas encore créés. Back-end : root directory `/backend`, config
  `/backend/railway.toml`. Site et tableau de bord : root directory vide, config
  `/frontend/<app>/railway.toml` (Dockerfile construit depuis la racine du dépôt car ils importent `partage`).
  Variables : voir les `.env.example`. `DJANGO_NOMBRE_PROXIES` vaut 1 par défaut en production.
- **Redis en production** : nécessaire pour que les compteurs de blocage de connexion soient communs à tous
  les processus (et pour Channels en vague 3).
- **Blocage de connexion** : 5 échecs par e-mail bloquent le compte 15 minutes, même si les tentatives viennent
  d'un tiers ; compteur par IP à 20 échecs. Un déblocage par e-mail pourra être ajouté si ça gêne.
- **Page Équipe** : réservée au super-admin ; à ouvrir en lecture aux membres si jeff le demande.
- **Accueil du tableau de bord** : provisoire, remplacé par le module `statistiques` en vague 4.

## 6. Prochaine étape : vague 1

Suivre la section 3 avec la fiche `docs/taches/vague-1.md`. Consignes déjà préparées pour l'agent `backend` :
- `catalogue` : familles, produits (maison, industrie, entreprise, type de bâtiment), designs et couleurs,
  prix facultatif avec unité (absent = « Prix sur devis », jamais inventé), fiche technique, plan de coupe
  (couches), filtres famille et type de bâtiment, recherche, slugs, publié ou brouillon.
- `vitrine` : réalisations avec photos avant/après, démos vidéo, témoignages de clients connectés visibles
  seulement après modération par l'équipe.
- `actualites` : nouveautés et autres produits de l'entreprise, publiées ou brouillons.
- `contenus` : textes et médias de l'accueil (vidéo de fond jouée une fois, photos de la sphère, bandeaux),
  lus par clé.
- Aucune donnée de démonstration inventée (produits, prix, témoignages, noms de clients).


## Reste à faire (après la vague 5, 21 octobre 2026)

- **Railway** : saisir les clés dans les variables de chaque service (jamais dans le dépôt) : JaaS, Gmail, CamPay, Gemini
  (liste dans `backend/.env.example`) ; créer le service « worker » (`python manage.py envoyer_emails --boucle`),
  les volumes (médias et pièces jointes privées `DJANGO_PRIVATE_ROOT`) et Redis ; adresse du webhook CamPay
  `<API_URL_PUBLIQUE>/api/paiements/webhooks/campay/`.
- **Confirmations avec de vraies clés** (le réseau n'était pas disponible pendant le développement) : format des
  réponses et webhooks CamPay (essai sur `demo.campay.net`), webhooks JaaS, API Gemini ; rejouer les 35 cas de
  `backend/agents/evaluations/` avec `python manage.py evaluer_assistant`.
- **Offre Gemini** : l'offre gratuite peut réutiliser les échanges ; prévoir l'offre payante en production
  (`docs/decisions/10-assistant-ia.md`).
- **Traductions** : anglais, chinois, allemand et japonais sont des traductions de travail, à faire relire par des
  locuteurs.
- Sitemap non fait ; pas de PDF pour les devis et contrats (feuille de style d'impression seulement).
