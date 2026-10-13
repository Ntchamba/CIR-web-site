# Contexte du projet CIR (historique et décisions)

Ce document résume les échanges avec le propriétaire (Ntchamba, Douala) avant le premier prototype.
Il sert à un agent ou un développeur qui reprend le projet sans avoir suivi ces échanges.

## 1. L'entreprise et le besoin

- **Complexe Industriel Révélation SARL (CIR)**, Douala, Cameroun. Vend et pose des revêtements de sol
  en résine époxy pour **maisons, industries et entreprises**, en Afrique centrale.
- Partenaire fabricant : **Jiuye** (catalogue de produits : finitions autolissantes, sable coloré,
  terrazzo, antidérapant, anti-UV, haute résistance, anticorrosion, primaires…). Logo affiché dans le
  pied de page.
- Contacts du catalogue : téléphone (00237) 678 829 313, WhatsApp (00237) 622 191 931.
- Le **cahier des charges** complet est dans `docs/cahier-des-charges/` (PDF et source LaTeX, v1.2) :
  besoins fonctionnels BF-01 à BF-17, non fonctionnels BNF-01 à BNF-10, architecture, points à préciser.

## 2. Étapes déjà faites

1. Cahier des charges (LaTeX/PDF).
2. Wireframes, puis maquette complète (desktop, mobile, dashboard) sur claude.ai.
3. Paquet de démonstration de la vue téléphone : `docs/reference/maquette-telephone.html`.
4. Prototype 1 (ce dépôt) : back-end, site, dashboard, images WebP.

## 3. Décisions de design prises avec le propriétaire

- Navigation : **Accueil, Catalogue, Réalisations, Contact, Mes commandes**, bouton **Se connecter**.
  Retirés à sa demande : « Nouveautés » et « Ma sélection » de la barre (la sélection reste accessible
  depuis la fiche produit et la nouvelle commande ; les nouveautés sont une section de l'accueil).
- Accueil inspiré d'une référence « Bornate » : titre à gauche, objet central = **sphère CSS 3D de
  photos**. Au survol d'une photo : la rotation s'arrête, la photo s'agrandit ; un clic ouvre l'article.
- Vidéo de fond de l'accueil : **visible, sans voile blanc** ; **jouée une seule fois** (pas en boucle),
  rejouée à chaque rechargement ou retour sur l'accueil ; zones de texte **légèrement assombries** à
  gauche, côté sphère laissé clair.
- Les deux cartes « Maison » / « Industrie » qui étaient sur le haut de l'accueil ont été **retirées**.
- Catalogue inspiré d'une référence « Willow » : vignettes carrées, titres légers, barre de filtres
  légère (type de bâtiment, famille).
- Article inspiré d'une référence « Cocktail » : grande image sur fond flouté ; un clic ouvre un
  **panneau à droite** avec le plus d'actions possible (commander, sélectionner, négocier, message,
  WhatsApp, appeler, rendu particulier, devis, visite, fiche technique, réalisations, démo).
- Contact : section en bas de l'accueil (fond sombre).
- Pied de page avec le logo du partenaire Jiuye.
- Police **Lora** demandée explicitement (titres).
- Fond de **toutes les pages** : l'image de la maison de la fin de la vidéo, avec un **léger flou blanc**
  pour garder le contenu lisible (sauf le haut de l'accueil).
- Catalogue, Réalisations, Mes commandes : bandeau photo **qui passe sous la barre de navigation**.
- Mobile : navigation au téléphone avec barre d'onglets en bas et boutons dans l'en-tête.
- Images : **éclaircies fortement** et converties en **WebP très légers**, objectif de chargement
  global 300 à 500 ms.

## 4. Décisions techniques

- Front-end **React**, back-end **Django**, dashboard **application séparée** (« porte dérobée » dans la
  demande initiale : adresse distincte, réservée à l'équipe).
- API REST (DRF), JWT, PostgreSQL ; Channels pour la messagerie instantanée.
- Délai de chargement : la demande initiale disait « 3 millisecondes » ; le cahier retient 3 secondes
  comme exigence, et le propriétaire vise en pratique 300 à 500 ms.

## 5. Décisions sur les fonctions de communication et de paiement (13 octobre 2026)

| Fonction | Décision | État |
|---|---|---|
| Paiement | **Par compte bancaire**, plus tard | Emplacement réservé, « Bientôt disponible » |
| Appels | Plusieurs options : téléphonie locale (Orange, MTN) et internationale, surtout en Afrique ; plus tard | Emplacement réservé |
| E-mails via Gmail | Formulaire de contact et notifications par e-mail : plus tard | `notifications.notifier()` journalise seulement |
| Messagerie instantanée | **Tout de suite**, échanges au jour le jour client ↔ équipe | Développée (WebSocket) |
| Formulaire de contact | Enregistré et visible dans le dashboard | Développé |

## 6. Questions encore ouvertes (à confirmer avec le propriétaire)

- Prix réels par produit et unité (m², kg, pose comprise) : non fournis → « Prix sur devis ».
- Gamme réellement commercialisée parmi le catalogue Jiuye ; références exactes.
- Accord de Jiuye pour l'usage de son logo et de ses images.
- Langues : français seul, ou aussi anglais.
- Rôle exact du bouton « Sélectionner ce produit » maintenant que « Ma sélection » n'est plus dans la
  barre (actuellement : la sélection alimente la nouvelle commande ; icône cœur avec compteur dans
  l'en-tête quand elle n'est pas vide).
- Hébergement et nom de domaine : à définir.
- Adresse Gmail de l'entreprise pour les e-mails (module à venir).
