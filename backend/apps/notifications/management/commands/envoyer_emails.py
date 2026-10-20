"""Programme d'envoi des e-mails (file `EnvoiEmail`).

    python manage.py envoyer_emails            # une passe
    python manage.py envoyer_emails --boucle   # toutes les 20 secondes (second service Railway, « worker »)

Chaque tour : nouveautés à annoncer, appels sans réponse à passer en « manqué », pièces jointes orphelines à purger,
e-mails des messages non lus, puis envoi de la file.
"""
import logging
import signal
import time

from django.core.management.base import BaseCommand

from apps.appels import services as appels
from apps.messagerie import pieces_jointes
from apps.notifications import taches

journal = logging.getLogger("cir.notifications")
PAUSE_SECONDES = 20


def une_passe():
    """Un tour complet. Une étape en panne n'empêche pas les suivantes. Renvoie le nombre d'e-mails envoyés."""
    etapes = (taches.notifier_actualites, appels.expirer_appels, pieces_jointes.purger_non_rattachees,
              taches.preparer_emails_messages)
    for etape in etapes:
        try:
            etape()
        except Exception:  # noqa: BLE001
            journal.exception("Étape %s en erreur.", etape.__name__)
    return taches.envoyer_en_attente()


class Command(BaseCommand):
    help = "Envoie les e-mails en attente (une passe, ou en boucle avec --boucle)."

    def add_arguments(self, parser):
        parser.add_argument("--boucle", action="store_true", help="Répéter toutes les 20 secondes.")
        parser.add_argument("--pause", type=int, default=PAUSE_SECONDES, help="Secondes entre deux tours (boucle).")

    def handle(self, *args, boucle=False, pause=PAUSE_SECONDES, **options):
        if not boucle:
            self.stdout.write(f"{une_passe()} e-mail(s) envoyé(s).")
            return
        arret = {"demande": False}

        def demander_arret(*_):
            arret["demande"] = True

        signal.signal(signal.SIGTERM, demander_arret)
        signal.signal(signal.SIGINT, demander_arret)
        self.stdout.write(f"Programme d'envoi démarré (un tour toutes les {pause} secondes).")
        while not arret["demande"]:
            try:
                une_passe()
            except Exception:  # noqa: BLE001 - la boucle ne s'arrête jamais sur une erreur
                journal.exception("Tour du programme d'envoi en erreur.")
            for _seconde in range(pause):  # pause découpée : l'arrêt demandé est pris en compte tout de suite
                if arret["demande"]:
                    break
                time.sleep(1)
        self.stdout.write("Programme d'envoi arrêté.")
