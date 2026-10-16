// Shared messages (frontend/partage): English.
export default {
  commun: {
    chargement: 'Loading…',
    reessayer: 'Try again',
    erreurInconnue: 'Something went wrong. Please try again.',
  },
  erreurs: {
    reseau: 'Unable to reach the server. Check your Internet connection and try again.',
    s400: 'Some information is incorrect. Please check the form.',
    s401: 'Your session has expired. Please sign in again.',
    s403: 'You do not have access to this action.',
    s404: 'Item not found.',
    s413: 'The file you sent is too large.',
    s429: 'Too many attempts. Please try again in a few minutes.',
    s501: 'Coming soon.',
    s5xx: 'The server is having a problem. Please try again shortly.',
    defaut: 'Something went wrong. Please try again.',
  },
  format: {
    devise: 'FCFA',
    prixSurDevis: 'Price on quotation',
    unites: { m2: 'FCFA / m²', kg: 'FCFA / kg', pose: 'FCFA / m², installation included' },
    dateHeure: '{date} at {heure}',
    depuis: {
      instant: 'just now',
      minutes: '{n} min ago',
      heures: '{n} h ago',
      hier: 'yesterday',
      jours: '{n} days ago',
    },
  },
  statuts: {
    nouvelle: 'New',
    negociation: 'Under negotiation',
    contrat_signe: 'Contract signed',
    travaux: 'Work in progress',
    terminee: 'Completed',
    annulee: 'Cancelled',
  },
  langue: {
    libelle: 'Language',
    choisir: 'Choose language',
  },
};
