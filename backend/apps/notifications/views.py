"""API client des notifications (/api/notifications/) et désabonnement public."""
from django.http import HttpResponse
from django.utils import translation
from django.utils.html import escape
from django.utils.translation import gettext as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.noyau.pagination import PaginationStandard

from . import services
from .permissions import EstClient
from .serializers import NotificationSerializer, PreferencesClientSerializer


class ListeNotificationsView(APIView):
    permission_classes = [EstClient]
    equipe = False

    def get(self, request):
        paginateur = PaginationStandard()
        page = paginateur.paginate_queryset(services.notifications_de(request.user, request.query_params), request,
                                            view=self)
        donnees = NotificationSerializer(page, many=True, context={"equipe": self.equipe}).data
        return paginateur.get_paginated_response(donnees)


class NonLuesView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        return Response({"count": services.compter_non_lues(request.user)})


class MarquerLueView(APIView):
    permission_classes = [EstClient]
    equipe = False

    def post(self, request, pk):
        notification = services.marquer_lue(request.user, pk)
        return Response(NotificationSerializer(notification, context={"equipe": self.equipe}).data)


class MarquerToutesLuesView(APIView):
    permission_classes = [EstClient]

    def post(self, request):
        return Response({"count": services.marquer_toutes_lues(request.user)})


class PreferencesView(APIView):
    permission_classes = [EstClient]

    def get(self, request):
        return Response(services.preferences_client(request.user))

    def patch(self, request):
        serializer = PreferencesClientSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for champ, valeur in serializer.validated_data.items():
            services.modifier_preference(request.user, champ, valeur)
        return Response(services.preferences_client(request.user))


PAGE_DESABONNEMENT = """<!DOCTYPE html>
<html lang="{langue}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>CIR</title></head>
<body style="margin:0;background:#F3F7F9;font-family:Figtree,Arial,sans-serif;color:#0E2A38;">
<main style="max-width:480px;margin:48px auto;padding:24px;background:#fff;border-radius:8px;">
<h1 style="font-family:Lora,Georgia,serif;font-size:22px;margin:0 0 12px;">{titre}</h1>
<p style="line-height:1.5;margin:0;">{texte}</p></main></body></html>"""


@csrf_exempt
@never_cache
def desabonnement(request):
    """Désabonnement des nouveautés par le lien des e-mails (GET) ou `List-Unsubscribe-Post` (POST). Public.

    Un jeton faux donne une 404 générique, sans détail.
    """
    if request.method not in ("GET", "POST"):
        return HttpResponse(status=405)
    if not services.desabonner(request.GET.get("jeton", "")):
        return HttpResponse(status=404)
    page = PAGE_DESABONNEMENT.format(
        langue=escape(translation.get_language() or "fr"), titre=escape(_("Vous êtes désabonné")),
        texte=escape(_("Vous ne recevrez plus les nouveautés du CIR par e-mail. Vous pouvez changer d'avis à tout "
                       "moment dans les notifications de votre compte.")))
    return HttpResponse(page, content_type="text/html; charset=utf-8")
