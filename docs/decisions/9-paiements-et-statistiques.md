# Décision 9 : paiements et statistiques (vague 4)

Date : 20 octobre 2026. Statut : retenue. Détails : `docs/taches/vague-4-contrat-api.md`.

## Choix

- **Revérification obligatoire** : une commande n'est payée qu'après interrogation de l'API CamPay. Le webhook, la
  redirection et le navigateur ne font que déclencher cette vérification. Montant, devise et référence externe doivent
  correspondre, sinon le paiement passe en « anomalie » et rien n'est encaissé.
- **Paiement après « Contrat signé »**, jamais au-delà du reste à payer ; versements partiels possibles (acompte).
- **Règlement hors ligne** (espèces, virement, chèque) enregistré par l'équipe, tracé, sans revérification : fréquent en
  pratique et indispensable quand le paiement en ligne n'est pas configuré.
- **Idempotence** par verrou de ligne ; `Commande.montant_paye` n'est modifié que par le module `paiements`.
- **Statistiques** calculées à la lecture (aucune table de plus), sommes d'argent réservées au super-administrateur.
- **Dégradation douce** : CamPay non configuré = bouton « Payer » masqué, règlement hors ligne toujours possible.

## Conséquences

- Variables d'environnement ajoutées ; l'adresse du webhook est à saisir dans la console CamPay.
- Le format exact des webhooks CamPay est à confirmer avec un vrai compte (essai sur `demo.campay.net`).
- Remboursements : hors application (l'équipe est prévenue d'un dépassement par une « anomalie »).
