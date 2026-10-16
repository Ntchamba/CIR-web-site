"""Identifiants d'adresse (slugs) uniques, calculés à partir d'un texte français."""
from django.utils.text import slugify


def slug_unique(instance, texte, champ="slug", secours="element"):
    """Slug libre pour `instance` : « sol-autolissant », puis « sol-autolissant-2 », « -3 »…

    Le slug d'un objet déjà enregistré n'est pas recalculé par les modules (adresses stables).
    """
    modele = type(instance)
    longueur = modele._meta.get_field(champ).max_length
    base = (slugify(texte) or secours)[: longueur - 4].strip("-") or secours
    autres = modele._default_manager.all()
    if instance.pk:
        autres = autres.exclude(pk=instance.pk)
    slug, numero = base, 2
    while autres.filter(**{champ: slug}).exists():
        slug = f"{base}-{numero}"
        numero += 1
    return slug
