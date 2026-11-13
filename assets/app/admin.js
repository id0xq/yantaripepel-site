// Админка и CRM «Янтарь и Пепел».
(function () {
  'use strict';
  var app = document.getElementById('app');
  var TABS = [['stats', 'Сводка'], ['users', 'Ученики'], ['orders', 'Заказы'], ['catalog', 'Курсы и уроки'], ['codes', 'Коды'], ['leads', 'Лист ожидания'], ['giveaway', 'Розыгрыш'], ['events', 'Журнал']];
  var STATUS = { pending: ['ждёт оплаты', 'warn'], paid: ['оплачен', 'good'], canceled: ['отменён', ''], failed: ['ошибка', 'bad'], refunded: ['возврат', ''],
    draft: ['черновик', ''], soon: ['скоро', 'warn'], on_sale: ['в продаже', 'good'], archived: ['в архиве', ''], published: ['опубликован', 'good'] };
  var TYPES = { course: 'курс', lesson: 'урок', club: 'клуб' };
  var products = [], lessons = [];
  var content, drawer;

  function pill(st) { var s = STATUS[st] || [st, '']; return h('span', { class: 'pill pill--' + s[1] }, s[0]); }
  function err(box, e) { clear(box).append(h('p', { class: 'msg msg--err', role: 'alert' }, e.message || String(e))); }
  function field(label, input) { return h('label', { class: 'field' }, h('span', null, label), input); }
  function table(head, rows) {
    return h('div', { class: 'tbl-wrap' }, h('table', null, h('thead', null, h('tr', null, head.map(function (x) { return h('th', { class: x[1] || null }, x[0]); }))), h('tbody', null, rows)));
  }
  function copy(text) {
    var done = function () { toast('Скопировано'); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { prompt('Скопируйте', text); });
  }

  async function boot() {
    var me;
    try { me = await API.get('/api/me'); } catch (e) { err(app, e); return; }
    if (!me.user) { location.href = '/account/'; return; }
    if (!me.user.isAdmin) { clear(app).append(h('h1', null, 'Нет доступа'), h('p', { class: 'lead' }, 'Админка открыта только администраторам.')); return; }
    clear(app);
    var tabs = h('div', { class: 'tabs', role: 'tablist' });
    TABS.forEach(function (t) { tabs.append(h('button', { type: 'button', role: 'tab', 'data-tab': t[0], onclick: function () { location.hash = t[0]; } }, t[1])); });
    content = h('div');
    app.append(tabs, content);
    window.addEventListener('hashchange', route);
    route();
  }

  function route() {
    var t = location.hash.slice(1) || 'stats';
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === t ? 'true' : 'false'); });
    closeDrawer();
    clear(content).append(h('p', { class: 'muted' }, 'Загружаю…'));
    ({ stats: stats, users: users, orders: orders, catalog: catalog, codes: codes, leads: leads, giveaway: giveaway, events: events }[t] || stats)().catch(function (e) { err(content, e); });
  }

  function openDrawer(nodes) {
    closeDrawer();
    drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true' }, h('button', { class: 'btn btn--sm drawer__x', type: 'button', onclick: closeDrawer }, 'Закрыть'), nodes);
    document.body.append(drawer);
  }
  function closeDrawer() { if (drawer) { drawer.remove(); drawer = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  async function loadCatalog() {
    var r = await Promise.all([API.get('/api/admin/products'), API.get('/api/admin/lessons')]);
    products = r[0].products; lessons = r[1].lessons;
  }
  function productSelect(id, all) {
    var s = h('select', { id: id });
    products.filter(function (p) { return all || p.status !== 'archived'; }).forEach(function (p) { s.append(h('option', { value: p.slug }, p.title + ' · ' + TYPES[p.type])); });
    return s;
  }

  /* ---------- сводка ---------- */
  async function stats() {
    var s = await API.get('/api/admin/stats');
    var pend = (await API.get('/api/admin/orders?status=pending')).orders;
    clear(content).append(h('div', { class: 'stats' },
      [[s.users, 'учеников, +' + s.usersWeek + ' за неделю'], [s.buyers, 'покупателей'], [rub(s.revenueMonth), 'выручка за месяц'], [rub(s.revenueTotal), 'выручка всего'],
        [s.clubActive, 'в клубе сейчас'], [s.pendingOrders, 'заказов ждут оплаты'], [s.leads, 'в листе ожидания'], [s.lessonsWithVideo + ' / ' + s.lessonsPublished, 'уроков с видео / опубликовано']]
        .map(function (x) { return h('div', { class: 'stat' }, h('b', null, x[0]), h('span', null, x[1])); })));
    content.append(h('h2', null, 'Ждут оплаты'), pend.length ? ordersTable(pend) : h('p', { class: 'muted' }, 'Неоплаченных заказов нет.'));
  }

  /* ---------- ученики ---------- */
  async function users(q) {
    var search = h('input', { type: 'search', placeholder: 'Почта, имя, телефон, метка', value: q || '', id: 'u-q' });
    var addBtn = h('button', { class: 'btn', type: 'button', onclick: newUser }, '+ Ученик');
    var exp = h('a', { class: 'btn', href: '/api/admin/export/users.csv' }, 'Выгрузить CSV');
    var list = h('div');
    clear(content).append(h('div', { class: 'row', style: 'margin-bottom:14px' }, h('div', { style: 'flex:1 1 260px' }, field('Поиск', search)), addBtn, exp), list);
    var t = 0;
    search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { fill(search.value); }, 250); });
    async function fill(v) {
      var r = await API.get('/api/admin/users?q=' + encodeURIComponent(v || ''));
      clear(list).append(r.users.length ? table([['Ученик'], ['Доступы'], ['Оплачено', 'num'], ['Метки'], ['С нами с']], r.users.map(function (u) {
        return h('tr', { class: 'click', onclick: function () { userCard(u.id); } },
          h('td', null, h('b', null, u.name || '—'), h('br'), h('span', { class: 'small muted' }, u.email), u.role === 'admin' ? h('span', { class: 'pill pill--amber', style: 'margin-left:6px' }, 'админ') : null),
          h('td', { class: 'small' }, u.access || '—'), h('td', { class: 'num' }, rub(u.spent)), h('td', { class: 'small' }, u.tags || ''), h('td', { class: 'small muted' }, dt(u.created_at)));
      })) : h('p', { class: 'muted' }, 'Никого не нашли.'));
    }
    fill(q);
  }

  async function userCard(id) {
    if (!products.length) await loadCatalog();
    var r = await API.get('/api/admin/users/' + id);
    var u = r.user;
    var name = h('input', { value: u.name, id: 'e-name' }), phone = h('input', { value: u.phone, id: 'e-phone' }), vk = h('input', { value: u.vk, id: 'e-vk' });
    var tags = h('input', { value: u.tags, placeholder: 'розыгрыш, клип C06, Москва', id: 'e-tags' });
    var notes = h('textarea', { id: 'e-notes' }); notes.value = u.notes || '';
    var role = h('select', { id: 'e-role' }, h('option', { value: 'student' }, 'ученик'), h('option', { value: 'admin' }, 'администратор')); role.value = u.role;
    var msg = h('div');
    var save = h('button', { class: 'btn btn--main', type: 'button' }, 'Сохранить');
    save.addEventListener('click', async function () {
      try { await API.patch('/api/admin/users/' + u.id, { name: name.value, phone: phone.value, vk: vk.value, tags: tags.value, notes: notes.value, role: role.value }); toast('Сохранено'); }
      catch (e) { err(msg, e); }
    });
    var reset = h('button', { class: 'btn', type: 'button' }, 'Ссылка на новый пароль');
    reset.addEventListener('click', async function () { var x = await API.post('/api/admin/users/' + u.id + '/reset-link'); clear(msg).append(h('p', { class: 'msg msg--ok' }, 'Ссылка на 72 часа: ', h('a', { href: x.link }, x.link), ' ', h('button', { class: 'link', type: 'button', onclick: function () { copy(x.link); } }, 'копировать'))); });

    var gSel = productSelect('g-prod'), gDays = h('input', { type: 'number', min: '1', placeholder: 'по умолчанию', id: 'g-days' });
    var gBtn = h('button', { class: 'btn', type: 'button' }, 'Выдать доступ');
    gBtn.addEventListener('click', async function () {
      try { await API.post('/api/admin/users/' + u.id + '/grants', { product: gSel.value, days: gDays.value }); toast('Доступ выдан'); userCard(u.id); } catch (e) { err(msg, e); }
    });
    var now = new Date().toISOString();
    openDrawer([
      h('p', { class: 'kicker' }, 'Ученик № ' + u.id), h('h2', null, u.name || u.email), h('p', { class: 'small muted' }, u.email + ' · с нами с ' + dt(u.created_at) + ' · вход ' + dt(u.last_login_at, true) + (u.source ? ' · источник: ' + u.source : '') + (u.marketing_ok ? ' · согласен на рассылку' : '')),
      h('div', { class: 'stack' }, h('div', { class: 'grid' }, field('Имя', name), field('Телефон', phone)), h('div', { class: 'grid' }, field('ВКонтакте', vk), field('Роль', role)), field('Метки через запятую', tags), field('Заметки', notes), msg, h('div', { class: 'row' }, save, reset)),
      h('h2', { style: 'margin-top:26px' }, 'Доступы'),
      r.grants.length ? h('ul', { class: 'list' }, r.grants.map(function (g) {
        var active = !g.revoked_at && (!g.expires_at || g.expires_at > now);
        var rv = active ? h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: async function () { await API.del('/api/admin/grants/' + g.id); toast('Доступ отозван'); userCard(u.id); } }, 'Отозвать') : null;
        return h('li', null, h('span', { class: 't' }, g.title, h('br'), h('span', { class: 'small muted' }, (g.source === 'order' ? 'покупка' : g.source === 'code' ? 'код' : g.source === 'manual' ? 'выдан вручную' : g.source) + ' · ' + dt(g.created_at) + (g.expires_at ? ' · до ' + dt(g.expires_at) : ' · без срока'))),
          h('span', { class: 'row' }, h('span', { class: 'pill pill--' + (active ? 'good' : '') }, g.revoked_at ? 'отозван' : active ? 'активен' : 'истёк'), rv));
      })) : h('p', { class: 'muted small' }, 'Доступов нет.'),
      h('div', { class: 'grid', style: 'margin-top:12px' }, field('Продукт', gSel), field('Дней (для клуба)', gDays)), h('div', { class: 'row', style: 'margin-top:10px' }, gBtn),
      h('h2', { style: 'margin-top:26px' }, 'Заказы'), r.orders.length ? ordersTable(r.orders) : h('p', { class: 'muted small' }, 'Заказов нет.'),
      h('h2', { style: 'margin-top:26px' }, 'Прогресс'), r.progress.length ? h('ul', { class: 'list' }, r.progress.map(function (p) { return h('li', null, h('span', { class: 't' }, p.title), h('span', { class: 'small muted' }, p.done_at ? 'просмотрен' : Math.round(p.position_sec / 60) + ' мин')); })) : h('p', { class: 'muted small' }, 'Ещё не смотрел уроки.'),
      h('h2', { style: 'margin-top:26px' }, 'История'), h('ul', { class: 'list small' }, r.events.map(function (e) { return h('li', null, h('span', { class: 't' }, e.action), h('span', { class: 'muted' }, dt(e.at, true))); }))
    ]);
  }

  function newUser() {
    var email = h('input', { type: 'email', id: 'n-email' }), name = h('input', { id: 'n-name' }), vk = h('input', { id: 'n-vk' });
    var msg = h('div');
    var btn = h('button', { class: 'btn btn--main', type: 'button' }, 'Создать');
    btn.addEventListener('click', async function () {
      try { var r = await API.post('/api/admin/users', { email: email.value, name: name.value, vk: vk.value }); clear(msg).append(h('p', { class: 'msg msg--ok' }, 'Готово. Отправьте ученику ссылку для пароля (14 дней): ', h('a', { href: r.link }, r.link), ' ', h('button', { class: 'link', type: 'button', onclick: function () { copy(r.link); } }, 'копировать'))); }
      catch (e) { err(msg, e); }
    });
    openDrawer([h('h2', null, 'Новый ученик'), h('p', { class: 'small muted' }, 'Например, оплатил переводом или выиграл в розыгрыше. После создания выдайте доступ в его карточке.'),
      h('div', { class: 'stack' }, field('Почта', email), field('Имя', name), field('ВКонтакте', vk), msg, btn)]);
  }

  /* ---------- заказы ---------- */
  function ordersTable(list) {
    return table([['№'], ['Ученик'], ['Что'], ['Сумма', 'num'], ['Статус'], ['Создан'], ['']], list.map(function (o) {
      var acts = h('span', { class: 'row' });
      if (o.status === 'pending' || o.status === 'failed') {
        acts.append(h('button', { class: 'btn btn--sm', type: 'button', onclick: async function () { if (!confirm('Отметить оплаченным и открыть доступ?')) return; await API.post('/api/admin/orders/' + o.id + '/paid', {}); toast('Оплата подтверждена, доступ открыт'); route(); } }, 'Оплачен'),
          h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: async function () { await API.post('/api/admin/orders/' + o.id + '/cancel'); route(); } }, 'Отменить'));
      }
      return h('tr', null, h('td', { class: 'mono' }, o.id), h('td', { class: 'small' }, o.name || '', o.email ? h('br') : null, h('span', { class: 'muted' }, o.email || '')), h('td', { class: 'small' }, o.title),
        h('td', { class: 'num' }, rub(o.amount)), h('td', null, pill(o.status), o.provider === 'manual' ? h('div', { class: 'small muted' }, 'вручную') : null, o.note ? h('div', { class: 'small muted' }, o.note) : null),
        h('td', { class: 'small muted' }, dt(o.created_at, true)), h('td', null, acts));
    }));
  }
  async function orders() {
    var sel = h('select', { id: 'o-st' }, h('option', { value: '' }, 'Все'), ['pending', 'paid', 'canceled', 'failed'].map(function (s) { return h('option', { value: s }, STATUS[s][0]); }));
    var box = h('div');
    clear(content).append(h('div', { class: 'row', style: 'margin-bottom:14px' }, field('Статус', sel)), h('p', { class: 'small muted' }, 'Пока ЮKassa не подключена, заказы приходят сюда со статусом «ждёт оплаты». Пришлите ученику ссылку или реквизиты, после оплаты нажмите «Оплачен» — доступ откроется сам.'), box);
    async function fill() { var r = await API.get('/api/admin/orders' + (sel.value ? '?status=' + sel.value : '')); clear(box).append(r.orders.length ? ordersTable(r.orders) : h('p', { class: 'muted' }, 'Заказов нет.')); }
    sel.addEventListener('change', fill); fill();
  }

  /* ---------- курсы и уроки ---------- */
  async function catalog() {
    await loadCatalog();
    clear(content).append(h('div', { class: 'row between', style: 'margin-bottom:12px' }, h('h2', { style: 'margin:0' }, 'Курсы, уроки, клуб'), h('button', { class: 'btn', type: 'button', onclick: function () { productForm(null); } }, '+ Продукт')),
      table([['Продукт'], ['Тип'], ['Цена', 'num'], ['Статус'], ['Уроков', 'num'], ['Учеников', 'num']], products.map(function (p) {
        return h('tr', { class: 'click', onclick: function () { productForm(p); } }, h('td', null, h('b', null, p.title), h('br'), h('span', { class: 'small muted' }, '/' + p.slug)), h('td', null, TYPES[p.type]),
          h('td', { class: 'num' }, rub(p.price)), h('td', null, pill(p.status)), h('td', { class: 'num' }, p.all_lessons ? 'все' : p.lessons.length), h('td', { class: 'num' }, p.buyers));
      })),
      h('div', { class: 'row between', style: 'margin:28px 0 12px' }, h('h2', { style: 'margin:0' }, 'Уроки'), h('button', { class: 'btn', type: 'button', onclick: function () { lessonForm(null); } }, '+ Урок')),
      table([['Урок'], ['Статус'], ['Видео'], ['Длина', 'num'], ['Бесплатно']], lessons.map(function (l) {
        return h('tr', { class: 'click', onclick: function () { lessonForm(l); } }, h('td', null, h('b', null, l.title), h('br'), h('span', { class: 'small muted' }, l.slug)), h('td', null, pill(l.status)),
          h('td', null, l.video_file ? h('span', { class: 'pill pill--good' }, (l.video_size / 1048576).toFixed(0) + ' МБ') : h('span', { class: 'pill pill--warn' }, 'нет')), h('td', { class: 'num' }, mins(l.duration_sec)), h('td', null, l.free ? 'да' : ''));
      })));
  }

  function productForm(p) {
    p = p || { slug: '', type: 'course', title: '', subtitle: '', description: '', price: 0, status: 'draft', pieces: '', sort: 100, all_lessons: 0, access_days: null, old_price: null, lessons: [] };
    var f = {
      title: h('input', { value: p.title, id: 'pf-title' }), slug: h('input', { value: p.slug, id: 'pf-slug', placeholder: 'pervoe-ukrashenie' }),
      type: h('select', { id: 'pf-type' }, Object.keys(TYPES).map(function (k) { return h('option', { value: k }, TYPES[k]); })),
      status: h('select', { id: 'pf-status' }, ['draft', 'soon', 'on_sale', 'archived'].map(function (k) { return h('option', { value: k }, STATUS[k][0]); })),
      price: h('input', { type: 'number', min: '0', value: p.price, id: 'pf-price' }), old: h('input', { type: 'number', min: '0', value: p.old_price == null ? '' : p.old_price, id: 'pf-old' }),
      days: h('input', { type: 'number', min: '1', value: p.access_days == null ? '' : p.access_days, placeholder: 'без срока', id: 'pf-days' }),
      all: h('input', { type: 'checkbox', checked: !!p.all_lessons, id: 'pf-all' }), pieces: h('input', { value: p.pieces, placeholder: 'ring,earring', id: 'pf-pieces' }),
      sub: h('textarea', { id: 'pf-sub' }), desc: h('textarea', { id: 'pf-desc' }), sort: h('input', { type: 'number', value: p.sort, id: 'pf-sort' })
    };
    f.type.value = p.type; f.status.value = p.status; f.sub.value = p.subtitle || ''; f.desc.value = p.description || '';
    var picks = h('div', { class: 'stack' }, lessons.map(function (l) { return h('label', { class: 'check' }, h('input', { type: 'checkbox', value: String(l.id), checked: p.lessons.indexOf(l.id) >= 0 }), h('span', null, l.title)); }));
    var msg = h('div');
    var save = h('button', { class: 'btn btn--main', type: 'button' }, 'Сохранить');
    save.addEventListener('click', async function () {
      var body = { title: f.title.value, slug: f.slug.value, type: f.type.value, status: f.status.value, price: f.price.value, old_price: f.old.value, access_days: f.days.value, all_lessons: f.all.checked, pieces: f.pieces.value, subtitle: f.sub.value, description: f.desc.value, sort: f.sort.value };
      var ids = Array.prototype.map.call(picks.querySelectorAll('input:checked'), function (i) { return Number(i.value); });
      try {
        var id = p.id;
        if (id) await API.patch('/api/admin/products/' + id, body); else id = (await API.post('/api/admin/products', body)).id;
        await API.put('/api/admin/products/' + id + '/lessons', { lessons: ids });
        toast('Сохранено'); catalog();
      } catch (e) { err(msg, e); }
    });
    openDrawer([h('h2', null, p.id ? p.title : 'Новый продукт'),
      h('div', { class: 'stack' }, field('Название', f.title), h('div', { class: 'grid' }, field('Адрес (латиница)', f.slug), field('Тип', f.type)), h('div', { class: 'grid' }, field('Статус', f.status), field('Порядок', f.sort)),
        h('div', { class: 'grid' }, field('Цена, ₽', f.price), field('Старая цена, ₽ (только если реальная)', f.old)), h('div', { class: 'grid' }, field('Дней доступа (клуб — 30)', f.days), field('Украшения на сайте', f.pieces)),
        h('label', { class: 'check' }, f.all, h('span', null, 'Открывает все уроки (клуб)')), field('Подзаголовок', f.sub), field('Описание', f.desc),
        h('h3', null, 'Уроки в продукте'), picks, msg, save),
      h('p', { class: 'small muted', style: 'margin-top:14px' }, 'Статусы: «черновик» не виден на сайте, «скоро» — виден без покупки, «в продаже» — можно купить, «в архиве» — скрыт, у купивших остаётся.')]);
  }

  function lessonForm(l) {
    l = l || { slug: '', title: '', summary: '', body: '', status: 'draft', free: 0, sort: 100, materials: '[]', duration_sec: 0 };
    var mats = []; try { mats = JSON.parse(l.materials || '[]'); } catch (e) { mats = []; }
    var f = {
      title: h('input', { value: l.title, id: 'lf-title' }), slug: h('input', { value: l.slug, id: 'lf-slug' }),
      status: h('select', { id: 'lf-status' }, ['draft', 'published', 'archived'].map(function (k) { return h('option', { value: k }, STATUS[k] ? STATUS[k][0] : k); })),
      free: h('input', { type: 'checkbox', checked: !!l.free, id: 'lf-free' }), sort: h('input', { type: 'number', value: l.sort, id: 'lf-sort' }),
      summary: h('textarea', { id: 'lf-sum' }), body: h('textarea', { id: 'lf-body', style: 'min-height:200px' }), mats: h('textarea', { id: 'lf-mats', style: 'min-height:140px' })
    };
    f.status.value = l.status; f.summary.value = l.summary || ''; f.body.value = l.body || '';
    f.mats.value = mats.map(function (m) { return [m.name, m.note || '', m.url || ''].join(' | '); }).join('\n');
    var msg = h('div');
    var save = h('button', { class: 'btn btn--main', type: 'button' }, 'Сохранить');
    save.addEventListener('click', async function () {
      var materials = f.mats.value.split('\n').map(function (s) { var p = s.split('|').map(function (x) { return x.trim(); }); return { name: p[0], note: p[1] || '', url: p[2] || '' }; }).filter(function (m) { return m.name; });
      var body = { title: f.title.value, slug: f.slug.value, status: f.status.value, free: f.free.checked, sort: f.sort.value, summary: f.summary.value, body: f.body.value, materials: materials };
      try { if (l.id) await API.patch('/api/admin/lessons/' + l.id, body); else await API.post('/api/admin/lessons', body); toast('Сохранено'); catalog(); }
      catch (e) { err(msg, e); }
    });
    var upload = h('div');
    if (l.id) {
      var file = h('input', { type: 'file', accept: 'video/mp4,video/quicktime,video/webm', id: 'lf-file' });
      var bar = h('div', { class: 'bar', hidden: true }, h('span'));
      var umsg = h('div');
      file.addEventListener('change', function () {
        var fl = file.files[0]; if (!fl) return;
        var probe = document.createElement('video'); probe.preload = 'metadata';
        probe.onloadedmetadata = function () { send(Math.round(probe.duration || 0)); URL.revokeObjectURL(probe.src); };
        probe.onerror = function () { send(0); };
        probe.src = URL.createObjectURL(fl);
        function send(dur) {
          var x = new XMLHttpRequest();
          x.open('PUT', '/api/admin/lessons/' + l.id + '/video?duration=' + dur);
          x.setRequestHeader('X-AA', '1'); x.setRequestHeader('Content-Type', fl.type || 'video/mp4');
          bar.hidden = false;
          x.upload.onprogress = function (e) { if (e.lengthComputable) bar.firstChild.style.width = Math.round(e.loaded / e.total * 100) + '%'; };
          x.onload = function () { if (x.status === 200) { toast('Видео загружено'); catalog(); } else { var t = {}; try { t = JSON.parse(x.responseText); } catch (e) { t = {}; } err(umsg, new Error(t.error || 'Не загрузилось')); } };
          x.onerror = function () { err(umsg, new Error('Связь прервалась — попробуйте ещё раз')); };
          x.send(fl);
        }
      });
      upload.append(h('h3', { style: 'margin-top:18px' }, 'Видео'), l.video_file ? h('p', { class: 'small muted' }, 'Загружено: ' + (l.video_size / 1048576).toFixed(1) + ' МБ, ' + mins(l.duration_sec) + '. Новый файл заменит старый.') : h('p', { class: 'small muted' }, 'Видео ещё нет. MP4 (H.264), лучше 1080p.'),
        field('Файл', file), bar, umsg, l.video_file ? h('a', { class: 'btn btn--sm', href: '/learn/?l=' + l.slug, target: '_blank' }, 'Посмотреть как ученик') : null);
    }
    openDrawer([h('h2', null, l.id ? l.title : 'Новый урок'),
      h('div', { class: 'stack' }, field('Название', f.title), h('div', { class: 'grid' }, field('Адрес (латиница)', f.slug), field('Статус', f.status)), h('div', { class: 'grid' }, field('Порядок', f.sort), h('label', { class: 'check', style: 'align-self:end' }, f.free, h('span', null, 'Бесплатный урок'))),
        field('Коротко', f.summary), field('Конспект урока', f.body), field('Что понадобится — по строке: название | заметка | ссылка', f.mats), msg, save), upload,
      h('p', { class: 'small muted', style: 'margin-top:14px' }, 'Ученики видят урок, когда он опубликован и входит в купленный курс или клуб.')]);
  }

  /* ---------- коды ---------- */
  async function codes() {
    await loadCatalog();
    var r = await API.get('/api/admin/codes');
    var prod = productSelect('c-prod', true), count = h('input', { type: 'number', min: '1', max: '200', value: '1', id: 'c-count' }), uses = h('input', { type: 'number', min: '1', value: '1', id: 'c-uses' });
    var days = h('input', { type: 'number', min: '1', placeholder: 'как у продукта', id: 'c-days' }), exp = h('input', { type: 'date', id: 'c-exp' }), note = h('input', { placeholder: 'приз розыгрыша, подарок…', id: 'c-note' });
    var out = h('div');
    var btn = h('button', { class: 'btn btn--main', type: 'button' }, 'Создать коды');
    btn.addEventListener('click', async function () {
      try { var x = await API.post('/api/admin/codes', { product: prod.value, count: count.value, uses: uses.value, days: days.value, expires: exp.value, note: note.value }); clear(out).append(h('p', { class: 'msg msg--ok' }, 'Коды: ', h('b', { class: 'mono' }, x.codes.join(', ')), ' ', h('button', { class: 'link', type: 'button', onclick: function () { copy(x.codes.join('\n')); } }, 'копировать'))); }
      catch (e) { err(out, e); }
    });
    clear(content).append(h('section', { class: 'card' }, h('h2', null, 'Новые коды'), h('p', { class: 'small muted' }, 'Для призов розыгрыша, подарков и блогеров. Ученик вводит код в кабинете — доступ открывается сразу.'),
      h('div', { class: 'grid' }, field('Что открывает', prod), field('Сколько кодов', count), field('Активаций на код', uses)), h('div', { class: 'grid', style: 'margin-top:12px' }, field('Дней доступа', days), field('Действует до', exp), field('Заметка', note)),
      h('div', { class: 'row', style: 'margin-top:12px' }, btn), out),
      h('h2', { style: 'margin-top:24px' }, 'Все коды'),
      r.codes.length ? table([['Код'], ['Что'], ['Осталось', 'num'], ['Использован', 'num'], ['До'], ['Заметка'], ['']], r.codes.map(function (c) {
        return h('tr', null, h('td', { class: 'mono' }, c.code), h('td', { class: 'small' }, c.title), h('td', { class: 'num' }, c.uses_left), h('td', { class: 'num' }, c.used_count), h('td', { class: 'small muted' }, c.expires_at ? dt(c.expires_at) : '—'), h('td', { class: 'small' }, c.note),
          h('td', null, c.uses_left > 0 ? h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: async function () { await API.del('/api/admin/codes/' + c.id); codes(); } }, 'Погасить') : null));
      })) : h('p', { class: 'muted' }, 'Кодов пока нет.'));
  }

  /* ---------- лист ожидания ---------- */
  async function leads() {
    var r = await API.get('/api/admin/leads');
    clear(content).append(h('p', { class: 'small muted' }, 'Кто просил сообщить о старте курса. Почта — с согласием на обработку.'),
      r.leads.length ? table([['Почта'], ['Имя'], ['Курс'], ['Источник'], ['Когда']], r.leads.map(function (l) {
        return h('tr', null, h('td', null, l.email), h('td', null, l.name), h('td', { class: 'small' }, l.title || '—'), h('td', { class: 'small muted' }, l.source), h('td', { class: 'small muted' }, dt(l.created_at)));
      })) : h('p', { class: 'muted' }, 'Пока пусто.'));
  }

  /* ---------- розыгрыш ---------- */
  async function giveaway() {
    var g = (await API.get('/api/admin/giveaway')).giveaway || {};
    var f = {
      active: h('input', { type: 'checkbox', checked: !!g.active, id: 'gw-active' }), title: h('input', { value: g.title || '', id: 'gw-title' }), lead: h('textarea', { id: 'gw-lead' }),
      prizes: h('textarea', { id: 'gw-prizes' }), steps: h('textarea', { id: 'gw-steps' }), winners: h('textarea', { id: 'gw-win', placeholder: 'Имя Ф., vk.com/…' }),
      s: h('input', { type: 'date', value: g.startsAt || '', id: 'gw-s' }), e: h('input', { type: 'date', value: g.endsAt || '', id: 'gw-e' }), d: h('input', { type: 'date', value: g.drawAt || '', id: 'gw-d' }),
      post: h('input', { type: 'url', value: g.postUrl || '', placeholder: 'https://vk.ru/wall-…', id: 'gw-post' })
    };
    f.lead.value = g.lead || ''; f.prizes.value = (g.prizes || []).join('\n'); f.steps.value = (g.steps || []).join('\n'); f.winners.value = (g.winners || []).join('\n');
    var msg = h('div');
    var save = h('button', { class: 'btn btn--main', type: 'button' }, 'Сохранить');
    save.addEventListener('click', async function () {
      try { await API.put('/api/admin/giveaway', { active: f.active.checked, title: f.title.value, lead: f.lead.value, prizes: f.prizes.value, steps: f.steps.value, winners: f.winners.value, startsAt: f.s.value, endsAt: f.e.value, drawAt: f.d.value, postUrl: f.post.value }); toast('Сохранено'); }
      catch (e) { err(msg, e); }
    });
    clear(content).append(h('section', { class: 'card stack' }, h('h2', null, 'Новогодний розыгрыш'),
      h('p', { class: 'small muted', style: 'margin:0' }, 'Анонс на главной берёт данные отсюда, когда сайт подключён к кабинету (config.app в catalog.js); до этого — из shop.js.'),
      h('label', { class: 'check' }, f.active, h('span', null, 'Показывать анонс')), field('Заголовок', f.title), field('Коротко', f.lead),
      h('div', { class: 'grid' }, field('Призы — по строке', f.prizes), field('Условия — по строке', f.steps)),
      h('div', { class: 'grid' }, field('Старт', f.s), field('Конец приёма', f.e), field('Итоги', f.d)), field('Пост розыгрыша ВКонтакте', f.post), field('Победители — по строке', f.winners), msg, save));
  }

  /* ---------- журнал ---------- */
  async function events() {
    var r = await API.get('/api/admin/events');
    clear(content).append(table([['Когда'], ['Что'], ['Ученик'], ['Подробности']], r.events.map(function (e) {
      return h('tr', null, h('td', { class: 'small muted' }, dt(e.at, true)), h('td', null, e.action), h('td', { class: 'small' }, e.email || ''), h('td', { class: 'small mono' }, e.data === '{}' ? '' : e.data));
    })));
  }

  boot();
})();
