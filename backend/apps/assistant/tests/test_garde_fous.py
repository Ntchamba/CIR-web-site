"""Garde-fous de sortie : module PUR (SimpleTestCase : aucun accès à la base), testé dans les 5 langues."""
from django.test import SimpleTestCase
from django.utils import translation

from apps.assistant import garde_fous as g
from apps.assistant.garde_fous import Coordonnees, LienAutorise

LIENS = [LienAutorise("Sol autolissant époxy", "/catalogue/sol-autolissant", ("YD-500", "Sol autolissant époxy"))]
COORD = Coordonnees(emails=("contact@exemple-cir.cm",), telephones=("+237 699 00 11 22",))


def controle(texte, langue="fr", montants=(), liens=(), coordonnees=None):
    return g.controler_sortie(texte, langue=langue, montants_autorises=montants, liens_autorises=liens,
                              coordonnees=coordonnees)


class MontantsTests(SimpleTestCase):
    def test_montants_interdits_ecrits_de_toutes_les_manieres(self):
        interdits = [
            "Ce sol coûte 12 500 FCFA le m².", "Environ 12500 XAF.", "C'est 12.500 F CFA.", "12 500 francs seulement.",
            "Comptez 12k.", "Un budget de 2 millions.", "2 millions de francs pour 100 m².", "Prix : €25.", "About $30 per m2.",
            "It costs 15,000 CFA.", "Around 40 euros.", "dix mille francs", "cinq cents francs CFA", "ten thousand francs",
            "zehntausend Franken", "Das kostet 120 Euro.", "Der Preis liegt bei 15000", "价格是 15000 元", "大约五千元",
            "约500元", "価格は 5万円 です", "一万円くらい", "Le prix est de 25 000", "Total : 1 200 000 XAF",
            "10 000 / m²", "12 500 par m²", "Nous faisons 20 % de remise", "A 15% discount for you", "10 % Rabatt",
            "折扣 10%", "割引 10％", "１２５００ FCFA", "12 500 FCFA".replace(" ", " "),
        ]
        for texte in interdits:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, g.PRIX, texte)
                self.assertTrue(sortie.proposer_contact)
                self.assertNotIn("000", sortie.texte)

    def test_montants_autorises_par_les_outils(self):
        for texte, montants in [("Prix publié indicatif : 18 500 FCFA par m², sous réserve de devis.", {18500}),
                                ("Indicative price: 18,500 FCFA per m², subject to quote.", {18500}),
                                ("Preis laut Katalog: 18.500 FCFA.", {18500}), ("参考价格：18500 元。", {18500}),
                                ("目安は 18500 円です。", {18500}), ("Reste à payer : 300 000 FCFA.", {300000}),
                                ("Environ 12k", {12000})]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte, montants=montants).bloque, "")
        # un autre montant que celui de l'outil reste interdit
        self.assertEqual(controle("Cela fera 19 000 FCFA.", montants={18500}).bloque, g.PRIX)

    def test_pas_de_faux_positifs(self):
        for texte in ["Le YD-500 convient pour 100 m² de sol.", "Séchage en 24 heures à 25 °C.", "Votre commande CIR-2026-0001 est à l'étape « Contrat signé ».",
                      "Épaisseur de 2 à 3 mm.", "Nous sommes à Douala depuis 2006.", "Prix sur devis.",
                      "Il y a 3 couches et 2 designs.", "Disponible en 5 coloris.", "12 km de Douala"]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).bloque, "", texte)

    def test_valeur_decimale_jamais_autorisee_par_arrondi(self):
        self.assertEqual(controle("€ 12,5", montants={12}).bloque, g.PRIX)


class EngagementsTests(SimpleTestCase):
    def test_engagements_dans_les_cinq_langues(self):
        engagements = [
            "J'ai passé votre commande.", "J'ai bien signé le contrat.", "Votre paiement est validé.",
            "Votre commande a été confirmée.", "Votre contrat vient d'être signé.", "Je confirme votre commande.",
            "Je viens de payer l'acompte.", "J'ai annulé votre commande.", "Votre commande est enregistrée.",
            "I have placed your order.", "I've signed the contract for you.", "Your payment has been confirmed.",
            "Your order is now confirmed.", "I just cancelled your order.", "Your contract has been signed.",
            "Ich habe Ihre Bestellung aufgegeben.", "Ihre Zahlung wurde bestätigt.", "Der Vertrag ist unterzeichnet.",
            "Ich habe den Vertrag unterschrieben.", "Ihre Bestellung wurde storniert.",
            "我已为您下单。", "您的订单已确认。", "您的付款已成功。".replace("成功", "确认"), "合同已签署。", "我已经取消了您的订单。",
            "ご注文は完了しました。", "お支払いを確認しました。", "契約を締結しました。", "ご注文をキャンセルしました。",
            "私が代わりに注文をしました。",
        ]
        for texte in engagements:
            with self.subTest(texte=texte):
                sortie = controle(texte)
                self.assertEqual(sortie.bloque, g.ENGAGEMENT, texte)
                self.assertTrue(sortie.proposer_contact)

    def test_etapes_et_explications_autorisees(self):
        for texte in ["Votre commande est à l'étape « Contrat signé ».", "Le paiement est possible après « Contrat signé ».",
                      "Your order is at the stage \"Contract signed\".", "Die Bestellung befindet sich im Schritt „Vertrag unterzeichnet“.",
                      "您的订单处于“合同已签署”阶段。".replace("合同已签署", "签约"), "ご注文は「契約締結」の段階です。".replace("契約締結", "交渉中"),
                      "Je ne peux pas passer commande à votre place.", "Pour signer, contactez l'équipe."]:
            with self.subTest(texte=texte):
                self.assertEqual(controle(texte).bloque, "", texte)


class CoordonneesTests(SimpleTestCase):
    def test_coordonnees_inventees_retirees(self):
        sortie = controle("Écrivez à direction@autre.com ou appelez le +237 677 12 34 56.", coordonnees=COORD)
        self.assertEqual(sortie.bloque, g.COORDONNEES)
        self.assertNotIn("direction@autre.com", sortie.texte)
        self.assertNotIn("677", sortie.texte)

    def test_coordonnees_publiques_conservees(self):
        sortie = controle("Écrivez à Contact@exemple-cir.cm ou appelez le 699 00 11 22.", coordonnees=COORD)
        self.assertEqual(sortie.bloque, "")
        self.assertIn("Contact@exemple-cir.cm", sortie.texte)
        self.assertIn("699 00 11 22", sortie.texte)

    def test_dates_references_et_montants_ne_sont_pas_des_telephones(self):
        sortie = controle("La commande CIR-2026-0001 du 2026-10-21 a un reste de 1 200 000 FCFA.", montants={1200000})
        self.assertEqual(sortie.bloque, "")

    def test_masquer_avant_envoi(self):
        masque = g.masquer_coordonnees("Appelez-moi au 699 11 22 33 ou écrivez à a@b.cm, budget 5 000 000 FCFA")
        self.assertNotIn("699", masque)
        self.assertNotIn("a@b.cm", masque)
        self.assertIn("5 000 000", masque)


class LiensEtHtmlTests(SimpleTestCase):
    def test_liens_externes_et_markdown_retires(self):
        sortie = controle("Voir https://exemple.com/x, www.arnaque.cm et [cliquez ici](https://evil.example/a). "
                          "Aussi [x](javascript:alert(1)) et ![img](http://a.b/c.png) et javascript:alert(1)")
        for interdit in ("http", "www.", "javascript", "evil", "arnaque", "](", "alert"):
            self.assertNotIn(interdit, sortie.texte)
        self.assertIn("cliquez ici", sortie.texte)
        self.assertEqual(sortie.liens, [])

    def test_seuls_les_chemins_des_outils_sont_des_liens(self):
        sortie = controle("Le YD-500 est adapté. [Voir la fiche](/catalogue/sol-autolissant) ou [piège](/compte).", liens=LIENS)
        self.assertEqual(sortie.liens, [{"libelle": "Sol autolissant époxy", "chemin": "/catalogue/sol-autolissant"}])
        self.assertNotIn("](", sortie.texte)

    def test_html_jamais_conserve(self):
        sortie = controle("<script>alert(1)</script>Bonjour <b>vous</b> <img src=x onerror=alert(1)> &lt;i&gt;ok&lt;/i&gt;")
        self.assertNotIn("<", sortie.texte)
        self.assertNotIn("script", sortie.texte)
        self.assertIn("Bonjour", sortie.texte)

    def test_longueur_limitee(self):
        self.assertLessEqual(len(controle("mot " * 1500).texte), g.LONGUEUR_MAX)

    def test_texte_vide_donne_le_repli(self):
        sortie = controle("  <b></b> ")
        self.assertEqual(sortie.bloque, g.CONTENU)
        self.assertTrue(sortie.texte)


class NomsPropresTests(SimpleTestCase):
    def test_jiuye_et_cir_retablis(self):
        sortie = controle("Notre partenaire jiu ye et le Cir travaillent ensemble ; JIUYE est fabricant.")
        self.assertIn("Jiuye", sortie.texte)
        self.assertIn("CIR", sortie.texte)
        self.assertNotIn("jiu ye", sortie.texte.lower().replace("jiuye", ""))

    def test_verification_des_traductions(self):
        self.assertTrue(g.noms_propres_conserves("Jiuye et le CIR", "Jiuye and the CIR"))
        self.assertFalse(g.noms_propres_conserves("Jiuye et le CIR", "久业 and the CIR"))
        self.assertFalse(g.noms_propres_conserves("Le CIR", "The Complex"))
        self.assertTrue(g.noms_propres_conserves("Aucun nom", "No name"))


class RepliTests(SimpleTestCase):
    def test_repli_traduit_dans_chaque_langue(self):
        textes = {}
        for langue in ("fr", "en", "zh", "de", "ja"):
            textes[langue] = {code: g.texte_repli(code, langue) for code in (g.PRIX, g.ENGAGEMENT, g.CONTENU)}
        self.assertIn("prix ferme", textes["fr"][g.PRIX])
        self.assertIn("firm price", textes["en"][g.PRIX])
        for code in (g.PRIX, g.ENGAGEMENT, g.CONTENU):
            self.assertEqual(len({textes[lg][code] for lg in textes}), 5, "chaque langue a son texte")
        # le prix refusé dans la langue du client est remplacé dans cette langue
        with translation.override("fr"):
            self.assertEqual(controle("Cela coûte 5 000 FCFA", langue="de").texte, textes["de"][g.PRIX])
            self.assertEqual(controle("我已为您下单", langue="zh").texte, textes["zh"][g.ENGAGEMENT])
