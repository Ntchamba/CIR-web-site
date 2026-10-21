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
_DOMAINE = re.compile(
    r"\b(?:[a-z0-9][a-z0-9\-]*\.)+(?:com|net|org|info|biz|io|co|cm|fr|de|cn|jp|ru|app|dev|me|ly|xyz|site|online|"
    r"shop|store|top|edu|gov|eu|uk|us|ai|tv)\b(?:/[^\s)>\]\"']*)?", re.IGNORECASE)
_EMAIL = re.compile(r"[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+")


def _normaliser(texte):
    texte = unicodedata.normalize("NFKC", str(texte or ""))
    texte = _INVISIBLES.sub("", texte)
    return _CONTROLES.sub("", texte)


def retirer_html(texte):
    """Supprime balises et scripts ; les entités sont décodées puis les balises éventuelles réapparues retirées."""
    texte = _SCRIPTS.sub("", texte)
    texte = _BALISES.sub("", texte)
    texte = html.unescape(texte)
    texte = _SCRIPTS.sub("", texte)
    return _BALISES.sub("", texte)


# --- Montants ---------------------------------------------------------------------------------------------

_NB = r"\d{1,3}(?:[   .,'’]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?"
_MULT_LATIN = (r"(?:k|millions?|milliards?|mille|milliers?|Mio\.?|Mrd\.?|thousand|billion|tausend|Millionen|"
               r"Million|Milliarden?)")
_MULT_CJK = r"(?:百万|万|千|億|亿)"
_DEVISE = (r"(?:F\.?\s?CFA|FCFA|CFA|XAF|XOF|francs?(?:\s+CFA)?|Fr\.?|F|€|EUR|euros?|Euro|\$|US\$|USD|dollars?|"
           r"Dollars?|£|GBP|¥|CNY|RMB|JPY|yen|Franken|Frs\.?|円|元|块|塊|ユーロ|ドル|フラン|欧元|美元|法郎|人民币|"
           r"西非法郎|中非法郎)")
_DEVISE_AVANT = r"(?:FCFA|F\.?\s?CFA|CFA|XAF|XOF|€|EUR|\$|US\$|USD|£|GBP|¥|CNY|RMB|JPY|Euro|Dollar)"

_APRES = re.compile(
    rf"(?<![0-9A-Za-z.,\-])(?P<n>{_NB})(?P<u>\s*(?:{_MULT_LATIN}(?![A-Za-zÀ-ÿ])(?:\s*(?:de\s+|d')?{_DEVISE}(?![A-Za-zÀ-ÿ]))?"
    rf"|{_MULT_CJK}?\s*{_DEVISE}(?![A-Za-zÀ-ÿ])))", re.IGNORECASE)
_AVANT = re.compile(rf"(?<![A-Za-z]){_DEVISE_AVANT}\s*(?P<n>{_NB})(?!\d)", re.IGNORECASE)
_PAR_M2 = re.compile(rf"(?<![0-9A-Za-z.,\-])(?P<n>{_NB})\s*(?:/|par\s+|per\s+|pro\s+|je\s+|每|あたり)\s*"
                     r"(?:m²|m2|m\^2|㎡|mètre|metre|meter|metre|平方米|平米)", re.IGNORECASE)

_MOTS_NOMBRES = (
    r"un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|"
    r"quarante|cinquante|soixante|cents?|mille|millions?|"
    r"one|two|three|four|five|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
    r"eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|"
    r"eins|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|dreissig|vierzig|"
    r"fünfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|[a-zäöüß]+hundert|[a-zäöüß]+tausend")
_DEVISE_MOTS = r"(?:francs?|FCFA|CFA|XAF|euros?|dollars?|Franken|Euro|Dollar)"
_EN_LETTRES = re.compile(rf"\b(?:(?:{_MOTS_NOMBRES})(?:[\s\-]+(?:et|and|und))?[\s\-]+)+{_DEVISE_MOTS}\b", re.IGNORECASE)
_EN_LETTRES_CJK = re.compile(r"[〇零一二三四五六七八九十百千万两兩億亿]+\s*(?:元|块|塊|円|法郎|フラン|欧元|美元|ドル|ユーロ|人民币)")

_MOT_PRIX = (r"(?:prix|tarifs?|co[uû]t\w*|montants?|total|budget|price\w*|cost\w*|fees?|Preis\w*|Kosten|kostet|Betrag|"
             r"Gesamt\w*|价格|价钱|费用|价位|总价|报价|金额|費用|価格|値段|料金|金額|代金|見積\w*)")
_PRIX_NOMBRE = re.compile(rf"{_MOT_PRIX}[^\d\n]{{0,30}}?(?<![\w\-])(?P<n>{_NB})(?![\d]|\s*(?:m²|m2|㎡|平方米|平米|%))",
                          re.IGNORECASE)
_MOT_REMISE = (r"(?:remises?|r[ée]ductions?|rabais|ristourne|discounts?|off|Rabatt\w*|Nachlass|折扣|优惠|優惠|降价|"
               r"割引|値引き?|ディスカウント)")
_POURCENT = r"\d+(?:[.,]\d+)?\s?%"
_REMISE = re.compile(rf"{_MOT_REMISE}[^\n]{{0,30}}?{_POURCENT}|{_POURCENT}[^\n]{{0,30}}?{_MOT_REMISE}", re.IGNORECASE)

_MULTIPLICATEURS = {"k": 10**3, "mille": 10**3, "millier": 10**3, "milliers": 10**3, "thousand": 10**3,
                    "tausend": 10**3, "million": 10**6, "millions": 10**6, "mio": 10**6, "millionen": 10**6,
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
    for motif in (_APRES, _PAR_M2):
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
    for motif in (_EN_LETTRES, _EN_LETTRES_CJK, _REMISE):
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

_OBJETS_FR = r"(?:commande|contrat|paiement|r[èe]glement|devis|proposition|r[ée]servation|virement|acompte|facture)"
_PARTICIPES_FR = (r"(?:pass[ée]e?s?|cr[ée]{2}e?s?|confirm[ée]e?s?|valid[ée]e?s?|sign[ée]e?s?|enregistr[ée]e?s?|"
                  r"annul[ée]e?s?|pay[ée]e?s?|r[ée]gl[ée]e?s?|accept[ée]e?s?|modifi[ée]e?s?|effectu[ée]e?s?|"
                  r"re[çc]ue?s?|trait[ée]e?s?|conclue?s?|d[ée]clench[ée]e?s?|pris(?:e|es)? en compte|envoy[ée]e?s?)")
_ENGAGEMENTS = {
    "fr": [
        rf"\bj[’']ai\s+(?:bien\s+|d[ée]j[àa]\s+|donc\s+)*{_PARTICIPES_FR}\b",
        rf"\bje\s+viens\s+(?:donc\s+)?de\s+(?:passer|cr[ée]er|confirmer|valider|signer|enregistrer|annuler|payer|"
        rf"r[ée]gler|modifier|d[ée]clencher|accepter)\b",
        rf"\bje\s+(?:vais\s+)?(?:confirme|valide|signe|annule|enregistre|r[èe]gle|paie|paye|passe|cr[ée]e|modifie|"
        rf"accepte)\s+(?:donc\s+)?(?:votre|vos|la\s+commande|le\s+contrat|le\s+paiement|ce\s+paiement|"
        rf"cette\s+commande|ce\s+contrat|l[’']acompte)",
        rf"\b(?:votre|vos|la|le|ce|cette)\s+{_OBJETS_FR}s?\s+(?:est|sont|a\s+[ée]t[ée]|ont\s+[ée]t[ée]|vient\s+d[’']être|"
        rf"viennent\s+d[’']être|est\s+maintenant|est\s+bien|sont\s+bien)\s+(?:bien\s+|maintenant\s+|d[ée]sormais\s+)?"
        rf"{_PARTICIPES_FR}\b",
        r"\bcontrat\s+(?:est\s+|a\s+[ée]t[ée]\s+)?sign[ée]\s+(?:avec\s+succ[èe]s|et\s+valid)",
        r"\bc[’']est\s+(?:bien\s+)?(?:fait|r[ée]gl[ée]|valid[ée]|confirm[ée]|sign[ée])\b",
    ],
    "en": [
        r"\bI(?:'ve|’ve| have|'ll|’ll| will| just| hereby)?\s+(?:just\s+|now\s+|successfully\s+|already\s+)?"
        r"(?:placed|created|confirmed|validated|signed|cancell?ed|modified|processed|paid|booked|submitted|"
        r"accepted|updated|triggered|registered)\b",
        r"\bI\s+(?:confirm|validate|sign|cancel|accept)\s+(?:your|the\s+(?:order|contract|payment))",
        rf"\b(?:your|the)\s+(?:order|payment|contract|quote|offer|proposal|booking|deposit|invoice)s?\s+"
        rf"(?:is|are|has\s+been|have\s+been|was|were|is\s+now|is\s+successfully)\s+(?:now\s+|successfully\s+)?"
        rf"(?:placed|created|confirmed|validated|signed|cancell?ed|paid|processed|accepted|completed|registered|"
        rf"modified|received|approved|submitted)\b",
        r"\bcontract\s+(?:has\s+been\s+|is\s+)?signed\s+successfully\b",
    ],
    "de": [
        r"\bich\s+habe\b[^.!?\n]{0,60}?\b(?:bestellt|aufgegeben|erstellt|best[äa]tigt|unterschrieben|unterzeichnet|"
        r"storniert|ge[äa]ndert|bezahlt|abgeschlossen|gebucht|angenommen|gespeichert|ausgel[öo]st|überwiesen|"
        r"registriert|validiert)\b",
        r"\bich\s+(?:best[äa]tige|storniere|unterschreibe|unterzeichne|bezahle|buche)\b[^.!?\n]{0,40}?"
        r"\b(?:ihre|ihren|ihr|die|den|das)\b",
        r"\b(?:ihre|ihr|ihren|die|der|das)\s+(?:bestellung|zahlung|vertrag|angebot|buchung|anzahlung|rechnung)\s+"
        r"(?:wurde|wurden|ist|sind)\s+(?:nun\s+|jetzt\s+|erfolgreich\s+|bereits\s+)*"
        r"(?:aufgegeben|erstellt|best[äa]tigt|unterschrieben|unterzeichnet|abgeschlossen|storniert|bezahlt|"
        r"angenommen|verbucht|durchgef[üu]hrt|eingegangen|validiert|gespeichert|registriert|ge[äa]ndert|"
        r"akzeptiert)\b",
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
        r"已成功(?:下单|支付|签约|签署|付款|提交)",
    ],
    "ja": [
        r"(?:ご注文|注文|お支払い|支払い|お支払|契約|ご契約|お見積り?|見積り?|ご予約|予約|手付金|頭金)(?:は|が|を|も)?"
        r"(?:無事に|正常に)?(?:完了|確定|成立|締結|確認|受理|受け付け|承り|登録|作成|署名|サイン|キャンセル|変更|処理|"
        r"受領|承認|送信|実行)(?:しました|されました|いたしました|致しました|させていただきました|済みです|されています|"
        r"済み)",
        r"(?:私が|こちらで|代わりに)[^。！？\n]{0,30}(?:注文|契約|支払い?|お支払い|署名|サイン|キャンセル|変更|予約)"
        r"[^。！？\n]{0,6}(?:しました|いたしました|致しました|させていただきました)",
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
_DATE_ISO = re.compile(r"\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b")
_TELEPHONE = re.compile(r"(?<![\w/])(?:\+|00)?\d(?:[\d  .\-()]{5,}\d)")


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


def emails_du_texte(texte):
    return [(m.start(), m.end(), m.group(0).lower()) for m in _EMAIL.finditer(_normaliser(texte))]


def masquer_coordonnees(texte, remplacement="[masqué]"):
    """Remplace e-mails et téléphones d'un texte (avant envoi à Gemini : minimisation des données)."""
    texte = _normaliser(texte)
    spans = [(d, f) for d, f, _v in emails_du_texte(texte)] + [(d, f) for d, f, _v in telephones_du_texte(texte)]
    for debut, fin in sorted(spans, reverse=True):
        texte = texte[:debut] + remplacement + texte[fin:]
    return texte


def _retirer_coordonnees(texte, coordonnees):
    autorises_mail = {e.lower() for e in coordonnees.emails}
    autorises_tel = {_cle_telephone(t) for t in coordonnees.telephones if _cle_telephone(t)}
    retires = []
    for debut, fin, valeur in emails_du_texte(texte):
        if valeur not in autorises_mail:
            retires.append((debut, fin))
    for debut, fin, valeur in telephones_du_texte(texte):
        if _cle_telephone(valeur) not in autorises_tel:
            retires.append((debut, fin))
    for debut, fin in sorted(retires, reverse=True):
        texte = texte[:debut] + "…" + texte[fin:]
    return texte, bool(retires)


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
    texte = _SCHEMAS.sub("", texte)
    morceaux, fin = [], 0
    for m in _EMAIL.finditer(texte):  # les e-mails sont jugés plus loin (coordonnées) : on ne touche pas à leur domaine
        morceaux.append(_DOMAINE.sub("", _URL.sub("", texte[fin:m.start()])))
        morceaux.append(m.group(0))
        fin = m.end()
    morceaux.append(_DOMAINE.sub("", _URL.sub("", texte[fin:])))
    return "".join(morceaux), cites


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
    texte = retirer_html(_normaliser(texte))
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
