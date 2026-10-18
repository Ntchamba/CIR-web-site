"""Sélection du client (BF-09) : produits et designs mis de côté avant de commander."""
from django.conf import settings
from django.db import models
from django.db.models import Q


class ElementSelection(models.Model):
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="selection")
    produit = models.ForeignKey("catalogue.Produit", on_delete=models.CASCADE, related_name="+")
    design = models.ForeignKey("catalogue.Design", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    cree_le = models.DateTimeField("ajouté le", auto_now_add=True)

    class Meta:
        verbose_name = "élément de sélection"
        verbose_name_plural = "éléments de sélection"
        ordering = ["-cree_le", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["utilisateur", "produit", "design"],
                                    name="selection_element_unique"),
            # En SQL, deux NULL sont toujours différents : le cas « sans design » a sa propre contrainte
            models.UniqueConstraint(fields=["utilisateur", "produit"], condition=Q(design__isnull=True),
                                    name="selection_element_sans_design_unique"),
        ]

    def __str__(self):
        return f"{self.utilisateur_id} : {self.produit_id}/{self.design_id or '-'}"
