"""Remplit la base avec le catalogue, les réalisations et des comptes de démonstration.

    python manage.py seed_demo            # crée ce qui manque (sans rien écraser)
    python manage.py seed_demo --sans-demo  # catalogue et contenus seulement, sans client ni commande

Les textes entre crochets [ ] sont à remplacer par l'équipe depuis le tableau de bord.
"""
import os
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Adresse, User
from apps.catalog.models import Caracteristique, Famille, ImageProduit, Produit
from apps.messaging.services import envoyer_message
from apps.orders import services as commandes
from apps.orders.models import Commande
from apps.site_content.models import ContenuAccueil, PhotoSphere
from apps.showcase.models import Realisation, Temoignage

SEED = settings.BASE_DIR / "seed" / "images"
SPHERE = settings.BASE_DIR.parent / "frontend" / "site" / "public" / "media" / "sphere"

FAMILLES = ["Finitions", "Primaires époxy", "Sans solvant", "À base d'eau", "Marquage", "Sols spéciaux"]

# (image, nom, référence, famille, usages, à la une, accroche)
PRODUITS = [
    ("autolissant", "Sol autolissant époxy", "YD-500", "Finitions", "MIE", True,
     "Une surface lisse et brillante, sans joints, facile à nettoyer."),
    ("sable", "Sable coloré autolissant", "YD-306", "Finitions", "ME", True,
     "Des grains colorés pris dans la résine, pour un sol décoratif et résistant."),
    ("terrazzo", "Terrazzo époxy", "", "Sols spéciaux", "ME", True,
     "L'aspect du terrazzo, motifs et couleurs sur mesure."),
    ("lisse", "Finition époxy lisse", "", "Finitions", "MI", False,
     "Brillante et uniforme, pour les pièces de vie et les ateliers."),
    ("mate", "Finition époxy mate", "", "Finitions", "ME", False,
     "Un rendu sobre et mat, sans reflets."),
    ("antiderapant", "Finition antidérapante", "", "Finitions", "IX", True,
     "Pour les zones humides, les rampes et les allées."),
    ("antiuv", "Peinture de sol anti-UV", "", "À base d'eau", "X", False,
     "Garde ses couleurs au soleil, pour les extérieurs."),
    ("resistance", "Finition haute résistance", "", "Sans solvant", "I", False,
     "Conçue pour le passage des engins et les charges lourdes."),
    ("anticorrosion", "Peinture anticorrosion", "", "Primaires époxy", "I", False,
     "Protège le béton et le métal des produits chimiques."),
    ("motif", "Sol à motifs", "", "Sols spéciaux", "ME", False,
     "Logos, marquages et dessins intégrés au revêtement."),
]
USAGE = {"M": "pour_maison", "I": "pour_industrie", "E": "pour_entreprise", "X": "pour_exterieur"}

REALISATIONS = [
    ("Salon effet marbre", "maison", "Douala", "apres", "avant"),
    ("Couloirs d'une école", "entreprise", "Yaoundé", "ecole", None),
    ("Parking souterrain", "industrie", "Douala", "parking", None),
    ("Allée extérieure", "exterieur", "Kribi", "allee", None),
    ("Pose d'un sol autolissant", "industrie", "Édéa", "pose", None),
    ("Grand hall en terrazzo", "entreprise", "Douala", "terrazzo-large", None),
]


class Command(BaseCommand):
    help = "Crée le catalogue, les contenus et des comptes de démonstration."

    def add_arguments(self, parser):
        parser.add_argument("--sans-demo", action="store_true", help="Pas de client ni de commande d'exemple.")

    @transaction.atomic
    def handle(self, *args, **options):
        familles = {nom: Famille.objects.get_or_create(nom=nom, defaults={"ordre": i})[0]
                    for i, nom in enumerate(FAMILLES)}
        produits = {}
        for i, (img, nom, ref, fam, usages, une, accroche) in enumerate(PRODUITS):
            produit, cree = Produit.objects.get_or_create(
                nom=nom,
                defaults={"reference": ref, "famille": familles[fam], "accroche": accroche, "a_la_une": une,
                          "ordre": i, "description": f"{accroche} [Présentation détaillée à compléter.]",
                          "durabilite": "[Durée de vie et résistance à l'usure.]",
                          "beaute": "[Rendu, couleurs et finitions possibles.]",
                          "confort": "[Entretien, confort sous le pied, hygiène.]",
                          **{USAGE[u]: True for u in usages}, **({"pour_maison": False} if "M" not in usages else {})})
            if cree:
                with open(SEED / "produits" / f"{img}.webp", "rb") as f:
                    ImageProduit.objects.create(produit=produit, image=File(f, name=f"{img}.webp"), alt=nom)
                for j, (libelle, valeur) in enumerate([("Épaisseur", "[à compléter]"), ("Séchage", "[à compléter]"),
                                                       ("Résistance", "[à compléter]")]):
                    Caracteristique.objects.create(produit=produit, libelle=libelle, valeur=valeur, ordre=j)
            produits[img] = produit

        for i, (titre, genre, ville, img, avant) in enumerate(REALISATIONS):
            if Realisation.objects.filter(titre=titre).exists():
                continue
            r = Realisation(titre=titre, type_chantier=genre, ville=ville, ordre=i,
                            description="[Description du chantier à compléter.]")
            with open(SEED / "realisations" / f"{img}.webp", "rb") as f:
                r.image.save(f"{img}.webp", File(f), save=False)
            if avant:
                with open(SEED / "realisations" / f"{avant}.webp", "rb") as f:
                    r.image_avant.save(f"{avant}.webp", File(f), save=False)
            r.save()

        if not Temoignage.objects.exists():
            for nom, genre, ville in [("[Nom du client]", "maison", "Douala"), ("[Nom du client]", "industrie", "Édéa"),
                                      ("[Nom du client]", "entreprise", "Yaoundé")]:
                Temoignage.objects.create(nom_client=nom, type_batiment=genre, ville=ville, statut="publie",
                                          texte="[Témoignage d'un client du CIR : deux ou trois phrases.]")

        ContenuAccueil.charger()
        if not PhotoSphere.objects.exists() and SPHERE.exists():
            liens = list(produits.values())
            for i, chemin in enumerate(sorted(SPHERE.glob("*.webp"), key=lambda p: int(p.stem[5:] or 0))):
                with open(chemin, "rb") as f:
                    PhotoSphere.objects.create(image=File(f, name=chemin.name), ordre=i, alt="Sol en résine époxy",
                                               produit=liens[i % len(liens)])

        email = os.environ.get("SEED_ADMIN_EMAIL", "admin@cir.cm")
        if not User.objects.filter(email=email).exists():
            User.objects.create_superuser(email=email, nom_complet="Administrateur CIR",
                                          password=os.environ.get("SEED_ADMIN_PASSWORD", "ChangeMoi-2026!"))
            self.stdout.write(f"Compte administrateur : {email}")

        if not options["sans_demo"] and not User.objects.filter(email="client@exemple.cm").exists():
            client = User.objects.create_user(email="client@exemple.cm", password="Client-Demo-2026",
                                              nom_complet="Client de démonstration", telephone="+237600000000")
            Adresse.objects.create(utilisateur=client, ville="Douala", quartier="Bonapriso",
                                   rue_repere="[Rue ou repère]")
            commande = commandes.creer_commande(client, {
                "message": "Je souhaite refaire le sol de mon salon (environ 45 m²).",
                "lignes": [{"produit": produits["autolissant"], "surface_m2": 45}]})
            equipe = User.objects.filter(is_staff=True).first()
            commandes.proposer(commande, equipe, {"prix_m2": None, "montant_total": None, "delai_jours": 10,
                                                  "message": "[Proposition de l'équipe : prix et délai.]"})
            envoyer_message(commande.conversation, client, "Bonjour, est-il possible de passer la semaine prochaine ?")
            envoyer_message(commande.conversation, equipe, "Bonjour ! Oui, nous pouvons venir mardi pour une visite.")
            self.stdout.write("Client de démonstration : client@exemple.cm / Client-Demo-2026")

        self.stdout.write(self.style.SUCCESS(
            f"Prêt : {Produit.objects.count()} produits, {Realisation.objects.count()} réalisations, "
            f"{PhotoSphere.objects.count()} photos de sphère, {Commande.objects.count()} commande(s)."))
