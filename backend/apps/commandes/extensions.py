"""Points d'extension de `commandes` pour les modules qui en dépendent (ici `devis`), sans import à l'envers.

Le détail d'une commande liste ses devis. Comme `commandes` ne doit pas importer `devis` (dépendance
circulaire), `devis` enregistre au démarrage (`DevisConfig.ready`) une fonction qui produit ce résumé.
"""
_fournisseur_devis = None


def enregistrer_fournisseur_devis(fonction):
    """`fonction(commande, request, equipe) -> list[dict]` : devis de la commande (tous si `equipe`, sinon envoyés)."""
    global _fournisseur_devis
    _fournisseur_devis = fonction


def devis_de(commande, request, equipe):
    return _fournisseur_devis(commande, request, equipe) if _fournisseur_devis else []
