/*
  Облако точек для варианта B. Сцена — снимок, текст или модель, разобранные на точки:
  у снимка координаты берутся из пикселей, глубина — из яркости; модель (палочка, аммонит)
  сама отдаёт точки в объёме. Между сценами точки разлетаются и собираются в новую форму.
  Курсор рассеивает облако, камера чуть поворачивается за ним. Поверх — трекеры
  с координатами, скан-линия и следы движения. У сцены бывает своё настроение:
  крупнее и мягче точки, дым и пепел, медленное вращение вокруг своей оси.
*/
(function () {
  'use strict';

  var Cloud = {};
  var canvas, gl, prog, fadeProg, buf, fadeBuf;
  var N = 0, W = 1, H = 1, dpr = 1, aspect = 1;
  var data;                      // Float32Array: на точку [pA(3) cA(3) pB(3) cB(3) r(2)] = 14
  var STRIDE = 14;
  var TRAIL = 0.22;              // доля, на которую гаснет прошлый кадр при включённых следах
  var defs = {}, cache = {};
  var current = null, mix = 1, mixStart = 0, mixDur = 950;
  var t0 = performance.now(), raf = 0, visible = true, lost = false, lastFrame = 0, settled = 0;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0 };
  var rot = { x: 0, y: 0 };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opts = { trackers: true, scan: true, trails: false, dense: false, depth: 1, field: 0 };
  // настроение сцены: размер точек, дым, вращение — плавно догоняет цель при смене сцены
  var look = { pt: 1, smoke: 0, spin: 0 }, aim = { pt: 1, smoke: 0, spin: 0 };
  var spin = { cx: 0, cy: 0, r: 1e3, axis: 0, speed: 0, sway: 0, start: 0, angle: 0 };
  var U = {}, A = {};
  var listeners = [];

  var VERT = [
    'attribute vec3 aPA;attribute vec3 aCA;attribute vec3 aPB;attribute vec3 aCB;attribute vec2 aR;',
    'uniform float uMix,uTime,uAspect,uDepth,uSize,uDpr,uField,uScanY,uScanOn,uMouseOn,uGain,uSmoke,uSpin,uSpinR,uSpinAxis,uPt;',
    'uniform vec2 uMouse,uRot,uSpinC;',
    'varying vec3 vCol;varying float vA;',
    'float ease(float t){return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.;}',
    'void main(){',
    ' float m=ease(uMix);',
    ' vec3 p=mix(aPA,aPB,m);',
    // вращение сцены вокруг своего центра: вертикальная ось (0) или плоскость экрана (1)
    ' vec2 rel=p.xy-uSpinC;',
    ' float an=uSpin*(1.-smoothstep(uSpinR*.97,uSpinR,length(rel)));',
    ' float cs=cos(an),sn=sin(an);',
    ' if(uSpinAxis<.5){float x0=rel.x;p.x=uSpinC.x+cs*x0+sn*p.z;p.z=-sn*x0+cs*p.z;}',
    ' else{p.xy=uSpinC+vec2(cs*rel.x-sn*rel.y,sn*rel.x+cs*rel.y);}',
    ' float fly=sin(3.14159*clamp(uMix,0.,1.));',
    ' p+=vec3(sin(aR.x*43.1+uTime*.7),cos(aR.y*37.7+uTime*.6),sin(aR.x*13.3+aR.y*7.1))*fly*.6;',
    ' p.x+=uField*sin(p.y*2.6+uTime*.35+aR.x*6.283)*.07;',
    ' p.y+=uField*cos(p.x*2.2+uTime*.28+aR.y*6.283)*.07;',
    // дым и пепел: часть точек отрывается от предмета, поднимается и тает
    ' float sm=step(aR.x,.22)*uSmoke,ash=step(.22,aR.x)*step(aR.x,.26)*uSmoke;',
    ' float life=fract(uTime*(.045+aR.y*.05)+aR.y*17.),life2=fract(uTime*(.02+aR.y*.02)+aR.y*9.);',
    ' p+=vec3(sin(life*5.+aR.x*60.)*.16*life+life*.1,life*1.05,cos(aR.y*40.+life*3.)*.12*life)*sm;',
    ' p+=vec3(sin(life2*4.+aR.y*30.)*.35,life2*.8-.15,sin(aR.x*80.)*.2)*ash;',
    ' p+=vec3(sin(uTime*1.3+aR.x*50.),cos(uTime*1.1+aR.y*40.),sin(uTime*.9+aR.x*30.))*.0025;',
    ' p.z*=uDepth;',
    ' float cy=cos(uRot.x),sy=sin(uRot.x),cx=cos(uRot.y),sx=sin(uRot.y);',
    ' p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);',
    ' p=vec3(p.x,cx*p.y-sx*p.z,sx*p.y+cx*p.z);',
    ' float persp=2.4/(2.4+p.z);',
    ' vec2 clip=vec2(p.x/uAspect,p.y)*persp;',
    ' vec2 d=(clip-uMouse)*vec2(uAspect,1.);',
    ' float dist=length(d);',
    ' float push=uMouseOn*exp(-dist*dist*18.)*(.1+.12*aR.x);',
    ' clip+=(d/max(dist,1e-4))*push/vec2(uAspect,1.);',
    ' gl_Position=vec4(clip,0.,1.);',
    ' gl_PointSize=uSize*uPt*uDpr*(.55+aR.y*.9)*persp*(1.+sm*2.6+ash*.3);',
    ' float scan=uScanOn*exp(-pow((clip.y-uScanY)*30.,2.));',
    ' vec3 col=mix(aCA,aCB,m);',
    ' col=mix(col,vec3(.62,.6,.57)*(.45+.55*aR.y),sm);',
    ' col=mix(col,vec3(.86,.84,.8),ash);',
    ' vCol=(col+scan*vec3(.9,.72,.45))*uGain;',
    ' vA=(.72+.28*aR.x)*(1.-.4*fly)*mix(1.,.16*sin(3.14159*life),sm)*mix(1.,sin(3.14159*life2),ash);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;varying vec3 vCol;varying float vA;',
    'void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c);if(r>.25)discard;',
    ' float a=smoothstep(.25,.0,r);gl_FragColor=vec4(vCol*a*vA,1.);}'
  ].join('\n');

  var FADE_V = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FADE_F = 'precision mediump float;uniform vec4 uC;void main(){gl_FragColor=uC;}';

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('cloud shader:', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function program(v, f) {
    var vs = compile(gl.VERTEX_SHADER, v), fs = compile(gl.FRAGMENT_SHADER, f);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }

  /* ---------- геометрия сцен ---------- */

  // Рамка сцены в долях экрана → мировые координаты (высота экрана = 2, ширина = 2·aspect).
  function frameOf(def) {
    var narrow = W < 900;
    var b = (narrow && def.mobile) || def.box || { x: 0.5, y: 0.5, h: 1 };
    return { cx: (b.x * 2 - 1) * aspect, cy: 1 - b.y * 2, h: b.h * 2 };
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = src;
    });
  }

  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Цветовая растяжка: яркость → цвет по опорным точкам [доля, r, g, b].
  function ramp(stops, t) {
    if (t <= stops[0][0]) return stops[0].slice(1);
    for (var i = 1; i < stops.length; i++) {
      if (t > stops[i][0]) continue;
      var a = stops[i - 1], b = stops[i], q = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q, a[3] + (b[3] - a[3]) * q];
    }
    return stops[stops.length - 1].slice(1);
  }

  // Выборка точек: больше всего их там, где снимок отличается от фона (фон — средний цвет
  // полосы по краю кадра) и где светлее. Края гасит эллиптическая виньетка, чтобы облако
  // не читалось прямоугольником. Тёмные снимки вытягиваются экспозицией.
  function sampleImage(img, def, n) {
    // crop — часть снимка в долях [x0, y0, x1, y1]; трекеры тогда считаются в долях этой части
    var cp = def.crop || [0, 0, 1, 1], nw = img.naturalWidth, nh = img.naturalHeight;
    var cw = nw * (cp[2] - cp[0]), ch = nh * (cp[3] - cp[1]);
    var sw = 320, sh = Math.round(sw * ch / cw);
    var cv = document.createElement('canvas');
    cv.width = sw; cv.height = sh;
    var g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, nw * cp[0], nh * cp[1], cw, ch, 0, 0, sw, sh);
    var px = g.getImageData(0, 0, sw, sh).data;
    var M = sw * sh, i, x, y;

    var edge = Math.max(2, Math.round(Math.min(sw, sh) * 0.05)), bg = [0, 0, 0], bn = 0;
    for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) {
      if (x >= edge && y >= edge && x < sw - edge && y < sh - edge) continue;
      i = (y * sw + x) * 4;
      bg[0] += px[i]; bg[1] += px[i + 1]; bg[2] += px[i + 2]; bn++;
    }
    bg = bg.map(function (c) { return c / bn / 255; });

    // focus — силуэт предмета в долях кадра: внутри точки есть даже там, где предмет сливается
    // с фоном (дымчатая часть кристалла), а серые пиксели внутри тонируются в янтарь
    var focus = null, F = def.focus;
    if (F) {
      var fc = document.createElement('canvas');
      fc.width = sw; fc.height = sh;
      var fx = fc.getContext('2d', { willReadFrequently: true });
      fx.filter = 'blur(' + (F.feather || 2) + 'px)';
      fx.fillStyle = '#fff';
      fx.beginPath();
      F.poly.forEach(function (q, j) { fx[j ? 'lineTo' : 'moveTo'](q[0] * sw, q[1] * sh); });
      fx.closePath();
      fx.fill();
      var fd = fx.getImageData(0, 0, sw, sh).data;
      focus = new Float32Array(M);
      for (i = 0; i < M; i++) focus[i] = fd[i * 4 + 3] / 255;
    }

    var key = def.key == null ? 0.65 : def.key, mr = def.mask || 0.95, vc = def.vc || [0.5, 0.5];
    var w = new Float32Array(M), vig = new Float32Array(M), lum = new Float32Array(M), maxW = 1e-6;
    for (i = 0; i < M; i++) {
      var r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
      var l = 0.299 * r + 0.587 * gg + 0.114 * b;
      var d = Math.sqrt((r - bg[0]) * (r - bg[0]) + (gg - bg[1]) * (gg - bg[1]) + (b - bg[2]) * (b - bg[2]));
      x = i % sw; y = (i / sw) | 0;
      var ex = (x / sw - vc[0]) * 2, ey = (y / sh - vc[1]) * 2;
      vig[i] = 1 - smooth(mr * 0.7, mr, Math.sqrt(ex * ex + ey * ey));
      lum[i] = l;
      w[i] = (key * Math.min(1, d * 2.2) + (1 - key) * l) * vig[i];
      if (focus) w[i] = Math.max(w[i], focus[i] * (F.weight || 0.5) * vig[i]);
      if (w[i] > maxW) maxW = w[i];
    }
    var cdf = new Float32Array(M), acc = 0;
    var gamma = def.gamma || 1.8, floor = def.floor == null ? 0.004 : def.floor;
    for (i = 0; i < M; i++) {
      acc += Math.pow(w[i] / maxW, gamma) + floor * vig[i];
      cdf[i] = acc;
    }

    var pick = new Int32Array(n);
    for (var k = 0; k < n; k++) {
      var t = Math.random() * acc, lo = 0, hi = M - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (cdf[mid] < t) lo = mid + 1; else hi = mid; }
      pick[k] = lo;
    }
    // экспозиция: 90-й перцентиль яркости выбранных точек выводим к expo (обычно 0.9)
    var probe = [];
    for (k = 0; k < Math.min(n, 3000); k++) probe.push(lum[pick[(Math.random() * n) | 0]]);
    probe.sort(function (a, b) { return a - b; });
    var expo = Math.min(3, Math.max(0.8, (def.expo || 0.9) / Math.max(probe[(probe.length * 0.9) | 0], 0.05)));
    var gain = (def.gain || 1) * expo, sat = def.sat || 1.3, gm = def.gradeMix == null ? 0.85 : def.gradeMix;

    var fr = frameOf(def);
    var ih = fr.h, iw = fr.h * sw / sh;
    var out = new Float32Array(n * 6);
    for (k = 0; k < n; k++) {
      var p = pick[k], o = k * 6;
      x = p % sw; y = (p / sw) | 0;
      var u = (x + Math.random()) / sw, v = (y + Math.random()) / sh;
      out[o] = fr.cx + (u - 0.5) * iw;
      out[o + 1] = fr.cy - (v - 0.5) * ih;
      out[o + 2] = (0.5 - lum[p]) * 0.55 * (def.relief || 1) + (Math.random() - 0.5) * 0.04;
      var cr = px[p * 4] / 255, cg = px[p * 4 + 1] / 255, cb = px[p * 4 + 2] / 255, gr = 0.3 * cr + 0.59 * cg + 0.11 * cb;
      if (focus && F.tint && focus[p] > 0) {
        var mx = Math.max(cr, cg, cb), s0 = mx > 0 ? (mx - Math.min(cr, cg, cb)) / mx : 0;
        var tw = focus[p] * (1 - Math.min(1, s0 * 1.6)), tl = 0.3 + lum[p] * 1.1;
        cr += (F.tint[0] * tl - cr) * tw; cg += (F.tint[1] * tl - cg) * tw; cb += (F.tint[2] * tl - cb) * tw;
        gr = 0.3 * cr + 0.59 * cg + 0.11 * cb;
      }
      // silver — тёплый металл на референсе (латунь) показываем серебром
      if (def.silver && cr >= cg && cg >= cb && cr - cb > 0.08) { var sv = 0.85; cr += (gr * 1.1 - cr) * sv; cg += (gr * 1.1 - cg) * sv; cb += (gr * 1.15 - cb) * sv; }
      if (def.mono) { cr = cg = cb = gr; }
      if (def.grade) {
        // своя палитра сцены: яркость после экспозиции раскладывается по растяжке
        var rr = ramp(def.grade, Math.min(1, gr * expo));
        cr = cr * expo + (rr[0] - cr * expo) * gm; cg = cg * expo + (rr[1] - cg * expo) * gm; cb = cb * expo + (rr[2] - cb * expo) * gm;
        gr = 0.3 * cr + 0.59 * cg + 0.11 * cb;
        var dg = def.gain || 1;
        out[o + 3] = Math.max(0, gr + (cr - gr) * sat) * dg;
        out[o + 4] = Math.max(0, gr + (cg - gr) * sat) * dg;
        out[o + 5] = Math.max(0, gr + (cb - gr) * sat) * dg;
        continue;
      }
      out[o + 3] = Math.max(0, gr + (cr - gr) * sat) * gain;
      out[o + 4] = Math.max(0, gr + (cg - gr) * sat) * gain;
      out[o + 5] = Math.max(0, gr + (cb - gr) * sat) * gain;
    }
    var anchors = (def.trackers || []).map(function (t) {
      var ax = Math.min(sw - 1, Math.round(t[0] * sw)), ay = Math.min(sh - 1, Math.round(t[1] * sh));
      return { label: t[2] || '', p: [fr.cx + (t[0] - 0.5) * iw, fr.cy - (t[1] - 0.5) * ih, (0.5 - lum[ay * sw + ax]) * 0.55 * (def.relief || 1)] };
    });
    return { points: out, anchors: anchors, frame: fr };
  }

  function sampleText(def, n) {
    var cw = 1400, ch = 520;
    var cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    var g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff';
    g.font = def.font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(def.text, cw / 2, ch / 2 + 20);
    var px = g.getImageData(0, 0, cw, ch).data;
    var on = [];
    for (var i = 0; i < cw * ch; i += 2) if (px[i * 4 + 3] > 120) on.push(i);
    var fr = frameOf(def);
    var ih = fr.h, iw = fr.h * cw / ch;
    var out = new Float32Array(n * 6);
    for (var k = 0; k < n; k++) {
      var idx = on[(Math.random() * on.length) | 0];
      var x = idx % cw, y = (idx / cw) | 0;
      var u = (x + Math.random() * 2) / cw, v = (y + Math.random()) / ch;
      var o = k * 6;
      out[o] = fr.cx + (u - 0.5) * iw;
      out[o + 1] = fr.cy - (v - 0.5) * ih;
      out[o + 2] = (Math.random() - 0.5) * 0.05;   // почти плоско: в перспективе глубина размывает буквы
      var w = u;                      // от мёда к светлому янтарю
      out[o + 3] = 0.95 + 0.05 * w; out[o + 4] = 0.55 + 0.25 * w; out[o + 5] = 0.2 + 0.25 * w;
    }
    return { points: out, anchors: [], frame: fr };
  }

  // Модель: make(n) отдаёт точки в объёме, высота модели = 1, центр в нуле:
  // { pos: [x, y, z]×n, col: [r, g, b]×n, anchors: [[x, y, z, подпись]] }.
  function sampleModel(def, n) {
    var m = def.make(n), fr = frameOf(def), out = new Float32Array(n * 6);
    for (var k = 0; k < n; k++) {
      var o = k * 6, q = k * 3;
      out[o] = fr.cx + m.pos[q] * fr.h;
      out[o + 1] = fr.cy + m.pos[q + 1] * fr.h;
      out[o + 2] = m.pos[q + 2] * fr.h;
      out[o + 3] = m.col[q]; out[o + 4] = m.col[q + 1]; out[o + 5] = m.col[q + 2];
    }
    var anchors = (m.anchors || []).map(function (a) { return { label: a[3], p: [fr.cx + a[0] * fr.h, fr.cy + a[1] * fr.h, a[2] * fr.h] }; });
    return { points: out, anchors: anchors, frame: fr };
  }

  function sampleField(n) {
    var out = new Float32Array(n * 6);
    for (var k = 0; k < n; k++) {
      var o = k * 6, warm = Math.random() < 0.55, a = 0.18 + Math.random() * 0.22;
      out[o] = (Math.random() * 2 - 1) * aspect * 1.15;
      out[o + 1] = (Math.random() * 2 - 1) * 1.15;
      out[o + 2] = (Math.random() - 0.5) * 0.9;
      out[o + 3] = (warm ? 0.92 : 0.72) * a; out[o + 4] = (warm ? 0.6 : 0.75) * a; out[o + 5] = (warm ? 0.3 : 0.82) * a;
    }
    return { points: out, anchors: [] };
  }

  // Часть сцены: снимок, текст, модель или поле. Вращение части — вокруг центра её рамки.
  function sample(def, n) {
    var p;
    if (def.type === 'image') p = loadImage(def.src).then(function (img) { return sampleImage(img, def, n); });
    else if (def.type === 'text') p = (document.fonts && document.fonts.load ? document.fonts.load(def.font) : Promise.resolve()).then(function () { return sampleText(def, n); });
    else if (def.type === 'model') p = Promise.resolve(sampleModel(def, n));
    else p = Promise.resolve(sampleField(n));
    return p.then(function (s) {
      if (def.spin && s.frame) s.spin = { cx: s.frame.cx, cy: s.frame.cy, r: def.spin.r ? def.spin.r * s.frame.h : 1e3, axis: def.spin.axis === 'z' ? 1 : 0, speed: def.spin.speed || 0.3, sway: def.spin.sway || 0 };
      return s;
    });
  }

  function build(name) {
    var def = defs[name];
    if (cache[name]) return Promise.resolve(cache[name]);
    var p;
    if (def.type === 'group') {
      // несколько частей в одной сцене: точки делятся по долям share
      var left = N, counts = def.parts.map(function (part, i) {
        var c = i === def.parts.length - 1 ? left : Math.round(N * part.share);
        left -= c;
        return c;
      });
      p = Promise.all(def.parts.map(function (part, i) { return sample(part, counts[i]); })).then(function (list) {
        var out = new Float32Array(N * 6), at = 0, anchors = [], sp = null;
        list.forEach(function (s, i) {
          out.set(s.points, at * 6);
          at += counts[i];
          anchors = anchors.concat(s.anchors);
          sp = sp || s.spin;
        });
        return { points: out, anchors: anchors, spin: sp };
      });
    } else {
      p = sample(def, N);
    }
    return p.then(function (s) { cache[name] = s; return s; });
  }

  /* ---------- трекеры: точки сцены с координатами, проецируются как сами точки ---------- */

  function anchors(name) {
    var def = defs[name], s = cache[name];
    if (!def || !s || !s.anchors) return [];
    return s.anchors.map(function (a, i) { return { id: i + 1, label: a.label, p: a.p }; });
  }

  function spun(p) {
    var x = p[0], y = p[1], z = p[2];
    var rx = x - spin.cx, ry = y - spin.cy, an = spin.angle * (1 - smooth(spin.r * 0.97, spin.r, Math.hypot(rx, ry)));
    var cs = Math.cos(an), sn = Math.sin(an);
    if (spin.axis < 0.5) return [spin.cx + cs * rx + sn * z, y, -sn * rx + cs * z];
    return [spin.cx + cs * rx - sn * ry, spin.cy + sn * rx + cs * ry, z];
  }

  function project(p0) {
    var p = spun(p0);
    var x = p[0], y = p[1], z = p[2] * opts.depth;
    var cy = Math.cos(rot.x), sy = Math.sin(rot.x), cx = Math.cos(rot.y), sx = Math.sin(rot.y);
    var x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
    var y2 = cx * y - sx * z1, z2 = sx * y + cx * z1;
    var persp = 2.4 / (2.4 + z2);
    var clipX = x1 * persp / aspect, clipY = y2 * persp;
    return { x: (clipX * 0.5 + 0.5) * W, y: (0.5 - clipY * 0.5) * H, z: z2 };
  }

  /* ---------- переходы ---------- */

  function currentPoints() {
    // где точки сейчас (с учётом незавершённого перехода) — новая форма стартует отсюда
    var e = mix < 0.5 ? 4 * mix * mix * mix : 1 - Math.pow(-2 * mix + 2, 3) / 2;
    var out = new Float32Array(N * 6);
    for (var k = 0; k < N; k++) {
      var o = k * STRIDE, q = k * 6;
      for (var j = 0; j < 6; j++) out[q + j] = data[o + j] + (data[o + 6 + j] - data[o + j]) * e;
    }
    return out;
  }

  var asked = 0;
  function show(name, instant) {
    if (!gl || !defs[name]) return Promise.resolve();
    var ask = ++asked;
    return build(name).then(function (s) {
      // снимок прежней сцены мог догрузиться позже: показываем только последнюю запрошенную
      if (ask !== asked) return;
      var from = currentPoints();
      for (var k = 0; k < N; k++) {
        var o = k * STRIDE, q = k * 6;
        for (var j = 0; j < 6; j++) { data[o + j] = from[q + j]; data[o + 6 + j] = s.points[q + j]; }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      current = name;
      var def = defs[name];
      opts.field = def.type === 'field' ? 1 : 0;
      aim.pt = def.pt || 1;
      aim.smoke = reduce ? 0 : def.smoke || 0;
      aim.spin = s.spin && !reduce ? 1 : 0;
      if (s.spin) {
        // новое вращение начинается с нуля; прежнее затухает вокруг своего центра
        spin.cx = s.spin.cx; spin.cy = s.spin.cy; spin.r = s.spin.r; spin.axis = s.spin.axis; spin.speed = s.spin.speed; spin.sway = s.spin.sway;
        spin.start = performance.now();
        look.spin = 0;
      }
      mix = instant || reduce ? 1 : 0;
      mixStart = performance.now();
      if (instant || reduce) { look.pt = aim.pt; look.smoke = aim.smoke; }
      if (reduce) frame(performance.now());
      listeners.forEach(function (cb) { cb(name); });
    });
  }

  /* ---------- кадр ---------- */

  // Размер — по самому холсту: он высотой в «большой» экран (100lvh), поэтому на телефоне
  // появление и скрытие адресной строки при прокрутке не меняет его и не стирает картинку.
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight; aspect = W / H;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function fadeQuad(c) {
    gl.uniform4f(U.c, c[0], c[1], c[2], c[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var trailsWas = false;
  function frame(now) {
    if (!gl || lost) return;
    lastFrame = now;
    var time = (now - t0) / 1000;
    if (mix < 1) mix = Math.min(1, (now - mixStart) / mixDur);
    if (mix < 1) settled = 0; else if (!settled) settled = now;
    var s = reduce ? 1 : 0.08;
    mouse.x += (mouse.tx - mouse.x) * s;
    mouse.y += (mouse.ty - mouse.y) * s;
    mouse.on += (mouse.ton - mouse.on) * (reduce ? 1 : 0.06);
    var idle = reduce ? 0 : Math.sin(time * 0.21) * 0.08;
    var tx = (mouse.on > 0.02 ? mouse.x * 0.32 : idle), ty = (mouse.on > 0.02 ? -mouse.y * 0.18 : Math.cos(time * 0.17) * 0.04);
    rot.x += (tx - rot.x) * 0.05;
    rot.y += (ty - rot.y) * 0.05;
    look.pt += (aim.pt - look.pt) * 0.05;
    look.smoke += (aim.smoke - look.smoke) * 0.03;
    look.spin += (aim.spin - look.spin) * 0.03;
    // sway — покачивание на угол sway вместо полного оборота (плоские вещи не встают ребром);
    // угол оборота держим в пределах полуоборота: уходя со сцены, он раскручивается не больше чем на пол-оборота
    var a = (now - spin.start) / 1000 * spin.speed;
    a = spin.sway ? Math.sin(a) * spin.sway : a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
    spin.angle = a * look.spin;

    var trails = opts.trails && !reduce;
    if (trails) {
      if (!trailsWas) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      // следы: прошлый кадр притемняем и чуть вычитаем, чтобы не оставалось вечных призраков
      gl.useProgram(fadeProg);
      gl.enable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, fadeBuf);
      gl.enableVertexAttribArray(A.fp);
      gl.vertexAttribPointer(A.fp, 2, gl.FLOAT, false, 0, 0);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      fadeQuad([0, 0, 0, TRAIL]);
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
      gl.blendFunc(gl.ONE, gl.ONE);
      fadeQuad([2 / 255, 2 / 255, 2 / 255, 0]);
      gl.blendEquation(gl.FUNC_ADD);
    } else {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    trailsWas = trails;

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    ['pa', 'ca', 'pb', 'cb', 'r'].forEach(function (k) { gl.enableVertexAttribArray(A[k]); });
    var F = 4;
    gl.vertexAttribPointer(A.pa, 3, gl.FLOAT, false, STRIDE * F, 0);
    gl.vertexAttribPointer(A.ca, 3, gl.FLOAT, false, STRIDE * F, 3 * F);
    gl.vertexAttribPointer(A.pb, 3, gl.FLOAT, false, STRIDE * F, 6 * F);
    gl.vertexAttribPointer(A.cb, 3, gl.FLOAT, false, STRIDE * F, 9 * F);
    gl.vertexAttribPointer(A.r, 2, gl.FLOAT, false, STRIDE * F, 12 * F);
    gl.uniform1f(U.mix, mix);
    gl.uniform1f(U.time, reduce ? 4 : time);
    gl.uniform1f(U.aspect, aspect);
    gl.uniform1f(U.depth, opts.depth);
    gl.uniform1f(U.size, opts.dense ? 2.2 : 1.55);
    gl.uniform1f(U.pt, look.pt);
    gl.uniform1f(U.dpr, dpr);
    gl.uniform1f(U.field, opts.field);
    gl.uniform1f(U.scanY, 1.1 - ((time * 0.11) % 1) * 2.2);
    gl.uniform1f(U.scanOn, opts.scan && !reduce && !opts.field ? 1 : 0);
    gl.uniform1f(U.mouseOn, mouse.on);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform2f(U.rot, rot.x, rot.y);
    gl.uniform1f(U.smoke, look.smoke);
    gl.uniform1f(U.spin, spin.angle);
    gl.uniform1f(U.spinR, spin.r);
    gl.uniform1f(U.spinAxis, spin.axis);
    gl.uniform2f(U.spinC, spin.cx, spin.cy);
    // крупные точки светятся слабее, чтобы сцена не выгорала; со следами яркость копится кадр за кадром,
    // поэтому каждый кадр тусклее (точки слегка дрожат и копятся не в одном пикселе — делим не на всю долю гашения)
    var gain = (opts.dense ? 0.42 : 0.62) * (N > 40000 ? 1 : 1.25) / Math.max(1, look.pt * look.pt * 0.8);
    gl.uniform1f(U.gain, trails ? gain * 0.45 : gain);
    gl.drawArrays(gl.POINTS, 0, N);

    // трекеры — когда точки уже собрались и постояли пару кадров: подписи не опережают картинку
    if (mix >= 1 && now - settled > 160 && opts.trackers && !opts.field) drawTrackers();
    else hideTrackers();
  }

  /* ---------- слой трекеров (SVG + подписи) ---------- */

  var svg, labels = [];
  function fmt(n) { return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2); }
  function drawTrackers() {
    var list = anchors(current);
    if (!list.length) return hideTrackers();
    var pts = list.map(function (a) { return { a: a, s: project(a.p) }; });
    var path = '';
    pts.forEach(function (q, i) { path += (i ? ' L' : 'M') + q.s.x.toFixed(1) + ' ' + q.s.y.toFixed(1); });
    var marks = pts.map(function (q) {
      var x = q.s.x, y = q.s.y, r = 9, k = 5;
      return 'M' + (x - r) + ' ' + (y - r + k) + ' V' + (y - r) + ' H' + (x - r + k) +
        ' M' + (x + r - k) + ' ' + (y - r) + ' H' + (x + r) + ' V' + (y - r + k) +
        ' M' + (x + r) + ' ' + (y + r - k) + ' V' + (y + r) + ' H' + (x + r - k) +
        ' M' + (x - r + k) + ' ' + (y + r) + ' H' + (x - r) + ' V' + (y + r - k);
    }).join(' ');
    svg.querySelector('.trk__link').setAttribute('d', path);
    svg.querySelector('.trk__mark').setAttribute('d', marks);
    svg.style.opacity = 1;
    pts.forEach(function (q, i) {
      var el = labels[i];
      if (!el) { el = document.createElement('span'); el.className = 'trk__l'; svg.parentNode.appendChild(el); labels[i] = el; }
      // на телефоне — только номер и подпись, координаты не помещаются
      var id = (q.a.id < 10 ? '0' : '') + q.a.id, p = spun(q.a.p);
      var txt = W < 600 ? id + ' ' + q.a.label : id + ' ' + fmt(p[0] / aspect) + ' ' + fmt(p[1]) + ' ' + fmt(p[2] * opts.depth) + (q.a.label ? '  ' + q.a.label : '');
      if (el.textContent !== txt) el.textContent = txt;
      // подпись справа от метки; если не помещается до рисок у края — слева
      var lw = txt.length * 6.7 + 12, x = q.s.x + 14;
      if (x + lw > W - 56) x = q.s.x - 14 - lw >= 8 ? q.s.x - 14 - lw : Math.max(8, W - 8 - lw);
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (q.s.y - 22).toFixed(1) + 'px)';
      el.style.opacity = 1;
    });
    for (var j = pts.length; j < labels.length; j++) labels[j].style.opacity = 0;
  }
  function hideTrackers() {
    if (!svg) return;
    svg.style.opacity = 0;
    labels.forEach(function (l) { l.style.opacity = 0; });
  }

  function loop() {
    if (!gl) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function tick(now) {
      if (lost || !visible || document.hidden || (reduce && mix >= 1)) { raf = 0; return; }
      frame(now);
      raf = requestAnimationFrame(tick);
    });
  }

  // Программы, буферы и атрибуты; заново — после потери контекста (телефон под нагрузкой,
  // возврат на страницу из кэша браузера).
  function setupGL() {
    prog = program(VERT, FRAG);
    fadeProg = program(FADE_V, FADE_F);
    if (!prog || !fadeProg) return false;
    ['aPA', 'aCA', 'aPB', 'aCB', 'aR'].forEach(function (n, i) { A[['pa', 'ca', 'pb', 'cb', 'r'][i]] = gl.getAttribLocation(prog, n); });
    A.fp = gl.getAttribLocation(fadeProg, 'p');
    ['uMix', 'uTime', 'uAspect', 'uDepth', 'uSize', 'uPt', 'uDpr', 'uField', 'uScanY', 'uScanOn', 'uMouseOn', 'uGain', 'uMouse', 'uRot',
      'uSmoke', 'uSpin', 'uSpinR', 'uSpinAxis', 'uSpinC'].forEach(function (n) {
      U[n.slice(1).charAt(0).toLowerCase() + n.slice(2)] = gl.getUniformLocation(prog, n);
    });
    U.c = gl.getUniformLocation(fadeProg, 'uC');
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.useProgram(prog);
    ['pa', 'ca', 'pb', 'cb', 'r'].forEach(function (k) { gl.enableVertexAttribArray(A[k]); });
    fadeBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fadeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    trailsWas = false;
    return true;
  }

  /* ---------- API ---------- */

  Cloud.init = function (el, overlay) {
    canvas = el;
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) return false;
    resize();
    var area = W * H;
    N = W < 700 ? 26000 : area > 1600000 ? 80000 : 60000;
    data = new Float32Array(N * STRIDE);
    // с первого кадра на экране тусклая россыпь, пока грузится снимок первой сцены, — не пустота
    for (var k = 0; k < N; k++) {
      var o = k * STRIDE, warm = Math.random() < 0.55, a = 0.1 + Math.random() * 0.14;
      data[o] = data[o + 6] = (Math.random() * 2 - 1) * aspect * 1.2;
      data[o + 1] = data[o + 7] = (Math.random() * 2 - 1) * 1.2;
      data[o + 2] = data[o + 8] = (Math.random() - 0.5) * 1.4;
      data[o + 3] = data[o + 9] = (warm ? 0.92 : 0.72) * a;
      data[o + 4] = data[o + 10] = (warm ? 0.6 : 0.75) * a;
      data[o + 5] = data[o + 11] = (warm ? 0.3 : 0.82) * a;
      data[o + 12] = Math.random();
      data[o + 13] = Math.random();
    }
    if (!setupGL()) { gl = null; return false; }
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; hideTrackers(); }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      lost = false;
      if (setupGL()) { frame(performance.now()); loop(); }
    }, false);

    svg = overlay.querySelector('svg');

    window.addEventListener('pointermove', function (e) {
      mouse.tx = e.clientX / W * 2 - 1;
      mouse.ty = 1 - e.clientY / H * 2;
      mouse.ton = e.pointerType === 'mouse' || e.buttons ? 1 : 0;
      if (reduce) frame(performance.now());
    }, { passive: true });
    document.addEventListener('pointerleave', function () { mouse.ton = 0; });
    window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') mouse.ton = 0; });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (canvas.clientWidth === W && canvas.clientHeight === H) return;
        resize();
        cache = {};                     // рамки сцен зависят от пропорций экрана
        if (current) show(current, true);
        loop();
      }, 180);
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) loop(); });
    // возврат на страницу из кэша браузера: контекст мог потеряться, цикл — встать
    window.addEventListener('pageshow', function () { if (gl && gl.isContextLost && !gl.isContextLost()) { frame(performance.now()); loop(); } });
    // сторож: если кадры перестали идти, хотя страница на виду, — запускаем цикл заново
    setInterval(function () {
      if (gl && !lost && visible && !document.hidden && !(reduce && mix >= 1) && performance.now() - lastFrame > 1500) loop();
    }, 1000);
    frame(performance.now());
    loop();
    return true;
  };

  Cloud.define = function (name, def) { defs[name] = def; };
  Cloud.show = function (name, instant) { var p = show(name, instant); loop(); return p; };
  // Остальные сцены разбираем на точки по одной, когда браузер свободен, — без длинных подвисаний.
  var queued = 0;
  Cloud.preload = function (names) {
    var queue = names.filter(function (n) { return defs[n] && !cache[n]; });
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 80); };
    queued += queue.length;
    (function next() {
      var n = queue.shift();
      if (!n) return;
      idle(function () { build(n).then(done, done); }, { timeout: 2000 });
      function done() { queued--; next(); }
    })();
  };
  Cloud.busy = function () { return queued > 0; };
  Cloud.set = function (k, v) { opts[k] = v; if (reduce && gl) frame(performance.now()); };
  Cloud.get = function (k) { return opts[k]; };
  Cloud.pause = function (p) { visible = !p; if (!p) loop(); };
  Cloud.onScene = function (cb) { listeners.push(cb); };
  Cloud.ok = function () { return !!gl; };

  window.Cloud = Cloud;
})();
