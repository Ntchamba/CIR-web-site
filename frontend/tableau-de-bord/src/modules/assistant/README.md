# Module `assistant` (tableau de bord)

**Vague 5, Intelligence artificielle** · Besoins : O1, O4

Gabarit commun : <Module>Page.jsx, composants/, api.js, use<Module>.js, <Module>.module.css

Fichiers :

- [x] `AssistantEquipe.jsx` : page `/assistant` (onglets Brouillons et Statut et usage)
- [x] `JournalAssistant.jsx` : page `/assistant/journal` (journal ; conversations réservées au super-administrateur)
- [x] `api.js`, `useAssistant.js`, `erreurs.js`, `Assistant.module.css`
- [x] `composants/BoutonBrouillonIA.jsx` : bouton réutilisable et volet du brouillon (jamais appliqué sans geste)
- [x] `composants/TiroirBrouillon.jsx`, `StatutUsage.jsx`, `ConversationsAssistant.jsx`, `NavigationAssistant.jsx`
- [x] Points d'entrée : détail d'une demande de contact, fil de messagerie, `OngletsLangues` (traductions)
- [x] Menu « Assistant IA » dans « Pilotage » (plus de section « À venir »)
- [x] Textes dans les cinq fichiers `src/i18n/*.js` (clé `assistant`)
- [x] Tests : `Assistant.test.jsx` (API simulée)

Règles : un brouillon est une proposition à relire. « Copier… » est un geste volontaire ; l'enregistrement, l'envoi ou la
publication restent les actions habituelles de chaque écran. Le bouton est masqué si `statut/` ne renvoie pas `configure: true`.

Tâches : agent `tableau-de-bord`, vérifiées par `tableau-de-bord-testeur` (tests Vitest + Testing Library).
