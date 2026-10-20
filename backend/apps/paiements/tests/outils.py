"""Outils des tests des paiements : CamPay est toujours simulé (aucun appel réseau, aucune clé)."""
from unittest import mock

from django.utils import timezone

from apps.commandes.models import Commande
from apps.noyau.tests.outils_direct import BaseVague3
from apps.paiements import transactions
from apps.paiements.models import EtatPaiement, ModePaiement, Paiement
from integrations.campay.client import Collecte, Transaction

URL = "/api/paiements/"
ADMIN = "/api/admin/paiements/"
TEL = "6 99 00 11 22"


def signer_commande(commande, montant=500_000, etat="contrat_signe", paye=0):
    """Met la commande à une étape payable (sans passer par la négociation, déjà testée ailleurs)."""
    Commande.objects.filter(pk=commande.pk).update(etat=etat, montant_convenu=montant, montant_paye=paye,
                                                   signe_le=timezone.now())
    commande.refresh_from_db()
    return commande


def transaction_campay(paiement, statut="reussi", **changements):
    valeurs = {"reference": paiement.reference_campay or "ref-campay-0001", "statut": statut,
               "montant": paiement.montant, "devise": "XAF", "operateur": "MTN",
               "reference_operateur": "OP-123456", "reference_externe": paiement.reference_externe, "raison": ""}
    valeurs.update(changements)
    return Transaction(**valeurs)


class BasePaiements(BaseVague3):
    """CamPay configuré et simulé : `self.campay` donne accès aux appels simulés."""

    def setUp(self):
        super().setUp()
        self.campay = mock.Mock()
        self.campay.statuts = {}  # référence externe → fonction(paiement) → Transaction (par défaut : en attente)
        self.appels_collecte = 0
        self.campay.initier_collecte.side_effect = self._collecte
        self.campay.lien_paiement.return_value = "https://campay.example/pay/abc"
        self.campay.configure.return_value = True
        self.campay.statut.side_effect = self._statut
        for nom in ("configure", "initier_collecte", "lien_paiement", "statut"):
            patch = mock.patch.object(transactions.client, nom, getattr(self.campay, nom))
            patch.start()
            self.addCleanup(patch.stop)
        self.commande = self.creer_commande_payable(self.client_a)

    def _collecte(self, **arguments):
        """Chaque collecte reçoit sa propre référence CamPay (la première : « ref-campay-0001 »)."""
        self.appels_collecte += 1
        reference = "ref-campay-0001" if self.appels_collecte == 1 else f"ref-campay-{self.appels_collecte:04d}"
        return Collecte(reference=reference, code_ussd="*126#", operateur="MTN")

    def _statut(self, reference):
        paiement = Paiement.objects.filter(reference_campay=reference).first()
        if paiement is None:  # référence candidate d'un webhook (paiement par lien) : le paiement annoncé sans référence
            paiement = Paiement.objects.filter(pk__in=list(self.campay.statuts)).first()
        if paiement is None:
            raise AssertionError(f"Référence CamPay inattendue dans le test : {reference}")
        fabrique = self.campay.statuts.get(paiement.pk)
        return fabrique(paiement) if fabrique else transaction_campay(paiement, "en_attente")

    def annoncer(self, paiement, statut="reussi", **changements):
        """CamPay répondra `statut` pour ce paiement."""
        self.campay.statuts[paiement.pk] = lambda p: transaction_campay(p, statut, **changements)

    def creer_commande_payable(self, client, montant=500_000, **options):
        from apps.commandes.tests.outils import creer_commande
        from apps.catalogue.models import Famille, Produit

        produit = Produit.objects.first() or Produit.objects.create(
            famille=Famille.objects.create(nom="Finitions"), nom="Sol autolissant", reference="YD-500")
        return signer_commande(creer_commande(client, produit), montant, **options)

    def paiement_en_base(self, commande=None, etat=EtatPaiement.EN_ATTENTE, montant=100_000, **champs):
        commande = commande or self.commande
        champs.setdefault("mode", ModePaiement.MOBILE)
        champs.setdefault("reference_campay", "ref-campay-0001" if etat == EtatPaiement.EN_ATTENTE else "")
        return Paiement.objects.create(commande=commande, client=commande.client, montant=montant, etat=etat,
                                       telephone="237699001122", **champs)

    def initier(self, utilisateur=None, **donnees):
        self.se_connecter(utilisateur or self.client_a)
        corps = {"commande": self.commande.pk, "mode": "mobile", "telephone": TEL, **donnees}
        return self.client.post(URL, corps, format="json")
