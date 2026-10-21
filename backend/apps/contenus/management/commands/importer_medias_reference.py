"""Charge en base les médias de référence (vidéo et affiche de l'accueil, photos de la sphère).

    python manage.py importer_medias_reference                 # dossier par défaut : backend/medias_reference
    python manage.py importer_medias_reference --forcer        # remplace les médias déjà en base
    python manage.py importer_medias_reference --dossier /chemin/vers/medias

Le manifeste `medias.json` du dossier décrit chaque fichier (usage, texte alternatif dans les cinq langues).

Idempotente : sans `--forcer`, la vidéo et l'affiche ne sont posées que si elles sont vides, et une photo de
sphère déjà importée (reconnue au nom du fichier d'origine) n'est pas recréée. Aucun texte, titre, téléphone
ni coordonnée de l'accueil n'est touché. Aucun produit, réalisation ou témoignage n'est créé. Aucun appel
réseau. Les fichiers passent par les modèles (conversion WebP et limites de poids), jamais par une simple copie.
Tout est vérifié avant la première écriture : un fichier manquant ne laisse rien de partiel.
"""
import json
import re
from contextlib import ExitStack
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.translation import gettext as _

from apps.contenus.models import ContenuAccueil, PhotoSphere
from apps.noyau.langues import AUTRES_LANGUES, CODES_LANGUES

USAGE_VIDEO = "accueil_video_fond"
USAGE_AFFICHE = "accueil_image_affiche"
USAGE_SPHERE = "sphere"
DOSSIER_SPHERE = "contenus/sphere/"


def dossier_par_defaut():
    return Path(settings.BASE_DIR) / "medias_reference"


def _nom_importe(nom_fichier):
    """Motif du nom enregistré par le stockage pour un fichier d'origine (suffixe aléatoire éventuel)."""
    return re.compile(rf"^{re.escape(DOSSIER_SPHERE)}{re.escape(Path(nom_fichier).stem)}(_[A-Za-z0-9]{{7}})?\.webp$")


class Command(BaseCommand):
    help = "Importe les médias de référence (accueil et sphère) décrits par medias.json, sans rien inventer."

    def add_arguments(self, parser):
        parser.add_argument("--forcer", action="store_true", help="Remplacer les médias déjà présents en base.")
        parser.add_argument("--dossier", default=None,
                            help="Dossier des médias et du manifeste medias.json (par défaut : medias_reference).")

    # --- Lecture et vérification (aucune écriture) ---

    def _lire_manifeste(self, dossier):
        if not dossier.is_dir():
            raise CommandError(_("Dossier de médias introuvable : %(chemin)s.") % {"chemin": dossier})
        chemin = dossier / "medias.json"
        if not chemin.is_file():
            raise CommandError(_("Manifeste introuvable : %(chemin)s.") % {"chemin": chemin})
        try:
            manifeste = json.loads(chemin.read_text(encoding="utf-8"))
            entrees = manifeste["fichiers"]
            assert isinstance(entrees, list) and all(isinstance(e, dict) for e in entrees)
        except (ValueError, KeyError, TypeError, AssertionError) as erreur:
            raise CommandError(_("Manifeste illisible : %(chemin)s.") % {"chemin": chemin}) from erreur
        return entrees

    def _preparer(self, dossier, entrees):
        """Renvoie (video, affiche, photos) ; chaque élément est (entrée, chemin). Lève CommandError au moindre défaut."""
        video = affiche = None
        photos = []
        for entree in entrees:
            usage = entree.get("usage")
            if usage not in (USAGE_VIDEO, USAGE_AFFICHE, USAGE_SPHERE):
                continue
            nom = entree.get("fichier")
            if not isinstance(nom, str) or not nom:
                raise CommandError(_("Manifeste illisible : %(chemin)s.") % {"chemin": dossier / "medias.json"})
            chemin = dossier / nom
            if not chemin.is_file():
                raise CommandError(_("Fichier de média manquant : %(fichier)s. Rien n'a été importé.")
                                   % {"fichier": chemin})
            if usage == USAGE_VIDEO:
                video = (entree, chemin)
            elif usage == USAGE_AFFICHE:
                affiche = (entree, chemin)
            else:
                alt = entree.get("alt")
                manquantes = [c for c in CODES_LANGUES
                              if not isinstance(alt, dict) or not str(alt.get(c) or "").strip()]
                if manquantes:
                    raise CommandError(_("Texte alternatif manquant pour %(fichier)s (langues : %(langues)s). "
                                         "Rien n'a été importé.")
                                       % {"fichier": nom, "langues": ", ".join(manquantes)})
                photos.append((entree, chemin))
        photos.sort(key=lambda p: p[0].get("ordre", 0))
        return video, affiche, photos

    # --- Écriture ---

    def _importer_accueil(self, pile, video, affiche, forcer, anciens, nouveaux):
        contenu = ContenuAccueil.charger()
        champs = []
        for champ, element in (("video_fond", video), ("image_affiche", affiche)):
            if element is None or (getattr(contenu, champ) and not forcer):
                continue
            if getattr(contenu, champ):
                anciens.append((getattr(contenu, champ).storage, getattr(contenu, champ).name))
            fichier = pile.enter_context(element[1].open("rb"))
            # L'affectation d'un fichier non enregistré laisse le modèle le convertir en WebP à la sauvegarde
            setattr(contenu, champ, File(fichier, name=element[1].name))
            champs.append(champ)
        if champs:
            contenu.save(update_fields=[*champs, "modifie_le"])
            nouveaux.extend((getattr(contenu, c).storage, getattr(contenu, c).name) for c in champs)
        return len(champs)

    def _importer_photos(self, pile, photos, forcer, anciens, nouveaux):
        existantes = list(PhotoSphere.objects.all())
        creees = remplacees = inchangees = 0
        for entree, chemin in photos:
            motif = _nom_importe(chemin.name)
            photo = next((p for p in existantes if motif.match(p.image.name or "")), None)
            if photo is not None and not forcer:
                inchangees += 1
                continue
            alt = entree["alt"]
            traductions = {c: {"alt": alt[c].strip()} for c in AUTRES_LANGUES}
            if photo is None:
                photo = PhotoSphere(produit=None)
                creees += 1
            else:
                anciens.append((photo.image.storage, photo.image.name))
                remplacees += 1
            photo.alt = alt["fr"].strip()
            photo.traductions = {**(photo.traductions or {}), **traductions}
            photo.ordre = entree.get("ordre", 0)
            fichier = pile.enter_context(chemin.open("rb"))
            photo.image = File(fichier, name=chemin.name)
            photo.save()
            nouveaux.append((photo.image.storage, photo.image.name))
        return creees, remplacees, inchangees

    def handle(self, *args, forcer=False, dossier=None, **options):
        dossier = Path(dossier) if dossier else dossier_par_defaut()
        video, affiche, photos = self._preparer(dossier, self._lire_manifeste(dossier))

        anciens, nouveaux = [], []
        try:
            with ExitStack() as pile, transaction.atomic():
                accueil = self._importer_accueil(pile, video, affiche, forcer, anciens, nouveaux)
                creees, remplacees, inchangees = self._importer_photos(pile, photos, forcer, anciens, nouveaux)
        except Exception:
            # Rien de partiel : la transaction annule la base, les fichiers écrits par cette exécution sont retirés
            for stockage, nom in nouveaux:
                stockage.delete(nom)
            raise
        for stockage, nom in anciens:
            if nom:
                stockage.delete(nom)

        self.stdout.write(self.style.SUCCESS(
            _("Médias de référence : %(accueil)s média(s) de l'accueil posé(s), %(creees)s photo(s) de la sphère "
              "créée(s), %(remplacees)s remplacée(s), %(inchangees)s déjà présente(s).")
            % {"accueil": accueil, "creees": creees, "remplacees": remplacees, "inchangees": inchangees}
        ))
