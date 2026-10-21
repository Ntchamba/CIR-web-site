"""Charge les données de référence du catalogue (cahier des charges, § « Familles de produits »).

    python manage.py charger_catalogue_reference

Idempotente : une famille (par son nom) ou un produit (par sa référence) déjà présent n'est jamais modifié,
sauf pour compléter les traductions vides d'une famille. Rien n'est inventé : ni prix, ni image, ni
caractéristique ; seuls les produits dont la référence et l'usage sont clairement liés dans le cahier sont créés.

Fusion avec le catalogue de la maquette du propriétaire (décision du propriétaire) :
- les produits existants (par référence) dont le nom est encore EXACTEMENT l'ancien nom par défaut prennent le nom de
  la maquette (YD-500 « Sol autolissant » -> « Sol autolissant époxy », YD-306 « Sable coloré » -> « Sable coloré
  autolissant ») ; un nom déjà modifié par l'équipe n'est jamais touché ;
- sept produits de la maquette sont ajoutés SANS référence (détection par nom, sans tenir compte de la casse), en
  ligne, sans prix ni image ni texte ;
- seul texte repris de la maquette : accroche et description de YD-500, posées seulement si ces champs sont vides.

ATTENTION : la famille et les usages (maison, industrie, entreprise, extérieur) de ces sept produits sont des valeurs
de départ, reprises de la démonstration du prototype 1 et rattachées aux familles du cahier : À VALIDER par l'équipe.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalogue.models import Famille, Produit

# (nom, description, traductions) : textes du tableau « Familles de produits » du cahier des charges
FAMILLES = [
    ("Primaires époxy", "Préparation du support en béton, ancien ou neuf.", {
        "en": {"nom": "Epoxy primers", "description": "Preparation of concrete substrates, old or new."},
        "zh": {"nom": "环氧底漆", "description": "用于新旧混凝土基面的处理。"},
        "de": {"nom": "Epoxid-Grundierungen", "description": "Vorbereitung von altem oder neuem Betonuntergrund."},
        "ja": {"nom": "エポキシプライマー", "description": "新旧コンクリート下地の前処理。"},
    }),
    ("Couche intermédiaire époxy", "Mortier intermédiaire, coloré ou incolore.", {
        "en": {"nom": "Epoxy intermediate coat", "description": "Intermediate mortar, coloured or clear."},
        "zh": {"nom": "环氧中涂层", "description": "中涂砂浆，有色或无色。"},
        "de": {"nom": "Epoxid-Zwischenschicht", "description": "Zwischenmörtel, farbig oder farblos."},
        "ja": {"nom": "エポキシ中塗り", "description": "中塗りモルタル（着色または無色）。"},
    }),
    ("Finitions", "Finition lisse, mate ou antidérapante, sol autolissant, sable coloré, terrazzo, anti-UV, "
                  "anticorrosion, haute résistance à l'usure, antistatique.", {
        "en": {"nom": "Finishes", "description": "Smooth, matt or anti-slip finish, self-levelling floor, coloured "
                                                 "sand, terrazzo, UV-resistant, anti-corrosion, high wear resistance, "
                                                 "antistatic."},
        "zh": {"nom": "面涂", "description": "平涂、哑光或防滑面层，自流平地坪，彩砂，水磨石，抗紫外线，防腐，高耐磨，防静电。"},
        "de": {"nom": "Deckschichten", "description": "Glatte, matte oder rutschfeste Oberfläche, selbstverlaufender "
                                                      "Boden, Farbsand, Terrazzo, UV-beständig, Korrosionsschutz, hohe "
                                                      "Verschleißfestigkeit, antistatisch."},
        "ja": {"nom": "上塗り", "description": "平滑・つや消し・防滑仕上げ、セルフレベリング床、カラーサンド、テラゾー、耐紫外線、"
                                              "防食、高耐摩耗、帯電防止。"},
    }),
    ("Époxy sans solvant", "Primaire, couche intermédiaire et finition sans solvant.", {
        "en": {"nom": "Solvent-free epoxy", "description": "Solvent-free primer, intermediate coat and finish."},
        "zh": {"nom": "无溶剂环氧", "description": "无溶剂底漆、中涂和面涂。"},
        "de": {"nom": "Lösemittelfreies Epoxid",
               "description": "Lösemittelfreie Grundierung, Zwischenschicht und Deckschicht."},
        "ja": {"nom": "無溶剤エポキシ", "description": "無溶剤のプライマー、中塗り、上塗り。"},
    }),
    ("Gamme à base d'eau", "Époxy et polyuréthane à l'eau, pour les lieux à exigences environnementales (santé, "
                           "alimentaire, écoles, habitat).", {
        "en": {"nom": "Water-based range", "description": "Water-based epoxy and polyurethane for places with "
                                                          "environmental requirements (healthcare, food, schools, "
                                                          "housing)."},
        "zh": {"nom": "水性系列", "description": "水性环氧和聚氨酯，适用于有环保要求的场所（医疗、食品、学校、住宅）。"},
        "de": {"nom": "Wasserbasierte Produktreihe", "description": "Wasserbasiertes Epoxid und Polyurethan für Orte "
                                                                    "mit Umweltanforderungen (Gesundheitswesen, "
                                                                    "Lebensmittel, Schulen, Wohnbau)."},
        "ja": {"nom": "水性シリーズ", "description": "環境への配慮が求められる場所（医療、食品、学校、住宅）向けの水性エポキシ・"
                                                 "ポリウレタン。"},
    }),
    ("Peintures de marquage", "Traçage des routes, des parkings et des ateliers.", {
        "en": {"nom": "Marking paints", "description": "Line marking for roads, car parks and workshops."},
        "zh": {"nom": "标线漆", "description": "用于道路、停车场和车间的划线。"},
        "de": {"nom": "Markierungsfarben", "description": "Markierung von Straßen, Parkplätzen und Werkstätten."},
        "ja": {"nom": "ライン塗料", "description": "道路、駐車場、作業場のライン引き。"},
    }),
    ("Traitement du béton", "Durcisseur et scellant, colorant, brillanteur.", {
        "en": {"nom": "Concrete treatment", "description": "Hardener and sealer, colourant, gloss enhancer."},
        "zh": {"nom": "混凝土处理", "description": "固化剂和密封剂、着色剂、增亮剂。"},
        "de": {"nom": "Betonbehandlung", "description": "Härter und Versiegelung, Färbemittel, Glanzverstärker."},
        "ja": {"nom": "コンクリート処理", "description": "硬化剤・シーラー、着色剤、光沢剤。"},
    }),
    ("Sols spéciaux", "Sol perméable d'extérieur, terrains de sport, piste d'athlétisme.", {
        "en": {"nom": "Special floors", "description": "Permeable outdoor flooring, sports grounds, running tracks."},
        "zh": {"nom": "特种地坪", "description": "室外透水地坪、运动场地、田径跑道。"},
        "de": {"nom": "Spezialböden", "description": "Wasserdurchlässiger Außenboden, Sportplätze, Laufbahnen."},
        "ja": {"nom": "特殊床材", "description": "屋外透水性舗装、スポーツコート、陸上トラック。"},
    }),
    ("Produits complémentaires", "Primaire antirouille, peinture pour tuiles, mastic pour joints, aménagement et "
                                 "signalisation de parking.", {
        "en": {"nom": "Complementary products", "description": "Anti-rust primer, roof tile paint, joint sealant, "
                                                               "car park layout and signage."},
        "zh": {"nom": "配套产品", "description": "防锈底漆、瓦片漆、填缝胶、停车场设施与标识。"},
        "de": {"nom": "Ergänzende Produkte", "description": "Rostschutzgrundierung, Dachziegelfarbe, "
                                                            "Fugendichtmasse, Parkplatzausstattung und "
                                                            "-beschilderung."},
        "ja": {"nom": "関連製品", "description": "防錆プライマー、瓦用塗料、目地シーラント、駐車場の設備と標識。"},
    }),
]

_ACCROCHE_PRIMAIRE = FAMILLES[0][1]
_ACCROCHE_INTERMEDIAIRE = FAMILLES[1][1]


def _accroche(famille_index):
    return {code: textes["description"] for code, textes in FAMILLES[famille_index][2].items()}


def _traductions(noms, accroches=None):
    return {code: {"nom": nom, **({"accroche": accroches[code]} if accroches else {})} for code, nom in noms.items()}


NOMS = {
    "primaire": {"en": "Epoxy primer", "zh": "环氧底漆", "de": "Epoxid-Grundierung", "ja": "エポキシプライマー"},
    "intermediaire": {"en": "Epoxy intermediate coat", "zh": "环氧中涂", "de": "Epoxid-Zwischenschicht",
                      "ja": "エポキシ中塗り"},
    "autolissant": {"en": "Epoxy self-levelling floor", "zh": "环氧自流平地坪", "de": "Selbstverlaufender Epoxidboden",
                    "ja": "エポキシセルフレベリング床"},
    "sable": {"en": "Self-levelling coloured sand", "zh": "自流平彩砂地坪", "de": "Selbstverlaufender Farbsand",
              "ja": "セルフレベリング・カラーサンド"},
    "terrazzo": {"en": "Epoxy terrazzo", "zh": "环氧水磨石", "de": "Epoxid-Terrazzo", "ja": "エポキシテラゾー"},
    "primaire_ss": {"en": "Solvent-free epoxy primer", "zh": "无溶剂环氧底漆",
                    "de": "Lösemittelfreie Epoxid-Grundierung", "ja": "無溶剤エポキシプライマー"},
    "intermediaire_ss": {"en": "Solvent-free epoxy intermediate coat", "zh": "无溶剂环氧中涂",
                         "de": "Lösemittelfreie Epoxid-Zwischenschicht", "ja": "無溶剤エポキシ中塗り"},
    "finition_ss": {"en": "Solvent-free epoxy finish", "zh": "无溶剂环氧面涂", "de": "Lösemittelfreie Epoxid-Deckschicht",
                    "ja": "無溶剤エポキシ上塗り"},
}

# (référence, index de la famille, nom, accroche, traductions, recommandé pour l'habitat)
# YD-500, YD-306 et YD-518 : recommandation du cahier pour l'habitat (à la une, usage « maison »).
PRODUITS = [
    ("YD-103", 0, "Primaire époxy", _ACCROCHE_PRIMAIRE, _traductions(NOMS["primaire"], _accroche(0)), False),
    ("YD-104", 0, "Primaire époxy", _ACCROCHE_PRIMAIRE, _traductions(NOMS["primaire"], _accroche(0)), False),
    ("YD-205", 1, "Couche intermédiaire époxy", _ACCROCHE_INTERMEDIAIRE,
     _traductions(NOMS["intermediaire"], _accroche(1)), False),
    ("YD-500", 2, "Sol autolissant époxy", "", _traductions(NOMS["autolissant"]), True),
    ("YD-306", 2, "Sable coloré autolissant", "", _traductions(NOMS["sable"]), True),
    ("YD-518", 2, "Terrazzo époxy", "", _traductions(NOMS["terrazzo"]), True),
    ("YD-106W", 3, "Primaire époxy sans solvant", "", _traductions(NOMS["primaire_ss"]), False),
    ("YD-206W", 3, "Couche intermédiaire époxy sans solvant", "", _traductions(NOMS["intermediaire_ss"]), False),
    ("YD-306W", 3, "Finition époxy sans solvant", "", _traductions(NOMS["finition_ss"]), False),
]

# Anciens noms par défaut (avant la fusion) : (nom français, noms traduits) ; remplacés seulement s'ils sont intacts.
ANCIENS_NOMS = {
    "YD-500": ("Sol autolissant", {"en": "Self-levelling floor", "zh": "自流平地坪",
                                   "de": "Selbstverlaufender Boden", "ja": "セルフレベリング床"}),
    "YD-306": ("Sable coloré", {"en": "Coloured sand", "zh": "彩砂", "de": "Farbsand", "ja": "カラーサンド"}),
}

# Textes de la maquette pour YD-500 (posés seulement si les champs sont vides) : (champ, français, traductions)
TEXTES_YD_500 = [
    ("accroche", "brillant, effet miroir, sans joints", {
        "en": "glossy, mirror effect, seamless", "zh": "光亮，镜面效果，无接缝",
        "de": "glänzend, Spiegeleffekt, fugenlos", "ja": "光沢、鏡面効果、継ぎ目なし"}),
    ("description", "Une surface lisse et brillante, sans joints, dans une grande variété de couleurs. "
                    "Non toxique et sans odeur.", {
        "en": "A smooth, glossy, seamless surface in a wide variety of colours. Non-toxic and odourless.",
        "zh": "光滑亮泽、无接缝的表面，颜色丰富多样。无毒无味。",
        "de": "Eine glatte, glänzende, fugenlose Oberfläche in einer großen Farbvielfalt. Ungiftig und geruchlos.",
        "ja": "なめらかで光沢のある継ぎ目のない表面。豊富なカラーバリエーション。無毒・無臭。"}),
]

# Produits de la maquette absents du cahier : (nom, index de la famille, usages M/I/E/X, à la une, noms traduits).
# Sans référence, sans prix, sans image, sans texte. Familles et usages : valeurs de départ À VALIDER par l'équipe.
PRODUITS_MAQUETTE = [
    ("Finition époxy lisse", 2, "MI", False, {"en": "Smooth epoxy finish", "zh": "环氧平涂面层",
                                              "de": "Glatte Epoxid-Deckschicht", "ja": "エポキシ平滑仕上げ"}),
    ("Finition époxy mate", 2, "ME", False, {"en": "Matt epoxy finish", "zh": "哑光环氧面层",
                                             "de": "Matte Epoxid-Deckschicht", "ja": "エポキシつや消し仕上げ"}),
    ("Finition antidérapante", 2, "IX", False, {"en": "Anti-slip finish", "zh": "防滑面层",
                                                "de": "Rutschfeste Deckschicht", "ja": "防滑仕上げ"}),
    ("Peinture de sol anti-UV", 4, "X", False, {"en": "Anti-UV floor paint", "zh": "抗紫外线地坪漆",
                                                "de": "UV-beständige Bodenfarbe", "ja": "耐紫外線床用塗料"}),
    ("Finition haute résistance", 3, "I", True, {"en": "High-resistance finish", "zh": "高耐磨面层",
                                                 "de": "Hochbelastbare Deckschicht", "ja": "高耐久仕上げ"}),
    ("Finition anticorrosion", 0, "I", False, {"en": "Anti-corrosion finish", "zh": "防腐面层",
                                               "de": "Korrosionsschutz-Deckschicht", "ja": "防食仕上げ"}),
    ("Sol à motifs", 7, "ME", False, {"en": "Patterned floor", "zh": "图案地坪",
                                      "de": "Gemusterter Boden", "ja": "模様入り床"}),
]
USAGES = {"M": "pour_maison", "I": "pour_industrie", "E": "pour_entreprise", "X": "pour_exterieur"}


PRODUITS_PAR_REFERENCE = {
    "YD-500": {"fr": "Sol autolissant époxy", **NOMS["autolissant"]},
    "YD-306": {"fr": "Sable coloré autolissant", **NOMS["sable"]},
}


def _mettre_a_jour_noms(produit):
    """Remplace l'ancien nom par défaut (français et traductions encore intacts) par celui de la maquette."""
    ancien = ANCIENS_NOMS.get(produit.reference)
    if ancien is None or produit.nom != ancien[0]:
        return False
    nouveau = dict(PRODUITS_PAR_REFERENCE[produit.reference])
    produit.nom = nouveau["fr"]
    traductions = {code: dict(valeurs) for code, valeurs in (produit.traductions or {}).items()}
    for code, ancien_nom in ancien[1].items():
        courant = traductions.get(code, {}).get("nom")
        if not courant or courant == ancien_nom:
            traductions.setdefault(code, {})["nom"] = nouveau[code]
    produit.traductions = traductions
    return True


def _completer_textes_yd_500(produit):
    """Pose accroche et description de la maquette sur YD-500, champ par champ, seulement s'ils sont vides."""
    modifie = False
    traductions = {code: dict(valeurs) for code, valeurs in (produit.traductions or {}).items()}
    for champ, francais, autres in TEXTES_YD_500:
        if getattr(produit, champ).strip():
            continue
        setattr(produit, champ, francais)
        for code, texte in autres.items():
            if not traductions.get(code, {}).get(champ):
                traductions.setdefault(code, {})[champ] = texte
        modifie = True
    produit.traductions = traductions
    return modifie


class Command(BaseCommand):
    help = "Charge les neuf familles du cahier, les produits de référence et ceux de la maquette (sans prix ni image)."

    @transaction.atomic
    def handle(self, *args, **options):
        familles, creees, produits_crees = [], 0, 0
        for ordre, (nom, description, traductions) in enumerate(FAMILLES):
            famille = Famille.objects.filter(nom__iexact=nom).first()
            if famille is None:
                famille = Famille.objects.create(nom=nom, description=description, ordre=ordre,
                                                 traductions=traductions)
                creees += 1
            elif not famille.traductions:
                famille.traductions = traductions
                famille.save(update_fields=["traductions"])
            familles.append(famille)

        produits_crees = renommes = textes = 0
        for ordre, (reference, index, nom, accroche, traductions, habitat) in enumerate(PRODUITS):
            produit = Produit.objects.filter(reference__iexact=reference).first()
            if produit is None:
                produit = Produit.objects.create(
                    famille=familles[index], reference=reference, nom=nom, accroche=accroche,
                    traductions=traductions, pour_maison=habitat, a_la_une=habitat, en_ligne=True, prix=None,
                    ordre=ordre,
                )
                produits_crees += 1
            else:
                champs = []
                if _mettre_a_jour_noms(produit):
                    renommes += 1
                    champs += ["nom", "traductions"]
                if champs:
                    produit.save(update_fields=champs)
            if reference == "YD-500" and _completer_textes_yd_500(produit):
                produit.save(update_fields=["accroche", "description", "traductions"])
                textes += 1

        maquette_crees = 0
        for position, (nom, index, usages, une, noms) in enumerate(PRODUITS_MAQUETTE):
            if Produit.objects.filter(nom__iexact=nom).exists():
                continue
            Produit.objects.create(
                famille=familles[index], reference="", nom=nom, traductions={c: {"nom": n} for c, n in noms.items()},
                a_la_une=une, en_ligne=True, prix=None, ordre=len(PRODUITS) + position,
                **{champ: lettre in usages for lettre, champ in USAGES.items()},
            )
            maquette_crees += 1

        self.stdout.write(self.style.SUCCESS(
            f"Catalogue de référence : {creees} famille(s), {produits_crees} produit(s) du cahier et "
            f"{maquette_crees} produit(s) de la maquette créés, {renommes} nom(s) mis à jour, {textes} texte(s) posé(s) "
            f"({len(FAMILLES)} familles et {len(PRODUITS) + len(PRODUITS_MAQUETTE)} produits attendus)."
        ))
