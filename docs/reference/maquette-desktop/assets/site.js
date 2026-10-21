(function () {
  'use strict';
  var PAGES = ['accueil', 'catalogue', 'article', 'realisations', 'compte', 'commandes'];
  // Pages qui commencent par une grande image : la barre du haut y est transparente tant qu'on n'a pas défilé.
  var SUR_IMAGE = ['accueil', 'catalogue', 'article', 'realisations', 'commandes'];
  var entete = document.querySelector('[data-entete]');
  var pied = document.querySelector('[data-pied]');
  var video = document.querySelector('[data-video]');
  var courante = 'accueil';

  // Sphère de photos : trois anneaux qui tournent ensemble
  var globe = document.querySelector('[data-globe]');
  var ANNEAUX = [
    { y: -215, r: 235, w: 190, h: 160, photos: [1, 2, 3, 4, 5, 6] },
    { y: 0, r: 315, w: 210, h: 178, photos: [7, 9, 8, 10, 13, 11, 12, 1] },
    { y: 215, r: 235, w: 190, h: 160, photos: [2, 3, 4, 5, 6, 7] }
  ];
  ANNEAUX.forEach(function (a) {
    var anneau = document.createElement('div');
    anneau.className = 'anneau';
    anneau.style.transform = 'translateY(' + a.y + 'px)';
    a.photos.forEach(function (n, i) {
      var large = n === 9 || n === 13;
      var w = large ? a.w * 1.6 : a.w;
      var tuile = document.createElement('a');
      tuile.className = 'tuile';
      tuile.href = '#/article';
      tuile.setAttribute('aria-label', 'Ouvrir la fiche de ce sol');
      var img = document.createElement('img');
      img.src = 'assets/img/sphere-photo' + n + '.webp';
      img.alt = '';
      img.style.cssText = 'left:' + (-w / 2) + 'px;top:' + (-a.h / 2) + 'px;width:' + w + 'px;height:' + a.h + 'px;' +
        'transform:rotateY(' + (360 / a.photos.length * i) + 'deg) translateZ(' + a.r + 'px)';
      tuile.appendChild(img);
      anneau.appendChild(tuile);
    });
    globe.appendChild(anneau);
  });

  function regleEntete() {
    var transparente = SUR_IMAGE.indexOf(courante) >= 0 && window.scrollY < 60;
    entete.classList.toggle('clair', !transparente);
  }

  function afficher() {
    var morceaux = (location.hash.replace(/^#\/?/, '') || 'accueil').split('/');
    var page = PAGES.indexOf(morceaux[0]) >= 0 ? morceaux[0] : 'accueil';
    var ancre = morceaux[1];
    courante = page;
    PAGES.forEach(function (p) {
      document.querySelector('[data-page="' + p + '"]').hidden = p !== page;
    });
    var horsCadre = page === 'compte';
    entete.hidden = horsCadre;
    pied.hidden = horsCadre;
    Array.prototype.forEach.call(document.querySelectorAll('[data-lien]'), function (a) {
      var actif = ancre === 'contact' ? a.dataset.lien === 'contact' : a.dataset.lien.split(' ').indexOf(page) >= 0;
      if (actif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    fermerPanneau();
    if (page === 'accueil' && video) {
      video.muted = true;
      try { video.currentTime = 0; } catch (e) {}
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
    if (ancre) {
      var cible = document.getElementById(ancre);
      if (cible) { cible.scrollIntoView(); regleEntete(); return; }
    }
    window.scrollTo(0, 0);
    regleEntete();
  }

  function fermerPanneau() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-if="panneau"]'), function (el) { el.hidden = true; });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act], [data-groupe] button, [data-ancre]');
    if (!el) return;
    if (el.dataset.ancre) {
      e.preventDefault();
      document.getElementById(el.dataset.ancre).scrollIntoView();
      return;
    }
    var act = el.dataset.act;
    if (act === 'panneau') {
      Array.prototype.forEach.call(document.querySelectorAll('[data-if="panneau"]'), function (p) { p.hidden = false; });
    } else if (act === 'fermer') {
      fermerPanneau();
    } else if (act === 'onglet') {
      var choix = el.dataset.onglet;
      Array.prototype.forEach.call(document.querySelectorAll('[data-act="onglet"]'), function (b) {
        b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-onglet-de]'), function (f) {
        f.hidden = f.dataset.ongletDe !== choix;
      });
    } else if (el.closest('[data-groupe]')) {
      // Boutons à choix unique (filtres, catégories)
      Array.prototype.forEach.call(el.closest('[data-groupe]').querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
      });
    }
  });

  // Mes commandes : choisir une commande dans la liste
  Array.prototype.forEach.call(document.querySelectorAll('.cmd'), function (c) {
    c.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.cmd'), function (x) { x.setAttribute('aria-current', x === c ? 'true' : 'false'); });
    });
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerPanneau(); });
  window.addEventListener('scroll', regleEntete, { passive: true });
  window.addEventListener('hashchange', afficher);
  afficher();
})();
