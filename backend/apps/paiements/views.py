"""API client des paiements (/api/paiements/) et webhook CamPay. Les règles métier sont dans services.py."""
import logging

from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.noyau.pagination import PaginationStandard

from . import services, transactions
from .permissions import EstClient
from .serializers import InitierSerializer, PaiementSerializer

journal = logging.getLogger("cir.paiements")


class DisponibiliteView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        return Response(services.disponibilite())


class PaiementsView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        paginateur = PaginationStandard()
        page = paginateur.paginate_queryset(services.paiements_du_client(request.user, request.query_params),
                                            request, view=self)
        return paginateur.get_paginated_response(PaiementSerializer(page, many=True).data)

    def post(self, request):
        donnees = InitierSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)
        valeurs = donnees.validated_data
        paiement = services.initier(request.user, valeurs["commande"], valeurs["mode"], valeurs["telephone"],
                                    valeurs["montant"])
        return Response(PaiementSerializer(paiement).data, status=status.HTTP_201_CREATED)


class PaiementView(APIView):
    permission_classes = [EstClient]

    def get(self, request, pk):
        return Response(PaiementSerializer(services.lire_pour_client(request.user, pk)).data)


class AnnulerView(APIView):
    permission_classes = [EstClient]

    def post(self, request, pk):
        return Response(PaiementSerializer(services.annuler(request.user, pk)).data)


class RecuView(APIView):
    permission_classes = [EstClient]

    def get(self, request, pk):
        return Response(services.recu(request.user, pk))


def _parametres(request):
    """Paramètres de requête et corps (JSON ou formulaire) réunis : le format exact des webhooks CamPay est tolérant."""
    parametres = dict(request.query_params.items())
    try:
        corps = request.data
    except ParseError:
        corps = {}
    if hasattr(corps, "items"):
        parametres.update({str(k): v for k, v in corps.items()})
    return parametres


class WebhookCampayView(APIView):
    """Webhook CamPay (GET ou POST), sans jeton JWT : protégé par la signature, jamais cru sur parole.

    503 si la clé de signature n'est pas configurée, 403 si la signature est absente ou fausse. Sinon 200
    `{"ok": true}` dans tous les cas (même paiement inconnu) : l'appelant n'apprend rien. Le contenu de la requête
    sert uniquement à retrouver le paiement, qui est **toujours** revérifié auprès de CamPay.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def _traiter(self, request):
        if not transactions.webhook_configure():
            return Response({"detail": _("Webhook non configuré."), "code": "webhook_non_configure"},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        parametres = _parametres(request)
        if not transactions.signature_valide(parametres):
            return Response({"detail": _("Signature du webhook invalide.")}, status=status.HTTP_403_FORBIDDEN)
        evenement = transactions.evenement(parametres)
        if evenement is not None:
            services.traiter_webhook(evenement)
        return Response({"ok": True})

    def get(self, request):
        return self._traiter(request)

    def post(self, request):
        return self._traiter(request)
