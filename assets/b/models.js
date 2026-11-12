/*
  3D-изделия варианта B в стиле облака: модель собрана из простых тел в миллиметрах (трубки,
  тела вращения, выдавленные контуры), а на экран выводится не поверхность, а светящиеся
  точки на ней — как палочка в сцене линеек. Модель перестраивается под выбор покупателя:
  грейд задаёт металл, элемент — верх, комплект — запасные рядом, камень — цвет и рисунок,
  размер — диаметр кольца. Изделие собирается из разлетевшихся точек, медленно вращается
  и поворачивается мышью или пальцем.
*/
import * as THREE from 'three';

const AA = window.AA;
const TAU = Math.PI * 2;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z || 0);

/* ---------- материалы-метки: по ним точки получают цвет ---------- */

function tag(kind, stone) {
  const m = new THREE.MeshBasicMaterial();
  m.userData = { kind, stone };
  return m;
}
const M = { bronze: tag('bronze'), whiteBronze: tag('whiteBronze'), silver: tag('silver'), wood: tag('wood'), woodPlain: tag('wood') };
const gems = {};
const gemMaterial = (id) => gems[id] || (gems[id] = tag('gem', id));
const faceted = (id) => ((AA.stones[id] || {}).kind || 'facet') === 'facet';

/* ---------- геометрия ---------- */

function mesh(geom, mat, x, y, z) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}

function tube(points, radius, mat, seg) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V3(p[0], p[1], p[2]))), false, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, seg || Math.max(24, points.length * 6), radius, 10, false), mat);
}

function torus(r, t, mat, x, y, z) {
  return mesh(new THREE.TorusGeometry(r, t, 10, 36), mat, x, y, z);
}

function lathe(profile, seg) {
  return new THREE.LatheGeometry(profile.map((p) => V2(p[0], p[1])), seg || 32);
}

function extrude(shape, depth, bevel, smooth, curve) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9,
    bevelSegments: smooth ? 6 : 2, curveSegments: curve || (smooth ? 32 : 40)
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Огранка: корона и павильон телом вращения (ось Y, площадка вверх).
function brilliant(r) {
  return lathe([[0.001, -0.62 * r], [r, -0.04 * r], [r, 0.04 * r], [0.6 * r, 0.36 * r], [0.001, 0.36 * r]], r > 3.5 ? 12 : 8);
}

// Кабошон: купол над плоскостью XY (лицом к +Z).
function dome(r, h) {
  const g = new THREE.RingGeometry(0.0001, r, 48, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const d = Math.min(1, Math.hypot(p.getX(i), p.getY(i)) / r);
    p.setZ(i, h * Math.sqrt(1 - d * d));
  }
  return g;
}

// Стакан оправы (ось Y, открыт вверх): дно, стенка, завальцованный край.
function cup(r) {
  return lathe([[0.001, -0.7 * r], [0.55 * r, -0.7 * r], [r + 0.45, -0.25 * r], [r + 0.55, 0.35], [r + 0.15, 0.75], [r - 0.12, 0.5]], 40);
}

// Камень в оправе. По умолчанию смотрит на зрителя (+Z), up — вверх (кольцо).
function setting(r, sel, metal, up) {
  const g = new THREE.Group();
  g.add(mesh(cup(r), metal));
  if (faceted(sel.stone)) {
    g.add(mesh(brilliant(r * 0.94), gemMaterial(sel.stone), 0, 0.35, 0));
  } else {
    const d = mesh(dome(r * 0.96, r * 0.42), gemMaterial(sel.stone), 0, 0.45, 0);
    d.rotation.x = -Math.PI / 2;
    g.add(d);
  }
  if (!up) g.rotation.x = Math.PI / 2;
  return g;
}

// Шинка кольца (ось пальца — Z): сечение — скруглённый прямоугольник, к верху шинка плавно
// шире и толще. Наверху — сквозное отверстие под камень: оно сужается к пальцу, стенка — конус.
function ringBand(rin, rs, metal, hole) {
  const A = 180, S = 32;
  const k = (a) => Math.pow((1 + Math.sin(a)) / 2, 3);           // 1 наверху, 0 внизу
  // под гнездо шинка заметно шире и толще; под оправу — чуть-чуть
  const width = (a) => 2.4 + (hole ? 2.8 : 0.9) * k(a), thick = (a) => 1.4 + (hole ? 1.0 : 0.45) * k(a);
  const pos = [], index = [];
  for (let i = 0; i <= A; i++) {
    const a = i / A * TAU, w = width(a), t = thick(a), ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < S; j++) {
      const ph = j / S * TAU, c = Math.cos(ph), s = Math.sin(ph);
      const u = Math.sign(c) * Math.pow(Math.abs(c), 0.45) * w / 2;   // вдоль пальца
      const v = Math.sign(s) * Math.pow(Math.abs(s), 0.45) * t / 2;   // по радиусу
      const R = rin + t / 2 + v;
      pos.push(ca * R, sa * R, u);
    }
  }
  for (let i = 0; i < A; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j, b = (i + 1) * S + j, c = (i + 1) * S + (j + 1) % S, d = i * S + (j + 1) % S;
      index.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  const top = rin + thick(Math.PI / 2), r = (y) => rs + 0.08 - (top - y) / (top - rin) * rs * 0.5;
  const band = mesh(geo, metal), g = new THREE.Group();
  g.add(band);
  if (hole) {
    // точки не ложатся туда, где в шинке отверстие; стенка отверстия — конус к пальцу
    band.userData.keep = (p) => p.y < rin * 0.5 || Math.hypot(p.x, p.z) > r(Math.min(top, Math.hypot(p.x, p.y)));
    g.add(mesh(lathe([[rs * 0.5, rin + 0.02], [rs + 0.08, top - 0.35], [rs + 0.08, top]], 40), metal));
  }
  return { group: g, top };
}

function arcTo(shape, cx, cy, r, from, to, via) {
  const norm = (a) => ((a % TAU) + TAU) % TAU;
  const ccw = norm(via - from) < norm(to - from);
  shape.absarc(cx, cy, r, from, to, !ccw);
}

// Полумесяц: круг R минус круг r со сдвигом (dx, dy) — как на чертеже, ось Y вверх.
function crescent(R, dx, dy, r) {
  const d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  const a = (R * R - r * r + d * d) / (2 * d), al = Math.acos(Math.min(1, a / R)), tu = Math.atan2(uy, ux);
  const p1 = [Math.cos(tu + al) * R, Math.sin(tu + al) * R], p2 = [Math.cos(tu - al) * R, Math.sin(tu - al) * R];
  const s = new THREE.Shape();
  s.moveTo(p1[0], p1[1]);
  arcTo(s, 0, 0, R, tu + al, tu - al, tu + Math.PI);
  arcTo(s, dx, dy, r, Math.atan2(p2[1] - dy, p2[0] - dx), Math.atan2(p1[1] - dy, p1[0] - dx), tu + Math.PI);
  const k = (R + r - d) / 2;
  return { shape: s, seat: [-ux * k, -uy * k], seatR: Math.max(1.6, (R - (r - d)) / 2 * 0.62) };
}

function pearShape(len, w) {
  const s = new THREE.Shape(), top = len / 2, bot = -len / 2;
  s.moveTo(0, top);
  s.bezierCurveTo(w, top - len * 0.4, w, bot + len * 0.06, 0, bot);
  s.bezierCurveTo(-w, bot + len * 0.06, -w, top - len * 0.4, 0, top);
  return s;
}

/* ---------- элементы (лицом к зрителю, центр в 0,0) ---------- */

const PARTS = {
  moon(R, sel, metal) {
    const g = new THREE.Group(), c = crescent(R, R * 0.4, R * 0.18, R * 0.84);
    g.add(mesh(extrude(c.shape, 1.6, 0.5), metal));
    const s = setting(c.seatR, sel, metal);
    s.position.set(c.seat[0], c.seat[1], 1.0 + c.seatR * 0.55);
    g.add(s);
    return g;
  },
  spiral(R, sel, metal) {
    const g = new THREE.Group(), pts = [];
    for (let i = 0; i <= 90; i++) {
      const t = i / 90, a = -Math.PI / 2 + t * 2.5 * TAU, r = R * (0.2 + 0.8 * t);
      pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
    }
    g.add(tube(pts, Math.max(0.5, R * 0.07), metal, 180));
    const s = setting(R * 0.22, sel, metal);
    s.position.z = 0.6;
    g.add(s);
    return g;
  },
  stone(R, sel, metal) {
    const g = new THREE.Group();
    const disc = mesh(new THREE.CylinderGeometry(R, R, 1.4, 48), metal);
    disc.rotation.x = Math.PI / 2;
    g.add(disc, torus(R * 0.86, 0.32, metal, 0, 0, 0.75));
    const s = setting(R * 0.66, sel, metal);
    s.position.z = 0.7 + R * 0.4;
    g.add(s);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + Math.PI / 4;
      g.add(mesh(new THREE.SphereGeometry(0.55, 12, 8), metal, Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7, 0.9 + R * 0.4));
    }
    return g;
  },
  cast(R, sel, metal) {
    const g = new THREE.Group();
    g.add(torus(R * 0.95, Math.max(0.45, R * 0.06), metal));
    const s = setting(R * 0.74, sel, metal);
    s.position.z = R * 0.2;
    g.add(s);
    return g;
  },
  sprout(R, sel, metal) {
    const g = new THREE.Group(), cx = R * 0.15, cy = R * 0.3, r1 = R * 0.62, turns = 1.05;
    const at = (t) => { const a = Math.PI - t * turns * TAU, r = r1 * (1 - t * 0.82); return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a }; };
    const curl = [];
    for (let i = 0; i <= 60; i++) { const q = at(i / 60); curl.push([q.x, q.y, 0]); }
    const w = Math.max(0.55, R * 0.06);
    g.add(tube([[0, -R * 1.05], [R * 0.06, -R * 0.55], [-R * 0.42, -R * 0.2], [-R * 0.47, cy]], w, metal));
    g.add(tube(curl, w, metal, 120));
    [0.06, 0.17, 0.28, 0.39, 0.5, 0.6, 0.69].forEach((t, k) => {
      const q = at(t), s = R * (0.2 - k * 0.022);
      const bud = mesh(new THREE.SphereGeometry(1, 14, 10), metal, q.x + Math.cos(q.a) * s * 0.85, q.y + Math.sin(q.a) * s * 0.85, 0);
      bud.scale.set(s * 0.5, s, s * 0.45);
      bud.rotation.z = q.a - Math.PI / 2;
      g.add(bud);
    });
    const s = setting(R * 0.13, sel, metal);
    s.position.set(cx, cy, 0.4);
    g.add(s);
    return g;
  },
  sun(R, sel, metal) {
    const g = new THREE.Group();
    const disc = mesh(new THREE.CylinderGeometry(R, R, 1.8, 48), metal);
    disc.rotation.x = Math.PI / 2;
    g.add(disc, torus(R * 0.86, 0.3, metal, 0, 0, 0.95));
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU + Math.PI / 2, len = k % 2 ? R * 0.34 : R * 0.6;
      const ray = mesh(new THREE.ConeGeometry(R * 0.11, len, 6), metal, Math.cos(a) * (R * 1.12 + len / 2), Math.sin(a) * (R * 1.12 + len / 2), 0);
      ray.rotation.z = a - Math.PI / 2;
      ray.scale.z = 0.45;
      g.add(ray);
    }
    const s = setting(R * 0.62, sel, metal);
    s.position.z = 0.9 + R * 0.35;
    g.add(s);
    return g;
  }
};

// Элемент на штоке с резьбой: точка крепления в 0,0, элемент над ней.
function mounted(kind, R, sel, metal) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.25, 1.25, 5.5, 20), metal, 0, 2.75, 0));
  [1.2, 2.6, 4].forEach((y) => { const t = torus(1.32, 0.22, metal, 0, y, 0); t.rotation.x = Math.PI / 2; g.add(t); });
  const lift = kind === 'sun' ? R * 1.2 : kind === 'sprout' ? R * 1.05 : R;
  const p = PARTS[kind](R, gemSel(sel, kind), metal);
  p.position.y = 5.5 + lift;
  g.add(p);
  return g;
}

// Втулка с резьбой на основе.
function collar(y, r, h, metal) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, h, 32), metal, 0, y + h / 2, 0));
  [0.3, 0.55, 0.8].forEach((k) => { const t = torus(r + 0.05, 0.22, metal, 0, y + h * k, 0); t.rotation.x = Math.PI / 2; g.add(t); });
  return g;
}

// Металл по грейду: в редком всё серебро (у палочки и заколки и основа), в классическом —
// бронза, а серьга и кольцо — белая бронза; основа палочки и заколки в классическом — дерево.
const metalOf = (item, sel) => (sel.line === 'rare' ? M.silver : item.skin ? M.whiteBronze : M.bronze);
const baseOf = (sel, plain) => (sel.line === 'rare' ? M.silver : plain ? M.woodPlain : M.wood);
const partsOf = (sel) => (sel.main ? [sel.main].concat(sel.extras || []) : []);
// у каждого элемента свой камень (sel.gems), без него — общий
const gemSel = (sel, kind) => (sel.gems && sel.gems[kind] ? Object.assign({}, sel, { stone: sel.gems[kind] }) : sel);
const SIZE = { moon: 14, cast: 9, sprout: 13, sun: 9.5, spiral: 5.6, stone: 4.6 };

function spares(list, x, y0, step, sel, metal, R) {
  return list.map((kind, i) => {
    const s = mounted(kind, R ? R(kind) : SIZE[kind], sel, metal);
    s.scale.setScalar(0.75);
    s.position.set(x, y0 - i * step, 0);
    return s;
  });
}

/* ---------- изделия ---------- */

const BUILD = {
  pin(item, sel) {
    const g = new THREE.Group(), metal = metalOf(item, sel), w = 0.75;
    g.add(tube([[-30, 7.5], [33, 7.5]], w, metal));
    g.add(tube([[-29, 0], [33, 0]], w, metal));
    const coil = [];
    for (let i = 0; i <= 48; i++) { const a = -Math.PI / 2 + i / 48 * TAU * 1.5; coil.push([33 + Math.cos(a) * 3.75, 3.75 + Math.sin(a) * 3.75, -0.9 + i / 48 * 1.8]); }
    g.add(tube(coil, w, metal, 120));
    const head = new THREE.Shape();
    head.moveTo(-29, -2.6);
    head.lineTo(-29, 10.1);
    head.lineTo(-35, 10.1);
    head.absarc(-35, 3.75, 6.35, Math.PI / 2, Math.PI * 1.5, false);
    head.lineTo(-29, -2.6);
    g.add(mesh(extrude(head, 3.2, 0.6, true), metal));
    const loops = [-12.4, 3.2, 18.9], kinds = partsOf(sel);
    loops.forEach((x, i) => {
      g.add(torus(1.5, 0.42, metal, x, -1.9, 0));
      const kind = kinds[i];
      if (!kind) return;
      const charm = new THREE.Group();
      const link = torus(1.15, 0.34, metal, 0, -4.6, 0);
      link.rotation.y = Math.PI / 2;
      charm.add(link, torus(1, 0.32, metal, 0, -7, 0));
      const R = SIZE[kind];
      const p = PARTS[kind](R, gemSel(sel, kind), metal);
      p.position.y = -8.4 - R;
      charm.add(p);
      charm.position.x = x;
      g.add(charm);
    });
    return { group: g, pose: [0.12, -0.32] };
  },

  stick(item, sel) {
    const g = new THREE.Group(), metal = metalOf(item, sel), list = partsOf(sel);
    g.add(mesh(lathe([[0.001, -92], [0.45, -90.5], [1.2, -82], [2.4, -45], [3.2, 0], [3.6, 40], [3.7, 64], [3.7, 66], [0.001, 66]], 32), baseOf(sel)));
    g.add(collar(66, 4.3, 8, metal));
    const el = mounted(list[0] || 'moon', SIZE[list[0] || 'moon'], sel, metal);
    el.position.y = 74;
    g.add(el);
    spares(list.slice(1), 28, 52, 44, sel, metal).forEach((s) => g.add(s));
    return { group: g, pose: [0.06, 0.5] };
  },

  clip(item, sel) {
    const g = new THREE.Group(), metal = metalOf(item, sel), list = partsOf(sel);
    const prong = lathe([[0.001, -80], [0.5, -78.5], [1.6, -66], [3.2, -10], [3.6, 30], [3.6, 40], [0.001, 40]], 28);
    g.add(mesh(prong, baseOf(sel), -9, 0, 0), mesh(prong, baseOf(sel), 9, 0, 0));
    const arc = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI - i / 16 * Math.PI; arc.push([Math.cos(a) * 9, 40 + Math.sin(a) * 9, 0]); }
    g.add(tube(arc, 3.6, baseOf(sel, true), 64));
    g.add(collar(51.5, 3.9, 7, metal));
    const kind = list[0] || 'sun', R = kind === 'sun' ? 9.5 : 14;
    const el = mounted(kind, R, sel, metal);
    el.position.y = 58.5;
    g.add(el);
    spares(list.slice(1), 36, 30, 44, sel, metal, (k) => (k === 'sun' ? 9.5 : 14)).forEach((s) => g.add(s));
    return { group: g, pose: [0.06, 0.45] };
  },

  earring(item, sel) {
    const g = new THREE.Group(), metal = metalOf(item, sel);
    // швенза: плотная дуга и короткий задний конец, проволока 0,9 мм
    const b = V3(-0.55, 0, -0.84).normalize(), pts = [];
    for (let i = 0; i <= 6; i++) pts.push(V3(0, i / 6 * 15, 0));
    const C = V3(0, 15, 0).addScaledVector(b, 4.2);
    for (let i = 1; i <= 16; i++) { const ph = i / 16 * Math.PI; pts.push(C.clone().addScaledVector(b, -4.2 * Math.cos(ph)).add(V3(0, 4.2 * Math.sin(ph), 0))); }
    const back = C.clone().addScaledVector(b, 4.2);
    for (let i = 1; i <= 6; i++) pts.push(back.clone().add(V3(0, -i / 6 * 9.5, 0)).addScaledVector(b, i / 6 * 0.6));
    pts.push(back.clone().add(V3(0, -11.2, 0)).addScaledVector(b, 1.7));
    g.add(tube(pts, 0.48, metal, 160));
    const r1 = torus(1.2, 0.36, metal, 0, -1.6, 0);
    r1.rotation.y = Math.PI / 2;
    g.add(r1, torus(1.1, 0.34, metal, 0, -3.9, 0));
    // оправа-капля: заметная рамка вокруг камня, в неё камень и вставляют; дно оправы — пластина
    const drop = new THREE.Group(), len = 19, wd = 8, outL = len + 3.6, outW = wd + 2.6;
    const rim = pearShape(outL, outW);
    rim.holes.push(pearShape(len - 0.2, wd - 0.1));
    drop.add(mesh(extrude(rim, 2.6, 0.45, true), metal));
    drop.add(mesh(extrude(pearShape(outL - 1.2, outW - 0.9), 0.6, 0.2, true), metal, 0, 0, -1.2));
    const fac = faceted(sel.stone);
    drop.add(mesh(extrude(pearShape(len * 0.9, wd * 0.88), 0.5, fac ? 1.5 : 1.2, !fac, fac ? 5 : 32), gemMaterial(sel.stone), 0, 0, 0.5));
    drop.position.y = -5 - outL / 2;
    g.add(drop);
    return { group: g, pose: [0.05, 0.55] };
  },

  // Кольцо. Классический грейд: без оправы, камень лежит прямо в отверстии шинки, площадкой
  // вровень с металлом. Редкий: небольшая оправа стоит прямо на шинке, без подиума.
  ring(item, sel) {
    const rin = parseFloat(sel.size || '17') / 2, metal = metalOf(item, sel), flush = sel.line !== 'rare';
    const rs = flush ? 1.8 : 2.1, band = ringBand(rin, rs, metal, flush), g = band.group;
    if (!flush) {
      const s = setting(rs, sel, metal, true);
      s.position.y = band.top + 0.9;          // дно оправы уходит в шинку
      g.add(s);
    } else if (faceted(sel.stone)) {
      g.add(mesh(brilliant(rs), gemMaterial(sel.stone), 0, band.top + 0.12 - 0.36 * rs, 0));
    } else {
      const d = mesh(dome(rs * 0.98, rs * 0.5), gemMaterial(sel.stone), 0, band.top - 0.15, 0);
      d.rotation.x = -Math.PI / 2;
      g.add(d);
    }
    return { group: g, pose: [0.62, 0.5] };
  }
};

/* ---------- модель → точки ---------- */

const hex = (c) => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };

// Цвет точки по материалу; lp — точка в координатах самого тела (для волокон дерева).
function paint(info, lp) {
  const j = 0.85 + Math.random() * 0.3;
  if (info.kind === 'wood') {
    const s = 0.7 + 0.3 * Math.sin(Math.atan2(lp.z, lp.x) * 7 + lp.y * 0.3 + Math.sin(lp.y * 0.05) * 2);
    return [0.72 * s, 0.45 * s, 0.24 * s];
  }
  if (info.kind === 'bronze') return [0.95 * j, 0.58 * j, 0.28 * j];
  if (info.kind === 'silver') return [0.8 * j, 0.84 * j, 0.92 * j];
  if (info.kind === 'whiteBronze') return [0.86 * j, 0.8 * j, 0.66 * j];
  const st = AA.stones[info.stone] || AA.stones.corundum_honey;
  if (st.kind === 'flash') {      // лабрадорит: тёмный тон своего цвета и светлые отблески
    const c = hex(st.color);
    return Math.random() < 0.34 ? [c[0] * 0.8 + 0.25, c[1] * 0.8 + 0.3, Math.min(1.2, c[2] * 1.05 + 0.2)] : [c[0] * 0.62, c[1] * 0.62, c[2] * 0.62];
  }
  if (st.kind === 'shell') {
    const tint = [[1, 0.86, 0.9], [0.84, 0.97, 0.94], [0.9, 0.88, 1], [1, 0.96, 0.86]][(Math.random() * 4) | 0];
    return [tint[0] * 0.95 * j, tint[1] * 0.95 * j, tint[2] * 0.95 * j];
  }
  const c = hex(st.color);
  if (Math.random() < 0.05) return [1.2, 1.2, 1.2];       // искра на грани
  return [c[0] * 1.25, c[1] * 1.25, c[2] * 1.25];
}

const WEIGHT = { wood: 0.7, bronze: 1.6, whiteBronze: 1.6, silver: 1.6, gem: 6 };

// Точки по поверхности: треугольники выбираются пропорционально площади и весу материала.
function toPoints(group, total) {
  group.updateMatrixWorld(true);
  const bodies = [];
  const a = V3(), b = V3(), c = V3(), ab = V3(), ac = V3(), n = V3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, p = g.attributes.position, idx = g.index, tri = idx ? idx.count / 3 : p.count / 3;
    const world = new Float32Array(tri * 9), local = new Float32Array(tri * 9), cdf = new Float32Array(tri);
    let acc = 0;
    for (let t = 0; t < tri; t++) {
      for (let k = 0; k < 3; k++) {
        const v = idx ? idx.getX(t * 3 + k) : t * 3 + k;
        a.fromBufferAttribute(p, v);
        local.set([a.x, a.y, a.z], t * 9 + k * 3);
        a.applyMatrix4(o.matrixWorld);
        world.set([a.x, a.y, a.z], t * 9 + k * 3);
      }
      a.fromArray(world, t * 9); b.fromArray(world, t * 9 + 3); c.fromArray(world, t * 9 + 6);
      acc += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
      cdf[t] = acc;
    }
    if (acc > 0) bodies.push({ world, local, cdf, area: acc, info: o.material.userData, keep: o.userData.keep });
    g.dispose();
  });
  const weight = bodies.reduce((s, q) => s + q.area * (WEIGHT[q.info.kind] || 1), 0);
  const counts = bodies.map((q) => Math.max(40, Math.round(total * q.area * (WEIGHT[q.info.kind] || 1) / weight)));
  const N = counts.reduce((s, x) => s + x, 0);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), nor = new Float32Array(N * 3), rnd = new Float32Array(N);
  const lp = V3();
  let i = 0;
  bodies.forEach((q, bi) => {
    for (let k = 0; k < counts[bi]; k++, i++) {
      let o, u, v, w;
      for (let tries = 0; tries < 16; tries++) {      // keep — тело просит не ставить точки в отверстие
        const s = Math.random() * q.area;
        let lo = 0, hi = q.cdf.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (q.cdf[mid] < s) lo = mid + 1; else hi = mid; }
        const r1 = Math.sqrt(Math.random()), r2 = Math.random();
        u = 1 - r1; v = r1 * (1 - r2); w = r1 * r2; o = lo * 9;
        a.fromArray(q.world, o); b.fromArray(q.world, o + 3); c.fromArray(q.world, o + 6);
        lp.set(a.x * u + b.x * v + c.x * w, a.y * u + b.y * v + c.y * w, a.z * u + b.z * v + c.z * w);
        if (!q.keep || q.keep(lp)) break;
      }
      pos[i * 3] = lp.x;
      pos[i * 3 + 1] = lp.y;
      pos[i * 3 + 2] = lp.z;
      n.subVectors(b, a).cross(ac.subVectors(c, a)).normalize();
      nor.set([n.x, n.y, n.z], i * 3);
      lp.set(q.local[o] * u + q.local[o + 3] * v + q.local[o + 6] * w, q.local[o + 1] * u + q.local[o + 4] * v + q.local[o + 7] * w, q.local[o + 2] * u + q.local[o + 5] * v + q.local[o + 8] * w);
      col.set(paint(q.info, lp), i * 3);
      rnd[i] = Math.random();
    }
  });
  return { pos, col, nor, rnd, count: N };
}

const VERT = `
attribute vec3 aStart;
attribute vec3 aColor;
attribute vec3 aNormal;
attribute float aRand;
uniform float uT, uTime, uSize, uDpr, uGain;
varying vec3 vCol;
varying float vA;
void main() {
  float k = clamp(uT * 1.3 - aRand * 0.3, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 3.0);
  vec3 p = mix(aStart, position, e);
  p += vec3(sin(uTime * 1.3 + aRand * 50.0), cos(uTime * 1.1 + aRand * 40.0), sin(uTime * 0.9 + aRand * 30.0)) * 0.05;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * aNormal);
  float lit = 0.5 + 0.5 * abs(n.z) + 0.35 * pow(1.0 - abs(n.z), 3.0);   // к зрителю ярче, по краю — светлый ободок
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uDpr * (0.6 + aRand * 0.8);
  vCol = aColor * lit * uGain;
  vA = mix(0.3, 1.0, e);
}`;

const FRAG = `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = dot(c, c);
  if (r > 0.25) discard;
  gl_FragColor = vec4(vCol * smoothstep(0.25, 0.0, r) * vA, 1.0);
}`;

/* ---------- просмотрщик ---------- */

export function create(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 4000);
  const pivot = new THREE.Group();
  scene.add(pivot);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uT: { value: 1 }, uTime: { value: 0 }, uSize: { value: 1.6 }, uDpr: { value: dpr }, uGain: { value: 0.42 } }
  });

  const wrap = document.createElement('div');
  wrap.className = 'v3d';
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  wrap.appendChild(canvas);
  const hint = document.createElement('p');
  hint.className = 'v3d__hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = window.matchMedia('(hover: hover)').matches ? 'Потяните, чтобы повернуть' : 'Проведите, чтобы повернуть';
  wrap.appendChild(hint);

  // точек столько, чтобы форма читалась, но металл не выгорал в белое там, где точки перекрываются
  const budget = window.innerWidth < 700 ? 12000 : 22000;
  let points = null, current = null, fitBox = null, t0 = 0, dur = 950;
  let active = false, visible = true, raf = 0, idleAt = 0;
  const rot = { x: 0, y: 0, vx: 0, vy: 0 };
  let drag = null;

  function fit() {
    if (!fitBox) return;
    const size = fitBox.getSize(V3()), half = THREE.MathUtils.degToRad(camera.fov / 2);
    const across = Math.max(size.x, size.z);
    const dH = size.y / 2 / Math.tan(half), dW = across / 2 / (Math.tan(half) * camera.aspect);
    camera.position.set(0, 0, Math.max(dH, dW) * 1.16 + across / 2);
    camera.lookAt(0, 0, 0);
  }

  // Экспозиция. Точки складываются, и там, где их на экране густо (маленький наконечник на
  // длинной палочке, светлое серебро, телефон с маленьким экраном), изделие выгорает в белое.
  // Считаем свет в клетках экрана 3×3 px при трёх поворотах: по плотности вокруг средней точки
  // ставим общую яркость, а точки в самых густых местах приглушаем, чтобы там остались детали.
  let last = null, dense = [0, 0];
  const EXPOSE = 5.9, HOT = 2.6;
  function exposure() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!last || !w || !h) return;
    const cell = 3, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), acc = new Float32Array(gw * gh);
    const v = V3(), m = new THREE.Matrix4(), keep = pivot.rotation.clone();
    const P = last.pos, C = last.base, n = last.count, at = new Int32Array(n), worst = new Float32Array(n);
    let med = 0;
    camera.updateMatrixWorld(true);
    [0, 1.05, 2.1].forEach((turn, pass) => {
      acc.fill(0);
      pivot.rotation.set(rot.x, rot.y + turn, 0);
      pivot.updateMatrixWorld(true);
      m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(pivot.matrixWorld);
      for (let i = 0; i < n; i++) {
        v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m);
        const x = ((v.x + 1) * 0.5 * w / cell) | 0, y = ((1 - v.y) * 0.5 * h / cell) | 0;
        if (x < 0 || y < 0 || x >= gw || y >= gh) { at[i] = -1; continue; }
        at[i] = y * gw + x;
        acc[at[i]] += 0.3 * C[i * 3] + 0.59 * C[i * 3 + 1] + 0.11 * C[i * 3 + 2];
      }
      for (let i = 0; i < n; i++) if (at[i] >= 0) worst[i] = Math.max(worst[i], acc[at[i]]);
      // плотность «вокруг средней точки»: Σ D² / Σ D по клеткам — не зависит от редких одиночных точек
      let s1 = 0, s2 = 0;
      for (let c = 0; c < acc.length; c++) { s1 += acc[c]; s2 += acc[c] * acc[c]; }
      med += (s1 ? s2 / s1 : 1) / 3;
    });
    pivot.rotation.copy(keep);
    pivot.updateMatrixWorld(true);
    const col = points.geometry.attributes.aColor;
    for (let i = 0; i < n; i++) {
      const f = worst[i] > HOT * med ? Math.pow(HOT * med / worst[i], 0.65) : 1;
      col.array[i * 3] = C[i * 3] * f; col.array[i * 3 + 1] = C[i * 3 + 1] * f; col.array[i * 3 + 2] = C[i * 3 + 2] * f;
    }
    col.needsUpdate = true;
    dense = [med, Math.max(...worst)];
    material.uniforms.uGain.value = Math.max(0.16, Math.min(0.55, EXPOSE / med));
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
    exposure();
    draw();
  }

  function show(item, sel, opts) {
    const o = opts || {};
    const same = current && current.item === item.id;
    const built = BUILD[item.id](item, sel);
    const cloud = toPoints(built.group, budget);
    // центрируем по габариту точек
    const box = new THREE.Box3().setFromArray(cloud.pos), c = box.getCenter(V3());
    for (let i = 0; i < cloud.count; i++) { cloud.pos[i * 3] -= c.x; cloud.pos[i * 3 + 1] -= c.y; cloud.pos[i * 3 + 2] -= c.z; }
    fitBox = box.translate(c.negate());
    const size = fitBox.getSize(V3()).length();
    // откуда точки слетаются: при смене изделия — издалека, при смене камня или грейда — рядом
    const start = new Float32Array(cloud.count * 3), spread = same && !o.intro ? 3 : size * 0.9;
    for (let i = 0; i < cloud.count; i++) {
      const u = Math.random() * 2 - 1, f = Math.random() * TAU, q = Math.sqrt(1 - u * u), r = spread * (0.4 + Math.random() * 0.6);
      start[i * 3] = cloud.pos[i * 3] * (same && !o.intro ? 1 : 0.2) + q * Math.cos(f) * r;
      start[i * 3 + 1] = cloud.pos[i * 3 + 1] * (same && !o.intro ? 1 : 0.2) + q * Math.sin(f) * r;
      start[i * 3 + 2] = cloud.pos[i * 3 + 2] * (same && !o.intro ? 1 : 0.2) + u * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cloud.pos, 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(cloud.col, 3));
    geo.setAttribute('aNormal', new THREE.BufferAttribute(cloud.nor, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(cloud.rnd, 1));
    if (points) { pivot.remove(points); points.geometry.dispose(); }
    points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    pivot.add(points);
    fit();
    if (!same || o.reset) { rot.x = built.pose[0]; rot.y = built.pose[1]; rot.vx = rot.vy = 0; }
    last = { pos: cloud.pos, base: cloud.col.slice(), count: cloud.count };
    exposure();
    dur = same && !o.intro ? 420 : 950;
    t0 = reduce ? -1e9 : performance.now();
    current = { item: item.id };
    canvas.setAttribute('aria-label', o.label || item.name);
    draw();
  }

  function animate(now) {
    material.uniforms.uT.value = Math.min(1, (now - t0) / dur);
    material.uniforms.uTime.value = reduce ? 0 : now / 1000;
    if (!drag) {
      rot.y += rot.vy;
      rot.x += rot.vx;
      rot.vy *= 0.93;
      rot.vx *= 0.9;
      if (!reduce && now > idleAt) rot.y += 0.0042;
    }
    rot.x = Math.max(-0.9, Math.min(0.9, rot.x));
    pivot.rotation.set(rot.x, rot.y, 0);
    if (points && !reduce) points.position.y = Math.sin(now / 1000 * 0.9) * 0.8;
  }

  function draw() {
    if (!points) return;
    animate(performance.now());
    renderer.render(scene, camera);
  }

  function loop() {
    cancelAnimationFrame(raf);
    if (!active || !visible || document.hidden) return;
    raf = requestAnimationFrame(function tick() {
      if (!active || !visible || document.hidden) return;
      draw();
      raf = requestAnimationFrame(tick);
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    wrap.classList.add('is-touched', 'is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    rot.vy = dx * 0.009;
    rot.vx = dy * 0.005;
    rot.y += rot.vy;
    rot.x += rot.vx;
    idleAt = performance.now() + 2600;
    if (!active) draw();
  });
  const release = () => { drag = null; wrap.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(wrap);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; loop(); }).observe(wrap);
  }
  document.addEventListener('visibilitychange', loop);

  function attach(el) {
    if (wrap.parentNode !== el) el.appendChild(wrap);
    requestAnimationFrame(resize);
  }

  attach(host);

  return {
    el: wrap,
    show,
    attach,
    resize,
    setActive(on) { active = !!on; loop(); },
    gain: () => material.uniforms.uGain.value,
    density: () => dense
  };
}

window.AA3D = { create };
document.dispatchEvent(new CustomEvent('aa3d:ready'));
