"""Pagination standard des listes de l'API."""
from rest_framework.pagination import PageNumberPagination


class PaginationStandard(PageNumberPagination):
    """Pages de 24 éléments ; le client peut demander jusqu'à 100 avec `?taille=`."""

    page_size = 24
    page_size_query_param = "taille"
    max_page_size = 100
