"""Rejoue les cas de `agents/evaluations/questions.json` contre le vrai Gemini et écrit un rapport.

    python manage.py evaluer_assistant [--cas ev-12] [--langue en]

MANUELLE : nécessite une vraie GEMINI_API_KEY et consomme du quota. Jamais lancée par les tests.
Les cas sont rejoués comme un visiteur sans compte (aucune donnée de client). Le rapport (JSON) est écrit
dans `agents/evaluations/rapports/` ; une relecture humaine reste nécessaire.
"""
import json
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError

from apps.assistant import evaluations, orchestrateur


class Command(BaseCommand):
    help = "Rejoue les questions d'évaluation de l'assistant avec une vraie clé Gemini et écrit un rapport."

    def add_arguments(self, parser):
        parser.add_argument("--cas", help="Identifiant d'un seul cas.")
        parser.add_argument("--langue", help="Seulement les cas de cette langue.")

    def handle(self, *args, cas=None, langue=None, **options):
        if not orchestrateur.configure():
            raise CommandError("GEMINI_API_KEY (ou les prompts de agents/prompts/) manque : évaluation impossible.")
        questions = evaluations.charger()
        if cas:
            questions = [q for q in questions if q["id"] == cas]
        if langue:
            questions = [q for q in questions if q["langue"] == langue]
        if not questions:
            raise CommandError("Aucun cas à rejouer.")
        resultats = []
        for question in questions:
            resultat = evaluations.rejouer(question)
            resultats.append(resultat)
            self.stdout.write(f"{question['id']} : {'OK' if resultat['reussi'] else 'À REVOIR'}")
        dossier = orchestrateur.dossier_agents() / "evaluations" / "rapports"
        dossier.mkdir(parents=True, exist_ok=True)
        fichier = dossier / f"rapport-{datetime.now():%Y%m%d-%H%M%S}.json"
        reussis = sum(1 for r in resultats if r["reussi"])
        fichier.write_text(json.dumps({"total": len(resultats), "reussis": reussis, "cas": resultats},
                                      ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"{reussis}/{len(resultats)} cas conformes. Rapport : {fichier}"))
