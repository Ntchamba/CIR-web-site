"""Charge les données de référence du catalogue (cahier des charges, § « Familles de produits »).

    python manage.py charger_catalogue_reference

Idempotente : une famille (par son nom) ou un produit (par sa référence) déjà présent n'est jamais modifié,
sauf pour compléter les traductions vides d'une famille. Rien n'est inventé : ni prix, ni image, ni
caractéristique ; seuls les produits dont la référence et l'usage sont clairement liés dans le cahier sont créés.
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
    "autolissant": {"en": "Self-levelling floor", "zh": "自流平地坪", "de": "Selbstverlaufender Boden",
                    "ja": "セルフレベリング床"},
    "sable": {"en": "Coloured sand", "zh": "彩砂", "de": "Farbsand", "ja": "カラーサンド"},
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
    ("YD-500", 2, "Sol autolissant", "", _traductions(NOMS["autolissant"]), True),
    ("YD-306", 2, "Sable coloré", "", _traductions(NOMS["sable"]), True),
    ("YD-518", 2, "Terrazzo époxy", "", _traductions(NOMS["terrazzo"]), True),
    ("YD-106W", 3, "Primaire époxy sans solvant", "", _traductions(NOMS["primaire_ss"]), False),
    ("YD-206W", 3, "Couche intermédiaire époxy sans solvant", "", _traductions(NOMS["intermediaire_ss"]), False),
    ("YD-306W", 3, "Finition époxy sans solvant", "", _traductions(NOMS["finition_ss"]), False),
]


class Command(BaseCommand):
    help = "Charge les neuf familles du cahier des charges et les produits de référence (sans prix ni image)."

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

        for ordre, (reference, index, nom, accroche, traductions, habitat) in enumerate(PRODUITS):
            if Produit.objects.filter(reference__iexact=reference).exists():
                continue
            Produit.objects.create(
                famille=familles[index], reference=reference, nom=nom, accroche=accroche, traductions=traductions,
                pour_maison=habitat, a_la_une=habitat, en_ligne=True, prix=None, ordre=ordre,
            )
            produits_crees += 1

        self.stdout.write(self.style.SUCCESS(
            f"Catalogue de référence : {creees} famille(s) et {produits_crees} produit(s) créés "
            f"({len(FAMILLES)} familles et {len(PRODUITS)} produits attendus)."
        ))
