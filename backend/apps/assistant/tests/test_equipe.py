"""API équipe : statut, brouillons (agent de fond), journal, conversations réservées au super-administrateur."""
import json
import os
from unittest import mock

from django.test import override_settings
from django.utils import timezone

from apps.assistant.models import Brouillon, ConversationAssistant, JournalAssistant, MessageAssistant
from apps.contact.models import DemandeContact
from apps.messagerie.models import Conversation as ConversationMessagerie, Message
from apps.notifications.models import EnvoiEmail
from integrations.gemini.erreurs import GeminiContenuBloque, GeminiErreurTemporaire

from .outils_assistant import ADMIN, BaseAssistant, appels, texte

BROUILLONS = ADMIN + "brouillons/"


class Base(BaseAssistant):
    def setUp(self):
        super().setUp()
        self.demande = DemandeContact.objects.create(
            auteur=self.client_a, nom="Alice Ngono", email="alice@exemple.cm", telephone="699112233", type="question",
            message="Bonjour, quel est le prix du YD-500 ? Rappelez-moi au 699 11 22 33 ou alice@exemple.cm.",
            langue="fr", produit=self.produit)
        self.fil = ConversationMessagerie.objects.create(client=self.client_a)
        Message.objects.create(conversation=self.fil, auteur=self.client_a, auteur_role="client",
                               texte="Bonjour, je suis Alice Ngono, mon numéro est 699 11 22 33. Délai ?")
        self.se_connecter(self.membre)

    def creer(self, **corps):
        return self.client.post(BROUILLONS, corps, format="json")


class AccesTests(Base):
    def test_equipe_seulement(self):
        for adresse in (ADMIN + "statut/", BROUILLONS, ADMIN + "journal/", ADMIN + "journal/resume/"):
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(adresse).status_code, 401, adresse)
            self.se_connecter(self.client_a)
            self.assertEqual(self.client.get(adresse).status_code, 403, adresse)
            self.se_connecter(self.membre)
            self.assertEqual(self.client.get(adresse).status_code, 200, adresse)
        self.se_connecter(self.client_a)
        self.assertEqual(self.creer(type="traduction", texte="Bonjour").status_code, 403)

    def test_conversations_super_administrateur_seulement(self):
        cle = self.client.post("/api/assistant/messages/", {"texte": "Bonjour"}, format="json").data["cle"]
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(ADMIN + "conversations/").status_code, 403)
        self.assertEqual(self.client.get(f"{ADMIN}conversations/{cle}/").status_code, 403)
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(ADMIN + "conversations/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(ADMIN + "conversations/").status_code, 401)

    def test_lecture_des_conversations_est_journalisee_sans_donnee_personnelle(self):
        self.se_connecter(self.client_a)
        self.client.post("/api/assistant/messages/", {"texte": "Question de compte"}, format="json")
        self.client.force_authenticate(None)
        cle_visiteur = self.client.post("/api/assistant/messages/", {"texte": "Question de visiteur"}, format="json",
                                        REMOTE_ADDR="10.4.4.4").data["cle"]
        self.se_connecter(self.super_admin)
        liste = self.client.get(ADMIN + "conversations/")
        self.assertEqual(liste.status_code, 200)
        self.assertEqual(liste.data["count"], 2)
        self.assertEqual({c["utilisateur"] for c in liste.data["results"]}, {True, False})
        self.assertEqual(set(liste.data["results"][0]) >= {"cle", "utilisateur", "langue", "contexte", "cree_le",
                                                          "derniere_activite_le"}, True)
        brut = json.dumps(liste.data, default=str)
        for secret in ("Alice", "alice@exemple.cm", "699"):
            self.assertNotIn(secret, brut)
        detail = self.client.get(f"{ADMIN}conversations/{cle_visiteur}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual([m["role"] for m in detail.data["messages"]], ["utilisateur", "assistant"])
        self.assertTrue(set(detail.data["messages"][1]) >= {"id", "role", "texte", "liens", "bloque", "cree_le"})
        self.assertEqual(detail.data["messages"][1]["bloque"], "")  # code interne pour l'équipe
        consultations = JournalAssistant.objects.filter(resultat="consultation")
        self.assertEqual(sorted(consultations.values_list("code", flat=True)), ["detail", "liste"])
        self.assertTrue(all(c.utilisateur == self.super_admin for c in consultations))
        self.assertEqual(self.client.get(f"{ADMIN}conversations/00000000-0000-0000-0000-000000000000/").status_code, 404)


class StatutEtJournalTests(Base):
    @override_settings(ASSISTANT_LIMITE_JOUR=500)
    def test_statut(self):
        self.client.post("/api/assistant/messages/", {"texte": "Bonjour"}, format="json")
        r = self.client.get(ADMIN + "statut/")
        self.assertEqual(r.data, {"configure": True, "modele_assistant": "gemini-2.5-flash",
                                  "modele_fond": "gemini-2.5-flash", "limite_jour": 500, "messages_aujourdhui": 1,
                                  "messages_mois": 1, "jetons_mois": 120})
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            self.assertFalse(self.client.get(ADMIN + "statut/").data["configure"])
        self.assertNotIn("cle-de-test", json.dumps(r.data))

    def test_journal_filtres_et_resume(self):
        self.faux.file = [texte("ok"), GeminiErreurTemporaire("x")]
        self.client.post("/api/assistant/messages/", {"texte": "a"}, format="json")
        self.client.post("/api/assistant/messages/", {"texte": "b"}, format="json", REMOTE_ADDR="10.5.5.5")
        liste = self.client.get(ADMIN + "journal/?resultat=ok")
        self.assertEqual(liste.data["count"], 1)
        self.assertEqual(set(liste.data["results"][0]), {"id", "agent", "utilisateur", "modele", "outils", "resultat",
                                                         "code", "jetons_entree", "jetons_sortie", "duree_ms", "cree_le"})
        self.assertEqual(self.client.get(ADMIN + "journal/?agent=fond").data["count"], 0)
        resume = self.client.get(ADMIN + "journal/resume/").data
        self.assertEqual(resume, {"ok": 1, "bloque": 0, "erreur_temporaire": 1, "erreur": 0, "limite": 0, "consultation": 0})


class BrouillonContactTests(Base):
    def test_reponse_contact_sans_donnee_personnelle(self):
        self.faux.file = [texte("Bonjour, l'équipe vous répondra par un devis pour le YD-500. Cordialement.")]
        r = self.creer(type="reponse_contact", cible_id=self.demande.pk)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(set(r.data), {"id", "type", "cible_type", "cible_id", "langue", "contenu", "etat", "bloque",
                                       "cree_par", "traite_par", "cree_le", "traite_le"})
        self.assertEqual((r.data["etat"], r.data["cible_type"], r.data["cible_id"], r.data["bloque"], r.data["langue"]),
                         ("propose", "demande_contact", self.demande.pk, "", "fr"))
        self.assertEqual(r.data["contenu"], {"texte": "Bonjour, l'équipe vous répondra par un devis pour le YD-500. Cordialement."})
        self.assertEqual(r.data["cree_par"], {"id": self.membre.pk, "nom_complet": "Membre CIR"})
        envoye = self.faux.tout_envoye
        for secret in ("Alice", "Ngono", "alice@exemple.cm", "699", "pharmacie", "Bonapriso"):
            self.assertNotIn(secret, envoye)
        self.assertIn("quel est le prix du YD-500", envoye)
        self.assertEqual(self.faux.appels[0]["modele"], "gemini-2.5-flash")
        ligne = JournalAssistant.objects.get()
        self.assertEqual((ligne.agent, ligne.utilisateur), ("fond", self.membre))

    def test_jamais_envoye_ni_applique_automatiquement(self):
        avant = (EnvoiEmail.objects.count(), Message.objects.count(), DemandeContact.objects.get().reponse_equipe)
        self.creer(type="reponse_contact", cible_id=self.demande.pk)
        self.creer(type="reponse_message", cible_id=self.fil.pk)
        self.assertEqual(avant, (EnvoiEmail.objects.count(), Message.objects.count(), DemandeContact.objects.get().reponse_equipe))
        self.assertEqual(DemandeContact.objects.get().etat, "nouvelle")

    def test_prix_et_engagement_et_coordonnees_controles(self):
        for sortie, code in [("Le prix est de 25 000 FCFA.", "prix_non_autorise"), ("J'ai confirmé votre commande.", "engagement"),
                             ("Écrivez à pirate@autre.com.", "coordonnees")]:
            self.faux.file = [texte(sortie)]
            r = self.creer(type="reponse_contact", cible_id=self.demande.pk)
            self.assertEqual((r.status_code, r.data["bloque"]), (201, code), sortie)
            self.assertNotIn("25 000", r.data["contenu"]["texte"])
            self.assertNotIn("pirate", r.data["contenu"]["texte"])

    def test_prix_publie_obtenu_par_outil_autorise(self):
        self.faux.file = [appels(("fiche_produit", {"reference": "YD-500"})), texte("Prix indicatif publié : 18 500 FCFA par m².")]
        r = self.creer(type="reponse_contact", cible_id=self.demande.pk)
        self.assertEqual(r.data["bloque"], "")
        self.assertEqual(len(JournalAssistant.objects.filter(agent="fond")), 2)

    def test_reponse_message_langue_du_compte_sans_nom(self):
        self.client_a.langue = "en"
        self.client_a.save()
        self.faux.file = [texte("Hello, the team will reply about the delay.")]
        r = self.creer(type="reponse_message", cible_id=self.fil.pk)
        self.assertEqual((r.status_code, r.data["langue"], r.data["cible_type"]), (201, "en", "conversation_messagerie"))
        envoye = self.faux.tout_envoye
        for secret in ("Alice", "Ngono", "699", "alice@exemple.cm"):
            self.assertNotIn(secret, envoye)
        self.assertIn("le client", envoye)
        self.assertIn("anglais", self.faux.appels[0]["messages"][0]["texte"])

    def test_cibles_inconnues_et_formes_invalides(self):
        for corps, statut in [({"type": "reponse_contact", "cible_id": 9999}, 404), ({"type": "reponse_message", "cible_id": 9999}, 404),
                              ({"type": "reponse_contact"}, 400), ({"type": "reponse_contact", "cible_id": "a"}, 400),
                              ({"type": "inconnu"}, 400), ({"type": "traduction", "texte": ""}, 400),
                              ({"type": "traduction", "texte": "x", "langues": ["es"]}, 400),
                              ({"type": "traduction", "texte": "x", "contexte": "zzz"}, 400),
                              ({"type": "traduction", "texte": "x" * 5001}, 400)]:
            with self.subTest(corps=corps):
                self.assertEqual(self.creer(**corps).status_code, statut)
        self.assertEqual(Brouillon.objects.count(), 0)
        self.assertEqual(self.faux.appels, [])


class BrouillonTraductionTests(Base):
    SORTIE = "### en\nThe CIR and Jiuye present Sol autolissant.\n### zh\nCIR 与 Jiuye 推出 Sol autolissant。\n" \
             "### de\nCIR und Jiuye präsentieren Sol autolissant.\n### ja\nCIR と Jiuye が Sol autolissant を紹介します。"

    def test_traduction_quatre_langues_par_defaut(self):
        self.faux.file = [texte(self.SORTIE)]
        r = self.creer(type="traduction", texte="Le CIR et Jiuye présentent Sol autolissant.", contexte="produit")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(set(r.data["contenu"]), {"en", "zh", "de", "ja"})
        self.assertEqual((r.data["bloque"], r.data["cible_type"], r.data["cible_id"]), ("", "texte", None))
        self.assertEqual(self.faux.appels[0]["outils"], [])  # aucun outil pour une traduction
        self.assertIn("Jiuye", self.faux.appels[0]["messages"][0]["texte"])

    def test_langues_choisies_et_noms_propres(self):
        self.faux.file = [texte("### en\nThe Complex and 久业 present it.\n### de\nDas Komplex.")]
        r = self.creer(type="traduction", texte="Le CIR et Jiuye le présentent.", langues=["en", "de"])
        self.assertEqual(set(r.data["contenu"]), {"en", "de"})
        self.assertEqual(r.data["bloque"], "noms_propres")

    def test_montants_de_la_source_conserves_autres_refuses(self):
        self.faux.file = [texte("### en\nFrom 12,500 FCFA.\n### de\nAb 99.000 FCFA.")]
        r = self.creer(type="traduction", texte="À partir de 12 500 FCFA.", langues=["en", "de"])
        self.assertEqual(r.data["bloque"], "prix_non_autorise")
        self.assertEqual(r.data["contenu"]["en"], "From 12,500 FCFA.")
        self.assertNotIn("99", r.data["contenu"]["de"])

    def test_reponse_inexploitable_ou_bloquee(self):
        self.faux.file = [texte("Voici la traduction sans format.")]
        self.assertEqual(self.creer(type="traduction", texte="Bonjour").status_code, 503)
        self.assertEqual(Brouillon.objects.count(), 0)
        self.faux.file = [GeminiContenuBloque("x")]
        r = self.creer(type="traduction", texte="Bonjour")
        self.assertEqual((r.status_code, r.data["bloque"]), (201, "contenu"))

    def test_service_absent_ou_en_panne(self):
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            r = self.creer(type="traduction", texte="Bonjour")
        self.assertEqual((r.status_code, r.json()["code"]), (503, "assistant_non_configure"))
        self.faux.file = [GeminiErreurTemporaire("x")]
        r = self.creer(type="traduction", texte="Bonjour")
        self.assertEqual((r.status_code, r.json()["code"]), (503, "assistant_indisponible"))
        self.assertEqual(Brouillon.objects.count(), 0)


class QuotaBrouillonsTests(Base):
    def test_60_par_heure_et_par_membre(self):
        Brouillon.objects.bulk_create([Brouillon(type="traduction", cree_par=self.membre) for _ in range(59)])
        self.assertEqual(self.creer(type="reponse_contact", cible_id=self.demande.pk).status_code, 201)
        r = self.creer(type="reponse_contact", cible_id=self.demande.pk)
        self.assertEqual((r.status_code, r.json()["code"]), (429, "assistant_trop_de_messages"))
        self.se_connecter(self.super_admin)
        self.assertEqual(self.creer(type="reponse_contact", cible_id=self.demande.pk).status_code, 201)

    def test_le_quota_est_pris_avant_l_appel(self):
        """La ligne du brouillon existe pendant l'appel à Gemini : deux demandes simultanées sont comptées."""
        vu = {}

        def espion(**demande):
            vu["nombre"] = Brouillon.objects.count()
            return texte("Bonjour")

        with mock.patch("integrations.gemini.client.generer", side_effect=espion):
            self.creer(type="reponse_contact", cible_id=self.demande.pk)
        self.assertEqual(vu["nombre"], 1)


class TraitementBrouillonTests(Base):
    def setUp(self):
        super().setUp()
        self.brouillon = Brouillon.objects.create(type="reponse_contact", cible_type="demande_contact",
                                                  cible_id=self.demande.pk, contenu={"texte": "Bonjour"}, cree_par=self.membre)
        self.adresse = f"{BROUILLONS}{self.brouillon.pk}/"

    def test_liste_filtres_et_detail(self):
        Brouillon.objects.create(type="traduction", contenu={"en": "x"}, cree_par=self.membre, etat="rejete")
        self.assertEqual(self.client.get(BROUILLONS).data["count"], 2)
        self.assertEqual(self.client.get(BROUILLONS + "?type=traduction").data["count"], 1)
        self.assertEqual(self.client.get(BROUILLONS + "?etat=propose").data["count"], 1)
        self.assertEqual(self.client.get(f"{BROUILLONS}?cible_type=demande_contact&cible_id={self.demande.pk}").data["count"], 1)
        self.assertEqual(self.client.get(self.adresse).data["id"], self.brouillon.pk)
        self.assertEqual(self.client.get(BROUILLONS + "9999/").status_code, 404)

    def test_accepter_conserve_le_texte_et_n_applique_rien(self):
        r = self.client.patch(self.adresse, {"etat": "accepte"}, format="json")
        self.assertEqual((r.status_code, r.data["etat"], r.data["traite_par"]["id"]), (200, "accepte", self.membre.pk))
        self.assertIsNotNone(r.data["traite_le"])
        self.assertEqual(DemandeContact.objects.get().reponse_equipe, "")
        self.assertEqual(DemandeContact.objects.get().etat, "nouvelle")

    def test_modifier_garde_le_texte_de_l_equipe(self):
        r = self.client.patch(self.adresse, {"etat": "modifie", "contenu": {"texte": "  Version relue  "}}, format="json")
        self.assertEqual((r.status_code, r.data["contenu"], r.data["etat"]), (200, {"texte": "Version relue"}, "modifie"))
        self.assertEqual(self.client.patch(self.adresse, {"etat": "rejete"}, format="json").json()["code"], "brouillon_deja_traite")

    def test_refus_et_formes_invalides(self):
        for corps in ({"etat": "propose"}, {"etat": "zzz"}, {}, {"etat": "modifie"}, {"etat": "modifie", "contenu": {"autre": "x"}},
                      {"etat": "accepte", "contenu": {"texte": "x" * 5001}}):
            with self.subTest(corps=corps):
                self.assertEqual(self.client.patch(self.adresse, corps, format="json").status_code, 400)
        self.assertEqual(Brouillon.objects.get().etat, "propose")
        self.assertEqual(self.client.patch(BROUILLONS + "9999/", {"etat": "rejete"}, format="json").status_code, 404)

    def test_traduction_modifiee(self):
        brouillon = Brouillon.objects.create(type="traduction", contenu={"en": "a"}, cree_par=self.membre)
        r = self.client.patch(f"{BROUILLONS}{brouillon.pk}/", {"etat": "modifie", "contenu": {"en": "b", "de": "c"}}, format="json")
        self.assertEqual(r.data["contenu"], {"en": "b", "de": "c"})
        autre = Brouillon.objects.create(type="traduction", contenu={}, cree_par=self.membre)
        self.assertEqual(self.client.patch(f"{BROUILLONS}{autre.pk}/", {"etat": "modifie", "contenu": {"fr": "b"}}, format="json").status_code, 400)

    def test_pas_de_suppression_ni_de_put(self):
        self.assertEqual(self.client.delete(self.adresse).status_code, 405)
        self.assertEqual(self.client.put(self.adresse, {"etat": "accepte"}, format="json").status_code, 405)
