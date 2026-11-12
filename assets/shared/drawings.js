/*
  Механические чертежи изделий: инлайн-SVG с осевыми линиями, размерами и
  разнесённым узлом крепления (элемент приподнят над резьбовым замком, стрелка
  показывает, что он откручивается). Чертёж перестраивается под выбор покупателя:
  какой элемент стоит на основе, что лежит в комплекте, какой камень и как он огранён.

  Классы линий одни на оба варианта, красит их CSS варианта:
  l — контур, t — тонкие линии, c — осевая, dl/dt — размерная линия и число,
  gh — пустое место под элемент, ar — стрелка вращения, w/s/g/fl — камень, k* — выноски.
*/
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  function f(n) { return Math.round(n * 10) / 10; }
  function pt(p) { return f(p[0]) + ' ' + f(p[1]); }
  // pathLength=1 — чтобы вариант мог «прорисовать» контур анимацией; у пунктиров его нет.
  function path(d, cls, dashed) {
    return '<path class="' + cls + '" d="' + d + '"' + (dashed ? '' : ' pathLength="1"') + '/>';
  }
  function circle(cx, cy, r, cls, dashed) {
    return '<circle class="' + cls + '" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"' + (dashed ? '' : ' pathLength="1"') + '/>';
  }
  function ellipse(cx, cy, rx, ry, cls) {
    return '<ellipse class="' + cls + '" cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" pathLength="1"/>';
  }
  function text(x, y, s, cls, anchor, rot) {
    return '<text class="' + cls + '" x="' + f(x) + '" y="' + f(y) + '" text-anchor="' + (anchor || 'middle') + '"' +
      (rot ? ' transform="rotate(' + rot + ' ' + f(x) + ' ' + f(y) + ')"' : '') + '>' + s + '</text>';
  }
  function group(inner, transform) {
    return '<g' + (transform ? ' transform="' + transform + '"' : '') + '>' + inner + '</g>';
  }

  function spiralD(cx, cy, r0, r1, turns, a0, dir) {
    var n = Math.max(24, Math.round(turns * 56));
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var a = a0 + dir * t * turns * TAU;
      var r = r0 + (r1 - r0) * t;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return 'M' + out.map(pt).join(' L');
  }

  function arcFlags(c, p, q, m) {
    function ang(v) { return Math.atan2(v[1] - c[1], v[0] - c[0]); }
    function norm(a) { return ((a % TAU) + TAU) % TAU; }
    var a0 = ang(p);
    var dq = norm(ang(q) - a0);
    var dm = norm(ang(m) - a0);
    if (dm < dq) return { sweep: 1, large: dq > Math.PI ? 1 : 0 };
    return { sweep: 0, large: (TAU - dq) > Math.PI ? 1 : 0 };
  }

  // Полумесяц: окружность (cx, cy, R) минус окружность, смещённая на (dx, dy) радиуса r.
  function crescent(cx, cy, R, dx, dy, r) {
    var d = Math.hypot(dx, dy);
    var ux = dx / d, uy = dy / d;
    var a = (R * R - r * r + d * d) / (2 * d);
    var h = Math.sqrt(Math.max(0, R * R - a * a));
    var px = cx + a * ux, py = cy + a * uy;
    var i1 = [px - h * uy, py + h * ux];
    var i2 = [px + h * uy, py - h * ux];
    var c2 = [cx + dx, cy + dy];
    var o = arcFlags([cx, cy], i1, i2, [cx - R * ux, cy - R * uy]);
    var n = arcFlags(c2, i2, i1, [c2[0] - r * ux, c2[1] - r * uy]);
    return {
      d: 'M' + pt(i1) + ' A' + R + ' ' + R + ' 0 ' + o.large + ' ' + o.sweep + ' ' + pt(i2) +
         ' A' + r + ' ' + r + ' 0 ' + n.large + ' ' + n.sweep + ' ' + pt(i1) + 'Z',
      seat: [cx - ux * (R + r - d) / 2, cy - uy * (R + r - d) / 2],
      seatR: Math.max(2.5, (R - (r - d)) / 2 * 0.62)
    };
  }

  /* ---------- камень: заливка + контур + рисунок по типу камня ---------- */

  var STONE = 'corundum_honey';   // камень текущего чертежа
  function kindOf() { return (AA.stones[STONE] || {}).kind || 'facet'; }

  function circleD(cx, cy, r) {
    return 'M' + f(cx - r) + ' ' + f(cy) + ' a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0 a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0';
  }

  function stoneCircle(cx, cy, r) {
    var kind = kindOf();
    var out = '<g class="aa-stone">' + path(circleD(cx + 0.6, cy + 0.5, r * 1.1), 'w') + path(circleD(cx, cy, r), 'l s');
    if (kind === 'facet' && r > 4) {
      out += circle(cx, cy, r * 0.52, 't');
      for (var k = 0; k < 8; k++) {
        var a = k / 8 * TAU + Math.PI / 8;
        out += path('M' + f(cx + Math.cos(a) * r * 0.52) + ' ' + f(cy + Math.sin(a) * r * 0.52) + ' L' + f(cx + Math.cos(a) * r) + ' ' + f(cy + Math.sin(a) * r), 't');
      }
      out += path('M' + f(cx - r * 0.34) + ' ' + f(cy - r * 0.12) + ' q' + f(r * 0.08) + ' ' + f(-r * 0.28) + ' ' + f(r * 0.32) + ' ' + f(-r * 0.36), 'g');
    } else if (kind === 'flash' && r > 4) {
      out += path('M' + f(cx - r * 0.75) + ' ' + f(cy + r * 0.25) + ' C' + f(cx - r * 0.2) + ' ' + f(cy - r * 0.45) + ' ' + f(cx + r * 0.3) + ' ' + f(cy + r * 0.35) + ' ' + f(cx + r * 0.78) + ' ' + f(cy - r * 0.2), 'fl');
    } else if (kind === 'shell' && r > 4) {
      for (var i = 0; i < 7; i++) {
        var c = Math.PI + 0.25 + i / 6 * (Math.PI - 0.5);
        out += path('M' + f(cx) + ' ' + f(cy + r * 0.82) + ' L' + f(cx + Math.cos(c) * r * 0.96) + ' ' + f(cy + Math.sin(c) * r * 0.96), 't');
      }
    }
    return out + '</g>';
  }

  // Камень-капля для серьги.
  function stoneDrop(cx, top, w, h) {
    var kind = kindOf();
    var bottom = top + h;
    var d = 'M' + f(cx) + ' ' + f(top) + ' C' + f(cx + w) + ' ' + f(top + h * 0.4) + ' ' + f(cx + w) + ' ' + f(bottom - h * 0.06) + ' ' + f(cx) + ' ' + f(bottom) +
      ' C' + f(cx - w) + ' ' + f(bottom - h * 0.06) + ' ' + f(cx - w) + ' ' + f(top + h * 0.4) + ' ' + f(cx) + ' ' + f(top) + 'Z';
    var wash = 'M' + f(cx - 1) + ' ' + f(top - 2) + ' C' + f(cx + w + 2) + ' ' + f(top + h * 0.38) + ' ' + f(cx + w + 3) + ' ' + f(bottom - h * 0.02) + ' ' + f(cx + 1) + ' ' + f(bottom + 2) +
      ' C' + f(cx - w - 3) + ' ' + f(bottom - h * 0.03) + ' ' + f(cx - w - 2) + ' ' + f(top + h * 0.38) + ' ' + f(cx - 1) + ' ' + f(top - 2) + 'Z';
    var out = '<g class="aa-stone">' + path(wash, 'w') + path(d, 'l s');
    var cy = top + h * 0.62;
    if (kind === 'facet') {
      var tw = w * 0.5, th = h * 0.42, tt = top + h * 0.34;
      var table = [[cx, tt], [cx + tw, tt + th * 0.45], [cx + tw * 0.8, tt + th], [cx - tw * 0.8, tt + th], [cx - tw, tt + th * 0.45]];
      out += path('M' + table.map(pt).join(' L') + 'Z', 't');
      var outer = [[cx, top], [cx + w * 0.86, top + h * 0.55], [cx + w * 0.55, bottom - h * 0.06], [cx - w * 0.55, bottom - h * 0.06], [cx - w * 0.86, top + h * 0.55]];
      for (var k = 0; k < 5; k++) out += path('M' + pt(table[k]) + ' L' + pt(outer[k]), 't');
      out += path('M' + f(cx - w * 0.42) + ' ' + f(top + h * 0.52) + ' q' + f(w * 0.05) + ' ' + f(-h * 0.12) + ' ' + f(w * 0.3) + ' ' + f(-h * 0.18), 'g');
    } else if (kind === 'flash') {
      out += path('M' + f(cx - w * 0.6) + ' ' + f(cy + h * 0.1) + ' C' + f(cx - w * 0.1) + ' ' + f(cy - h * 0.25) + ' ' + f(cx + w * 0.2) + ' ' + f(cy + h * 0.2) + ' ' + f(cx + w * 0.62) + ' ' + f(cy - h * 0.12), 'fl');
    } else if (kind === 'shell') {
      for (var i = 0; i < 6; i++) {
        var x = cx - w * 0.6 + i * w * 0.24;
        out += path('M' + f(cx) + ' ' + f(bottom - 4) + ' L' + f(x) + ' ' + f(top + h * 0.3), 't');
      }
    }
    return out + '</g>';
  }

  /* ---------- элементы (рисуются вокруг 0,0) ---------- */

  var parts = {
    moon: function (R) {
      var c = crescent(0, 0, R, R * 0.4, -R * 0.18, R * 0.84);
      return path(c.d, 'l m') + stoneCircle(c.seat[0], c.seat[1], c.seatR);
    },
    spiral: function (R) {
      return path(spiralD(0, 0, R * 0.18, R, 2.5, -Math.PI / 2, 1), 'l') + stoneCircle(0, 0, R * 0.2);
    },
    stone: function (R) {
      return circle(0, 0, R, 'l m') + circle(0, 0, R * 0.86, 't') + stoneCircle(0, 0, R * 0.7) +
        [0, 1, 2, 3].map(function (k) {
          var a = k / 4 * TAU + Math.PI / 4;
          return path('M' + f(Math.cos(a) * R * 0.86) + ' ' + f(Math.sin(a) * R * 0.86) + ' L' + f(Math.cos(a) * R * 0.66) + ' ' + f(Math.sin(a) * R * 0.66), 'l');
        }).join('');
    },
    cast: function (R) {
      return circle(0, 0, R, 'l m') + circle(0, 0, R * 0.84, 't') + stoneCircle(0, 0, R * 0.68);
    },
    sprout: function (R) {
      // завиток с бутонами по мотиву фотографий Блоссфельдта
      var cx = R * 0.15, cy = -R * 0.3, r1 = R * 0.62, a0 = Math.PI, turns = 1.05;
      function at(t) {
        var a = a0 + t * turns * TAU, r = r1 * (1 - t * 0.82);
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a: a };
      }
      var pts = [];
      for (var i = 0; i <= 60; i++) { var p = at(i / 60); pts.push([p.x, p.y]); }
      var stem = 'M0 ' + f(R * 1.05) + ' C' + f(R * 0.05) + ' ' + f(R * 0.5) + ' ' + f(-R * 0.47) + ' ' + f(R * 0.25) + ' ' + f(-R * 0.47) + ' ' + f(cy);
      var buds = '';
      [0.06, 0.17, 0.28, 0.39, 0.5, 0.6, 0.69].forEach(function (t, k) {
        var q = at(t), s = R * (0.2 - k * 0.022);
        var bx = q.x + Math.cos(q.a) * s * 0.85, by = q.y + Math.sin(q.a) * s * 0.85;
        buds += '<path class="l m" pathLength="1" transform="translate(' + f(bx) + ' ' + f(by) + ') rotate(' + f(q.a * 180 / Math.PI + 90) + ')" d="M0 ' + f(s) +
          ' C' + f(s * 0.62) + ' ' + f(s * 0.55) + ' ' + f(s * 0.5) + ' ' + f(-s * 0.7) + ' 0 ' + f(-s) +
          ' C' + f(-s * 0.5) + ' ' + f(-s * 0.7) + ' ' + f(-s * 0.62) + ' ' + f(s * 0.55) + ' 0 ' + f(s) + 'Z"/>';
      });
      return path(stem, 'l') + path('M' + pts.map(pt).join(' L'), 'l') + buds + stoneCircle(cx, cy, R * 0.12);
    },
    sun: function (R) {
      var rays = '';
      for (var k = 0; k < 12; k++) {
        var a = k / 12 * TAU - Math.PI / 2;
        var r1 = k % 2 ? R * 1.5 : R * 1.75;
        rays += path('M' + f(Math.cos(a) * R * 1.24) + ' ' + f(Math.sin(a) * R * 1.24) + ' L' + f(Math.cos(a) * r1) + ' ' + f(Math.sin(a) * r1), 'l');
      }
      return rays + circle(0, 0, R, 'l m') + circle(0, 0, R * 0.86, 't') + stoneCircle(0, 0, R * 0.66);
    }
  };

  // Габарит элемента от центра (в радиусах) — для размеров и стыковки с замком.
  var EXTENT = { moon: 1, spiral: 1, stone: 1, cast: 1, sprout: 1.05, sun: 1.75 };

  // Элемент со своим камнем: цвет и рисунок камня — от камня этого элемента (GEMS), иначе общий.
  var GEMS = null;
  function part(kind, x, y, R) {
    var keep = STONE, gem = GEMS && GEMS[kind];
    if (gem && AA.stones[gem]) STONE = gem;
    var st = AA.stones[STONE] || AA.stones.corundum_honey;
    var out = '<g transform="translate(' + f(x) + ' ' + f(y) + ')" style="--stone:' + st.color + '">' + parts[kind](R) + '</g>';
    STONE = keep;
    return out;
  }

  // Резьба: прямоугольник с косыми витками.
  function thread(cx, y, w, h) {
    var out = path('M' + f(cx - w / 2) + ' ' + f(y) + ' h' + f(w) + ' v' + f(h) + ' h' + f(-w) + 'Z', 'l');
    var n = Math.max(2, Math.round(h / 5));
    for (var i = 1; i <= n; i++) {
      var yy = y + h * i / (n + 1);
      out += path('M' + f(cx - w / 2) + ' ' + f(yy + 1.4) + ' L' + f(cx + w / 2) + ' ' + f(yy - 1.4), 't');
    }
    return out;
  }

  function arrowHead(x, y, ang, size) {
    var s = size || 6;
    var bx = x - Math.cos(ang) * s, by = y - Math.sin(ang) * s;
    var nx = -Math.sin(ang) * s * 0.36, ny = Math.cos(ang) * s * 0.36;
    return '<path class="ah" d="M' + f(x) + ' ' + f(y) + ' L' + f(bx + nx) + ' ' + f(by + ny) + ' L' + f(bx - nx) + ' ' + f(by - ny) + 'Z"/>';
  }

  function dimH(x1, x2, y, label, fromY) {
    var out = '';
    if (fromY != null) out += path('M' + f(x1) + ' ' + f(fromY) + ' V' + f(y - 4), 'dl', true) + path('M' + f(x2) + ' ' + f(fromY) + ' V' + f(y - 4), 'dl', true);
    out += path('M' + f(x1) + ' ' + f(y) + ' H' + f(x2), 'dl', true) + arrowHead(x1, y, Math.PI) + arrowHead(x2, y, 0);
    return out + text((x1 + x2) / 2, y - 6, label, 'dt');
  }

  // Вертикальный размер: выносные линии от объекта (fromX1 у y1, fromX2 у y2) до размерной.
  function dimV(y1, y2, x, label, fromX1, fromX2) {
    var out = '';
    var dir = fromX1 != null && fromX1 > x ? 1 : -1;   // 1 — объект справа от размерной линии
    if (fromX1 != null) out += path('M' + f(fromX1) + ' ' + f(y1) + ' H' + f(x - 4 * dir), 'dl', true);
    if (fromX2 != null) out += path('M' + f(fromX2) + ' ' + f(y2) + ' H' + f(x - 4 * dir), 'dl', true);
    out += path('M' + f(x) + ' ' + f(y1) + ' V' + f(y2), 'dl', true) + arrowHead(x, y1, -Math.PI / 2) + arrowHead(x, y2, Math.PI / 2);
    return out + text(x - 6, (y1 + y2) / 2, label, 'dt', 'middle', -90);
  }

  function axis(x1, y1, x2, y2) {
    return path('M' + f(x1) + ' ' + f(y1) + ' L' + f(x2) + ' ' + f(y2), 'c', true);
  }

  // Стрелка вращения вокруг резьбы: элемент откручивается.
  function twist(cx, cy, rx) {
    var ry = rx * 0.32;
    return path('M' + f(cx - rx) + ' ' + f(cy) + ' A' + f(rx) + ' ' + f(ry) + ' 0 0 0 ' + f(cx + rx) + ' ' + f(cy), 'ar', true) +
      arrowHead(cx + rx, cy, -Math.PI / 2 + 0.35, 6);
  }

  function callout(px, py, lx, ly, n) {
    return '<g class="ko">' + circle(px, py, 1.8, 'kd', true) + path('M' + f(px) + ' ' + f(py) + ' L' + f(lx) + ' ' + f(ly), 'k', true) +
      circle(lx, ly, 8, 'kc', true) + text(lx, ly + 3.6, String(n), 'kt') + '</g>';
  }

  /* ---------- изделия ---------- */

  var draw = {};

  draw.pin = function (s, o) {
    var els = AA.parts(s);
    if (!els.length) els = ['moon'];
    var out = '';
    out += path('M94 60 L70 60 C54 60 47 70 47 79 C47 89 54 98 70 98 L94 98', 'l');
    out += path('M94 60 L94 98', 'l');
    out += path('M73 68 C63 72 63 86 73 90', 't');
    out += path('M302 74 L80 76', 'l');
    out += path('M306 93 L94 92', 'l');
    out += circle(313, 83, 12, 'l') + path(spiralD(313, 83, 3, 8.5, 1.6, 0, 1), 't');
    out += dimH(47, 325, 36, '75', 56);
    var loops = [140, 198, 256];
    loops.forEach(function (x, i) {
      out += circle(x, 98.5, 5.2, 'l');
      out += axis(x, 104, x, 214);
      var kind = els[i];
      if (!kind) {
        out += circle(x, 152, 15, 'gh', true) + path('M' + (x - 5) + ' 152 H' + (x + 5) + ' M' + x + ' 147 V157', 'gh', true);
        return;
      }
      out += circle(x, 109, 4.2, 'l');
      out += ellipse(x, 121, 3.4, 7, 'l') + path('M' + f(x + 3.4) + ' 118 l3 -3', 't');
      var R = kind === 'stone' ? 15 : 20;
      var cy = 130 + R + 6;
      out += path('M' + x + ' 128 L' + x + ' ' + f(cy - R), 'l');
      out += part(kind, x, cy, R);
    });
    out += dimV(132, 182, 296, '25', 276, 276);
    if (o.full) {
      out += callout(200, 75, 216, 18, 1) + callout(122, 156, 84, 186, 2) + callout(loops[0] - 6, 160, 84, 222, 3) + callout(259, 121, 336, 150, 4);
    }
    return { vb: '0 0 380 240', body: out };
  };

  // Элемент над замком с зазором: шток с резьбой и стрелка вращения.
  function mounted(x, kind, R, topY) {
    var ext = EXTENT[kind] * R;
    var cy = topY + ext;
    var studTop = cy + R + 6;
    var out = part(kind, x, cy, R);
    out += path('M' + x + ' ' + f(cy + R) + ' L' + x + ' ' + f(studTop), 'l');
    out += thread(x, studTop, 12, 14);
    out += twist(x, studTop + 7, 17);
    return { svg: out, cy: cy, bottom: studTop + 14, top: cy - ext };
  }

  function spares(els, x, y0, step, scale, R) {
    var out = '';
    els.forEach(function (kind, i) {
      var r = typeof R === 'function' ? R(kind) : R;
      out += group(part(kind, 0, 0, r) + path('M0 ' + r + ' L0 ' + (r + 8), 'l') + thread(0, r + 8, 12, 12),
        'translate(' + x + ' ' + (y0 + i * step) + ') scale(' + scale + ')');
    });
    return out;
  }

  draw.stick = function (s, o) {
    var els = AA.parts(s);
    if (!els.length) els = ['moon'];
    var x = 120, R = 34;
    var m = mounted(x, els[0], R, 34);
    var lockTop = m.bottom + 9;
    var out = m.svg;
    out += thread(x, lockTop, 18, 18);
    var bodyTop = lockTop + 18;
    out += path('M114 ' + f(bodyTop) + ' L117.6 440 Q120 456 122.4 440 L126 ' + f(bodyTop) + ' Z', 'l');
    out += path('M118 ' + f(bodyTop + 14) + ' C119.5 260 117.5 340 119.2 426', 't');
    out += path('M122 ' + f(bodyTop + 24) + ' C121 270 123 350 121 416', 't');
    out += ellipse(120, 300, 1.6, 5, 't');
    out += axis(x, 16, x, 462);
    out += dimV(lockTop, 452, 62, '150–180', 108, 116);
    out += dimV(m.top, m.cy + R, 178, '38', 150, 140);
    out += spares(els.slice(1), 214, 262, 98, 0.55, 34);
    if (o.full) {
      out += callout(125, 330, 160, 350, 1) + callout(x + R * 0.72, m.cy + 10, 168, m.cy + 58, 2) +
        callout(x - 13, m.cy + 4, 80, m.cy + 50, 3) + callout(x - 9, lockTop + 9, 80, lockTop + 34, 4);
    }
    return { vb: '0 0 260 470', body: out };
  };

  draw.clip = function (s, o) {
    var els = AA.parts(s);
    if (!els.length) els = ['sun'];
    var x = 120;
    var R = els[0] === 'sun' ? 19 : 30;
    var m = mounted(x, els[0], R, 20);
    var sockTop = m.bottom + 9;
    var out = m.svg;
    out += thread(x, sockTop, 16, 16);
    var dy = sockTop + 16 - 174;   // перемычка зубцов встаёт под замок
    function sh(d) { return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, function (_, a, b) { return a + ' ' + f(parseFloat(b) + dy); }); }
    out += path(sh('M102 446 C92 360 86 262 92 212 C98 162 142 162 148 212 C154 262 148 360 138 446'), 'l');
    out += path(sh('M102 446 C104 364 102 272 106 224 C110 186 130 186 134 224 C138 272 136 364 138 446'), 'l');
    out += path(sh('M97 252 C96 302 98 362 101 420'), 't') + path(sh('M143 252 C144 302 142 362 139 420'), 't');
    out += axis(x, 12, x, 466);
    out += dimV(sockTop, 446 + dy, 56, '160', 112, 100);
    out += dimV(m.top, m.cy + R, 196, '38', x + EXTENT[els[0]] * R + 4, x + R + 4);
    out += spares(els.slice(1), 222, 340, 90, 0.55, function (k) { return k === 'sun' ? 19 : 30; });
    if (o.full) {
      out += callout(147, 300 + dy, 190, 318 + dy, 1) + callout(x + R * 0.66, m.cy + R * 0.62, 186, m.cy + 58, 2) +
        callout(x - 7, m.cy + 2, 72, m.cy + 44, 3) + callout(x - 8, sockTop + 8, 72, sockTop + 30, 4);
    }
    return { vb: '0 0 260 480', body: out };
  };

  // Проволока с толщиной: контур вокруг осевой линии (две параллельные линии, как у булавки).
  function wire(pts, w) {
    var L = [], Rt = [];
    pts.forEach(function (p, i) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
      var nx = -dy / n * w / 2, ny = dx / n * w / 2;
      L.push([p[0] + nx, p[1] + ny]);
      Rt.push([p[0] - nx, p[1] - ny]);
    });
    return path('M' + L.map(pt).join(' L') + ' L' + Rt.reverse().map(pt).join(' L') + 'Z', 'l');
  }

  // Швенза-крючок: плотная дуга и короткий задний конец с отгибом.
  function hook(x, y0, top, r) {
    var pts = [], cx = x - r, cy = top + r, i;
    for (i = 0; i <= 8; i++) pts.push([x, y0 - (y0 - cy) * i / 8]);
    for (i = 1; i <= 24; i++) { var a = -Math.PI * i / 24; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    var bx = cx - r;
    for (i = 1; i <= 10; i++) { var t = i / 10; pts.push([bx - 1.2 * t, cy + (y0 - cy) * 0.62 * t]); }
    pts.push([bx - 3.4, cy + (y0 - cy) * 0.62 + 4]);
    return wire(pts, 3);
  }

  draw.earring = function (s, o) {
    var out = '';
    out += hook(126, 140, 68, 16);
    out += circle(126, 145, 5, 'l');
    out += circle(126, 156, 4.5, 'l');
    out += path('M126 160.5 L126 164', 'l');
    // оправа-капля: широкая рамка вокруг камня (внешний контур и внутренний край гнезда)
    out += path('M126 162 C162 200 162 254 126 264 C90 254 90 200 126 162Z', 'l m');
    out += path('M126 171 C152 205 152 248 126 256 C100 248 100 205 126 171Z', 't');
    out += stoneDrop(126, 180, 19, 70);
    out += axis(126, 132, 126, 280);
    out += dimV(68, 264, 192, '55', 112, 158);
    if (o.full) {
      out += callout(110, 70, 64, 40, 1) + callout(156, 222, 190, 296, 2) + callout(124, 226, 70, 294, 3);
    }
    return { vb: '0 0 240 310', body: out };
  };

  // Кольцо: в классическом грейде камень сидит прямо в отверстии шинки, в редком — в небольшой
  // оправе прямо на шинке, без подиума.
  draw.ring = function (s, o) {
    return s.line === 'rare' ? ringBezel(s, o) : ringFlush(s, o);
  };

  // Камень в отверстии шинки: вид спереди с местным разрезом по гнезду (штриховка — металл)
  // и вид сверху на камень в шинке.
  function ringFlush(s, o) {
    var size = String(s.size || '17').replace('.', ',');
    var cx = 108, cy = 150, r = 51, i;
    var out = '';
    // толщина шинки: 10 внизу, к верху плавно растёт до 16 — там гнездо под камень
    function thick(a) { return 10 + 6 * Math.pow((1 - Math.sin(a)) / 2, 2.5); }
    function rimAt(a) { var R = r + thick(a); return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }
    var rim = [];
    for (i = 0; i < 120; i++) rim.push(rimAt(-Math.PI / 2 + i / 120 * TAU));
    out += axis(cx - r - 26, cy, cx + r + 26, cy) + axis(cx, 66, cx, cy + r + 24);
    out += path('M' + rim.map(pt).join(' L') + 'Z', 'l') + circle(cx, cy, r, 'l');

    // гнездо: отверстие сужается к пальцу, камень лежит площадкой вровень с шинкой
    var top = cy - r - thick(-Math.PI / 2), floor = cy - r, g = 9, yg = top + 2.2;
    function inHole(x, y) { return Math.abs(x - cx) < g + 0.6 - (y - top) / (floor - top) * 5.2; }
    function inMetal(x, y) {
      var dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      return dy < 0 && Math.abs(dx) < 21 && d > r && d < r + thick(Math.atan2(dy, dx)) && !inHole(x, y);
    }
    for (var c = 2 * cy - 170; c < 2 * cy - 40; c += 4.2) {        // штриховка под 45°: x + y = c
      var run = null;
      for (var x = cx - 24; x <= cx + 24; x += 0.4) {
        var on = inMetal(x, c - x);
        if (on && !run) run = [x, c - x];
        if ((!on || x + 0.4 > cx + 24) && run) {
          if (x - run[0] > 1.2) out += path('M' + pt(run) + ' L' + f(x - 0.4) + ' ' + f(c - x + 0.4), 't');
          run = null;
        }
      }
    }
    [-21, 21].forEach(function (dx) {                               // линии обрыва разреза
      var yi = cy - Math.sqrt(r * r - dx * dx), yo = rimAt(Math.atan2(-Math.sqrt(66 * 66 - dx * dx), dx))[1];
      out += path('M' + f(cx + dx) + ' ' + f(yi) + ' C' + f(cx + dx + 3) + ' ' + f(yi - 6) + ' ' + f(cx + dx - 3) + ' ' + f(yo + 6) + ' ' + f(cx + dx) + ' ' + f(yo), 't');
    });
    [-1, 1].forEach(function (k) {                                 // стенки отверстия
      out += path('M' + f(cx + k * (g + 0.6)) + ' ' + f(top + 0.4) + ' L' + f(cx + k * 4.4) + ' ' + f(floor + 0.2), 't');
    });
    var gem;
    if (kindOf() === 'facet') gem = 'M' + f(cx - 5.5) + ' ' + f(top - 0.6) + ' H' + f(cx + 5.5) + ' L' + f(cx + g) + ' ' + f(yg) + ' L' + f(cx) + ' ' + f(top + 13) + ' L' + f(cx - g) + ' ' + f(yg) + 'Z';
    else gem = 'M' + f(cx - g) + ' ' + f(top + 4) + ' Q' + f(cx - g) + ' ' + f(top - 3.5) + ' ' + f(cx) + ' ' + f(top - 3.5) + ' Q' + f(cx + g) + ' ' + f(top - 3.5) + ' ' + f(cx + g) + ' ' + f(top + 4) + 'Z';
    out += '<g class="aa-stone">' + path(gem, 'w') + path(gem, 'l s') + '</g>';
    out += dimH(cx - r, cx + r, cy - 8, 'Ø ' + size);

    // вид сверху: шинка к гнезду шире, камень в отверстии
    var tx = 262, ty = 150, L = 60;
    function hw(xx) { return 6 + 8 * Math.pow(Math.max(0, 1 - xx * xx / (L * L)), 1.5); }
    var upper = [], lower = [];
    for (i = 0; i <= 48; i++) { var xx = -L + i / 48 * 2 * L; upper.push([tx + xx, ty - hw(xx)]); lower.push([tx + xx, ty + hw(xx)]); }
    out += axis(tx - L - 8, ty, tx + L + 8, ty) + axis(tx, ty - 30, tx, ty + 30);
    out += path('M' + upper.map(pt).join(' L') + ' L' + lower.reverse().map(pt).join(' L') + 'Z', 'l m');
    out += circle(tx, ty, g + 1.4, 't') + stoneCircle(tx, ty, g);
    out += path('M' + f(cx + 12) + ' ' + f(top - 3) + ' L' + f(tx - 15) + ' ' + f(ty - 15), 'gh', true);
    if (o.full) {
      out += callout(cx + 61 * 0.71, cy + 61 * 0.71, cx + 83, cy + 79, 1) + callout(cx - 8, top + 7, cx - 54, top - 14, 2) + callout(tx + 5, ty - 5, tx + 34, ty - 46, 3);
    }
    return { vb: '0 0 330 250', body: out };
  }

  // Небольшая оправа прямо на шинке: стенка поднимается от шинки, подиума нет.
  function ringBezel(s, o) {
    var size = String(s.size || '17').replace('.', ',');
    var cx = 108, cy = 150, r = 51, i;
    var out = '';
    function thick(a) { return 10 + 2.5 * Math.pow((1 - Math.sin(a)) / 2, 2.5); }
    var rim = [];
    for (i = 0; i < 120; i++) { var a = -Math.PI / 2 + i / 120 * TAU, R = r + thick(a); rim.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    out += axis(cx - r - 26, cy, cx + r + 26, cy) + axis(cx, 56, cx, cy + r + 24);
    out += path('M' + rim.map(pt).join(' L') + 'Z', 'l') + circle(cx, cy, r, 'l');
    var top = cy - r - thick(-Math.PI / 2), bw = 12, tw = 14.5, h = 9;
    out += path('M' + f(cx - bw) + ' ' + f(top + 2.4) + ' L' + f(cx - tw) + ' ' + f(top - h) + ' H' + f(cx + tw) + ' L' + f(cx + bw) + ' ' + f(top + 2.4), 'l m');
    out += path('M' + f(cx - tw + 1.8) + ' ' + f(top - h + 2.6) + ' H' + f(cx + tw - 1.8), 't');
    var y0 = top - h + 1.2, gem;
    if (kindOf() === 'facet') gem = 'M' + f(cx - 6.5) + ' ' + f(y0 - 6.5) + ' H' + f(cx + 6.5) + ' L' + f(cx + 11.5) + ' ' + f(y0) + ' L' + f(cx - 11.5) + ' ' + f(y0) + 'Z';
    else gem = 'M' + f(cx - 11.5) + ' ' + f(y0) + ' Q' + f(cx - 11.5) + ' ' + f(y0 - 8) + ' ' + f(cx) + ' ' + f(y0 - 8) + ' Q' + f(cx + 11.5) + ' ' + f(y0 - 8) + ' ' + f(cx + 11.5) + ' ' + f(y0) + 'Z';
    out += '<g class="aa-stone">' + path(gem, 'w') + path(gem, 'l s') + '</g>';
    out += dimH(cx - r, cx + r, cy - 8, 'Ø ' + size);
    // вид сверху: шинка к оправе чуть шире, сверху — оправа и камень
    var tx = 262, ty = 150, L = 60;
    function hw(xx) { return 6 + 3.5 * Math.pow(Math.max(0, 1 - xx * xx / (L * L)), 1.5); }
    var upper = [], lower = [];
    for (i = 0; i <= 48; i++) { var xx = -L + i / 48 * 2 * L; upper.push([tx + xx, ty - hw(xx)]); lower.push([tx + xx, ty + hw(xx)]); }
    out += axis(tx - L - 8, ty, tx + L + 8, ty) + axis(tx, ty - 30, tx, ty + 30);
    out += path('M' + upper.map(pt).join(' L') + ' L' + lower.reverse().map(pt).join(' L') + 'Z', 'l m');
    out += circle(tx, ty, tw, 'l m') + circle(tx, ty, tw - 2.4, 't') + stoneCircle(tx, ty, 11);
    out += path('M' + f(cx + 16) + ' ' + f(top - h - 4) + ' L' + f(tx - 17) + ' ' + f(ty - 17), 'gh', true);
    if (o.full) {
      out += callout(cx + 61 * 0.71, cy + 61 * 0.71, cx + 83, cy + 79, 1) + callout(cx - tw + 1, top - h / 2, cx - 56, top - 26, 2) + callout(tx + 6, ty - 6, tx + 34, ty - 46, 3);
    }
    return { vb: '0 0 330 250', body: out };
  }

  draw.gift = function (s) {
    var amount = s && s.amount ? AA.fmtPrice(AA.certOf(s.amount).amount) : '';
    var out = '';
    out += path('M300 78 C306 46 318 24 334 8', 'l') + path('M300 78 C290 50 294 26 310 6', 't');
    out += path('M40 58 L330 58 L330 238 L40 238 Z', 'l');
    out += circle(300, 80, 6, 'l');
    out += path('M70 112 C110 108 150 116 196 111 S258 113 278 110', 't');
    out += path('M70 134 C120 130 168 138 214 132 S262 135 284 131', 't');
    out += path('M70 156 C102 153 140 159 180 154', 't');
    out += path(spiralD(92, 202, 2, 17, 2.8, 0, 1), 'l');
    out += stoneCircle(258, 196, 15);
    if (amount) out += text(122, 208, amount, 'dt', 'start');
    return { vb: '0 0 360 250', body: out };
  };

  // Подписи к выноскам: номер на чертеже → что это и из чего.
  // Металл по грейду: в классическом — медь или бронза, у серьги и кольца белая бронза;
  // в редком всё серебро, включая основу палочки и заколки.
  function legend(item, s) {
    var rare = s.line === 'rare';
    var metal = rare ? 'серебро' : item.skin ? 'белая бронза' : 'медь или бронза';
    var base = rare ? 'серебро' : 'дерево';
    var el = item.element ? item.element.choices.filter(function (c) { return c.id === s.main; })[0] : null;
    var name = el ? el.label.toLowerCase() : '';
    function label(id) { return AA.stones[id] ? AA.stones[id].label.toLowerCase() : ''; }
    var list = item.element ? AA.parts(s).map(function (id) { return label(AA.gemOf(s, id)); }) : [label(s.stone)];
    var uniq = list.filter(function (x, i) { return list.indexOf(x) === i; });
    var st = uniq.length > 1 ? 'камни: ' + list.join(', ') : 'камень: ' + uniq[0];
    if (item.id === 'pin') return ['основа: ' + metal, 'чарм: ' + name, st, 'карабин'];
    if (item.id === 'stick') return ['основа: ' + base, 'наконечник: ' + name + ', ' + metal, st, 'резьбовой замок'];
    if (item.id === 'clip') return ['основа: ' + base, 'верх: ' + name + ', ' + metal, st, 'резьбовой замок'];
    if (item.id === 'earring') return ['швенза: ' + metal, 'оправа: ' + metal, st];
    if (item.id === 'ring') return rare ? ['шинка: серебро', 'оправа: серебро', st] : ['шинка: белая бронза', 'гнездо в шинке', st];
    return [];
  }

  function render(kind, sel, stoneId, label, opts) {
    STONE = stoneId || 'corundum_honey';
    GEMS = (sel && sel.gems) || null;
    var o = opts || {};
    var d = draw[kind](sel || {}, o);
    GEMS = null;
    var st = AA.stones[STONE] || AA.stones.corundum_honey;
    return '<svg class="aa-art aa-art--' + kind + (o.full ? ' is-full' : '') + '" viewBox="' + d.vb + '" role="img" aria-label="' + (label || '') +
      '" style="--stone:' + st.color + '" preserveAspectRatio="xMidYMid meet"><g class="aa-root">' + d.body + '</g></svg>';
  }

  window.AA = window.AA || {};
  window.AA.draw = render;
  window.AA.drawLegend = legend;
  window.AA.geom = { spiralD: spiralD, crescent: crescent };
})();
