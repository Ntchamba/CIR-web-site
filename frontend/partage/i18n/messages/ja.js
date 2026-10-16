// 共通メッセージ（frontend/partage）：日本語。
export default {
  commun: {
    chargement: '読み込み中…',
    reessayer: '再試行',
    erreurInconnue: 'エラーが発生しました。もう一度お試しください。',
  },
  erreurs: {
    reseau: 'サーバーに接続できません。インターネット接続を確認して、もう一度お試しください。',
    s400: '入力内容に誤りがあります。フォームをご確認ください。',
    s401: 'セッションの有効期限が切れました。もう一度ログインしてください。',
    s403: 'この操作を行う権限がありません。',
    s404: '見つかりませんでした。',
    s413: '送信されたファイルが大きすぎます。',
    s429: '試行回数が多すぎます。数分後にもう一度お試しください。',
    s501: '近日公開予定です。',
    s5xx: 'サーバーで問題が発生しています。しばらくしてからもう一度お試しください。',
    defaut: 'エラーが発生しました。もう一度お試しください。',
  },
  format: {
    devise: 'FCFA',
    prixSurDevis: '価格はお見積もり',
    unites: { m2: 'FCFA / m²', kg: 'FCFA / kg', pose: 'FCFA / m²（施工込み）' },
    dateHeure: '{date} {heure}',
    depuis: {
      instant: 'たった今',
      minutes: '{n} 分前',
      heures: '{n} 時間前',
      hier: '昨日',
      jours: '{n} 日前',
    },
  },
  statuts: {
    nouvelle: '新規',
    negociation: '交渉中',
    contrat_signe: '契約締結済み',
    travaux: '施工中',
    terminee: '完了',
    annulee: 'キャンセル',
  },
  langue: {
    libelle: '言語',
    choisir: '言語を選択',
  },
};
