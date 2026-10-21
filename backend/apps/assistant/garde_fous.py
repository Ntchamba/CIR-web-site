"""Garde-fous de sortie de l'assistant (module PUR : aucun accès à la base ni au réseau).

Le prompt peut être contourné, pas le code. Chaque réponse du conseiller et chaque brouillon passe par
`controler_sortie` avant d'être montré :

- montants : tout montant qui ne vient pas d'un résultat d'outil du même tour remplace la réponse
  par le texte de repli (`prix_non_autorise`) ; remises en pourcentage comprises ;
- engagements : « j'ai passé votre commande », « votre paiement est validé »… (5 langues) → repli (`engagement`) ;
- coordonnées : e-mail ou téléphone qui ne vient pas des coordonnées publiques → retiré (`coordonnees`) ;
- liens : seuls les chemins internes issus des outils sont conservés (dans `liens`), toute autre adresse,
  tout lien Markdown, tout `javascript:` est retiré du texte ;
- texte : jamais de HTML, 2000 caractères au plus ;
- noms propres : « Jiuye » et « CIR » ne sont ni traduits ni altérés.
"""
import html
import re
import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.utils import translation
from django.utils.translation import gettext as _

from apps.noyau.langues import code_django

LONGUEUR_MAX = 2000
MAX_LIENS = 5

PRIX = "prix_non_autorise"
ENGAGEMENT = "engagement"
COORDONNEES = "coordonnees"
CONTENU = "contenu"
NOMS_PROPRES = "noms_propres"

# Ordre de gravité : le premier code présent est celui qui est renvoyé
GRAVITE = (ENGAGEMENT, PRIX, COORDONNEES, CONTENU, NOMS_PROPRES)


def texte_repli(code, langue="fr"):
    """Texte de repli dans la langue du client (traduit avec gettext)."""
    with translation.override(code_django(langue)):
        if code == PRIX:
            return _("Je ne peux pas donner de prix ferme : l'équipe vous répondra par un devis.")
        if code == ENGAGEMENT:
            return _("Je ne peux ni passer, ni confirmer, ni signer, ni payer, ni modifier quoi que ce soit : "
                     "seule l'équipe du CIR le fait. Vous pouvez lui écrire ou demander un devis.")
        return _("Je ne peux pas répondre à cette demande. Vous pouvez écrire à l'équipe du CIR.")


@dataclass(frozen=True)
class LienAutorise:
    """Lien interne issu d'un outil (champ `chemin`). `mots` : textes dont la présence dans la réponse
    justifie de proposer le lien (nom, référence)."""

    libelle: str
    chemin: str
    mots: tuple = ()


@dataclass(frozen=True)
class Coordonnees:
    emails: tuple = ()
    telephones: tuple = ()


@dataclass
class Sortie:
    texte: str
    liens: list = field(default_factory=list)  # [{"libelle", "chemin"}]
    bloque: str = ""
    proposer_contact: bool = False


# --- Nettoyage du texte -----------------------------------------------------------------------------------

_INVISIBLES = re.compile("[​-‏‪-‮⁠-⁤﻿]")
_CONTROLES = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SCRIPTS = re.compile(r"<\s*(script|style)\b.*?<\s*/\s*\1\s*>", re.IGNORECASE | re.DOTALL)
_BALISES = re.compile(r"</?[A-Za-z!?][^>]*>")
_IMAGE_MD = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_LIEN_MD = re.compile(r"\[([^\]]*)\]\(\s*([^)]*?)\s*\)")
_SCHEMAS = re.compile(r"\b(?:javascript|data|vbscript|file)\s*:[^\s)>\]]*", re.IGNORECASE)
_URL = re.compile(r"(?:\b[a-z][a-z0-9+.\-]*://|\bwww\.)[^\s)>\]\"']*", re.IGNORECASE)
_EXTENSIONS = (r"pdf|jpe?g|png|webp|gif|svg|docx?|xlsx?|pptx?|csv|txt|zip|rar|mp[34]|mov|avi|html?|json|xml|md|py|js|css|"
               r"heic|odt|ods|rtf|log|bak|tmp|ini|exe")
# Domaine « nu » : mot.mot ou mot.mot/chemin, extension alphabétique d'au moins 2 lettres, toute en minuscules ou
# toute en majuscules (« Bonjour.Merci », oubli d'espace après un point, n'est pas un domaine). Fichiers exclus.
_DOMAINE = re.compile(
    rf"(?<![\w@.\-])(?!(?i:jiu\.ye)\b)(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+(?!(?:{_EXTENSIONS})\b)(?:[a-z]{{2,}}|[A-Z]{{2,}})\b"
    r"(?:/[^\s)>\]\"']*)?")
_EMAIL = re.compile(r"[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+")
# E-mail écrit pour tromper : « evil @ example . com », « evil (at) example (dot) com », « evil [at] example.com »
_EMAIL_OBFUSQUE = re.compile(
    r"[\w+\-]+(?:\.[\w+\-]+)*\s*(?:@|\(at\)|\[at\]|\{at\}|\sat\s)\s*[\w\-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[\w\-]+)+",
    re.IGNORECASE)


def _normaliser(texte):
    """Texte pour la DÉTECTION seulement (NFKC : pleine largeur, exposants…). Jamais montré au client."""
    texte = unicodedata.normalize("NFKC", str(texte or ""))
    texte = _INVISIBLES.sub("", texte).replace("\u00ad", "")
    return _CONTROLES.sub("", texte)


def _epurer(texte):
    """Texte montré au client : invisibles et caractères de contrôle retirés, rien d'autre n'est modifié."""
    texte = _INVISIBLES.sub("", str(texte or "")).replace("\u00ad", "")
    return _CONTROLES.sub("", texte)


class _Vue:
    """Texte normalisé (détection) + correspondance des positions avec le texte d'origine (suppression)."""

    def __init__(self, texte):
        norm, carte = [], []
        for i, c in enumerate(texte):
            for x in unicodedata.normalize("NFKC", c):
                norm.append(x)
                carte.append(i)
        self.texte, self.norm, self.carte = texte, "".join(norm), carte

    def origine(self, debut, fin):
        return self.carte[debut], self.carte[fin - 1] + 1

    def remplacer(self, spans, remplacement=""):
        """Remplace dans le texte d'origine les zones repérées (positions du texte normalisé)."""
        zones = sorted({self.origine(d, f) for d, f in spans if f > d})
        fusion = []
        for d, f in zones:
            if fusion and d <= fusion[-1][1]:
                fusion[-1] = (fusion[-1][0], max(fusion[-1][1], f))
            else:
                fusion.append((d, f))
        texte = self.texte
        for d, f in reversed(fusion):
            texte = texte[:d] + remplacement + texte[f:]
        return texte


def retirer_html(texte):
    """Supprime balises et scripts ; les entités sont décodées puis les balises éventuelles réapparues retirées."""
    texte = _SCRIPTS.sub("", texte)
    texte = _BALISES.sub("", texte)
    texte = html.unescape(texte)
    texte = _SCRIPTS.sub("", texte)
    return _BALISES.sub("", texte)


# --- Montants ---------------------------------------------------------------------------------------------

_NB = r"\d{1,3}(?:[   .,'’]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?"
_MULT_LATIN = (r"(?:k|Tsd\.?|millions?|milliards?|milles?|mille|milliers?|Mio\.?|Mrd\.?|thousand|billion|tausend|Millionen|"
               r"Million|Milliarden?)")
_MULT_CJK = r"(?:百万|万|千|億|亿)"
_DEVISE = (r"(?:F\.?\s?CFA|FCFA|CFA|XAF|XOF|US\s+dollars?|bucks?|francs?(?:\s+CFA)?|Fr\.?|F|€|EUR|euros?|Euro|\$|US\$|USD|dollars?|"
           r"Dollars?|£|GBP|¥|CNY|RMB|JPY|yen|Franken|Frs\.?|円|元|块|塊|ユーロ|ドル|フラン|欧元|美元|法郎|人民币|"
           r"西非法郎|中非法郎|日元|日圆|日円|港元|英镑|韩元|美金|人民幣|ウォン|ポンド)")
_DEVISE_AVANT = r"(?:FCFA|F\.?\s?CFA|CFA|XAF|XOF|€|EUR|\$|US\$|USD|£|GBP|¥|CNY|RMB|JPY|Euro|Dollar)"

_APRES = re.compile(
    rf"(?<![0-9A-Za-z.,\-])(?P<n>{_NB})(?P<u>\s*(?:(?:{_MULT_LATIN}|M)\s*(?:de\s+|d')?{_DEVISE}(?![A-Za-zÀ-ÿ])"
    rf"|{_MULT_LATIN}(?![A-Za-zÀ-ÿ])"
    rf"|{_MULT_CJK}?\s*(?:(?:de|d')\s*)?{_DEVISE}(?![A-Za-zÀ-ÿ])))", re.IGNORECASE)
_AVANT = re.compile(rf"(?<![A-Za-z]){_DEVISE_AVANT}\s*(?P<n>{_NB})(?!\d)", re.IGNORECASE)
_UNITES_VENTE = (r"(?:m²|m2|m\^2|㎡|sqm|sq\.?\s?m|square\s+met(?:re|er)s?|m[èe]tres?\s+carr[ée]s?|met(?:re|er)s?|m[èe]tres?|"
                 r"quadratmeter|qm|平方米|平米|平方メートル|kilos?|kg|litres?|liters?|l|seaux?|eimer|bucket|kit|pots?|bidons?|"
                 r"sacs?|unit[ée]s?|units?|pi[èe]ces?|st[üu]cks?|ml|laufmeter|linear\s+met(?:re|er)|公斤|千克|升|桶|件|个|個|"
                 r"キロ|リットル|バケツ|セット)")
_PAR_M2 = re.compile(rf"(?<![0-9A-Za-z.,\-])(?P<n>{_NB})\s*(?:/|par\s+|per\s+|pro\s+|je\s+|le\s+|la\s+|au\s+|the\s+|"
                     rf"l[’']|每|あたり)\s*{_UNITES_VENTE}(?![A-Za-zÀ-ÿ²])", re.IGNORECASE)
_UNITE_PUIS_PRIX = re.compile(rf"(?:每|毎|1|一)\s?(?:平方米|平米|公斤|千克|升|桶|件|个|平方メートル|キロ|個)\s*(?P<n>{_NB})")

_MOTS_NOMBRES = (
    r"un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|"
    r"quarante|cinquante|soixante|cents?|mille|millions?|"
    r"one|two|three|four|five|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
    r"eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|"
    r"eins|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|dreissig|vierzig|"
    r"fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|[a-zäöüß]+hundert|[a-zäöüß]+tausend|millionen|"
    r"(?:ein|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun)und(?:zwanzig|dreißig|dreissig|vierzig|fünfzig|sechzig|"
    r"siebzig|achtzig|neunzig)|"
    r"milliards?|milliarden?|mio|mrd")
_DEVISE_MOTS = r"(?:F\.?\s?CFA|francs?|FCFA|CFA|XAF|euros?|dollars?|Franken|Euro|Dollar|bucks?)"
_EN_LETTRES = re.compile(rf"\b(?:(?:{_MOTS_NOMBRES})(?:[\s\-]+(?:et|and|und))?[\s\-]+)+(?:(?:de|d')\s*)?{_DEVISE_MOTS}\b", re.IGNORECASE)
_EN_LETTRES_CJK = re.compile(r"[〇零一二三四五六七八九十百千万两兩億亿]+\s*(?:元|块|塊|円|法郎|フラン|欧元|美元|ドル|ユーロ|人民币|F\.?\s?CFA|FCFA|XAF|XOF|CFA|EUR|USD)", re.IGNORECASE)

_MOT_PRIX = (r"(?:prix|tarifs?|co[uû]t[^\W\d_]*|montants?|total|budget|price[^\W\d_]*|cost[^\W\d_]*|fees?|"
             r"Preis[^\W\d_]*|Kosten|kostet|Betrag|Gesamt[^\W\d_]*|价格|价钱|费用|价位|总价|单价|报价|金额|費用|価格|値段|"
             r"料金|金額|代金|見積(?:もり|り)?|à\s+partir\s+de|dès|starting\s+(?:at|from)|from|ab)")
_UNITES = (r"m²|m2|㎡|mm|cm|km|kg|mpa|bar|litres?|jours?|heures?|mois|ans?|days?|hours?|months?|years?|tage|stunden|"
           r"monate|jahre|couches?|h\b|°|%|平方米|平米|米|公斤|天|小时|日|時間|年|か月|m\b|g\b|l\b")
_PRIX_NOMBRE = re.compile(
    rf"{_MOT_PRIX}[^\d\n]{{0,30}}?(?<![0-9A-Za-z_\-])(?P<n>{_NB})(?![\d]|\s*(?:{_UNITES}))", re.IGNORECASE)
_GRANDS_MOTS = (r"cents?|mille|millions?|vingts?|trente|quarante|cinquante|soixante|hundred|thousand|million|twenty|"
                r"thirty|forty|fifty|sixty|seventy|eighty|ninety|hundert|tausend|zwanzig|dreißig|dreissig|vierzig|"
                r"fünfzig|sechzig|siebzig|achtzig|neunzig|[a-zäöüß]+hundert|[a-zäöüß]+tausend")
_PRIX_LETTRES = re.compile(rf"{_MOT_PRIX}[^\d\n]{{0,30}}?(?<![A-Za-zÀ-ÿ])(?:{_GRANDS_MOTS})(?![A-Za-zÀ-ÿ])", re.IGNORECASE)
_PRIX_LETTRES_CJK = re.compile(rf"{_MOT_PRIX}[^\d\n〇零一二三四五六七八九十百千万两兩]{{0,6}}"
                               r"(?:[〇零一二三四五六七八九十两兩]*[百千万][〇零一二三四五六七八九十百千万两兩]*"
                               r"|[〇零一二三四五六七八九十两兩]{2,})", re.IGNORECASE)
_MOT_REMISE = (r"(?:remises?|r[ée]ductions?|rabais|ristourne|discounts?|off|Rabatt\w*|Nachlass|折扣|优惠|優惠|降价|"
               r"割引|値引き?|ディスカウント|オフ)")
_POURCENT = (rf"(?:\d+(?:[.,]\d+)?\s?(?:%|pour\s?cent|per\s?cent|percent|prozent)|\d+\s?割|(?:{_MOTS_NOMBRES})(?:[\s\-]+(?:{_MOTS_NOMBRES}))*\s+"
             r"(?:pour\s?cent|per\s?cent|percent|prozent))")
_REMISE = re.compile(rf"{_MOT_REMISE}[^\n]{{0,30}}?{_POURCENT}|{_POURCENT}[^\n]{{0,30}}?{_MOT_REMISE}", re.IGNORECASE)
_REMISE_SEULE = re.compile(r"\d+(?:[.,]\d+)?\s?%\s*(?:de\s+)?(?:moins|less|weniger|cheaper|billiger|off)\b|"
                          r"\b(?:moins|less|minus|weniger)\s+(?:de\s+)?\d+(?:[.,]\d+)?\s?%|(?<![\d\w])[-−–]\s?\d+(?:[.,]\d+)?\s?%|"
                          r"\b(?:gratuit(?:e|es|s)?|offert(?:e|es|s)?|free\s+of\s+charge|kostenlos|gratis|prix\s+co[uû]tant|"
                          r"half[\s-]price|moiti[ée]\s+prix|halber\s+preis)\b|免费|免費|無料|\d+\s?割|[一二三四五六七八九十]折|[0-9]折|打[一二三四五六七八九十0-9]折")

_MULTIPLICATEURS = {"k": 10**3, "mille": 10**3, "millier": 10**3, "milliers": 10**3, "thousand": 10**3,
                    "tausend": 10**3, "tsd": 10**3, "milles": 10**3, "million": 10**6, "millions": 10**6, "mio": 10**6, "millionen": 10**6,
                    "milliard": 10**9, "milliards": 10**9, "mrd": 10**9, "billion": 10**9, "milliarden": 10**9,
                    "milliarde": 10**9, "百万": 10**6, "万": 10**4, "千": 10**3, "億": 10**8, "亿": 10**8}


_GROUPE = re.compile(r"^(\d{1,3}(?:[ .,']\d{3})+)(?:[.,](\d+))?$")


def _decimal(jeton):
    """Valeur d'un nombre écrit avec séparateurs de milliers (espace, point, virgule, apostrophe) ou décimale."""
    brut = jeton.strip().replace("\u00a0", " ").replace("\u202f", " ").replace("’", "'")
    groupe = _GROUPE.match(brut)
    if groupe:
        return Decimal(f"{re.sub(r'[ .,]', '', groupe.group(1)).replace(chr(39), '')}.{groupe.group(2) or '0'}")
    return Decimal(brut.replace(",", "."))


def _multiplicateur(suffixe):
    suffixe = suffixe.lower()
    for mot, facteur in sorted(_MULTIPLICATEURS.items(), key=lambda m: -len(m[0])):
        if re.search(rf"(?<![a-zà-ÿ]){re.escape(mot)}(?![a-zà-ÿ])" if mot.isascii() else re.escape(mot), suffixe):
            return facteur
    return 1


def montants_du_texte(texte):
    """Liste de (début, fin, valeur entière | None) des montants trouvés. `None` : montant impossible à autoriser
    (écrit en lettres, remise en pourcentage…)."""
    texte = _normaliser(texte)
    trouves = []
    for motif in (_APRES, _PAR_M2, _UNITE_PUIS_PRIX):
        for m in motif.finditer(texte):
            try:
                valeur = _decimal(m.group("n"))
            except (InvalidOperation, ValueError):
                trouves.append((m.start(), m.end(), None))
                continue
            if "u" in m.groupdict():
                valeur *= _multiplicateur(m.group("u"))
            trouves.append((m.start(), m.end(), int(valeur) if valeur == int(valeur) else None))
    for m in _AVANT.finditer(texte):
        try:
            valeur = _decimal(m.group("n"))
            trouves.append((m.start(), m.end(), int(valeur) if valeur == int(valeur) else None))
        except (InvalidOperation, ValueError):
            trouves.append((m.start(), m.end(), None))
    for motif in (_EN_LETTRES, _EN_LETTRES_CJK, _REMISE, _REMISE_SEULE, _PRIX_LETTRES, _PRIX_LETTRES_CJK):
        trouves.extend((m.start(), m.end(), None) for m in motif.finditer(texte))
    for m in _PRIX_NOMBRE.finditer(texte):
        try:
            valeur = int(_decimal(m.group("n")))
        except (InvalidOperation, ValueError):
            continue
        if valeur >= 100 and not 1900 <= valeur <= 2100:
            trouves.append((m.start("n"), m.end("n"), valeur))
    return sorted(trouves)


def contient_montant_non_autorise(texte, autorises=()):
    autorises = {int(a) for a in autorises}
    return any(valeur is None or valeur not in autorises for _d, _f, valeur in montants_du_texte(texte))


# --- Engagements ------------------------------------------------------------------------------------------

_OBJETS_FR = (r"(?:commande|contrat|paiement|r[èe]glement|devis|proposition|r[ée]servation|virement|acompte|facture|"
               r"adresse|compte|profil|panier|versement)")
_PARTICIPES_FR = (r"(?:supprim[ée]e?s?|mis(?:e|es)?\s+à\s+jour|chang[ée]e?s?|command[ée]e?s?|vers[ée]e?s?|pass[ée]e?s?|cr[ée]{2}e?s?|confirm[ée]e?s?|valid[ée]e?s?|sign[ée]e?s?|enregistr[ée]e?s?|"
                  r"annul[ée]e?s?|pay[ée]e?s?|r[ée]gl[ée]e?s?|accept[ée]e?s?|modifi[ée]e?s?|effectu[ée]e?s?|"
                  r"re[çc]ue?s?|trait[ée]e?s?|conclue?s?|d[ée]clench[ée]e?s?|pris(?:e|es)? en compte|envoy[ée]e?s?)")
_PARTICIPES_COURTS_FR = (r"(?:pass[ée]e?s?|confirm[ée]e?s?|valid[ée]e?s?|enregistr[ée]e?s?|annul[ée]e?s?|"
                         r"pay[ée]e?s?|r[ée]gl[ée]e?s?|accept[ée]e?s?|effectu[ée]e?s?|re[çc]ue?s?|trait[ée]e?s?)")
_ENGAGEMENTS = {
    "fr": [
        rf"\bj[’']ai\s+(?:bien\s+|d[ée]j[àa]\s+|donc\s+)*{_PARTICIPES_FR}\b",
        rf"\bje\s+viens\s+(?:donc\s+)?de\s+(?:passer|cr[ée]er|confirmer|valider|signer|enregistrer|annuler|payer|"
        rf"r[ée]gler|modifier|d[ée]clencher|accepter)\b",
        rf"(?<![\w])(?:je\s+(?:vais\s+)?|j[’'])(?:confirme|valide|signe|annule|enregistre|r[èe]gle|paie|paye|passe|"
        rf"cr[ée]e|modifie|accepte|effectue)\s+(?:donc\s+)?(?:votre|vos|la\s+commande|le\s+contrat|le\s+paiement|"
        rf"ce\s+paiement|cette\s+commande|ce\s+contrat|l[’']acompte|la\s+proposition|l[’']offre|le\s+devis)",
        rf"\b(?:votre|vos|la|le|ce|cette)\s+{_OBJETS_FR}s?\s+(?:est|sont|a|ont|vient|viennent)\s+"
        rf"(?:(?:bien|maintenant|d[ée]sormais|d[ée]j[àa]|enfin|correctement|[ée]t[ée]|d[’']être|bel\s+et\s+bien)\s+)*"
        rf"{_PARTICIPES_FR}\b",
        rf"(?:^|[.!?\n]\s*)\W*{_OBJETS_FR}\s+(?:bien\s+|d[ée]j[àa]\s+)?{_PARTICIPES_COURTS_FR}\b",
        r"\bj[’']ai\s+(?:bien\s+|d[ée]j[àa]\s+)?ajout[ée]\b[^.!?\n]{0,40}?\b(?:à|dans)\s+(?:votre|la|le)\s+"
        r"(?:commande|panier|s[ée]lection|devis)",
        r"\bcontrat\s+(?:est\s+|a\s+[ée]t[ée]\s+)?sign[ée]\s+(?:avec\s+succ[èe]s|et\s+valid)",
        r"\bc[’']est\s+(?:bien\s+)?(?:fait|r[ée]gl[ée]|valid[ée]|confirm[ée]|sign[ée])\b",
    ],
    "en": [
        r"\bI(?:'ve|’ve| have|'ll|’ll| will| just| hereby)?\s+(?:just\s+|now\s+|successfully\s+|already\s+)?"
        r"(?:placed|created|confirmed|validated|signed|cancell?ed|modified|processed|paid|booked|submitted|"
        r"accepted|updated|triggered|registered|ordered|deleted|removed|changed)\b",
        r"\bI\s+(?:confirm|validate|sign|cancel|accept)\s+(?:your|the\s+(?:order|contract|payment))",
        rf"\b(?:your|the)\s+(?:order|payment|contract|quote|offer|proposal|booking|deposit|invoice|account|address|profile|cart)s?\s+"
        rf"(?:is|are|has\s+been|have\s+been|was|were|is\s+now|is\s+successfully)\s+(?:now\s+|successfully\s+)?"
        rf"(?:placed|created|confirmed|validated|signed|cancell?ed|paid|processed|accepted|completed|registered|"
        rf"modified|received|approved|submitted|successful|updated|deleted|removed|changed)\b",
        r"\bcontract\s+(?:has\s+been\s+|is\s+)?signed\s+successfully\b",
        r"(?:^|[.!?\n]\s*)\W*(?:order|payment|contract|booking|deposit|purchase|transaction)\s+(?:has\s+been\s+|was\s+|is\s+)?"
        r"(?:successfully\s+)?(?:placed|created|confirmed|received|signed|completed|processed|accepted|approved|"
        r"cancell?ed|successful|made|paid|registered)\b",
        r"\b(?:payment|order|transaction|purchase)\s+(?:has\s+|have\s+)?(?:went|gone)\s+through\b",
    ],
    "de": [
        r"\bich\s+habe\b[^.!?\n]{0,60}?\b(?:bestellt|aufgegeben|erstellt|best[äa]tigt|unterschrieben|unterzeichnet|"
        r"storniert|ge[äa]ndert|bezahlt|abgeschlossen|gebucht|angenommen|gespeichert|ausgel[öo]st|überwiesen|"
        r"registriert|validiert|gel[öo]scht|aktualisiert|entfernt|hinzugef[üu]gt)\b",
        r"\bich\s+(?:best[äa]tige|storniere|unterschreibe|unterzeichne|bezahle|buche)\b[^.!?\n]{0,40}?"
        r"\b(?:ihre|ihren|ihr|die|den|das)\b",
        r"\b(?:ihre|ihr|ihren|die|der|das)\s+(?:bestellung|zahlung|vertrag|angebot|buchung|anzahlung|rechnung|adresse|konto|profil)\s+"
        r"(?:wurde|wurden|ist|sind)\s+(?:nun\s+|jetzt\s+|erfolgreich\s+|bereits\s+)*"
        r"(?:aufgegeben|erstellt|best[äa]tigt|unterschrieben|unterzeichnet|abgeschlossen|storniert|bezahlt|"
        r"angenommen|verbucht|durchgef[üu]hrt|eingegangen|validiert|gespeichert|registriert|ge[äa]ndert|"
        r"akzeptiert|gel[öo]scht|aktualisiert|entfernt|hinzugef[üu]gt)\b",
        r"(?:^|[.!?\n]\s*)\W*(?:die\s+|ihre\s+|der\s+|ihr\s+)?(?:bestellung|zahlung|vertrag|buchung|anzahlung|"
        r"[üu]berweisung|auftrag|rechnung)\s+(?:wurde\s+|ist\s+)?(?:nun\s+|jetzt\s+|bereits\s+)?"
        r"(?:erfolgreich|erhalten|aufgegeben|best[äa]tigt|unterschrieben|unterzeichnet|abgeschlossen|storniert|bezahlt|"
        r"angenommen|verbucht|eingegangen|durchgef[üu]hrt)\b",
    ],
    "zh": [
        r"我(?:已|已经|刚|刚刚|将|会)?(?:为您|帮您|替您|为你|帮你)?(?:成功)?(?:下单|下了单|签署|签订|签了|付了|"
        r"支付了|付款了)",
        r"我(?:已|已经|刚|刚刚|将|会)?(?:为您|帮您|替您|为你|帮你)?(?:成功)?(?:提交|创建|确认|取消|修改|支付|付款|"
        r"办理|预订|接受|完成).{0,6}(?:订单|合同|付款|支付|款项|报价|预订|定金|您的|你的)",
        r"已(?:经)?(?:成功)?(?:为您|帮您|替您|为你|帮你)(?:成功)?(?:下单|提交|创建|确认|签署|签订|取消|修改|支付|办理|预订)",
        r"(?:您的|你的|该|此)?(?:订单|付款|支付|合同|报价|订购|预订|定金|款项)(?:已|已经|已被|已成功|现已|均已)"
        r"(?:成功)?(?:下|提交|创建|生成|确认|签署|签订|生效|取消|修改|支付|付款|完成|接受|通过|到账|收到|登记|处理)",
        r"合同(?:现)?已(?:签|签署|签订|生效)",
        r"(?:订单|地址|账户|账号|资料|信息|合同|付款)(?:已|已经)(?:成功)?(?:删除|更新|变更|更改|修改|取消)",
        r"已(?:经)?(?:成功)?(?:删除|修改|更新|变更|更改|取消)(?:了)?(?:您的|你的)?(?:订单|地址|账户|账号|资料|信息|合同|付款)",
        r"我(?:已|已经)?(?:帮您|为您|替您)?(?:成功)?(?:更新|修改|删除|更改|变更).{0,4}(?:订单|地址|账户|账号|资料|信息|合同)",
        r"已成功(?:下单|支付|签约|签署|付款|提交)",
        r"已(?:经)?(?:成功)?(?:帮您|为您|替您|为你|帮你)?(?:下单|付款|支付|签约|签署|签订)",
        r"我(?:已|已经)?(?:帮您|为您|替您|为你|帮你)?(?:付款|支付|签约|下单)",
        r"(?:支付|付款|下单|订购|签约|订单创建|订单提交|预订)(?:已)?成功",
    ],
    "ja": [
        r"(?:ご注文|注文|契約|署名|サイン|お支払い|支払い|入金|住所|アカウント|予約|情報|登録|お手続き)(?:を|が|は)?(?:無事に)?"
        r"(?:削除|更新|変更|完了|確認|受領|反映|登録|取消|キャンセル|確定)(?:しました|いたしました|致しました|されました)",
        r"(?:ご注文|注文|お支払い|支払い|お支払|契約|ご契約|ご予約|予約)(?:は|が|を|も)?(?:無事に)?"
        r"(?:承りました|承っております|受け付けました|受理しました)",
        r"(?:ご注文|注文|お支払い|支払い|お支払|契約|ご契約|ご予約|予約|お手続き)(?:は|が)?(?:すでに|既に)?済み(?:です|ました)",
        r"(?:ご注文|注文|お支払い|支払い|お支払|契約|ご契約|お見積り?|見積り?|ご予約|予約|手付金|頭金)(?:は|が|を|も)?"
        r"(?:無事に|正常に)?(?:完了|確定|成立|締結|確認|受理|受け付け|承り|登録|作成|署名|サイン|キャンセル|変更|処理|"
        r"受領|承認|送信|実行)(?:しました|されました|いたしました|致しました|させていただきました|済みです|されています|"
        r"済み)",
        r"(?:私が|こちらで|代わりに)[^。！？\n]{0,30}(?:注文|契約|支払い?|お支払い|署名|サイン|キャンセル|変更|予約)"
        r"[^。！？\n]{0,6}(?:しました|いたしました|致しました|させていただきました|ました)",
        r"(?:注文|契約|署名|サイン|支払い?|お支払い|キャンセル|変更|予約|手続き)(?:を|も)?(?:無事に)?"
        r"(?:しました|いたしました|致しました|させていただきました)",
        r"契約(?:が|は)?(?:成立|締結)(?:しました|いたしました|済み)",
    ],
}
_ENGAGEMENTS_COMPILES = [re.compile(p, re.IGNORECASE) for motifs in _ENGAGEMENTS.values() for p in motifs]


def contient_engagement(texte):
    texte = _normaliser(texte)
    return any(m.search(texte) for m in _ENGAGEMENTS_COMPILES)


# --- Coordonnées ------------------------------------------------------------------------------------------

_REFERENCE = re.compile(r"\b[A-Z]{2,4}-\d{4}-\d{4,6}\b")
_DATE_ISO = re.compile(r"\b\d{4}-\d{2}-\d{2}\b|(?<!\d)(?<!\d\.)(?:0?[1-9]|[12]\d|3[01])[/.](?:0?[1-9]|1[0-2])[/.](?:\d{4}|\d{2})(?!\d)(?!\.\d)")
_TELEPHONE = re.compile(r"(?<![\w/])(?:\+|00)?\d(?:[\d \u00a0.\-()/·・\u2010-\u2015\u2212]{5,}\d)")


def _cle_telephone(valeur):
    chiffres = re.sub(r"\D", "", valeur)
    return chiffres[-9:]


def telephones_du_texte(texte):
    """Numéros de téléphone trouvés (8 à 15 chiffres), hors dates, références et montants."""
    texte = _normaliser(texte)
    masque = list(texte)
    for motif in (_REFERENCE, _DATE_ISO):
        for m in motif.finditer(texte):
            for i in range(m.start(), m.end()):
                masque[i] = " "
    for debut, fin, _valeur in montants_du_texte(texte):
        for i in range(debut, fin):
            masque[i] = " "
    masque = "".join(masque)
    return [(m.start(), m.end(), m.group(0)) for m in _TELEPHONE.finditer(masque)
            if 8 <= len(re.sub(r"\D", "", m.group(0))) <= 15]


def _forme_email(brut):
    brut = re.sub(r"\s*(?:\(at\)|\[at\]|\{at\}|\sat\s)\s*", "@", brut, flags=re.IGNORECASE)
    brut = re.sub(r"\s*(?:\(dot\)|\[dot\]|\sdot\s)\s*", ".", brut, flags=re.IGNORECASE)
    return re.sub(r"\s+", "", brut).lower()


def emails_du_texte(texte):
    texte = _normaliser(texte)
    trouves = {(m.start(), m.end(), m.group(0).lower()) for m in _EMAIL.finditer(texte)}
    for m in _EMAIL_OBFUSQUE.finditer(texte):
        if not any(d <= m.start() and m.end() <= f for d, f, _v in trouves):
            trouves.add((m.start(), m.end(), _forme_email(m.group(0))))
    return sorted(trouves)


def masquer_coordonnees(texte, remplacement="[masqué]"):
    """Remplace e-mails et téléphones d'un texte (avant envoi à Gemini : minimisation des données)."""
    texte = _normaliser(texte)
    spans = [(d, f) for d, f, _v in emails_du_texte(texte)] + [(d, f) for d, f, _v in telephones_du_texte(texte)]
    for debut, fin in sorted(spans, reverse=True):
        texte = texte[:debut] + remplacement + texte[fin:]
    return texte


def masquer_identite(texte, termes, remplacement="[client]"):
    """Remplace dans un texte le nom complet (et chacun de ses éléments), l'e-mail et le téléphone connus d'un
    compte ou d'une demande, puis les e-mails et téléphones restants (minimisation avant envoi à Gemini)."""
    texte = _normaliser(texte)
    mots = set()
    for terme in termes:
        terme = " ".join(str(terme or "").split())
        if len(terme) >= 3:
            mots.add(terme)
            mots.update(partie for partie in re.split(r"[\s,;\-]+", terme) if len(partie) >= 3 and "@" not in partie)
    for mot in sorted(mots, key=len, reverse=True):
        texte = re.sub(rf"(?<!\w){re.escape(mot)}(?!\w)", remplacement, texte, flags=re.IGNORECASE)
    return masquer_coordonnees(texte)


def _retirer_coordonnees(texte, coordonnees):
    vue = _Vue(texte)
    autorises_mail = {e.lower() for e in coordonnees.emails}
    autorises_tel = {_cle_telephone(t) for t in coordonnees.telephones if _cle_telephone(t)}
    retires = []
    for debut, fin, valeur in emails_du_texte(vue.norm):
        if valeur not in autorises_mail:
            retires.append((debut, fin))
    for debut, fin, valeur in telephones_du_texte(vue.norm):
        if _cle_telephone(valeur) not in autorises_tel:
            retires.append((debut, fin))
    return vue.remplacer(retires, "…"), bool(retires)


# --- Liens ------------------------------------------------------------------------------------------------

def _est_chemin_autorise(adresse, autorises):
    adresse = adresse.strip()
    return adresse in autorises


def _traiter_liens(texte, autorises):
    """Retire images, liens Markdown (le libellé reste), adresses externes et schémas dangereux."""
    chemins = {lien.chemin: lien for lien in autorises}
    cites = []

    def remplacer(m):
        libelle, adresse = m.group(1), m.group(2)
        if _est_chemin_autorise(adresse, chemins):
            cites.append(chemins[adresse.strip()])
        return libelle

    texte = _IMAGE_MD.sub("", texte)
    texte = _LIEN_MD.sub(remplacer, texte)
    vue = _Vue(texte)
    mails = [(d, f) for d, f, _v in emails_du_texte(vue.norm)]  # jugés plus loin : leur domaine reste
    zones = [(m.start(), m.end()) for motif in (_SCHEMAS, _URL) for m in motif.finditer(vue.norm)]
    zones += [(m.start(), m.end()) for m in _DOMAINE.finditer(vue.norm)
              if not any(d <= m.start() and m.end() <= f for d, f in mails)]
    return vue.remplacer(zones), cites


def _liens_cites(texte, autorises, deja):
    bas = texte.lower()
    liens = list(deja)
    for lien in autorises:
        if lien in liens:
            continue
        mots = [m for m in (lien.mots or ()) if m and len(m) >= 3]
        if lien.chemin in texte or any(m.lower() in bas for m in mots):
            liens.append(lien)
    resultat, vus = [], set()
    for lien in liens:
        if lien.chemin not in vus:
            vus.add(lien.chemin)
            resultat.append({"libelle": lien.libelle, "chemin": lien.chemin})
    return resultat[:MAX_LIENS]


# --- Noms propres -----------------------------------------------------------------------------------------

_JIUYE = re.compile(r"\bjiu[\s\-·.]?ye\b", re.IGNORECASE)
_CIR = re.compile(r"(?<![\w\-@./])cir(?![\w\-/@])", re.IGNORECASE)
NOMS_A_CONSERVER = ("Jiuye", "CIR")


def proteger_noms_propres(texte):
    """Rétablit « Jiuye » et « CIR » (casse, espaces ajoutés par une traduction)."""
    texte = _JIUYE.sub("Jiuye", texte)
    return _CIR.sub("CIR", texte)


def noms_propres_conserves(source, traduction):
    """Faux si un nom propre présent dans la source (Jiuye, CIR) est absent de la traduction."""
    for nom in NOMS_A_CONSERVER:
        if re.search(rf"(?<![A-Za-z]){nom}(?![A-Za-z])", source or "", re.IGNORECASE) \
                and not re.search(rf"(?<![A-Za-z]){nom}(?![A-Za-z])", traduction or ""):
            return False
    return True


# --- Contrôle complet -------------------------------------------------------------------------------------

def nettoyer(texte):
    """Texte sans HTML, sans caractère de contrôle, borné à 2000 caractères."""
    texte = retirer_html(_epurer(texte))
    texte = re.sub(r"[ \t]+\n", "\n", texte)
    texte = re.sub(r"\n{3,}", "\n\n", texte).strip()
    if len(texte) > LONGUEUR_MAX:
        texte = texte[:LONGUEUR_MAX - 1].rstrip() + "…"
    return texte


def controler_sortie(texte, *, langue="fr", montants_autorises=(), liens_autorises=(), coordonnees=None):
    """Contrôle une réponse avant de la montrer. Renvoie un `Sortie`.

    `montants_autorises` : montants (entiers, FCFA) présents dans les résultats d'outils du même tour.
    `liens_autorises` : `LienAutorise` issus des outils. `coordonnees` : `Coordonnees` publiques de l'entreprise.
    """
    coordonnees = coordonnees or Coordonnees()
    liens_autorises = list(liens_autorises)
    brut = nettoyer(texte)
    brut, cites = _traiter_liens(brut, liens_autorises)
    brut = nettoyer(brut)
    if not brut:
        return Sortie(texte_repli(CONTENU, langue), [], CONTENU, True)
    if contient_engagement(brut):
        return Sortie(texte_repli(ENGAGEMENT, langue), [], ENGAGEMENT, True)
    if contient_montant_non_autorise(brut, montants_autorises):
        return Sortie(texte_repli(PRIX, langue), [], PRIX, True)
    brut, retire = _retirer_coordonnees(brut, coordonnees)
    brut = nettoyer(proteger_noms_propres(brut))
    liens = _liens_cites(brut, liens_autorises, cites)
    return Sortie(brut, liens, COORDONNEES if retire else "", False)


def code_le_plus_grave(codes):
    codes = [c for c in codes if c]
    for code in GRAVITE:
        if code in codes:
            return code
    return codes[0] if codes else ""
