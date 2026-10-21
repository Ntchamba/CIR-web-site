"""Garde-fous de sortie : tests ADVERSES (contournements, formes inhabituelles, 5 langues).

Module pur : aucun accès à la base. Chaque test liste TOUS les cas qui échappent au garde-fou (sous-tests).
"""
from django.test import SimpleTestCase

from apps.assistant import garde_fous as g
from apps.assistant.garde_fous import Coordonnees, LienAutorise

COORD = Coordonnees(emails=("contact@exemple-cir.cm",), telephones=("+237 699 00 11 22",))
LIENS = [LienAutorise("Sol autolissant époxy", "/catalogue/sol-autolissant", ("YD-500",))]


def controle(texte, langue="fr", montants=(), liens=LIENS, coordonnees=COORD):
    return g.controler_sortie(texte, langue=langue, montants_autorises=montants, liens_autorises=liens,
                              coordonnees=coordonnees)


class ContournementsDeMontantsTests(SimpleTestCase):
    """Un même montant, écrit avec des séparateurs ou des caractères détournés, reste un montant."""

    def verifier_bloques(self, textes, code=g.PRIX):
        for texte in textes:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, code, f"{texte!r} -> {sortie.texte!r}")
                self.assertTrue(sortie.proposer_contact)

    def test_separateurs_et_espaces_exotiques(self):
        self.verifier_bloques([
            "12 500 FCFA", "12 500 FCFA", "12 500 FCFA", "12 500 FCFA", "12　500 FCFA",
            "12​500 FCFA", "12‍500 FCFA", "1­2500 FCFA", "12.500 FCFA", "12,500 XAF", "12'500 CFA",
            "12٫500 FCFA", "12٬500 FCFA", "12.500.000 FCFA", "12500,00 FCFA", "12 500,50 FCFA",
        ])

    def test_chiffres_pleine_largeur_et_autres_ecritures(self):
        self.verifier_bloques(["１２５００ ＦＣＦＡ", "１２５００ FCFA", "٣٠٠٠٠ FCFA", "३००० FCFA", "𝟏𝟐𝟓𝟎𝟎 FCFA",
                               "¹²⁵⁰⁰ FCFA", "12 500 ｆｃｆａ"])

    def test_homoglyphes_dans_la_devise(self):
        self.verifier_bloques(["12 500 FСFA", "12 500 ｆｃｆａ", "12 500 Ｆ ＣＦＡ"])  # С cyrillique, pleine largeur

    def test_devises_et_symboles(self):
        self.verifier_bloques([
            "€12500", "12500€", "12500$", "15$ le m²", "15 $/m²", "$ 12 500", "US$ 12 500", "USD 12500", "EUR12,500",
            "XAF 12 500", "FCFA 12 500", "12500 CNY", "12500 XOF", "12,500 yen", "¥12500", "£12500",
            "12 500 Fr.", "12500 francs", "12500F", "12 500 f. cfa", "12 500 F-CFA", "12 500 CFA francs",
        ])

    def test_multiplicateurs(self):
        self.verifier_bloques(["12k", "12 K FCFA", "12.5k", "12,5 k FCFA", "2,5 millions", "2 MILLIONS", "2 Million FCFA",
                               "1M FCFA", "1 M FCFA", "12 kFCFA", "3 Mio. Euro", "zwei Millionen Franken"])

    def test_par_metre_carre_sans_devise(self):
        self.verifier_bloques(["12 500/m2", "9 000 le m²", "9 000 au m²", "9000 par m²", "8 500 pro m²",
                               "每平方米500元", "平米あたり5000円"])

    def test_montants_en_lettres(self):
        self.verifier_bloques([
            "dix mille francs", "douze mille cinq cents francs", "cinquante mille FCFA", "quatre-vingt mille francs",
            "un million de francs", "un million cinq cent mille FCFA", "ten thousand francs", "fifty thousand FCFA",
            "five hundred euros", "twenty euros", "zwanzig Euro", "fünftausend Franken", "hunderttausend Franken",
            "一万二千元", "三千块", "二百五十円", "五万円", "300万日元", "三百万元", "五千円です",
        ])

    def test_montant_en_lettres_apres_un_mot_de_prix(self):
        self.verifier_bloques(["Le prix est de cinquante mille", "The price is twelve thousand", "Preis: dreitausend",
                               "价格是五千", "总价五千", "価格は五千です"])

    def test_remises_et_pourcentages(self):
        self.verifier_bloques(["15 % de remise", "remise de quinze pour cent", "discount of ten percent",
                               "zehn Prozent Rabatt", "10 % Rabatt", "折扣 10%", "九折", "打八折", "割引 10％", "1割引",
                               "10％オフ"])

    def test_nombre_derriere_un_mot_de_prix_sans_devise(self):
        self.verifier_bloques(["Le prix: 50000", "Preis 5000", "价格：5000", "价格为5000", "单价5000", 
                               "価格は5000", "価格5000", "料金は5000", "見積もりは5000", "à partir de 12 500",
                               "dès 8000"])

    def test_montant_en_chiffres_dans_un_texte_long(self):
        texte = ("Le sol YD-500 convient pour l'industrie. " * 20) + "Comptez 12 500 FCFA le m²."
        self.assertEqual(controle(texte).bloque, g.PRIX)

    def test_montants_autorises_seulement_exactement(self):
        self.assertEqual(controle("18 500 FCFA", montants={18500}).bloque, "")
        self.assertEqual(controle("１８５００ FCFA", montants={18500}).bloque, "")
        self.assertEqual(controle("18,5k FCFA", montants={18500}).bloque, "")
        for texte in ("18 501 FCFA", "185 000 FCFA", "1 850 FCFA", "18 500 FCFA et 19 000 FCFA", "18 500,50 FCFA"):
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte, montants={18500}).bloque, g.PRIX)

    def test_pourcentage_jamais_autorise_par_un_montant(self):
        self.assertEqual(controle("Remise de 18 %", montants={18}).bloque, g.PRIX)

    def test_pas_de_faux_positifs_techniques(self):
        for texte in ["Le YD-500 convient pour 100 m² de sol.", "Séchage en 24 heures à 25 °C.", "Épaisseur de 2 à 3 mm.",
                      "Nous sommes à Douala depuis 2006.", "Chantier de 5 000 m².", "Plus de 10 000 m² réalisés.",
                      "Résistance 35 MPa.", "Dosage 1,5 kg/m².", "Livraison en 3 à 5 jours ouvrés ?",
                      "Surface minimale : 20 m2", "Il y a 12 couleurs.", "Version 2", "À partir de 100 m²",
                      "Ab 100 m² de Fläche", "from 100 m2", "Appelez du lundi au vendredi, de 8 h à 17 h.",
                      "Commande CIR-2026-0001 du 21/10/2026."]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).bloque, "", texte)


class SortieNonAlTereeTests(SimpleTestCase):
    def test_les_unites_ne_sont_pas_alterees_par_la_normalisation(self):
        """La normalisation Unicode sert à DÉTECTER ; le texte montré au client garde ses caractères (m², °C…)."""
        for texte in ["Pour 100 m² de sol, séchage à 25 °C.", "Compter 2 m² par seau.", "Surface : 20 ㎡", "Dosage 1,5 kg/m²."]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, "")
                self.assertEqual(sortie.texte, texte)

    def test_caracteres_non_latins_conserves(self):
        for texte in ["我们提供环氧树脂地坪。", "エポキシ樹脂の床材です。", "Epoxidharzböden für die Industrie.",
                      "Revêtements époxy « sur devis » ― œuvre à Douala."]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).texte, texte)


class EngagementsAdversesTests(SimpleTestCase):
    def test_engagements_formes_courtes_et_conjugaisons(self):
        for texte in [
            "Votre commande a bien été passée.", "Commande passée !", "J'annule votre commande.",
            "J'accepte la proposition de l'équipe en votre nom.", "Paiement reçu.", "Paiement effectué.",
            "Votre paiement a bien été reçu.", 
            "Order placed successfully.", "Payment received.", "Payment confirmed.", "Payment successful.",
            "Your payment went through.",
            "Zahlung erfolgreich.", "Zahlung erhalten.", "Bestellung aufgegeben.", "Vertrag unterschrieben.",
            "已下单", "已付款", "我已付款", "我已帮您付款", "支付成功", "付款成功", "订单创建成功", "已签约",
            "注文を承りました。", "ご注文を承りました。", "お支払い済みです。", "私が支払いました。", "代わりに支払いました。",
            "契約済みです",
        ]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, g.ENGAGEMENT, f"{texte!r} -> {sortie.texte!r}")

    def test_engagement_dissimule_par_la_forme(self):
        for texte in ["J’ai passé votre commande.", "J'ai passé votre commande.", "J'ai pa​ssé votre commande.",
                      "J'AI PASSÉ VOTRE COMMANDE.", "j’ai confirmé le contrat", "Ｉ have placed your order.",
                      "Voici : j'ai signé le contrat.", "Bonjour ! Je viens de payer l'acompte."]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).bloque, g.ENGAGEMENT, texte)

    def test_repli_d_engagement_ne_reprend_pas_le_texte_du_modele(self):
        sortie = controle("J'ai signé le contrat. Lien : https://evil.example/x")
        self.assertNotIn("evil", sortie.texte)
        self.assertNotIn("signé le contrat", sortie.texte)
        self.assertEqual(sortie.liens, [])

    def test_explications_et_etapes_restent_autorisees(self):
        for texte in ["Votre commande est à l'étape « Contrat signé ».", "Le paiement n'est possible qu'après « Contrat signé ».",
                      "Pour signer, contactez l'équipe.", "Je ne peux pas valider votre paiement.",
                      "I cannot place an order for you; the team can.", "Ich kann keine Bestellung aufgeben.",
                      "我无法为您下单，请联系团队。", "私は注文を代行できません。チームにご連絡ください。",
                      "Une commande est payée après vérification auprès de CamPay.",
                      "Votre commande est « Terminée »."]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).bloque, "", texte)


class LiensEtHtmlAdversesTests(SimpleTestCase):
    def test_adresses_et_schemas_dissimules(self):
        for texte in ["Voir hxxp://evil.com", "Voir HTTPS://EVIL.COM/a?b=c", "Voir evil.com/path", "Voir www.evil.com",
                      "Voir WWW.EVIL.COM", "Voir ｅｖｉｌ．ｃｏｍ", "Voir https://ｅｖｉｌ.com", "Voir //evil.com/x",
                      "Voir ftp://evil.com", "Voir <http://evil.com>", "Voir t.me/evil", "Voir bit.ly/abc",
                      "Voir wa.me/237677000000", "Voir sub.evil.co.uk/a", "Voir data:text/html;base64,AAA",
                      "Voir vbscript:x", "Voir javascript:alert(1)", "Voir JaVaScRiPt:alert(1)"]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                for interdit in ("evil", "bit.ly", "t.me", "wa.me", "alert", "base64", "vbscript", "javascript"):
                    self.assertNotIn(interdit, sortie.texte.lower(), f"{texte!r} -> {sortie.texte!r}")
                self.assertEqual(sortie.liens, [])

    def test_liens_markdown_pieges(self):
        for texte in ["Voir [a](  JAVASCRIPT:alert(1) )", "Voir [a](java\nscript:alert(1))", "Voir [x](//evil.com)",
                      "Voir [x](/compte)", "Voir [x](/catalogue/sol-autolissant/../../compte)",
                      "Voir [x](/catalogue/sol-autolissant?next=http://evil.com)", "Voir ![i](http://evil.com/p.png)",
                      "Voir [a][1]\n\n[1]: http://evil.com"]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertNotIn("evil", sortie.texte)
                self.assertNotIn("alert", sortie.texte)
                self.assertNotIn("](", sortie.texte)
                self.assertEqual(sortie.liens, [], texte)

    def test_lien_autorise_exact_seulement(self):
        sortie = controle("Voir [la fiche](/catalogue/sol-autolissant).")
        self.assertEqual(sortie.liens, [{"libelle": "Sol autolissant époxy", "chemin": "/catalogue/sol-autolissant"}])
        self.assertNotIn("](", sortie.texte)

    def test_html_et_entites(self):
        for texte in ["<script>alert(1)</script>ok", "<scr<script>ipt>alert(1)</scr</script>ipt>ok",
                      "<<script>script>alert(1)<</script>/script>ok", "&lt;script&gt;alert(1)&lt;/script&gt;ok",
                      "&#60;script&#62;alert(1)&#60;/script&#62;ok", "&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;ok",
                      "<img src=x onerror=alert(1)>ok", "<svg onload=alert(1)>ok", "<iframe src=x></iframe>ok",
                      "<a href='http://evil.com'>ok</a>", "<b>ok</b>", "<!-- c -->ok", "<?php echo 1 ?>ok"]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertNotRegex(sortie.texte, r"</?[A-Za-z!?]", texte)
                self.assertNotIn("alert", sortie.texte)
                self.assertNotIn("evil", sortie.texte)
                self.assertIn("ok", sortie.texte)

    def test_texte_mathematique_non_confondu_avec_du_html(self):
        self.assertEqual(controle("Si a < b et c > d, alors 5 < 6.").texte, "Si a < b et c > d, alors 5 < 6.")

    def test_longueur_bornee_apres_nettoyage(self):
        self.assertLessEqual(len(controle("é" * 5000).texte), g.LONGUEUR_MAX)
        self.assertLessEqual(len(controle("<b>" + "x" * 5000 + "</b>").texte), g.LONGUEUR_MAX)


class CoordonneesAdversesTests(SimpleTestCase):
    def test_numeros_inventes_sous_toutes_formes(self):
        for texte in ["Appelez le 677123456", "Appelez le 6 77 12 34 56", "Appelez le +237677123456",
                      "Appelez le 00237 677 12 34 56", "Appelez le (+237) 677-12-34-56", "Appelez le 677.12.34.56",
                      "WhatsApp : 677 123 456", "Appelez le 677 12 34 56", "Appelez le ６７７１２３４５６",
                      "Tel: 677-123-456", "Appelez 0677123456", "Appelez le +237 699 00 11 23", "Call +1 202 555 0143"]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, g.COORDONNEES, f"{texte!r} -> {sortie.texte!r}")
                self.assertNotRegex(sortie.texte, r"677|555|0143|1 202")

    def test_adresses_electroniques_inventees(self):
        for texte in ["evil@example.com", "Ｅｖｉｌ＠ｅｘａｍｐｌｅ．ｃｏｍ", "e.v.i.l@example.cm", "EVIL@EXAMPLE.COM.",
                      "contact@exemple-cir.cm.evil.com", "mailto:evil@x.com"]:
            with self.subTest(texte=texte):
                sortie = controle(f"Écrivez à {texte}")
                self.assertNotRegex(sortie.texte.lower(), r"evil|example")
                self.assertEqual(sortie.bloque, g.COORDONNEES)

    def test_coordonnees_publiques_reconnues_sous_d_autres_formes(self):
        for texte in ["Appelez le 699 00 11 22", "Appelez le 699001122", "Appelez le +237699001122",
                      "Appelez le +237 699-00-11-22", "Écrivez à CONTACT@EXEMPLE-CIR.CM"]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).bloque, "", texte)

    def test_sans_coordonnees_publiques_tout_est_retire(self):
        sortie = controle("Écrivez à contact@exemple-cir.cm ou appelez le 699 00 11 22.", coordonnees=Coordonnees())
        self.assertEqual(sortie.bloque, g.COORDONNEES)
        self.assertNotIn("contact@", sortie.texte)
        self.assertNotIn("699", sortie.texte)


class MinimisationAdverseTests(SimpleTestCase):
    """`masquer_identite` / `masquer_coordonnees` : avant tout envoi à Gemini."""

    def test_nom_email_telephone_sous_plusieurs_formes(self):
        termes = ["Jean-Pierre Mbarga Nguema", "jp@mail.cm", "677123456"]
        texte = ("Je suis JEAN-PIERRE MBARGA NGUEMA, écrivez à JP@MAIL.CM ou au 6 77 12 34 56, +237 677 12 34 56, "
                 "677-12-34-56. Mbarga, Nguema.")
        masque = g.masquer_identite(texte, termes)
        for secret in ("JEAN", "MBARGA", "NGUEMA", "Mbarga", "Nguema", "JP@", "mail.cm", "677", "12 34 56", "34-56"):
            self.assertNotIn(secret, masque)

    def test_email_et_telephone_en_pleine_largeur_ou_avec_caracteres_invisibles(self):
        masque = g.masquer_identite("Mon mail ＪＰ＠mail.cm, mon tel ６７７​１２３４５６ ou +237 677 123 456", [])
        for secret in ("mail.cm", "677", "６７７", "123 456", "123456"):
            self.assertNotIn(secret, masque)

    def test_le_montant_et_le_reste_du_message_sont_conserves(self):
        masque = g.masquer_identite("Quel est le prix du YD-500 pour 120 m² ? Budget 5 000 000 FCFA. Merci, Alice Ngono.",
                                    ["Alice Ngono"])
        self.assertIn("YD-500", masque)
        self.assertIn("120", masque)
        self.assertIn("5 000 000", masque)
        self.assertNotIn("Alice", masque)
        self.assertNotIn("Ngono", masque)

    def test_mot_courant_pas_masque_par_erreur(self):
        self.assertEqual(g.masquer_identite("Bonjour la maison", ["Al", "Jo"]), "Bonjour la maison")
        self.assertEqual(g.masquer_identite("Le marché est bon", ["Marc"]), "Le marché est bon")  # pas de sous-chaîne


class NomsProprespAdversesTests(SimpleTestCase):
    def test_variantes_rétablies(self):
        for texte in ["jiuye", "JIUYE", "Jiu Ye", "jiu-ye", "Jiu·ye", "jiu.ye"]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(f"Partenaire : {texte}.").texte, "Partenaire : Jiuye.")
        self.assertEqual(controle("le Cir et le cir.").texte, "le CIR et le CIR.")

    def test_cir_dans_une_reference_ou_un_mot_intact(self):
        self.assertEqual(controle("Commande CIR-2026-0001 et circuit, circulaire.").texte,
                         "Commande CIR-2026-0001 et circuit, circulaire.")
        self.assertEqual(controle("Écrivez à contact@exemple-cir.cm", coordonnees=COORD).texte,
                         "Écrivez à contact@exemple-cir.cm")

    def test_noms_propres_dans_les_traductions(self):
        for langue, traduction in [("zh", "Jiuye 与 CIR 合作"), ("ja", "Jiuye と CIR"), ("de", "Jiuye und CIR"), ("en", "Jiuye and CIR")]:
            with self.subTest(langue=langue):
                self.assertTrue(g.noms_propres_conserves("Jiuye et CIR", traduction))
        self.assertFalse(g.noms_propres_conserves("Jiuye et CIR", "九叶 与 CIR"))
        self.assertFalse(g.noms_propres_conserves("Jiuye et CIR", "Jiuye und Zirkus"))


class ReplisEtGraviteTests(SimpleTestCase):
    def test_repli_dans_la_langue_demandee_pour_chaque_garde_fou(self):
        for langue in ("fr", "en", "zh", "de", "ja"):
            textes = {controle(t, langue=langue).texte for t in ("Cela coûte 5 000 FCFA", "J'ai signé le contrat")}
            self.assertEqual(len(textes), 2, langue)
            self.assertTrue(all(textes))

    def test_le_repli_ne_contient_aucun_montant_ni_lien(self):
        for langue in ("fr", "en", "zh", "de", "ja"):
            for code in (g.PRIX, g.ENGAGEMENT, g.CONTENU):
                texte = g.texte_repli(code, langue)
                self.assertEqual(g.montants_du_texte(texte), [], texte)
                self.assertNotIn("http", texte)
                self.assertFalse(g.contient_engagement(texte), texte)

    def test_langue_inconnue_donne_le_francais(self):
        self.assertEqual(g.texte_repli(g.PRIX, "xx"), g.texte_repli(g.PRIX, "fr"))

    def test_code_le_plus_grave(self):
        self.assertEqual(g.code_le_plus_grave(["", g.COORDONNEES, g.PRIX]), g.PRIX)
        self.assertEqual(g.code_le_plus_grave([g.PRIX, g.ENGAGEMENT]), g.ENGAGEMENT)
        self.assertEqual(g.code_le_plus_grave(["", ""]), "")

    def test_priorite_engagement_puis_prix_dans_un_meme_texte(self):
        sortie = controle("J'ai confirmé votre commande pour 12 500 FCFA.")
        self.assertEqual(sortie.bloque, g.ENGAGEMENT)
        self.assertNotIn("12", sortie.texte)


class SecondPassageContournementsTests(SimpleTestCase):
    """Deuxième série de contournements (regard neuf) : prix unitaires, devises familières, engagements de
    suppression/mise à jour, séparateurs de téléphone, domaines peu courants."""

    def verifier(self, textes, code):
        for texte in textes:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, code, f"{texte!r} -> {sortie.texte!r}")

    def test_prix_unitaires_sans_devise(self):
        self.verifier(["25 000 per square metre", "25 000 per square meter", "25 000 pro Quadratmeter", "25 000 / sqm",
                       "每平方米25000", "1平方米25000", "25000 le kg", "25 000 le seau", "25 000 le kit", "25 000 par seau",
                       "25 000 l'unité", "25 000 per kg", "25 000 pro kg", "25 000 /kg", "25000 / ml"], g.PRIX)

    def test_devises_et_ecritures_peu_courantes(self):
        self.verifier(["douze mille cinq cents F CFA", "12 500 de francs", "12 Tsd. Franken", "12 Tsd. €", "12,5 Tsd. Euro",
                       "35 US dollars", "35 bucks", "fünfunddreißig Euro", "一万二千五百 FCFA", "12.5 milles francs"], g.PRIX)

    def test_remises_sans_mot_de_remise_a_cote(self):
        self.verifier(["20 pour cent de remise", "15 % de moins", "15 % moins cher", "moins 15 %", "-20 %", "−20 %"], g.PRIX)

    def test_engagements_de_suppression_et_de_mise_a_jour(self):
        self.verifier([
            "J'ai supprimé votre commande.", "Votre commande a été supprimée.", "J'ai mis à jour votre commande.",
            "Votre commande a été mise à jour.", "J'ai changé votre adresse.", "Votre adresse a été modifiée.",
            "J'ai commandé le YD-500 pour vous.", "J'ai ajouté le produit à votre commande.", "Votre acompte a été versé.",
            "I have ordered it for you.", "I have deleted your order.", "Your account has been updated.",
            "Ihre Bestellung wurde gelöscht.", "订单已删除", "已修改您的地址", "我已更新订单", "注文を削除しました",
            "注文を更新しました", "署名が完了しました", "入金を確認しました",
        ], g.ENGAGEMENT)

    def test_telephones_avec_separateurs_inhabituels(self):
        for texte in ["Appelez le 677/12/34/56", "Appelez le 677 – 123 – 456", "Appelez le 677·123·456"]:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, g.COORDONNEES, sortie.texte)
                self.assertNotIn("677", sortie.texte)

    def test_domaines_courants_en_afrique_et_raccourcisseurs(self):
        for texte in ["Voir evil.ng", "Voir evil.sn", "Voir evil.africa", "Voir evil.cloud", "Voir evil.link",
                      "Voir evil.click", "Voir evil.page", "Voir goo.gl/x", "Voir youtu.be/x", "Voir evil.tk"]:
            with self.subTest(texte=texte):
                self.assertNotIn("evil", controle(texte).texte)
                self.assertNotIn("goo.gl", controle(texte).texte)
                self.assertNotIn("youtu", controle(texte).texte)


class SurBlocageTests(SimpleTestCase):
    """Un bon conseil ne doit jamais être remplacé par le repli."""

    def test_textes_legitimes_passent_intacts(self):
        textes = [
            "Séchage : 24 heures à 25 °C, circulation piétonne après 48 heures.", "Prévoyez 20 kg pour 10 m².",
            "Le kit de 20 kg couvre environ 8 m².", "Épaisseur 2 mm, 3 couches.", "Dimensions : 1 200 x 800 mm.",
            "Température entre 5 °C et 35 °C.", "Humidité inférieure à 80 %.",
            "Le produit YD-500 (réf. YD-500) est un sol autolissant.",
            "Votre commande CIR-2026-0001 est à l'étape « Travaux en cours ».", "Commande créée le 21 octobre 2026.",
            "Le 21/10/2026 à 14 h 30.", "Durée : 3 jours, puis 7 jours de cure.", "Prix sur devis.", "Price on request.",
            "Preis auf Anfrage.", "价格需报价。", "お見積もりとなります。", "Prix indicatif publié : 18 500 FCFA.",
            "Surface minimale 50 m², hauteur 3 m.", "Résistance à la compression de 80 MPa.", "Dureté Shore D 80.",
            "Appliquez 2 couches de 0,5 kg/m².", "Pour 100 m2, comptez 2 jours de travaux.", "Le chantier fait 1 500 m².",
            "Nous sommes ouverts de 8 h à 17 h.", "Le reste à payer est de 300 000 FCFA.", "Il y a 12 designs et 4 familles.",
            "Étape 3 sur 5", "12 produits trouvés", "Gamme de 20 à 40 m²", "Compter 4 à 6 heures de séchage.",
            "Disponible en 25 kg ou 5 kg.", "Séchage 24 h.", "Délai de séchage de 48 heures avant circulation.",
            "Drying takes 24 hours at 25 °C.", "Trocknungszeit 24 Stunden bei 25 °C.", "干燥时间为24小时，温度25摄氏度。",
            "乾燥時間は24時間、温度は25℃です。", "面积100平方米，厚度2毫米。", "面積は100平方メートル、厚さ2ミリです。",
            "Fläche 100 m², Dicke 2 mm.", "Pour 100 m² il faut 2 seaux de 20 kg.", "Le prix dépend de la surface.",
            "The cost depends on the area.", "Der Preis hängt von der Fläche ab.", "费用取决于面积。",
            "価格は面積によって異なります。", "Prix : sur devis (merci de préciser 120 m²).",
            "Le budget dépend de vos 120 m².", "Le prix de 100 m² dépend du chantier", "Le coût de 2 couches est sur devis.",
            "Preis für 2 Schichten auf Anfrage", "价格取决于3个因素", "費用は3つの要素で決まります",
            "Le prix varie selon 3 critères : surface, support, délai.", "J'ai trouvé 12 produits pour l'industrie.",
            "Je confirme que le YD-500 est publié.", "Gamma de 3 à 5 mm pour 2 couches.",
        ]
        for texte in textes:
            with self.subTest(texte=texte):
                sortie = controle(texte, montants={18500, 300000})
                self.assertEqual((sortie.bloque, sortie.texte), ("", texte))

    def test_conseils_de_produit_avec_reference_et_numero_de_commande(self):
        sortie = controle("Pour 120 m² d'atelier, le YD-500 convient : 2 couches, séchage de 24 heures à 25 °C. "
                          "Votre commande CIR-2026-0042 du 2026-10-21 est en « Négociation ».", liens=LIENS)
        self.assertEqual(sortie.bloque, "")
        self.assertEqual([lien["chemin"] for lien in sortie.liens], ["/catalogue/sol-autolissant"])
