/*
  Карточка украшения после пивота (12.11.2026): чертёж или 3D, примерка металла и камня,
  урок и курс по этому украшению, что понадобится, кнопки покупки.
  Имя модуля AA.preorder оставлено, чтобы не трогать вызовы в main.js и проверки.

  Курсы, уроки и цены — в shop.js. Когда в catalog.js задан config.app (адрес личного
  кабинета), каталог берётся оттуда, а кнопки ведут к оплате в кабинете. Пока кабинета нет
  или продажи не открыты, кнопки ведут в сообщество ВК.
*/
(function () {
  'use strict';

  var AA = window.AA;
  var cfg = AA.config;
  var shop = AA.shop || { products: [], lessons: [], materials: {} };

  var state = { item: null, sel: null, opener: null };
  // renderArt(место, изделие, выбор, список подписей) — вариант рисует изделие сам (B: 3D) и возвращает true
  var opts = { variant: '?', artLabel: 'Чертёж', renderArt: null };
  var listeners = { counts: [] };
  var dlg, el = {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function emit(name, data) { listeners[name].forEach(function (cb) { try { cb(data); } catch (e) { console.error(e); } }); }

  function track(name, params) {
    try {
      if (cfg.metrikaId && typeof window.ym === 'function') window.ym(cfg.metrikaId, 'reachGoal', name, params || {});
      (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: 'aa_' + name }, params || {}));
    } catch (e) { /* аналитика не должна ломать сайт */ }
  }

  /* ---------- каталог ---------- */

  function lessonBySlug(slug) { return shop.lessons.filter(function (l) { return l.slug === slug; })[0] || null; }
  function productsFor(item, type) {
    return shop.products.filter(function (p) { return p.type === type && (p.pieces || []).indexOf(item.id) >= 0 && p.status !== 'draft'; });
  }
  function offers(item) {
    return { lesson: productsFor(item, 'lesson')[0] || null, course: productsFor(item, 'course')[0] || null };
  }
  function onSale(p) { return !!(p && p.status === 'on_sale' && cfg.app); }
  function lessonsOf(p) {
    if (!p) return [];
    return (p.lessons || []).map(function (l) { return typeof l === 'string' ? lessonBySlug(l) : l; }).filter(Boolean);
  }
  // Что понадобится — под выбранный металл: медная или бронзовая глина (у колец и серёг —
  // белая бронза) и корунд, либо серебряная глина и натуральный камень после обжига.
  function materialsOf(item, line) {
    var o = offers(item), src = o.lesson || o.course;
    var seen = {}, out = [];
    function fits(x) {
      if (x.metal && line && x.metal !== line) return false;
      if (x.forms === 'skin' && !item.skin) return false;
      if (x.forms === 'base' && item.skin) return false;
      return true;
    }
    lessonsOf(src).forEach(function (l) {
      var mats = l.materials || [];
      mats.forEach(function (m) {
        var list = typeof m === 'string' ? (shop.materials[m] || []) : [m];
        list.forEach(function (x) { if (fits(x) && !seen[x.name]) { seen[x.name] = 1; out.push(x); } });
      });
    });
    return out;
  }

  function renderMats() {
    var line = state.sel && state.sel.line;
    var mats = materialsOf(state.item, line);
    el.matsH.textContent = 'Что понадобится' + (line === 'rare' ? ': серебро' : line === 'classic' ? ': медь и бронза' : '');
    el.mats.innerHTML = mats.map(function (m) {
      var name = m.url ? '<a href="' + esc(m.url) + '" target="_blank" rel="noopener sponsored">' + esc(m.name) + '</a>' : esc(m.name);
      return '<li>' + name + (m.note ? '<small>' + esc(m.note) + '</small>' : '') + '</li>';
    }).join('');
    el.mats.parentNode.hidden = !mats.length;
  }

  // Каталог из кабинета, если он подключён: там актуальные цены и статусы.
  function loadCatalog() {
    if (!cfg.app) return;
    fetch(cfg.app.replace(/\/$/, '') + '/api/catalog', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.products || !j.products.length) return;
        var lessons = {};
        j.products.forEach(function (p) { (p.lessons || []).forEach(function (l) { lessons[l.slug] = l; }); });
        shop = { products: j.products, lessons: Object.keys(lessons).map(function (k) { return lessons[k]; }), materials: shop.materials, launch: shop.launch, launchLabel: shop.launchLabel, giveaway: shop.giveaway };
        AA.shop = shop;
        emit('counts', {});
        if (dlg && dlg.open && state.item) renderOffers();
      })
      .catch(function () { /* кабинет недоступен — остаёмся на shop.js */ });
  }

  function buyUrl(p) { return cfg.app.replace(/\/$/, '') + '/account/?buy=' + encodeURIComponent(p.slug); }

  // Короткий статус для списка и подписи на сцене.
  function status(item) {
    var o = offers(item);
    var p = o.lesson || o.course;
    if (!p) return 'скоро';
    if (onSale(p)) return (p.type === 'lesson' ? 'урок ' : 'курс ') + AA.fmtPrice(p.price);
    return 'старт ' + (shop.launchLabel || '');
  }
  function mode(item) { var o = offers(item); return onSale(o.lesson || o.course) ? 'sale' : 'soon'; }
  function ctaLabel() { return 'Как сделать это украшение'; }

  /* ---------- разметка ---------- */

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'pd';
    dlg.setAttribute('aria-labelledby', 'pd-title');
    dlg.innerHTML =
      '<div class="pd__sheet">' +
        '<button class="pd__x" type="button" aria-label="Закрыть"><span></span></button>' +
        '<div class="pd__media"><div class="pd__art"></div><ol class="pd__key"></ol><p class="pd__vis"></p></div>' +
        '<div class="pd__main">' +
          '<header class="pd__head"><p class="pd__no"></p><h2 class="pd__title" id="pd-title"></h2><p class="pd__lead"></p></header>' +
          '<section class="pd__offers" aria-label="Урок и курс"></section>' +
          '<form class="pd__form" novalidate onsubmit="return false">' +
            '<p class="pd__try">Примерьте металл и камень — чертёж меняется сразу</p>' +
            '<div class="pd__opts"></div>' +
          '</form>' +
          '<dl class="pd__specs"></dl>' +
          '<section class="pd__mats"><h3 class="pd__h3">Что понадобится</h3><ul class="pd__list pd__list--mats"></ul></section>' +
          '<section class="pd__lessons"><h3 class="pd__h3"></h3><ol class="pd__list pd__list--lessons"></ol></section>' +
          '<p class="pd__legend"></p>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);

    el.sheet = $('.pd__sheet', dlg);
    el.art = $('.pd__art', dlg);
    el.vis = $('.pd__vis', dlg);
    el.key = $('.pd__key', dlg);
    el.no = $('.pd__no', dlg);
    el.title = $('.pd__title', dlg);
    el.lead = $('.pd__lead', dlg);
    el.form = $('.pd__form', dlg);
    el.opts = $('.pd__opts', dlg);
    el.specs = $('.pd__specs', dlg);
    el.offers = $('.pd__offers', dlg);
    el.mats = $('.pd__list--mats', dlg);
    el.matsH = $('.pd__mats .pd__h3', dlg);
    el.lessonsH = $('.pd__lessons .pd__h3', dlg);
    el.lessons = $('.pd__list--lessons', dlg);
    el.legend = $('.pd__legend', dlg);

    $('.pd__x', dlg).addEventListener('click', close);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    el.opts.addEventListener('change', onOption);
    el.offers.addEventListener('click', function (e) {
      var a = e.target.closest('[data-offer]');
      if (a) track('offer_click', { item: state.item && state.item.id, product: a.getAttribute('data-offer'), sale: a.getAttribute('data-sale') });
    });
  }

  // Камни по элементам: ряд на каждый элемент (чарм, наконечник, верх), камень — одним нажатием.
  function gemsHtml(g) {
    var rows = g.rows.map(function (r) {
      var chips = g.choices.map(function (c) {
        return '<label class="pd__chip pd__chip--gem" title="' + esc(c.title || c.label) + '">' +
          '<input type="radio" name="' + r.id + '" value="' + c.id + '"' + (r.value === c.id ? ' checked' : '') + '>' +
          '<span><i class="pd__sw" style="--sw:' + c.color + '"></i>' + esc(c.label) + '</span></label>';
      }).join('');
      return '<div class="pd__gem" role="radiogroup" aria-label="' + esc(r.label) + '">' +
        '<span class="pd__gem-l" aria-hidden="true">' + esc(r.label) + '</span><div class="pd__chips">' + chips + '</div></div>';
    }).join('');
    return '<fieldset class="pd__opt pd__opt--gems" data-opt="' + g.id + '"><legend class="pd__opt-l">' + esc(g.label) + '</legend>' +
      (g.hint ? '<p class="pd__opt-h">' + esc(g.hint) + '</p>' : '') + '<div class="pd__gems">' + rows + '</div></fieldset>';
  }

  function groupHtml(g) {
    if (g.type === 'gems') return gemsHtml(g);
    var check = g.type === 'check';
    var chips = g.choices.map(function (c) {
      var on = check ? g.value.indexOf(c.id) >= 0 : g.value === c.id;
      return '<label class="pd__chip' + (c.disabled ? ' is-off' : '') + '">' +
        '<input type="' + (check ? 'checkbox' : 'radio') + '" name="' + g.id + '" value="' + c.id + '"' + (on ? ' checked' : '') + (c.disabled ? ' disabled' : '') + '>' +
        '<span>' + (c.color ? '<i class="pd__sw" style="--sw:' + c.color + '"></i>' : '') + esc(c.label) +
        (c.note ? '<small>' + esc(c.note) + '</small>' : '') + '</span></label>';
    }).join('');
    if (g.all) {
      var allOn = g.choices.length && g.choices.every(function (c) { return g.value.indexOf(c.id) >= 0; });
      chips += '<label class="pd__chip pd__chip--all"><input type="checkbox" name="' + g.id + '" value="*all"' + (allOn ? ' checked' : '') + '><span>' + esc(g.all) + '</span></label>';
    }
    return '<fieldset class="pd__opt" data-opt="' + g.id + '"><legend class="pd__opt-l">' + esc(g.label) + '</legend>' +
      (g.hint ? '<p class="pd__opt-h">' + esc(g.hint) + '</p>' : '') +
      '<div class="pd__chips">' + chips + '</div></fieldset>';
  }

  function renderOptions() { el.opts.innerHTML = AA.groups(state.item, state.sel).map(groupHtml).join(''); }

  function renderArt() {
    var it = state.item;
    if (opts.renderArt && opts.renderArt(el.art, it, state.sel, el.key)) return;
    var label = opts.artLabel + ': ' + it.name;
    el.art.innerHTML = AA.draw(it.drawing, state.sel, state.sel.stone, label, { full: true });
    var keys = AA.drawLegend(it, state.sel);
    el.key.innerHTML = keys.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('');
    el.key.hidden = !keys.length;
  }

  function renderSpecs() {
    el.specs.innerHTML = state.item.specs(state.sel).map(function (s) {
      return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
    }).join('');
  }

  function offerHtml(p, kind) {
    if (!p) return '';
    var n = lessonsOf(p).length;
    var sale = onSale(p);
    var meta = kind === 'lesson' ? 'Видеоурок и список материалов' : n + ' ' + plural(n, 'урок', 'урока', 'уроков') + ', доступ без срока';
    var href = sale ? buyUrl(p) : (cfg.links.vk || '#');
    var label = sale ? (kind === 'lesson' ? 'Купить урок' : 'Купить курс') : 'Узнать о старте';
    return '<div class="pd__offer pd__offer--' + kind + '">' +
      '<p class="pd__offer-k">' + (kind === 'lesson' ? 'Урок по этому украшению' : 'Входит в курс') + '</p>' +
      '<p class="pd__offer-t">' + esc(kind === 'lesson' ? cap(p.title.replace(/^Урок:\s*/, '')) : p.title) + '</p>' +
      '<p class="pd__offer-m">' + esc(meta) + '</p>' +
      '<div class="pd__offer-row"><span class="pd__offer-p">' + AA.fmtPrice(p.price) + '</span>' +
      '<a class="pd__buy' + (kind === 'course' ? ' pd__buy--main' : '') + '" data-offer="' + esc(p.slug) + '" data-sale="' + (sale ? 1 : 0) + '" href="' + esc(href) + '"' +
      (sale ? '' : ' target="_blank" rel="noopener"') + '>' + label + '</a></div></div>';
  }

  function renderOffers() {
    var o = offers(state.item);
    var any = onSale(o.lesson) || onSale(o.course);
    el.offers.innerHTML = offerHtml(o.course, 'course') + offerHtml(o.lesson, 'lesson') +
      (any ? '' : '<p class="pd__soon">Старт продаж — ' + esc(shop.launchLabel || 'скоро') + '. Анонс, бесплатные уроки и розыгрыш — в нашем сообществе ВКонтакте.</p>');
    renderMats();
    var course = o.course, ls = lessonsOf(course);
    el.lessonsH.textContent = course ? 'Уроки курса' : '';
    el.lessons.innerHTML = ls.map(function (l) {
      return '<li><b>' + esc(l.title) + '</b>' + (l.free ? '<em>бесплатно</em>' : '') + '<small>' + esc(l.summary || '') + '</small></li>';
    }).join('');
    el.lessons.parentNode.hidden = !ls.length;
  }

  function onOption(e) {
    var input = e.target;
    if (!input.name) return;
    AA.change(state.item, state.sel, input.name, input.value, input.checked);
    renderOptions();
    var again = el.opts.querySelector('input[name="' + input.name + '"][value="' + input.value + '"]');
    if (again) again.focus({ preventScroll: true });
    renderArt();
    renderSpecs();
    if (input.name === 'line') renderMats();
    track('option', { item: state.item.id, option: input.name });
  }

  function fill(item) {
    state.item = item;
    state.sel = AA.defaults(item);
    dlg.setAttribute('data-mode', mode(item));
    dlg.setAttribute('data-item', item.id);
    el.no.textContent = item.no ? 'Проект № ' + item.no : '';
    el.title.textContent = item.name;
    el.lead.textContent = item.lead;
    el.vis.textContent = 'Изображение — визуализация. Ваше украшение будет своим: форму и камень выбираете вы.';
    el.legend.textContent = item.care || '';
    renderOptions();
    renderSpecs();
    renderArt();
    renderOffers();
  }

  function open(id, opener) {
    var item = AA.byId(id);
    if (!item || AA.items.indexOf(item) < 0) return;
    if (!dlg) build();
    state.opener = opener || document.activeElement;
    fill(item);
    document.documentElement.classList.add('pd-lock');
    dlg.showModal();
    dlg.scrollTop = 0;
    el.sheet.scrollTop = 0;
    requestAnimationFrame(function () { dlg.classList.add('is-in'); });
    var first = $('.pd__buy', dlg) || $('.pd__chip input', dlg);
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
    else $('.pd__x', dlg).focus({ preventScroll: true });
    track('open_item', { item: item.id, mode: mode(item) });
    if (history.replaceState) history.replaceState(null, '', '#' + item.id);
  }

  function close() {
    if (!dlg || !dlg.open) return;
    dlg.classList.remove('is-in');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      dlg.close();
      document.documentElement.classList.remove('pd-lock');
      if (state.opener && state.opener.focus) state.opener.focus({ preventScroll: true });
    }, reduce ? 0 : 260);
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  function init(o) {
    Object.keys(o || {}).forEach(function (k) { opts[k] = o[k]; });
    build();
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open]');
      if (!t) return;
      e.preventDefault();
      open(t.getAttribute('data-open'), t);
    });
    loadCatalog();
    // ссылка вида #stick открывает карточку сразу — удобно для пинов и сторис
    var hash = location.hash.replace('#', '');
    if (hash && AA.byId(hash) && AA.items.indexOf(AA.byId(hash)) >= 0) setTimeout(function () { open(hash); }, 350);
  }

  AA.preorder = {
    init: init,
    open: open,
    close: close,
    mode: mode,
    status: status,
    ctaLabel: ctaLabel,
    offers: offers,
    track: track,
    plural: plural,
    on: function (name, cb) { listeners[name].push(cb); if (name === 'counts') cb({}); }
  };
})();
