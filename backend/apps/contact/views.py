from rest_framework import mixins, serializers, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

from apps.core.permissions import EstEquipe
from apps.notifications.services import notifier

from .models import DemandeContact


class DemandeContactSerializer(serializers.ModelSerializer):
    objet_libelle = serializers.CharField(source="get_objet_display", read_only=True)
    type_batiment_libelle = serializers.CharField(source="get_type_batiment_display", read_only=True)

    class Meta:
        model = DemandeContact
        fields = ["id", "nom", "telephone", "email", "objet", "objet_libelle", "type_batiment",
                  "type_batiment_libelle", "surface_m2", "message", "traitee", "cree_le"]
        read_only_fields = ["traitee", "cree_le"]

    def validate(self, donnees):
        if not donnees.get("telephone") and not donnees.get("email"):
            raise serializers.ValidationError("Laissez un téléphone ou un e-mail pour qu'on vous réponde.")
        return donnees


class ContactView(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """BF-11 : formulaire de contact de l'accueil (visiteurs et clients)."""

    permission_classes = [AllowAny]
    serializer_class = DemandeContactSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

    def perform_create(self, serializer):
        utilisateur = self.request.user if self.request.user.is_authenticated else None
        demande = serializer.save(utilisateur=utilisateur)
        notifier("contact.nouveau", None, {"demande": demande})  # e-mail à l'équipe : à venir (Gmail)


class ContactAdminView(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                       viewsets.GenericViewSet):
    permission_classes = [EstEquipe]
    serializer_class = DemandeContactSerializer
    filterset_fields = ["objet", "traitee", "type_batiment"]
    search_fields = ["nom", "email", "telephone", "message"]
    queryset = DemandeContact.objects.all()

    def perform_update(self, serializer):
        serializer.save(traitee=bool(self.request.data.get("traitee", serializer.instance.traitee)))
