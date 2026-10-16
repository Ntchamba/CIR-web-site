# 7. Plateforme multilingue : français, anglais, chinois, allemand, japonais

16 octobre 2026.

## Contexte

Le CIR vend à Douala, mais son fabricant partenaire (Jiuye) et une partie de ses visiteurs et clients
(entreprises, industriels, expatriés) ne lisent pas le français. Le propriétaire demande une version de la
plateforme en plusieurs langues : **français, anglais, chinois, allemand, japonais**.

## Choix

1. **Cinq langues**, le **français reste la langue de référence** : tout texte existe d'abord en français
   et sert de secours si une traduction manque. Codes courts partout : `fr`, `en`, `zh` (chinois
   simplifié), `de`, `ja`. Django nomme le chinois `zh-hans` : `apps/noyau/langues.py` fait la correspondance.
2. **Interface (site et tableau de bord)** : moteur de traduction maison dans `frontend/partage/i18n/`,
   sans bibliothèque (quelques dizaines de lignes, pluriels et nombres par `Intl`). Un fichier de textes
   par langue et par application ; seul le français est chargé avec l'application, les autres langues sont
   chargées à la demande (environ 2 Ko compressés chacune, BNF-02).
3. **Choix de la langue** : liste dans l'en-tête et le pied de page (site), dans l'en-tête et sur la page
   de connexion (tableau de bord). Chaque langue est écrite dans sa propre langue (« 日本語 »).
   Langue à l'ouverture : paramètre `?lang=` de l'adresse, puis choix déjà fait dans ce navigateur, puis
   langues du navigateur, puis le français. Pas de préfixe de langue dans les adresses (`/en/…`) à ce stade :
   le site est une application React rendue dans le navigateur ; à revoir si le référencement par langue
   devient prioritaire (voir « Suites »).
4. **API** : le navigateur envoie `Accept-Language` ; `LocaleMiddleware` répond dans cette langue (messages
   d'erreur, validations de Django et DRF, déjà traduits par ces bibliothèques). Les messages propres au
   CIR sont écrits en français dans le code (`_("…")`) et traduits dans `backend/locale/*/django.po`.
   `python manage.py compiler_traductions` compile les `.mo` sans les outils GNU gettext (absents des
   images Railway) ; un test échoue si un message n'est pas traduit ou si un `.mo` n'est pas recompilé.
5. **Langue préférée du compte** (`Utilisateur.langue`) : fixée à l'inscription (langue de l'interface),
   mise à jour quand un client ou un membre connecté change de langue. Elle servira aux e-mails (vague 3,
   module `notifications`) et elle est affichée à l'équipe sur la fiche du client.
6. **Contenu saisi par l'équipe** (catalogue, réalisations, actualités, contenus, à partir de la vague 1) :
   le français reste dans les champs habituels ; les autres langues vont dans un champ JSON `traductions`
   (`{"en": {"nom": "…"}, "zh": {…}}`). Outils communs dans `apps/noyau/traductions.py` : l'API publique
   renvoie chaque champ dans la langue de la requête, avec le français en secours ; l'API du tableau de bord
   reçoit et contrôle les traductions et signale les langues incomplètes. Ajouter une langue ne demande
   aucune migration.
7. **Chinois et japonais** : Lora et Figtree n'ont pas ces caractères ; les polices du système prennent
   le relais (aucun téléchargement de police supplémentaire), voir `frontend/partage/styles/jetons.css`.

## Conséquences

- Tout nouveau texte visible passe par `t('clé')` (front-end) ou `_("…")` (back-end), avec sa traduction
  dans les quatre autres langues. Les tests vérifient que chaque fichier de langue a les mêmes clés et les
  mêmes variables que le français.
- Les traductions de l'interface ont été rédigées à partir du français ; une relecture par un locuteur
  natif (chinois, allemand, japonais) est conseillée avant l'ouverture au public.
- Jamais de traduction inventée pour les noms propres (Jiuye, noms de quartiers, noms de clients).

## Suites possibles

- Adresses par langue (`revelation-sarl.com/en/…`) et balises `hreflang` si le référencement à l'étranger
  devient un objectif (demande un rendu côté serveur ou un pré-rendu).
- Aide à la traduction du contenu par l'assistant IA (Gemini) dans le tableau de bord, toujours relue par
  l'équipe avant publication (vague 5).
