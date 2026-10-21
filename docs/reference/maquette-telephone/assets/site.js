(function () {
  'use strict';
  var app = document.getElementById('app');
  var PAGES = ['accueil', 'catalogue', 'article', 'realisations', 'compte', 'commandes'];

  // Vidéo de fond : jouée une fois à chaque ouverture de l'accueil, puis figée sur la dernière image.
  var video = document.querySelector('[data-video]');
  function lancerVideo() {
    if (!video) return;
    video.muted = true;
    video.loop = false;
    video.playsInline = true;
    try { video.currentTime = 0; } catch (e) {}
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  // Menu de la barre du haut
  function reglerMenu(header, ouvert) {
    var menu = header.querySelector('[data-if="ouvert"]');
    if (menu) menu.hidden = !ouvert;
    var bouton = header.querySelector('[data-act="basculer"]');
    if (bouton) bouton.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    if (header.getAttribute('data-fond') !== 'transparent') return;
    var clair = ouvert;
    header.style.background = clair ? '#F3F7F9' : 'transparent';
    header.style.borderBottomColor = clair ? '#D5E0E6' : 'transparent';
    var barre = header.firstElementChild;
    var logo = barre.querySelector('a');
    logo.style.color = clair ? '#0E2A38' : '#FFFFFF';
    logo.style.textShadow = clair ? 'none' : '0 1px 2px rgba(8, 24, 32, 0.7), 0 2px 16px rgba(8, 24, 32, 0.8)';
    Array.prototype.forEach.call(barre.querySelectorAll('svg'), function (svg) {
      svg.setAttribute('stroke', clair ? '#0E2A38' : '#FFFFFF');
      svg.style.filter = clair ? 'none' : 'drop-shadow(0 1px 3px rgba(8, 24, 32, 0.8))';
    });
  }
  function fermerMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('header[data-fond]'), function (h) { reglerMenu(h, false); });
  }

  // Onglets Se connecter / Créer un compte
  function reglerCompte(onglet) {
    var page = document.querySelector('[data-page="compte"]');
    var cx = onglet === 'connexion';
    page.querySelector('[data-if="estConnexion"]').hidden = !cx;
    page.querySelector('[data-if="estInscription"]').hidden = cx;
    [['versConnexion', cx], ['versInscription', !cx]].forEach(function (pair) {
      var b = page.querySelector('[data-act="' + pair[0] + '"]');
      b.setAttribute('aria-pressed', pair[1] ? 'true' : 'false');
      b.style.borderBottomColor = pair[1] ? '#FF6D4C' : 'transparent';
      b.style.color = pair[1] ? '#0E2A38' : '#2F4A57';
    });
  }

  // Panneau d'options de l'article
  function reglerPanneau(ouvert) {
    var p = document.querySelector('[data-page="article"] [data-if="ouvert"]');
    if (p) p.hidden = !ouvert;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'basculer') {
      var header = el.closest('header');
      var menu = header.querySelector('[data-if="ouvert"]');
      reglerMenu(header, menu.hidden);
    } else if (act === 'ouvrir') {
      reglerPanneau(true);
    } else if (act === 'fermer') {
      reglerPanneau(false);
    } else if (act === 'versConnexion') {
      reglerCompte('connexion');
    } else if (act === 'versInscription') {
      reglerCompte('inscription');
    }
  });

  // Navigation entre les vues
  function haut() {
    app.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  var courante = null;
  function route() {
    var h = (window.location.hash || '').replace(/^#\/?/, '');
    var ancre = null;
    if (h === 'contact') { h = 'accueil'; ancre = 'contact'; }
    if (PAGES.indexOf(h) < 0) h = 'accueil';
    Array.prototype.forEach.call(document.querySelectorAll('.page'), function (p) {
      p.hidden = p.getAttribute('data-page') !== h;
    });
    fermerMenus();
    reglerPanneau(false);
    if (ancre) {
      var cible = document.getElementById(ancre);
      if (cible && cible.scrollIntoView) cible.scrollIntoView();
    } else {
      haut();
    }
    if (h === 'accueil' && courante !== 'accueil') lancerVideo();
    courante = h;
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', function (e) {
    // Un lien vers la vue déjà affichée (par exemple Contact depuis l'accueil) ne change pas l'adresse.
    var a = e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if (a && a.getAttribute('href') === window.location.hash) route();
  });
  route();
})();
