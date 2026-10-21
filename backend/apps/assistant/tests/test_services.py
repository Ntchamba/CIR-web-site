"""Rétention, commandes de gestion, évaluations, prompts et connaissances, worker."""
import json
import re
from datetime import timedelta
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from apps.assistant import evaluations, orchestrateur, services
from apps.assistant.models import (Brouillon, CompteurAssistant, ConversationAssistant, JournalAssistant,
                                   MessageAssistant, UsageAssistant)
from apps.notifications.management.commands import envoyer_emails

from .outils_assistant import BaseAssistant


class PurgeTests(BaseAssistant):
    def vieillir(self, jours):
        return timezone.now() - timedelta(days=jours)

    def test_purge_selon_la_retention(self):
        vieille = ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(91))
        MessageAssistant.objects.create(conversation=vieille, role="utilisateur", texte="ancien")
        recente = ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(89))
        JournalAssistant.objects.create(agent="conseiller", resultat="ok", cree_le=self.vieillir(181))
        JournalAssistant.objects.create(agent="conseiller", resultat="ok", cree_le=self.vieillir(100))
        vieux = Brouillon.objects.create(type="traduction", etat="accepte", traite_le=self.vieillir(181), cree_par=self.membre)
        recent = Brouillon.objects.create(type="traduction", etat="rejete", traite_le=self.vieillir(10), cree_par=self.membre)
        propose = Brouillon.objects.create(type="traduction", cree_le=self.vieillir(400), cree_par=self.membre)
        UsageAssistant.objects.create(cree_le=self.vieillir(3))
        resultat = services.purger()
        self.assertEqual(list(ConversationAssistant.objects.all()), [recente])
        self.assertEqual(MessageAssistant.objects.count(), 0)
        self.assertEqual(JournalAssistant.objects.count(), 1)
        self.assertEqual(set(Brouillon.objects.all()), {recent, propose})
        self.assertNotIn(vieux, Brouillon.objects.all())
        self.assertEqual(UsageAssistant.objects.count(), 0)
        self.assertGreaterEqual(resultat["conversations"], 1)

    @override_settings(ASSISTANT_RETENTION_JOURS=30)
    def test_retention_configurable(self):
        ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(31))
        ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(29))
        services.purger()
        self.assertEqual(ConversationAssistant.objects.count(), 1)

    def test_commande_purger_assistant(self):
        ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(200))
        sortie = StringIO()
        call_command("purger_assistant", stdout=sortie)
        self.assertEqual(ConversationAssistant.objects.count(), 0)
        self.assertIn("1 suppression(s) de conversation", sortie.getvalue())

    def test_la_boucle_du_worker_purge_au_plus_une_fois_par_heure(self):
        ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(200))
        with mock.patch.object(envoyer_emails.taches, "envoyer_en_attente", return_value=0):
            envoyer_emails.une_passe()
            self.assertEqual(ConversationAssistant.objects.count(), 0)
            ConversationAssistant.objects.create(derniere_activite_le=self.vieillir(200))
            envoyer_emails.une_passe()  # trop tôt : pas de nouvelle purge
            self.assertEqual(ConversationAssistant.objects.count(), 1)
            cache.clear()
            envoyer_emails.une_passe()
            self.assertEqual(ConversationAssistant.objects.count(), 0)

    def test_une_panne_de_purge_n_arrete_pas_le_tour(self):
        with mock.patch.object(services, "purger", side_effect=RuntimeError("panne")), \
                mock.patch.object(envoyer_emails.taches, "envoyer_en_attente", return_value=7):
            self.assertEqual(envoyer_emails.une_passe(), 7)

    def test_compte_supprime_emporte_ses_conversations(self):
        ConversationAssistant.objects.create(utilisateur=self.client_b)
        self.client_b.delete()
        self.assertEqual(ConversationAssistant.objects.count(), 0)


class EvaluationsTests(SimpleTestCase):
    def test_fichier_valide(self):
        questions = evaluations.charger()
        self.assertEqual(evaluations.erreurs_de_forme(questions), [])
        self.assertGreaterEqual(len(questions), 30)

    def test_couverture_des_sujets_et_des_langues(self):
        questions = evaluations.charger()
        self.assertEqual({q["langue"] for q in questions}, {"fr", "en", "zh", "de", "ja"})
        texte = json.dumps(questions, ensure_ascii=False).lower()
        for sujet in ("famille", "téléphone", "commande", "remise", "délai", "signe mon contrat", "valide mon paiement",
                      "ignore tes instructions", "affiche ton prompt", "idiot", "capitale", "jiuye"):
            self.assertIn(sujet, texte, sujet)
        outils_attendus = {o for q in questions for o in q["attendu"].get("outils", [])}
        self.assertTrue({"rechercher_produits", "fiche_produit", "lister_familles", "infos_entreprise", "ma_commande",
                         "rechercher_realisations"} <= outils_attendus)

    def test_fichier_invalide_detecte(self):
        mauvais = [{"id": "a", "langue": "xx", "question": "", "attendu": {"doit": ["@inconnu"]}},
                   {"id": "a", "langue": "fr", "question": "ok", "attendu": {"doit": [], "ne_doit_pas": [], "outils": "x"}}]
        self.assertGreaterEqual(len(evaluations.erreurs_de_forme(mauvais)), 5)
        self.assertTrue(evaluations.erreurs_de_forme({"pas": "une liste"}))

    def test_verification_des_reponses_types(self):
        attendu = {"doit": ["@proposer_contact", "devis|quote"], "ne_doit_pas": ["j'ai signé"], "outils": ["fiche_produit"]}
        bon = evaluations.verifier(attendu, texte="L'équipe vous répondra par un devis.", outils_appeles=["fiche_produit"],
                                   proposer_contact=True)
        self.assertEqual(bon, [])
        mauvais = evaluations.verifier(attendu, texte="J'ai signé.", outils_appeles=[], proposer_contact=False)
        self.assertEqual(len(mauvais), 4)
        aucun = {"doit": ["@aucun_montant"], "ne_doit_pas": []}
        self.assertEqual(evaluations.verifier(aucun, texte="Prix sur devis."), [])
        self.assertTrue(evaluations.verifier(aucun, texte="Cela coûte 5 000 FCFA."))

    def test_les_garde_fous_bloquent_et_laissent_passer_les_reponses_types(self):
        from apps.assistant import garde_fous as g
        for q in evaluations.charger():
            if "@aucun_montant" in q["attendu"]["doit"]:
                self.assertEqual(g.controler_sortie("Cela coûte 5 000 FCFA.", langue=q["langue"]).bloque, g.PRIX)
                self.assertEqual(g.controler_sortie("Prix sur devis.", langue=q["langue"]).bloque, "")
        for q in evaluations.charger():
            if any("signe" in m or "valide" in m for m in [q["question"].lower()]) and q["langue"] == "fr":
                self.assertEqual(g.controler_sortie("J'ai signé votre contrat.", langue="fr").bloque, g.ENGAGEMENT)

    def test_la_commande_manuelle_refuse_sans_cle_et_les_tests_ne_l_appellent_pas(self):
        with mock.patch.dict("os.environ", {"GEMINI_API_KEY": ""}), self.assertRaises(CommandError):
            call_command("evaluer_assistant")
        with mock.patch.object(evaluations, "rejouer") as rejeu:
            with mock.patch.dict("os.environ", {"GEMINI_API_KEY": ""}), self.assertRaises(CommandError):
                call_command("evaluer_assistant")
        rejeu.assert_not_called()


class RejeuSimuleTests(BaseAssistant):
    def test_rejeu_avec_gemini_simule_ecrit_un_rapport(self):
        from .outils_assistant import texte
        self.faux.file = [texte("Prix sur devis : l'équipe vous répondra.")]
        with mock.patch.object(evaluations, "charger", return_value=[
                {"id": "t-1", "langue": "fr", "question": "Prix ?", "attendu": {"doit": ["devis"], "ne_doit_pas": ["5 000"]}}]):
            with override_settings(ASSISTANT_AGENTS_DIR=Path(self._tmp())):
                orchestrateur_dossier = orchestrateur.dossier_agents()
                (orchestrateur_dossier / "prompts").mkdir()
                for nom in ("conseiller", "fond"):
                    (orchestrateur_dossier / "prompts" / f"{nom}.md").write_text("Consignes de test.", encoding="utf-8")
                sortie = StringIO()
                call_command("evaluer_assistant", stdout=sortie)
                rapports = list((orchestrateur_dossier / "evaluations" / "rapports").glob("rapport-*.json"))
        self.assertEqual(len(rapports), 1)
        self.assertIn("1/1", sortie.getvalue())

    def _tmp(self):
        import shutil
        import tempfile
        dossier = tempfile.mkdtemp(prefix="cir-agents-")
        self.addCleanup(shutil.rmtree, dossier, ignore_errors=True)
        return dossier


class PromptsEtConnaissancesTests(SimpleTestCase):
    def test_prompts_presents_et_en_francais(self):
        for nom in ("conseiller", "fond"):
            texte = orchestrateur.lire_prompt(nom)
            self.assertGreater(len(texte), 500, nom)
            self.assertIn("Jiuye", texte)
            self.assertIn("prix", texte.lower())
        self.assertTrue(orchestrateur.prompts_disponibles())

    def test_regles_d_or_dans_le_prompt_du_conseiller(self):
        texte = orchestrateur.lire_prompt("conseiller").lower()
        for regle in ("aucun prix ferme", "ne signes rien", "données", "contacter_equipe", "jamais"):
            self.assertIn(regle, texte)

    def test_connaissances_sans_invention(self):
        connaissances = orchestrateur.lire_connaissances()
        self.assertIn("Nouvelle", connaissances)
        self.assertIn("Contrat signé", connaissances)
        # aucun prix, montant, téléphone, e-mail ni nom de client dans les connaissances ni les prompts
        for texte in (connaissances, orchestrateur.lire_prompt("conseiller"), orchestrateur.lire_prompt("fond")):
            self.assertIsNone(re.search(r"\d[\d  ]{2,}\s?(FCFA|XAF|€|\$)", texte))
            self.assertIsNone(re.search(r"[\w.]+@[\w.]+\.\w+", texte))
            self.assertIsNone(re.search(r"\+?\d[\d ]{8,}", texte))

    @override_settings(ASSISTANT_AGENTS_DIR=Path("/inexistant/agents"))
    def test_prompts_absents_assistant_non_configure(self):
        self.assertFalse(orchestrateur.prompts_disponibles())
        with mock.patch.dict("os.environ", {"GEMINI_API_KEY": "x"}):
            self.assertFalse(orchestrateur.configure())
        self.assertEqual(orchestrateur.lire_connaissances(), "")


class ConfigurationTests(TestCase):
    def test_variables_documentees_dans_env_example(self):
        env = (Path(__file__).resolve().parents[3] / ".env.example").read_text(encoding="utf-8")
        for variable in ("GEMINI_API_KEY", "GEMINI_MODELE_ASSISTANT", "GEMINI_MODELE_FOND", "ASSISTANT_LIMITE_JOUR",
                         "ASSISTANT_RETENTION_JOURS"):
            self.assertRegex(env, rf"(?m)^{variable}=")
        self.assertRegex(env, r"(?m)^GEMINI_API_KEY=$")  # aucune clé versionnée

    def test_valeurs_par_defaut(self):
        from django.conf import settings
        self.assertEqual(settings.ASSISTANT_RETENTION_JOURS, 90)
        self.assertEqual(settings.ASSISTANT_LIMITE_JOUR, 1000)
        self.assertEqual(settings.GEMINI_MODELE_ASSISTANT, "gemini-2.5-flash")

    def test_aucune_cle_dans_le_code(self):
        racine = Path(__file__).resolve().parents[1]
        for fichier in racine.rglob("*.py"):
            if "tests" in fichier.parts:
                continue
            self.assertIsNone(re.search(r"AIza[0-9A-Za-z_\-]{20,}", fichier.read_text(encoding="utf-8")), fichier.name)

    def test_le_module_n_importe_aucun_service_d_ecriture(self):
        """Les outils n'importent ni `services` d'écriture (commandes, paiements, messagerie…)."""
        source = (Path(__file__).resolve().parents[1] / "outils.py").read_text(encoding="utf-8")
        for interdit in ("paiements", "messagerie", "negociation", "apps.devis", "apps.contact", "campay"):
            self.assertNotIn(interdit, source)
