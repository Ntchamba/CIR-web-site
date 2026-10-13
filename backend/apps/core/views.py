from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def sante(request):
    """Vérifie que l'API répond (surveillance de la disponibilité, BNF-08)."""
    return Response({"statut": "ok"})


@api_view(["GET"])
@permission_classes([AllowAny])
def coordonnees(request):
    """Numéros affichés sur le site (boutons Appeler et WhatsApp)."""
    return Response({"telephone": settings.CIR_TELEPHONE, "whatsapp": settings.CIR_WHATSAPP})
