"""MODULE À VENIR : paiement par compte bancaire.

Parcours prévu
1. La commande passe à « Contrat signé » (montant convenu connu).
2. Le client choisit « Payer » : le back-end crée une demande de paiement auprès de la banque
   ou de son prestataire (virement, carte), avec la référence de la commande.
3. La banque confirme le paiement par un appel serveur à serveur (webhook) ; le back-end vérifie la
   signature puis enregistre le paiement. Aucune donnée bancaire n'est stockée par le CIR.
4. L'équipe peut aussi enregistrer à la main un virement reçu, depuis le tableau de bord.

Modèles prévus : Paiement(commande, montant, moyen, reference_banque, statut, recu_le).
"""


def creer_demande_paiement(commande, montant):
    raise NotImplementedError("Paiement par compte bancaire : module à venir.")


def verifier_notification_banque(requete):
    raise NotImplementedError("Paiement par compte bancaire : module à venir.")
