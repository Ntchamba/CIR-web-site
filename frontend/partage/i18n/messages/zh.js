// 公共信息（frontend/partage）：简体中文。
export default {
  commun: {
    chargement: '加载中…',
    reessayer: '重试',
    erreurInconnue: '出现错误，请重试。',
  },
  erreurs: {
    reseau: '无法连接服务器。请检查您的网络连接后重试。',
    s400: '部分信息有误，请检查表单。',
    s401: '您的会话已过期，请重新登录。',
    s403: '您无权执行此操作。',
    s404: '未找到该内容。',
    s413: '上传的文件过大。',
    s429: '尝试次数过多，请几分钟后再试。',
    s501: '即将推出。',
    s5xx: '服务器出现问题，请稍后重试。',
    defaut: '出现错误，请重试。',
  },
  format: {
    devise: 'FCFA',
    prixSurDevis: '价格面议（报价）',
    unites: { m2: 'FCFA / 平方米', kg: 'FCFA / 公斤', pose: 'FCFA / 平方米（含施工）' },
    dateHeure: '{date} {heure}',
    depuis: {
      instant: '刚刚',
      minutes: '{n} 分钟前',
      heures: '{n} 小时前',
      hier: '昨天',
      jours: '{n} 天前',
    },
  },
  statuts: {
    nouvelle: '新订单',
    negociation: '洽谈中',
    contrat_signe: '已签合同',
    travaux: '施工中',
    terminee: '已完成',
    annulee: '已取消',
  },
  langue: {
    libelle: '语言',
    choisir: '选择语言',
  },
};
