from django.conf import settings
from django.db import models


class ElementSelection(models.Model):
    """BF-09 : produit ou design mis de côté par un client, avant de commander."""

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="selection")
    produit = models.ForeignKey("catalog.Produit", on_delete=models.CASCADE, related_name="+")
    surface_m2 = models.DecimalField("surface souhaitée (m²)", max_digits=10, decimal_places=2, null=True,
                                     blank=True)
    remarque = models.CharField(max_length=240, blank=True)
    ajoute_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-ajoute_le"]
        constraints = [models.UniqueConstraint(fields=["client", "produit"], name="selection_unique")]
