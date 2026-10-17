# Instructions pour les agents Claude (prototype 2)

Branche de travail : `prototype-2`. `prototype-1` reste intact, comme référence.
Document d'architecture : `docs/architecture.md`. Fiches de tâches : `docs/taches/vague-<n>.md`.
**À lire en premier pour reprendre le projet : `docs/passation.md`** (état, décisions, méthode des agents).

## Le projet

Application web du **Complexe Industriel Révélation SARL (CIR)**, Douala (Cameroun) : vitrine, catalogue et
prise de commande de revêtements de sol en **résine époxy** (partenaire fabricant : **Jiuye**) pour la maison,
l'industrie et l'entreprise. Cahier des charges : `docs/cahier-des-charges/` (BF-01 à BF-17, BNF-01 à BNF-10).

- `backend/` : Django 5.2 LTS, Django REST Framework, Channels, JWT, PostgreSQL (SQLite en dev).
- `frontend/site/` : site public React + Vite. `frontend/tableau-de-bord/` : application séparée de l'équipe.
- `frontend/partage/` : client API, jetons de style, composants de base.
- Services : CamPay (paiement), Jitsi JaaS (appels), API Gmail (e-mails), API Gemini (assistant IA).
- Hébergement : Railway (un service par application), domaine revelation-sarl.com.

Tout est **en français** : interface, commentaires, documentation, messages de commit.

## Organisation des agents

Chaque agent qui code a son agent testeur (`.claude/agents/`) : `backend` / `backend-testeur`,
`integrations` / `integrations-testeur`, `site` / `site-testeur`, `tableau-de-bord` / `tableau-de-bord-testeur`.
Chaque agent travaille dans sa propre fenêtre de contexte et ne touche que sa zone. Le testeur relit, écrit
et lance les tests ; un module n'est terminé que lorsque son testeur rend **VALIDÉ**.

## Règles métier

- **Commande** : impossible sans compte **et** adresse complète (ville, quartier, rue ou repère). Vérifié côté serveur.
- **Étapes** : Nouvelle → En négociation → Contrat signé → Travaux en cours → Terminée (+ Annulée).
- **Négociation** : propositions et contre-propositions (prix au m², total, délai, message) ; accepter passe en
  « Contrat signé » et fixe le montant convenu.
- **Prix** : facultatifs ; absent = « Prix sur devis ». Ne jamais inventer de prix, de témoignages ni de noms de clients.
- **Paiement** : seulement après « Contrat signé » ; une commande n'est payée qu'après revérification de la
  transaction auprès de CamPay.
- **Assistant IA** : ne fixe aucun prix ferme, ne signe rien, ne déclenche aucun paiement.
- Le tableau de bord n'est jamais lié depuis le site public et n'accepte que les comptes de l'équipe.

## Conventions

- Back-end : `apps/<module>/` avec models, serializers, views, views_admin, urls (`/api/<module>/`),
  urls_admin (`/api/admin/<module>/`), services (règles métier), permissions, tests/.
- Front-end : `src/modules/<module>/` avec `<Module>Page.jsx`, `composants/`, `api.js`, `use<Module>.js`, CSS Module.
- Design : encre `#0E2A38`, bleu `#1177A8`, corail `#FF6D4C`, fond `#F3F7F9`. Polices Lora (titres), Figtree (texte).
- Performance : images WebP légères, chargement progressif, routes chargées à la demande (viser 300 à 500 ms).
- Accessibilité : libellés de formulaires, cibles tactiles ≥ 44 px, `prefers-reduced-motion`.
- Secrets uniquement dans `.env` (jamais versionné) ; `.env.example` liste les variables.
