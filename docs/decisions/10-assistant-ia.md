# Décision 10 : assistant IA (vague 5)

Date : 21 octobre 2026. Statut : retenue. Détails : `docs/taches/vague-5-contrat-api.md`. Complète la décision 5 (API Gemini).

## Choix

- **Deux agents** : un **conseiller** pour les clients (outils en lecture seule) et un **agent de fond** qui prépare des
  **brouillons** pour l'équipe, jamais envoyés ni publiés automatiquement.
- **Règles de CLAUDE.md garanties par le code**, pas seulement par le prompt : aucun prix ferme (seuls les prix publiés du
  catalogue peuvent être cités), aucune signature, aucun paiement, aucune écriture. Un module pur de garde-fous contrôle chaque sortie
  (montants, liens, engagements, coordonnées).
- **Outils en lecture seule, dans le contexte de l'utilisateur** ; tout identifiant donné par le modèle est revérifié.
- **Minimisation des données** : ni nom, ni e-mail, ni téléphone, ni adresse envoyés à Gemini.
- **Coûts maîtrisés** : limites par visiteur, par client et plafond global quotidien ; service absent = bulle masquée.
- **Traçabilité** : journal sans texte ni donnée personnelle ; lecture des conversations réservée au super-administrateur et journalisée ;
  conservation limitée (90 jours).
- **Évaluations** rejouables à la main avant chaque mise en ligne (`backend/agents/evaluations/`), jamais lancées par les tests.

## Conséquences

- **Offre Gemini** : l'offre gratuite de l'API peut utiliser les échanges pour améliorer les modèles de Google. Pour la production,
  prévoir l'offre payante (ou un compte avec ces données exclues) ; à décider par le propriétaire du projet avant l'ouverture au public.
- Le format exact de l'API Gemini est à confirmer avec une vraie clé ; les évaluations sont à rejouer avec elle.
- Les réponses du conseiller ne sont pas des engagements : mention visible en permanence dans l'interface.
