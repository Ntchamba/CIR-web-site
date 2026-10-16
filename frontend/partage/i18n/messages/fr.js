// Messages communs (frontend/partage) : français, langue de référence.
// Toute clé ajoutée ici doit l'être aussi dans en.js, zh.js, de.js et ja.js (vérifié par les tests).
export default {
  commun: {
    chargement: 'Chargement…',
    reessayer: 'Réessayer',
    erreurInconnue: 'Une erreur est survenue. Réessayez.',
  },
  erreurs: {
    reseau: 'Connexion au serveur impossible. Vérifiez votre accès à Internet et réessayez.',
    s400: 'Certaines informations sont incorrectes. Vérifiez le formulaire.',
    s401: 'Votre session a expiré. Reconnectez-vous.',
    s403: "Vous n'avez pas accès à cette action.",
    s404: 'Élément introuvable.',
    s413: 'Le fichier envoyé est trop volumineux.',
    s429: 'Trop de tentatives. Réessayez dans quelques minutes.',
    s501: 'Bientôt disponible.',
    s5xx: 'Le serveur rencontre un problème. Réessayez dans un instant.',
    defaut: 'Une erreur est survenue. Réessayez.',
  },
  format: {
    devise: 'FCFA',
    prixSurDevis: 'Prix sur devis',
    unites: { m2: 'FCFA / m²', kg: 'FCFA / kg', pose: 'FCFA / m², pose comprise' },
    dateHeure: '{date} à {heure}',
    depuis: {
      instant: "à l'instant",
      minutes: 'il y a {n} min',
      heures: 'il y a {n} h',
      hier: 'hier',
      jours: 'il y a {n} j',
    },
  },
  statuts: {
    nouvelle: 'Nouvelle',
    negociation: 'En négociation',
    contrat_signe: 'Contrat signé',
    travaux: 'Travaux en cours',
    terminee: 'Terminée',
    annulee: 'Annulée',
  },
  langue: {
    libelle: 'Langue',
    choisir: 'Choisir la langue',
  },
};
