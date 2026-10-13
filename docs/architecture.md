# Architecture de l'application CIR

L'application est découpée en **trois applications** qui partagent **un seul back-end** :

```
 Visiteurs et clients ──► frontend/site        (React, port 5173) ─┐
                                                                   ├──► backend (Django + API, port 8000) ──► PostgreSQL
 Équipe du CIR ─────────► frontend/dashboard   (React, port 5174) ─┘        │
                                                                            └── WebSocket : messagerie instantanée
```

- Le **site public** et le **tableau de bord** sont deux applications séparées : le dashboard n'est pas
  visible depuis le site, il a sa propre adresse et n'accepte que les comptes de l'équipe.
- L'API publique est sous `/api/…`, l'API du dashboard sous `/api/admin/…` (comptes `is_staff`
  uniquement), la messagerie instantanée sous `/ws/…`.

## Correspondance entre les besoins et les modules

Chaque besoin fonctionnel (BF) du cahier des charges correspond à un module, côté back-end et côté
front-end.

| Besoin | Fonction | Back-end (`backend/apps/`) | Site (`frontend/site/src/modules/`) | Dashboard (`frontend/dashboard/src/modules/`) |
|---|---|---|---|---|
| BF-01 | Catalogue des produits | `catalog` | `catalogue` | `catalogue` |
| BF-02 | Réalisations | `showcase` | `realisations` | `contenus` |
| BF-03 | Démonstrations | `showcase` | `realisations` | `contenus` |
| BF-04 | Témoignages | `showcase` | `accueil`, `realisations` | `contenus` |
| BF-05 | Prix | `catalog` | `catalogue`, `produit` | `catalogue` |
| BF-06 | Détails techniques | `catalog` | `produit` | `catalogue` |
| BF-07 | Nouveautés | `news` | `nouveautes` (sur l'accueil) | `contenus` |
| BF-08 | Inscription et connexion | `accounts` | `compte` | `auth` |
| BF-09 | Sélection de catalogues | `selection` | `selection` | — |
| BF-10 | Passage de commande | `orders` | `commandes` | `commandes` |
| BF-11 | Contact et design sur mesure | `contact` | `contact` | `commandes` (demandes) |
| BF-12 | Négociation | `orders` | `commandes` | `commandes` |
| BF-13 | Suivi de commande | `orders` | `commandes` | `commandes` |
| BF-14 | Gestion du catalogue | `catalog` | — | `catalogue` |
| BF-15 | Gestion des contenus | `site_content`, `showcase`, `news` | `accueil` | `contenus` |
| BF-16 | Gestion des commandes | `orders` | — | `commandes` |
| BF-17 | Gestion des utilisateurs | `accounts` | — | `clients`, `equipe` |
| — | Messagerie instantanée | `messaging` | `messagerie` | `messagerie` |
| — | Statistiques | `dashboard` | — | `tableau-de-bord` |
| **À venir** | E-mails (Gmail) | `notifications` | — | — |
| **À venir** | Paiement par compte bancaire | `payments` | `paiement` | `paiements` |
| **À venir** | Appels (local et international) | `telephony` | `appels` | `appels` |

## Organisation d'un module back-end

```
backend/apps/<module>/
├── models.py        données (tables)
├── serializers.py   conversion en JSON et validation
├── services.py      règles métier (quand il y en a : commandes, messagerie…)
├── views.py         points d'accès de l'API (publics et dashboard)
├── urls.py          routes publiques        → /api/<module>/
├── urls_admin.py    routes du dashboard     → /api/admin/<module>/
├── admin.py         administration technique Django (adresse cachée)
├── tests.py         tests automatiques
└── migrations/
```

## Organisation d'un module front-end

```
src/modules/<module>/
├── <Module>Page.jsx         page (une route)
├── components/              composants propres au module
├── api.js                   appels à l'API du module
└── *.module.css             styles du module (CSS Modules)
```

Les éléments communs aux deux applications (couleurs, polices, client HTTP, client WebSocket) sont
dans `frontend/shared/`.

## Règles importantes

- **Commande** : un client ne peut commander qu'après s'être inscrit **et** avoir donné son adresse
  (vérifié par le back-end, `apps/orders/services.py`).
- **Négociation** : l'équipe et le client s'échangent des propositions ; l'acceptation fait passer la
  commande à « Contrat signé » et fixe le montant convenu.
- **Étapes d'une commande** : Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée.
- **Sécurité** : mots de passe hachés, jetons JWT (30 min, renouvelés), blocage 15 min après 5 essais
  de connexion incorrects, API du dashboard réservée à l'équipe, HTTPS obligatoire en production.
- **Images** : toute image envoyée depuis le dashboard est réduite et convertie en WebP par le
  back-end (`apps/core/images.py`).
