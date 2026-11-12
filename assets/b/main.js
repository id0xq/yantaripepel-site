/* amber&ash — вариант B «Свет». Пять слайдов вместо длинной страницы: камень, грейды,
   изделия, amber/ash, предзаказ. Фон — облако точек (cloud.js): каждый слайд собирает его
   в свою сцену. На большом экране слайды листаются колесом, клавишами, свайпом и рисками
   справа; на телефоне — обычной прокруткой со «снапом» к началу слайда. */
(function () {
  'use strict';

  var AA = window.AA, Cloud = window.Cloud;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var deckQ = window.matchMedia('(min-width: 900px) and (min-height: 640px)');

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var slides = $$('.sl');
  var ids = slides.map(function (s) { return s.id; });
  var dots = $$('.dots [data-go]');
  var count = $('[data-count]');
  var tools = $('.tools');
  var faq = $('#faq');
  var stage = $('[data-stage]');
  var cur = -1, deck = false, gl = false, lockUntil = 0;
  var line = AA.lineIds[0], duo = 'amber', piece = 0;
  var viewer = null, inDialog = false;   // 3D-изделие (models.js), пока не загрузилось — чертёж

  /* ---------- сцены облака ---------- */

  // Фото — референсы с Unsplash: замените своей макросъёмкой под теми же именами.
  // box — где сцена стоит на экране: центр (x, y) и высота в долях экрана, mobile — то же на телефоне.
  // trackers — точки снимка с подписью: [доля ширины, доля высоты, подпись].
  var REF = '../assets/b/ref/';
  var WIDE = { x: 0.67, y: 0.46, h: 0.52 }, WIDE_M = { x: 0.5, y: 0.31, h: 0.34 };
  // силуэт кристалла на hero.jpg: его дымчатый верх почти не отличается от фона, без силуэта он проваливается
  var CRYSTAL = [[0.345, 0.405], [0.6, 0.405], [0.64, 0.5], [0.69, 0.635], [0.6, 0.72], [0.5, 0.82], [0.43, 0.9],
    [0.36, 0.865], [0.32, 0.8], [0.31, 0.68], [0.32, 0.55]];
  var SCENES = {
    stone: {
      type: 'image', src: REF + 'hero-s.jpg', box: { x: 0.7, y: 0.53, h: 0.84 }, mobile: { x: 0.5, y: 0.32, h: 0.46 },
      mask: 1.1, key: 0.8, gamma: 2.2, floor: 0.002,
      focus: { poly: CRYSTAL, weight: 0.55, tint: [1, 0.58, 0.2] },
      trackers: [[0.49, 0.12, 'ушко'], [0.5, 0.335, 'a&sh'], [0.66, 0.55, 'грань'], [0.42, 0.89, 'вершина']]
    },
    // грейды — одна и та же палочка с подвесками: при переключении точки перестраиваются
    // из бронзы с корундами в серебро с гранатом, аквамарином и лабрадоритом
    'line-classic': {
      type: 'model', make: function (n) { return makeStick(n, STICK.classic); }, box: { x: 0.69, y: 0.52, h: 0.72 }, mobile: { x: 0.5, y: 0.33, h: 0.42 },
      spin: { axis: 'y', speed: 0.45, sway: 0.6 }
    },
    'line-rare': {
      type: 'model', make: function (n) { return makeStick(n, STICK.rare); }, box: { x: 0.69, y: 0.52, h: 0.72 }, mobile: { x: 0.5, y: 0.33, h: 0.42 },
      spin: { axis: 'y', speed: 0.45, sway: 0.6 }
    },
    field: { type: 'field' },
    // amber — натуральная палитра янтаря: коньяк, мёд, светлое золото вместо кислотно-жёлтого
    amber: {
      type: 'image', src: REF + 'amber-s.jpg', box: WIDE, mobile: WIDE_M, pt: 1.15, sat: 1.05, expo: 0.82, gradeMix: 0.8,
      grade: [[0, 0.06, 0.02, 0.005], [0.3, 0.32, 0.11, 0.025], [0.55, 0.62, 0.27, 0.05], [0.78, 0.86, 0.5, 0.14], [0.92, 0.95, 0.7, 0.32], [1, 1, 0.86, 0.6]],
      trackers: [[0.32, 0.45, 'смола'], [0.72, 0.3, 'свет']]
    },
    // ash — тот же кулон, что на первом слайде, в пепельной гамме: точки крупнее и мягче, от него поднимается дым
    ash: {
      type: 'image', src: REF + 'hero-s.jpg', box: { x: 0.7, y: 0.56, h: 0.8 }, mobile: { x: 0.5, y: 0.34, h: 0.44 },
      mask: 1.1, key: 0.8, gamma: 2.2, floor: 0.002, mono: true, pt: 1.5, smoke: 1, sat: 1, gradeMix: 1,
      focus: { poly: CRYSTAL, weight: 0.55 },
      grade: [[0, 0.02, 0.02, 0.02], [0.35, 0.2, 0.19, 0.18], [0.7, 0.55, 0.53, 0.5], [1, 0.9, 0.88, 0.84]],
      trackers: [[0.49, 0.12, 'ушко'], [0.5, 0.335, 'a&sh'], [0.62, 0.62, 'камень']]
    },
    // предзаказ: монограмма a&sh и под ней крупный аммонит — шире надписи примерно в 1,6 раза,
    // медленно вращается вокруг завитка. r — радиус вращения: аммонит внутри, надпись снаружи.
    mono: {
      type: 'group',
      parts: [
        { type: 'text', share: 0.3, text: 'a&sh', font: '500 360px Spectral', box: { x: 0.72, y: 0.16, h: 0.24 }, mobile: { x: 0.5, y: 0.115, h: 0.15 } },
        { type: 'model', share: 0.7, make: makeAmmonite, box: { x: 0.72, y: 0.61, h: 0.58 }, mobile: { x: 0.5, y: 0.335, h: 0.28 }, spin: { axis: 'z', speed: 0.1, r: 0.6 } }
      ]
    }
  };

  // Палочка в двух грейдах. Классический: дерево, бронза и корунды. Редкий: палочка целиком
  // из серебра, в луне гранат, на подвесках аквамарин и лабрадорит. labels — что подписать трекерами.
  var STICK = {
    classic: { shaft: [0.5, 0.31, 0.17], grain: true, metal: [0.98, 0.64, 0.34], seat: [1, 0.6, 0.2],
      charms: [[1, 0.6, 0.2], [0.95, 0.45, 0.62], [1, 0.6, 0.2], [0.38, 0.52, 1]],
      labels: [['shaft', 'дерево'], ['collar', 'бронза'], ['seat', 'корунд'], ['charm1', 'подвеска']] },
    rare: { shaft: [0.5, 0.54, 0.62], grain: false, metal: [0.54, 0.58, 0.66], seat: [0.86, 0.12, 0.2],
      charms: [[0.5, 0.86, 0.95], [0.3, 0.52, 0.95], [0.86, 0.12, 0.2], [0.5, 0.86, 0.95]],
      labels: [['shaft', 'серебро'], ['seat', 'гранат'], ['charm0', 'аквамарин'], ['charm1', 'лабрадорит']] }
  };

  // Палочка с подвесками (мм → доли высоты): дерево, луна с камнем, цепочки с камнями.
  function makeStick(n, g) {
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), k = 0, i;
    var tilt = -0.38, ct = Math.cos(tilt), st = Math.sin(tilt), S = 1 / 205, oy = 8;
    var BR = g.metal, WOOD = g.shaft;
    function raw(x, y, z, c, m) {                 // точка в мм, уже с наклоном
      if (k >= n) return;
      var o = k * 3;
      pos[o] = x * S; pos[o + 1] = (y - oy) * S; pos[o + 2] = z * S;
      col[o] = c[0] * m; col[o + 1] = c[1] * m; col[o + 2] = c[2] * m;
      k++;
    }
    function tilted(x, y) { var yy = y - 20; return [x * ct - yy * st, x * st + yy * ct + 20]; }
    function put(x, y, z, c, m) { var q = tilted(x, y); raw(q[0], q[1], z, c, m); }
    function radius(y) {                          // острый кончик, к верху — 3,7 мм
      if (y < -90) return Math.max(0.05, 0.45 * (y + 92) / 2);
      if (y < -82) return 0.45 + (y + 90) / 8 * 0.75;
      if (y < 0) return 1.2 + (y + 82) / 82 * 2;
      return Math.min(3.7, 3.2 + y / 64 * 0.5);
    }
    function wood() {
      for (;;) {
        var y = -92 + Math.random() * 158, r = radius(y);
        if (Math.random() > r / 3.7) continue;    // равная плотность по поверхности
        var f = Math.random() * Math.PI * 2;
        // дерево — волокна, серебро — гладкий блик вдоль палочки
        var m = g.grain ? 1.25 * (0.72 + 0.28 * Math.sin(f * 7 + y * 0.3 + Math.sin(y * 0.05) * 2)) : 0.8 + 0.55 * Math.pow(Math.max(0, Math.cos(f - 0.7)), 6);
        put(Math.cos(f) * r, y, Math.sin(f) * r, WOOD, m);
        return;
      }
    }
    for (i = 0; i < n * 0.34; i++) wood();
    // втулка с резьбой и шток
    for (i = 0; i < n * 0.07; i++) {
      var yc = 66 + Math.random() * 8, fc = Math.random() * Math.PI * 2;
      put(Math.cos(fc) * 4.3, yc, Math.sin(fc) * 4.3, BR, Math.abs(((yc - 66) % 2.6) - 1.3) < 0.35 ? 1.35 : 0.9);
    }
    for (i = 0; i < n * 0.015; i++) {
      var fs = Math.random() * Math.PI * 2;
      put(Math.cos(fs) * 1.25, 74 + Math.random() * 5.5, Math.sin(fs) * 1.25, BR, 1);
    }
    // луна: круг R минус сдвинутый круг; лицевая и обратная грань, светлое ребро
    var R = 18, my = 79.5 + R, dx = R * 0.4, dy = R * 0.18, rc = R * 0.84;
    for (i = 0; i < n * 0.16;) {
      var px = (Math.random() * 2 - 1) * R, py = (Math.random() * 2 - 1) * R;
      if (px * px + py * py > R * R || (px - dx) * (px - dx) + (py - dy) * (py - dy) < rc * rc) continue;
      put(px, my + py, Math.random() < 0.5 ? 1.3 : -1.3, BR, 0.85 + Math.random() * 0.2);
      i++;
    }
    for (i = 0; i < n * 0.06;) {
      var ang = Math.random() * Math.PI * 2, outer = Math.random() < 0.6;
      var ex = outer ? Math.cos(ang) * R : dx + Math.cos(ang) * rc, ey = outer ? Math.sin(ang) * R : dy + Math.sin(ang) * rc;
      if (outer ? (ex - dx) * (ex - dx) + (ey - dy) * (ey - dy) < rc * rc : ex * ex + ey * ey > R * R) continue;
      put(ex, my + ey, (Math.random() * 2 - 1) * 1.3, BR, 1.3);
      i++;
    }
    // камень в гнезде луны
    var seat = [-0.639 * R, my - 0.287 * R], sr = 0.186 * R;
    for (i = 0; i < n * 0.07; i++) {
      var u = Math.random() * 2 - 1, v = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      put(seat[0] + q * Math.cos(v) * sr, seat[1] + q * Math.sin(v) * sr, 1.6 + Math.abs(u) * sr * 0.7, g.seat, 0.95);
    }
    // подвески: цепочки висят отвесно от нижнего края луны, на концах — корунды
    var hung = [], step = 3;
    [[228, 34, g.charms[0]], [250, 52, g.charms[1]], [272, 40, g.charms[2]], [296, 28, g.charms[3]]].forEach(function (h, j) {
      var a = h[0] * Math.PI / 180, top = tilted(Math.cos(a) * R, my + Math.sin(a) * R), links = Math.round(h[1] / step);
      for (i = 0; i < n * 0.032; i++) {
        var L = (Math.random() * links) | 0, t = Math.random() * Math.PI * 2, cy0 = top[1] - 1.8 - L * step;
        if (L % 2) raw(top[0], cy0 + Math.sin(t) * 1.8, Math.cos(t) * 1.2, BR, 0.7);
        else raw(top[0] + Math.cos(t) * 1.2, cy0 + Math.sin(t) * 1.8, 0, BR, 0.7);
      }
      var gy = top[1] - 1.8 - links * step - 3.4;
      for (i = 0; i < n * 0.034; i++) {
        var gu = Math.random() * 2 - 1, gv = Math.random() * Math.PI * 2, gq = Math.sqrt(1 - gu * gu);
        raw(top[0] + gq * Math.cos(gv) * 3.2, gy + gu * 4, gq * Math.sin(gv) * 3.2, h[2], 0.85);
      }
      hung.push([top[0], gy]);
    });
    while (k < n) wood();
    function at(x, y, z) { var q = tilted(x, y); return [q[0] * S, (q[1] - oy) * S, z * S]; }
    var spots = { shaft: at(0, -30, 3.3), collar: at(4.3, 70, 0), seat: at(seat[0], seat[1], 2.5) };
    hung.forEach(function (h, j) { spots['charm' + j] = [h[0] * S, (h[1] - oy) * S, 0]; });
    return { pos: pos, col: col, anchors: g.labels.map(function (l) { return spots[l[0]].concat(l[1]); }) };
  }

  // Аммонит как гравюра: пять витков по логарифмической спирали (каждый шире прежнего в 1,85
  // раза), между витками тёмный шов. Точки ложатся в основном на рёбра — они идут поперёк
  // витка от шва к наружному краю и чуть изгибаются вперёд, — на края витков и на валик устья;
  // остальное — редкая заливка. Цвет — от коньячного в завитке к бледному золоту. Высота ≈ 1.
  function makeAmmonite(n) {
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), k = 0;
    var W = 1.85, b = Math.log(W) / (Math.PI * 2), T = 5 * Math.PI * 2, rOut = 0.45, q = 0.25, RIBS = 26;
    var a = rOut / Math.exp(b * T), E = Math.exp(b * T) - 1, E2 = Math.exp(2 * b * T) - 1;
    var RIB = [0.7, 0.48, 0.2], EDGE = [0.56, 0.33, 0.12], FILL = [0.36, 0.17, 0.05], LIP = [0.8, 0.6, 0.3];
    function at(th, ph, bump) {
      var r = a * Math.exp(b * th), rho = r * q * (1 + bump), er = Math.cos(ph) * rho;
      return [Math.cos(th) * (r + er), Math.sin(th) * (r + er), Math.sin(ph) * rho * 0.8];
    }
    function put(th, ph, bump, c) {
      var p = at(th, ph, bump), t = th / T, o = k * 3;
      var m = (0.88 + 0.24 * Math.random()) * (0.55 + 0.45 * Math.max(0, Math.cos(ph - 1.1))) * (0.7 + 0.3 * t);
      pos[o] = p[0]; pos[o + 1] = p[1]; pos[o + 2] = p[2];
      col[o] = (c[0] + 0.4 * t) * m; col[o + 1] = (c[1] + 0.38 * t) * m; col[o + 2] = (c[2] + 0.22 * t) * m;
      k++;
    }
    function byLength() { return Math.log(1 + Math.random() * E) / b; }        // чем шире виток, тем больше точек
    function flare(th) { return Math.max(0, (th - T + 0.6) / 0.6) * 0.12; }   // виток к устью чуть раздаётся
    while (k < n * 0.42) {                                                       // рёбра
      var ri = Math.round(byLength() * RIBS / (Math.PI * 2)), ph = Math.random() * Math.PI;
      var tr = ri * Math.PI * 2 / RIBS + 0.09 * Math.cos(ph) + (Math.random() - 0.5) * 0.012;
      if (tr > T - 0.02 || tr < 0.3) continue;
      put(tr, ph, 0.06 + flare(tr), RIB);
    }
    while (k < n * 0.6) {                                                        // края витков: наружный и у шва
      var te = byLength();
      put(te, (Math.random() < 0.55 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.22, flare(te), EDGE);
    }
    while (k < n * 0.64) put(T - Math.random() * 0.03, Math.random() * Math.PI * 2, flare(T) + 0.04, LIP);   // валик устья
    while (k < n) {                                                              // заливка по площади
      var tf = Math.log(1 + Math.random() * E2) / (2 * b);
      put(tf, Math.random() * Math.PI * 2, flare(tf), FILL);
    }
    return { pos: pos, col: col, anchors: [[0, 0, 0, 'аммонит'], at((RIBS * 5 - 6) * Math.PI * 2 / RIBS, Math.PI / 2, 0.06).concat('ребро')] };
  }

  function sceneName() {
    var id = ids[cur];
    if (id === 'lines') return 'line-' + line;
    if (id === 'idea') return duo;
    return slides[cur].getAttribute('data-scene');
  }

  function scene() {
    if (cur < 0) return;
    var name = sceneName();
    tools.classList.toggle('is-off', name === 'field');
    if (gl) Cloud.show(name);
  }

  function startCloud() {
    gl = !!(Cloud && Cloud.init($('.gl'), $('.trk')));
    if (!gl) { root.classList.add('no-gl'); return; }
    Object.keys(SCENES).forEach(function (k) { Cloud.define(k, SCENES[k]); });
    $$('[data-tool]').forEach(function (b) {
      var k = b.getAttribute('data-tool');
      Cloud.set(k, b.getAttribute('aria-pressed') === 'true');
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        Cloud.set(k, on);
      });
    });
    var depth = $('[data-depth]');
    Cloud.set('depth', +depth.value);
    depth.addEventListener('input', function () { Cloud.set('depth', +depth.value); });
    // остальные сцены разбираем на точки заранее, чтобы переход не ждал загрузки снимка
    setTimeout(function () { Cloud.preload(Object.keys(SCENES)); }, 1800);
  }

  /* ---------- слайды ---------- */

  function apply() {
    slides.forEach(function (s, k) {
      var on = k === cur;
      s.classList.toggle('is-active', on);
      s.classList.toggle('is-before', k < cur);
      s.inert = deck && !on;
      if (deck && !on) s.setAttribute('aria-hidden', 'true');
      else s.removeAttribute('aria-hidden');
    });
  }

  function busy() { return !faq.hidden || !!$('dialog[open]'); }

  function activate(i) {
    if (i === cur || i < 0) return;
    cur = i;
    apply();
    count.textContent = (i < 9 ? '0' : '') + (i + 1);
    dots.forEach(function (d, k) { d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    scene();
    if (ids[i] === 'pieces') replay();
    if (Math.abs(i - ids.indexOf('pieces')) <= 1) whenIdle(wantViewer);
    syncViewer();
    if (history.replaceState && !busy()) history.replaceState(null, '', i ? '#' + ids[i] : location.pathname + location.search);
  }

  function go(i, focus) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (!deck) {
      slides[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (i === cur) return;
    var from = slides[cur];
    lockUntil = performance.now() + 650;
    activate(i);
    // фокус не должен остаться на скрытом слайде
    if (focus || (from && from.contains(document.activeElement))) $('.sl__title', slides[i]).focus({ preventScroll: true });
  }

  // Колода — только если текст каждого слайда помещается в экран под шапкой; иначе слайды идут подряд.
  function fitsDeck() {
    if (!deckQ.matches) return false;
    var room = window.innerHeight - 72;
    return slides.every(function (s) {
      return $('.sl__copy', s).offsetHeight + (parseFloat(getComputedStyle(s).paddingBottom) || 0) <= room;
    });
  }

  function setMode() {
    deck = fitsDeck();
    root.classList.toggle('deck-mode', deck);
    apply();
    syncViewer();
    if (deck) window.scrollTo(0, 0);
    else if (cur > 0) slides[cur].scrollIntoView({ block: 'start' });
  }

  function navigation() {
    // колесо и тачпад: один жест — один слайд, инерция тачпада не листает дальше
    var acc = 0, last = 0, used = false;
    window.addEventListener('wheel', function (e) {
      if (!deck || e.ctrlKey || busy()) return;
      e.preventDefault();
      // время самого события, а не обработки: если страница на миг занята, жест не дробится
      var now = e.timeStamp || performance.now();
      if (now - last > 240) { acc = 0; used = false; }
      last = now;
      if (used || now < lockUntil) return;
      var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      acc += e.deltaMode === 1 ? d * 32 : d;
      if (Math.abs(acc) > 60) { used = true; go(cur + (acc > 0 ? 1 : -1)); }
    }, { passive: false });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !faq.hidden) { closeFaq(); return; }
      if (!deck || busy() || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target, tag = t.tagName, k = e.key, next = null;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      if (k === 'ArrowDown' || k === 'PageDown') next = cur + 1;
      else if (k === 'ArrowUp' || k === 'PageUp') next = cur - 1;
      else if (k === ' ' && !t.closest('button, a, summary')) next = cur + (e.shiftKey ? -1 : 1);
      else if (k === 'Home') next = 0;
      else if (k === 'End') next = slides.length - 1;
      if (next === null) return;
      e.preventDefault();
      go(next);
    });

    var touch = null;
    window.addEventListener('touchstart', function (e) {
      touch = deck && !busy() && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    window.addEventListener('touchend', function (e) {
      if (!touch) return;
      var p = e.changedTouches[0], dx = p.clientX - touch.x, dy = p.clientY - touch.y;
      touch = null;
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.3) go(cur + (dy < 0 ? 1 : -1));
    }, { passive: true });

    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); go(+g.getAttribute('data-go'), !g.closest('.dots')); return; }
      var f = e.target.closest('[data-faq]');
      if (f) {
        e.preventDefault();
        openFaq(f);
        // data-faq="giveaway" открывает вопросы сразу на нужном пункте
        var d = f.getAttribute('data-faq') && document.getElementById('faq-' + f.getAttribute('data-faq'));
        if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
      }
    });

    // на телефоне текущий слайд — тот, что пересекает середину экрана
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (deck) return;
        entries.forEach(function (en) { if (en.isIntersecting) activate(slides.indexOf(en.target)); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      slides.forEach(function (s) { io.observe(s); });
    }

    if (deckQ.addEventListener) deckQ.addEventListener('change', setMode);
    else if (deckQ.addListener) deckQ.addListener(setMode);
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (fitsDeck() !== deck) setMode(); }, 160);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (fitsDeck() !== deck) setMode(); });
  }

  /* ---------- грейды ---------- */

  function renderLines() {
    var list = $('[data-lines]'), note = $('[data-line-note]');
    list.innerHTML = AA.lineIds.map(function (id) {
      var l = AA.lines[id];
      return '<button type="button" role="tab" class="tab" id="tab-' + id + '" data-line="' + id + '" aria-controls="line-note">' +
        '<b>' + l.label + '</b></button>';
    }).join('');
    note.id = 'line-note';
    note.setAttribute('role', 'tabpanel');
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-line]');
      if (b) setLine(b.getAttribute('data-line'));
    });
    list.addEventListener('keydown', function (e) {
      var n = AA.lineIds.length, k = AA.lineIds.indexOf(line);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') k = (k + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') k = (k + n - 1) % n;
      else return;
      e.preventDefault();
      e.stopPropagation();
      setLine(AA.lineIds[k], true);
    });
    setLine(line);
  }

  function setLine(id, focus) {
    var changed = id !== line;
    line = id;
    $$('[data-line]').forEach(function (b) {
      var on = b.getAttribute('data-line') === id;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    var l = AA.lines[id], note = $('[data-line-note]');
    note.setAttribute('aria-labelledby', 'tab-' + id);
    note.textContent = l.note;
    if (changed && ids[cur] === 'lines') scene();
  }

  /* ---------- изделия: список и 3D-модель (или чертёж) ---------- */

  function renderPieces() {
    var list = $('[data-pieces]');
    list.innerHTML = AA.items.map(function (it, i) {
      return '<li><button type="button" class="piece" data-piece="' + i + '">' +
        '<i>' + it.no + '</i><b>' + it.name + '</b><span data-piece-status>' + AA.preorder.status(it) + '</span></button></li>';
    }).join('');
    // грейды и изделия выбираются нажатием, не наведением: облако и 3D не перебивают друг друга.
    // Первое нажатие показывает изделие, второе открывает сборку.
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-piece]');
      if (!b) return;
      var i = +b.getAttribute('data-piece');
      if (i === piece) AA.preorder.open(AA.items[i].id, b);
      else setPiece(i);
    });
    $('[data-build]').addEventListener('click', function (e) { AA.preorder.open(AA.items[piece].id, e.currentTarget); });
    setPiece(piece, true);
  }

  function setPiece(i, quiet) {
    if (i === piece && !quiet) return;
    piece = i;
    $$('[data-piece]').forEach(function (b) { b.setAttribute('aria-current', +b.getAttribute('data-piece') === i ? 'true' : 'false'); });
    renderStage();
    if (!quiet && !viewer) replay();
  }

  // На сцене: булавка, палочка и заколка — в классическом грейде полным комплектом, у каждого
  // элемента свой камень, видно, что их можно собрать по-разному; моносерьга и кольцо — в серебре:
  // серьга с синим лабрадоритом, кольцо со светлым аквамарином (решение 07.11). Карточка
  // открывается как обычно.
  var SHOWCASE = { earring: { line: 'rare', stone: 'labradorite' }, ring: { line: 'rare', stone: 'aquamarine' } };
  function stageSel(it) {
    var s = AA.defaults(it), show = SHOWCASE[it.id];
    if (show && it.lines.indexOf(show.line) >= 0) { AA.change(it, s, 'line', show.line); s.stone = show.stone; }
    if (it.element) {
      s.extras = it.element.choices.map(function (c) { return c.id; }).filter(function (id) { return id !== s.main; });
      var list = AA.lines[s.line].stones;
      AA.parts(s).forEach(function (id, i) { s.gems[id] = list[i % list.length]; });
      s.stone = s.gems[s.main];
    }
    return s;
  }

  function renderStage(intro) {
    var it = AA.items[piece], s = stageSel(it), art = $('[data-stage-art]');
    if (viewer) {
      if (!inDialog) viewer.show(it, s, { label: it.name + (it.element ? ', полный комплект' : '') + (s.line === 'rare' ? ', серебро' : ''), intro: intro });
    } else {
      art.innerHTML = AA.draw(it.drawing, s, s.stone, 'Чертёж: ' + it.name + (it.element ? ', полный комплект' : '') + (s.line === 'rare' ? ', серебро' : ''), { full: true });
    }
    $('[data-stage-key]').innerHTML = AA.drawLegend(it, s).map(function (k) { return '<li>' + k + '</li>'; }).join('');
    $('[data-stage-spec]').textContent = '№ ' + it.no + '   ' + it.typed[0];
    statuses();
  }

  function statuses() {
    var it = AA.items[piece];
    $('[data-stage-status]').textContent = AA.preorder.status(it);
    $('[data-build]').textContent = AA.preorder.ctaLabel(it);
    $$('[data-piece]').forEach(function (b) {
      var s = $('[data-piece-status]', b);
      if (s) s.textContent = AA.preorder.status(AA.items[+b.getAttribute('data-piece')]);
    });
  }

  // Вход на слайд: чертёж прорисовывается заново, у 3D-модели элемент накручивается на резьбу.
  function replay() {
    if (viewer) { renderStage(true); return; }
    stage.classList.remove('is-drawn');
    void stage.offsetWidth;
    stage.classList.add('is-drawn');
  }

  // 3D крутится, только когда его видно: слайд изделий на экране или открыта карточка.
  function syncViewer() {
    if (viewer) viewer.setActive(inDialog || !deck || ids[cur] === 'pieces');
  }

  // Тяжёлое — когда браузер свободен и переход слайда закончился.
  function whenIdle(fn) {
    if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 1500 });
    else setTimeout(fn, 700);
  }

  // 3D включаем, когда оно понадобится: слайд изделий рядом, открыта карточка или прошло
  // несколько секунд. Так первый экран не делит видеокарту и главный поток с Three.js.
  function wantViewer() {
    if (viewer || !gl) return;
    if (window.AA3D) mountViewer();
    else if (!wantViewer.waiting) {
      wantViewer.waiting = true;
      document.addEventListener('aa3d:ready', mountViewer, { once: true });
    }
  }

  function mountViewer() {
    if (viewer || !window.AA3D || !gl) return;     // без WebGL остаётся чертёж
    var art = $('[data-stage-art]');
    try { viewer = window.AA3D.create(art); } catch (e) { console.warn('3D недоступно:', e); return; }
    window.AA3D.viewer = viewer;
    $$(':scope > svg', art).forEach(function (n) { art.removeChild(n); });
    stage.classList.add('stage--3d');
    renderStage(true);
    syncViewer();
  }

  // В карточке изделия вместо чертежа — та же модель: меняется вместе с выбором.
  function dialogArt(host, it, s, keyEl) {
    if (!it.drawing || it.id === 'gift') return false;
    if (!viewer) wantViewer();
    if (!viewer) return false;
    inDialog = true;
    $$(':scope > *', host).forEach(function (n) { if (n !== viewer.el) host.removeChild(n); });
    viewer.attach(host);
    viewer.show(it, s, { label: it.name });
    keyEl.innerHTML = AA.drawLegend(it, s).map(function (k) { return '<li>' + k + '</li>'; }).join('');
    keyEl.hidden = false;
    keyEl.classList.add('pd__key--plain');
    syncViewer();
    return true;
  }

  function dialogClosed() {
    if (!viewer || !inDialog) return;
    inDialog = false;
    viewer.attach($('[data-stage-art]'));
    renderStage();
    syncViewer();
  }

  /* ---------- amber / ash ---------- */

  // Янтарь — камень, пепел — металл после огня. Ключи amber/ash — имена сцен облака.
  var DUO = {
    amber: { word: 'янтарь', text: 'Камень: корунд, лабрадорит, аквамарин, гранат. Момент, сохранённый в форме.' },
    ash: { word: 'пепел', text: 'Металл: серебро и медь, прошедшие через огонь. Глина сгорает — остаются металл и след ваших рук.' }
  };

  function setDuo(id) {
    if (id === duo) return;
    duo = id;
    $$('[data-duo]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-duo') === id ? 'true' : 'false'); });
    $('[data-duo-word]').textContent = DUO[id].word;
    $('[data-duo-text]').textContent = DUO[id].text;
    if (ids[cur] === 'idea') scene();
  }

  /* ---------- вопросы ---------- */

  var faqFrom = null, faqInert = [];
  function openFaq(from) {
    faqFrom = from;
    faq.hidden = false;
    faqInert = $$('body > *').filter(function (el) { return el !== faq && !el.inert && el.tagName !== 'SCRIPT'; });
    faqInert.forEach(function (el) { el.inert = true; });
    root.classList.add('pd-lock');
    if (gl) Cloud.pause(true);
    $('.faq__x', faq).focus({ preventScroll: true });
  }
  function closeFaq() {
    if (faq.hidden) return;
    faq.hidden = true;
    faqInert.forEach(function (el) { el.inert = false; });
    root.classList.remove('pd-lock');
    if (gl) Cloud.pause(false);
    if (faqFrom && faqFrom.focus) faqFrom.focus({ preventScroll: true });
  }

  /* ---------- даты, фаза, ссылки ---------- */

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function ymd(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return { d: +m[3], m: +m[2] - 1 }; }

  function dmy(iso) { var d = ymd(iso); return d.d + ' ' + MONTHS[d.m]; }

  // Старт продаж и новогодний розыгрыш — из shop.js.
  function phaseCopy() {
    var shop = AA.shop || {};
    var today = new Date().toISOString().slice(0, 10);
    $$('[data-phase]').forEach(function (el) { el.textContent = shop.launch && today < shop.launch ? 'Старт ' + dmy(shop.launch) : 'Мастерская'; });
    $$('[data-cta]').forEach(function (el) { el.textContent = 'Выбрать украшение'; });
    $$('[data-launch]').forEach(function (el) { if (shop.launch) el.textContent = dmy(shop.launch); });
    var g = shop.giveaway;
    var box = $('[data-gw]');
    if (!box) return;
    if (!g || !g.active) { box.hidden = true; $$('[data-gw-flag]').forEach(function (el) { el.hidden = true; }); return; }
    var when = today < g.startsAt ? 'Старт ' + dmy(g.startsAt) : today <= g.endsAt ? 'Идёт до ' + dmy(g.endsAt) : 'Итоги ' + dmy(g.drawAt);
    $('[data-gw-title]').textContent = g.title;
    $('[data-gw-when]').textContent = when;
    $('[data-gw-prizes]').innerHTML = g.prizes.map(function (p) { return '<li>' + p.replace(/[<>&]/g, '') + '</li>'; }).join('');
    $('[data-gw-steps]').innerHTML = g.steps.map(function (p) { return '<li>' + p.replace(/[<>&]/g, '') + '</li>'; }).join('');
    $('[data-gw-dates]').textContent = 'Участвовать — с ' + dmy(g.startsAt) + ' по ' + dmy(g.endsAt) + ' включительно. Трёх победителей выберем случайно ' + dmy(g.drawAt) + ' и покажем выбор на видео.';
    var winners = $('[data-gw-winners]');
    winners.hidden = !(g.winners && g.winners.length);
    if (g.winners && g.winners.length) winners.textContent = 'Победители: ' + g.winners.join(', ');
    $$('[data-gw-post]').forEach(function (a) { var url = g.postUrl || AA.config.links.vk; if (url) a.href = url; });
    $$('[data-gw-flag]').forEach(function (el) { el.hidden = today > g.drawAt; });
  }

  // Ссылка без адреса в настройках не показывается (канала Telegram, профилей Instagram и
  // Pinterest ещё нет), вместе с ней — сноска про Meta. «От» в вопросах — из каталога.
  function links() {
    $$('[data-link]').forEach(function (a) {
      var url = AA.config.links[a.getAttribute('data-link')];
      a.hidden = !url;
      if (url) a.href = url;
    });
    $$('[data-link-note]').forEach(function (el) { el.hidden = !AA.config.links[el.getAttribute('data-link-note')]; });
  }

  /* ---------- старт ---------- */

  function start() {
    links();
    phaseCopy();
    slides.forEach(function (s) {
      $$('.sl__copy > *', s).forEach(function (el, i) { el.style.setProperty('--i', i); });
      $('.sl__title', s).tabIndex = -1;
    });
    renderLines();
    renderPieces();
    $$('[data-duo]').forEach(function (b) { b.addEventListener('click', function () { setDuo(b.getAttribute('data-duo')); }); });
    faq.addEventListener('click', function (e) { if (e.target === faq || e.target.closest('.faq__x')) closeFaq(); });

    // На сцене — 3D из точек, в карточке — чертёж с выносками (решение 12.11.2026).
    AA.preorder.init({ variant: 'B', artLabel: 'Чертёж', renderArt: null });
    AA.preorder.on('counts', statuses);
    var dlg = $('dialog.pd');
    if (dlg) dlg.addEventListener('close', dialogClosed);

    startCloud();
    // 3D готовим после того, как первая сцена собралась: первый экран ни с чем не делит видеокарту
    var firstScene = true;
    if (gl) Cloud.onScene(function () {
      if (!firstScene) return;
      firstScene = false;
      setTimeout(function () { whenIdle(wantViewer); }, 1100);
    });
    setTimeout(function () { whenIdle(wantViewer); }, 5000);
    if ('IntersectionObserver' in window) {
      // в прокрутке на телефоне — заранее, за экран до слайда изделий
      new IntersectionObserver(function (en) { if (!deck && en[0].isIntersecting) whenIdle(wantViewer); }, { rootMargin: '120% 0px' }).observe($('#pieces'));
    }
    // пока открыта карточка изделия, облако стоит на месте: не тратим кадры под затемнением
    if (gl && dlg && window.MutationObserver) {
      new MutationObserver(function () { Cloud.pause(dlg.open); }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
    }

    // первый слайд — из адреса: #lines, #idea… или ссылка на изделие (#stick) ведёт к изделиям
    var h = location.hash.slice(1), first = Math.max(0, ids.indexOf(h)), item = AA.byId(h);
    if (item) {
      first = ids.indexOf('pieces');
      if (AA.items.indexOf(item) >= 0) setPiece(AA.items.indexOf(item), true);
    }

    deck = fitsDeck();
    root.classList.toggle('deck-mode', deck);
    apply();
    navigation();
    // вход: облако собирается в камень, текст проявляется следом
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        activate(first);
        if (!deck && first > 0) slides[first].scrollIntoView({ block: 'start' });
      });
    });
  }

  start();
})();
