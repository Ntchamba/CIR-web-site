"""API des notifications : client, équipe, préférences, désabonnement, modèles d'e-mails, envois."""
from unittest import mock

from django.test import override_settings

from apps.noyau.tests.outils_direct import BaseVague3
from apps.notifications import courriels, services, taches
from apps.notifications.models import EnvoiEmail, ModeleEmail, Notification

URL = "/api/notifications/"
ADMIN = "/api/admin/notifications/"


def creer(utilisateur, type_="commande_creee", **donnees):
    base = {"commande": 3, "reference": "CIR-2026-0003", "nom": "Alice Client"}
    return Notification.objects.create(utilisateur=utilisateur, type=type_, donnees={**base, **donnees})


class ClientTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.n1, self.n2 = creer(self.client_a), creer(self.client_a, "etape_changee", etape="travaux")
        creer(self.client_b)
        self.se_connecter(self.client_a)

    def test_acces(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL).status_code, 401)
        self.se_connecter(self.membre)
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_liste_pagine_et_isolee(self):
        r = self.client.get(URL)
        self.assertEqual(r.data["count"], 2)
        self.assertEqual([n["id"] for n in r.data["results"]], [self.n2.pk, self.n1.pk])
        premiere = r.data["results"][0]
        self.assertEqual(set(premiere), {"id", "type", "titre", "texte", "lien", "lue", "cree_le"})
        self.assertEqual(premiere["lien"], "/commandes/3")

    def test_texte_dans_la_langue_de_la_requete(self):
        for langue, extrait in (("fr", "a changé"), ("en", "has changed"), ("zh-hans", "已更新"),
                                ("de", "geändert"), ("ja", "変わりました")):
            with self.subTest(langue=langue):
                texte = self.client.get(URL, HTTP_ACCEPT_LANGUAGE=langue).data["results"][0]["texte"]
                self.assertIn(extrait, texte)
                self.assertIn("CIR-2026-0003", texte)

    def test_filtre_lue(self):
        self.client.post(f"{URL}{self.n1.pk}/lue/")
        self.assertEqual([n["id"] for n in self.client.get(URL + "?lue=0").data["results"]], [self.n2.pk])
        self.assertEqual([n["id"] for n in self.client.get(URL + "?lue=1").data["results"]], [self.n1.pk])

    def test_non_lues_lue_et_tout_lire(self):
        self.assertEqual(self.client.get(URL + "non-lues/").data, {"count": 2})
        r = self.client.post(f"{URL}{self.n1.pk}/lue/")
        self.assertTrue(r.data["lue"])
        self.assertEqual(self.client.get(URL + "non-lues/").data, {"count": 1})
        self.assertEqual(self.client.post(URL + "lues/").data, {"count": 0})
        self.assertEqual(self.client.get(URL + "non-lues/").data, {"count": 0})
        self.assertEqual(Notification.objects.filter(utilisateur=self.client_b, lue=False).count(), 1)
        self.assertTrue(self.trames(f"utilisateur_{self.client_a.pk}", "non_lus"))  # pastille mise à jour en direct

    def test_pas_de_lecture_de_la_notification_d_un_autre(self):
        autre = Notification.objects.filter(utilisateur=self.client_b).first()
        self.assertEqual(self.client.post(f"{URL}{autre.pk}/lue/").status_code, 404)
        autre.refresh_from_db()
        self.assertFalse(autre.lue)

    def test_preferences(self):
        self.assertEqual(self.client.get(URL + "preferences/").data, {"recevoir_nouveautes": False})
        r = self.client.patch(URL + "preferences/", {"recevoir_nouveautes": True}, format="json")
        self.assertEqual(r.data, {"recevoir_nouveautes": True})
        self.client_a.refresh_from_db()
        self.assertTrue(self.client_a.recevoir_nouveautes)
        self.assertEqual(self.client.patch(URL + "preferences/", {"recevoir_nouveautes": "oui"}, format="json").status_code, 400)

    def test_comptes_moi_expose_les_preferences(self):
        r = self.client.get("/api/comptes/moi/")
        self.assertIs(r.data["recevoir_nouveautes"], False)
        self.assertIs(r.data["email_equipe"], True)
        self.client.patch("/api/comptes/moi/", {"recevoir_nouveautes": True, "email_equipe": False}, format="json")
        self.client_a.refresh_from_db()
        self.assertFalse(self.client_a.recevoir_nouveautes)  # modifiable seulement par /preferences/

    def test_valeurs_par_defaut_des_comptes(self):
        self.assertFalse(self.client_a.recevoir_nouveautes)  # consentement : désactivé par défaut
        self.assertTrue(self.membre.email_equipe)


@override_settings(API_URL_PUBLIQUE="https://api.exemple.cm")
class DesabonnementTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.client_a.recevoir_nouveautes = True
        self.client_a.save()
        self.jeton = courriels.jeton_desabonnement(self.client_a)

    def test_desabonnement_sans_compte_connecte(self):
        r = self.client.get(f"{URL}desabonnement/?jeton={self.jeton}")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/html", r["Content-Type"])
        self.assertIn("Vous êtes désabonné", r.content.decode())
        self.client_a.refresh_from_db()
        self.assertFalse(self.client_a.recevoir_nouveautes)

    def test_page_traduite(self):
        r = self.client.get(f"{URL}desabonnement/?jeton={self.jeton}", HTTP_ACCEPT_LANGUAGE="en")
        self.assertIn("You are unsubscribed", r.content.decode())

    def test_post_list_unsubscribe(self):
        r = self.client.post(f"{URL}desabonnement/?jeton={self.jeton}", data="List-Unsubscribe=One-Click",
                             content_type="application/x-www-form-urlencoded")
        self.assertEqual(r.status_code, 200)
        self.client_a.refresh_from_db()
        self.assertFalse(self.client_a.recevoir_nouveautes)

    def test_jeton_faux_404_generique(self):
        for jeton in ("", "faux", self.jeton[:-3] + "xyz", courriels.signing.dumps({"u": self.client_a.pk}, salt="autre")):
            r = self.client.get(f"{URL}desabonnement/?jeton={jeton}")
            self.assertEqual(r.status_code, 404)
            self.assertEqual(r.content, b"")
        self.client_a.refresh_from_db()
        self.assertTrue(self.client_a.recevoir_nouveautes)

    def test_le_jeton_ne_desabonne_que_les_clients(self):
        jeton = courriels.jeton_desabonnement(self.membre)
        self.assertEqual(self.client.get(f"{URL}desabonnement/?jeton={jeton}").status_code, 404)

    def test_autres_methodes_refusees(self):
        self.assertEqual(self.client.delete(f"{URL}desabonnement/?jeton={self.jeton}").status_code, 405)


class EquipeTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.n = creer(self.membre, "commande_nouvelle")
        creer(self.client_a)
        self.se_connecter(self.membre)

    def test_acces(self):
        self.se_connecter(self.client_a)
        self.assertEqual(self.client.get(ADMIN).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(ADMIN).status_code, 401)

    def test_ses_propres_notifications(self):
        r = self.client.get(ADMIN)
        self.assertEqual([n["id"] for n in r.data["results"]], [self.n.pk])
        self.assertEqual(self.client.get(ADMIN + "non-lues/").data, {"count": 1})
        self.assertTrue(self.client.post(f"{ADMIN}{self.n.pk}/lue/").data["lue"])
        self.assertEqual(self.client.post(ADMIN + "lues/").data, {"count": 0})

    def test_preferences_equipe(self):
        self.assertEqual(self.client.get(ADMIN + "preferences/").data, {"email_equipe": True})
        self.assertEqual(self.client.patch(ADMIN + "preferences/", {"email_equipe": False}, format="json").data,
                         {"email_equipe": False})
        self.membre.refresh_from_db()
        self.assertFalse(self.membre.email_equipe)

    def test_reserve_au_super_admin(self):
        for methode, chemin in (("get", "modeles/"), ("put", "modeles/commande_creee/fr/"),
                                ("delete", "modeles/commande_creee/fr/"), ("post", "modeles/apercu/"),
                                ("get", "envois/"), ("get", "envois/resume/"), ("post", "envois/1/reessayer/")):
            with self.subTest(chemin=chemin, methode=methode):
                self.assertEqual(getattr(self.client, methode)(ADMIN + chemin).status_code, 403)


class ModelesTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.super_admin)

    def test_liste_des_evenements(self):
        r = self.client.get(ADMIN + "modeles/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 17)  # 18 événements, dont « paiement_echoue » sans e-mail
        ligne = next(e for e in r.data if e["evenement"] == "commande_creee")
        self.assertEqual(set(ligne), {"evenement", "libelle", "variables", "langues"})
        self.assertEqual(ligne["variables"], ["nom", "reference", "montant", "etape"])
        self.assertEqual([l["langue"] for l in ligne["langues"]], ["fr", "en", "zh", "de", "ja"])
        self.assertTrue(all(l["modele"] is None and l["defaut"]["sujet"] for l in ligne["langues"]))
        self.assertEqual(ligne["langues"][1]["defaut"]["sujet"], "Your order {reference} has been recorded")

    def test_enregistrer_remplacer_et_retablir(self):
        r = self.client.put(ADMIN + "modeles/commande_creee/en/", {"sujet": "Got it {reference}",
                            "introduction": "Thanks {nom}!"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.put(ADMIN + "modeles/commande_creee/en/", {"sujet": "Got it again", "introduction": "Thanks"}, format="json")
        self.assertEqual(ModeleEmail.objects.count(), 1)
        en = next(e for e in self.client.get(ADMIN + "modeles/").data
                  if e["evenement"] == "commande_creee")["langues"][1]
        self.assertEqual(en["modele"], {"sujet": "Got it again", "introduction": "Thanks"})
        self.assertEqual(self.client.delete(ADMIN + "modeles/commande_creee/en/").status_code, 204)
        self.assertEqual(ModeleEmail.objects.count(), 0)

    def test_variables_inconnues_400(self):
        for sujet in ("Salut {prix}", "{nom.__class__}", "{0}", "{nom!r}", "{nom:>10}", "{", "}"):
            with self.subTest(sujet=sujet):
                r = self.client.put(ADMIN + "modeles/commande_creee/fr/", {"sujet": sujet, "introduction": "ok"},
                                    format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn("sujet", r.data)
        r = self.client.put(ADMIN + "modeles/commande_creee/fr/", {"sujet": "ok", "introduction": "{secret}"}, format="json")
        self.assertIn("introduction", r.data)
        self.assertEqual(ModeleEmail.objects.count(), 0)

    def test_champs_obligatoires_et_longueurs(self):
        url = ADMIN + "modeles/commande_creee/fr/"
        self.assertEqual(self.client.put(url, {"sujet": "", "introduction": "x"}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"sujet": "x" * 151, "introduction": "x"}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"sujet": "x", "introduction": "y" * 1001}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"sujet": "a\nb", "introduction": "x"}, format="json").status_code, 400)
        self.assertEqual(self.client.put(url, {"sujet": "x" * 150, "introduction": "y" * 1000}, format="json").status_code, 200)

    def test_evenement_ou_langue_inconnus_404(self):
        corps = {"sujet": "a", "introduction": "b"}
        self.assertEqual(self.client.put(ADMIN + "modeles/inconnu/fr/", corps, format="json").status_code, 404)
        self.assertEqual(self.client.put(ADMIN + "modeles/commande_creee/es/", corps, format="json").status_code, 404)
        self.assertEqual(self.client.delete(ADMIN + "modeles/commande_creee/es/").status_code, 404)

    def test_apercu_avec_valeurs_d_exemple(self):
        r = self.client.post(ADMIN + "modeles/apercu/", {"evenement": "contrat_signe", "langue": "en",
                             "sujet": "Signed {reference}", "introduction": "<b>Hi</b> {nom}, {montant}"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(set(r.data), {"sujet", "corps_html", "corps_texte"})
        self.assertEqual(r.data["sujet"], "Signed [reference]")
        self.assertIn("[nom]", r.data["corps_texte"])
        self.assertIn("[montant]", r.data["corps_texte"])
        self.assertNotIn("<b>Hi</b>", r.data["corps_html"])  # échappé
        self.assertNotIn("Alice", r.content.decode())  # jamais de vrai client
        self.assertEqual(ModeleEmail.objects.count(), 0)  # rien d'enregistré

    def test_libelle_traduit_selon_la_langue(self):
        for langue, attendu in (("fr", "Commande enregistrée"), ("en", "Order recorded"), ("zh-hans", "订单已登记"),
                                ("de", "Bestellung erfasst"), ("ja", "注文受付")):
            with self.subTest(langue=langue):
                r = self.client.get(ADMIN + "modeles/", HTTP_ACCEPT_LANGUAGE=langue)
                ligne = next(e for e in r.data if e["evenement"] == "commande_creee")
                self.assertEqual(ligne["libelle"], attendu)

    def test_apercu_par_defaut_et_erreurs(self):
        r = self.client.post(ADMIN + "modeles/apercu/", {"evenement": "etape_changee", "langue": "de"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.post(ADMIN + "modeles/apercu/", {"evenement": "x", "langue": "fr"}, format="json").status_code, 404)
        r = self.client.post(ADMIN + "modeles/apercu/", {"evenement": "etape_changee", "langue": "fr",
                             "sujet": "{bidon}"}, format="json")
        self.assertEqual(r.status_code, 400)


class EnvoisTests(BaseVague3):
    def setUp(self):
        super().setUp()
        self.se_connecter(self.super_admin)
        base = {"evenement": "commande_creee", "sujet": "S", "corps_texte": "T", "prochaine_tentative": "2026-10-20T10:00:00Z"}
        self.e1 = EnvoiEmail.objects.create(destinataire_email="jean@exemple.cm", cle_unique="1", etat="echec",
                                            derniere_erreur="GmailErreurDefinitive", **base)
        EnvoiEmail.objects.create(destinataire_email="x@exemple.cm", cle_unique="2", **base)
        EnvoiEmail.objects.create(destinataire_email="y@exemple.cm", cle_unique="3", etat="envoye", **base)

    def test_liste_masquee_et_filtree(self):
        r = self.client.get(ADMIN + "envois/")
        self.assertEqual(r.data["count"], 3)
        ligne = next(e for e in r.data["results"] if e["id"] == self.e1.pk)
        self.assertEqual(ligne["destinataire_email"], "j***@exemple.cm")
        self.assertEqual(set(ligne), {"id", "destinataire_email", "evenement", "etat", "tentatives", "derniere_erreur",
                                      "derniere_erreur_code", "cree_le", "envoye_le"})
        self.assertEqual(ligne["derniere_erreur_code"], "GmailErreurDefinitive")
        self.assertIn("refusé l'envoi", ligne["derniere_erreur"])
        en = self.client.get(ADMIN + "envois/", HTTP_ACCEPT_LANGUAGE="en").data["results"]
        self.assertIn("refused", next(e for e in en if e["id"] == self.e1.pk)["derniere_erreur"])
        autre = next(e for e in r.data["results"] if e["id"] != self.e1.pk)
        self.assertEqual((autre["derniere_erreur"], autre["derniere_erreur_code"]), ("", ""))
        self.assertNotIn("jean@", r.content.decode())
        self.assertEqual(self.client.get(ADMIN + "envois/?etat=echec").data["count"], 1)

    def test_resume(self):
        with mock.patch.object(taches.gmail, "configure", return_value=False):
            r = self.client.get(ADMIN + "envois/resume/")
        self.assertEqual(r.data, {"en_attente": 1, "envoye": 1, "echec": 1, "annule": 0, "gmail_configure": False})

    def test_reessayer_seulement_un_echec(self):
        r = self.client.post(f"{ADMIN}envois/{self.e1.pk}/reessayer/")
        self.assertEqual(r.data["etat"], "en_attente")
        self.e1.refresh_from_db()
        self.assertEqual((self.e1.tentatives, self.e1.derniere_erreur), (0, ""))
        self.assertEqual(self.client.post(f"{ADMIN}envois/{self.e1.pk}/reessayer/").status_code, 400)
        self.assertEqual(self.client.post(f"{ADMIN}envois/9999/reessayer/").status_code, 404)

    def test_masquage(self):
        self.assertEqual(services.masquer_email("jean@exemple.cm"), "j***@exemple.cm")
        self.assertEqual(services.masquer_email("pas-une-adresse"), "***")
