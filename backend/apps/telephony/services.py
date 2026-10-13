"""MODULE À VENIR : appels entre les clients et l'équipe.

Options prévues
- Téléphonie locale : appel direct vers les numéros du CIR via Orange et MTN (Cameroun).
- Téléphonie internationale, en Afrique d'abord : même service pour les clients des autres pays,
  où Orange et MTN sont aussi les principaux opérateurs.
- Demande de rappel : le client laisse son numéro et un créneau (déjà possible via le formulaire de
  contact, objet « Être rappelé »).

Le prestataire (passerelle d'appel ou numéro virtuel) sera choisi plus tard ; il se branchera ici,
derrière une interface unique, sans changer les pages du site.
"""

OPTIONS_PREVUES = [
    {"code": "local", "libelle": "Appel local (Orange, MTN)", "pays": ["CM"]},
    {"code": "afrique", "libelle": "Appel depuis un autre pays d'Afrique", "pays": ["*"]},
    {"code": "rappel", "libelle": "Être rappelé par l'équipe", "pays": ["*"]},
]


def lancer_appel(client, option):
    raise NotImplementedError("Téléphonie : module à venir.")
