// Личный кабинет: вход и регистрация, смена пароля по ссылке, покупка, мои курсы, коды, заказы, профиль.
(function () {
  'use strict';
  var app = document.getElementById('app');
  var state = { me: null, catalog: null, site: null };
  var VK = 'https://vk.ru/yantaripepel';

  function err(box, e) { clear(box).append(h('p', { class: 'msg msg--err', role: 'alert' }, e.message || String(e))); }
  function field(label, input) { return h('label', { class: 'field' }, h('span', null, label), input); }

  async function boot() {
    try {
      var res = await Promise.all([API.get('/api/me'), API.get('/api/catalog'), API.get('/api/site')]);
      state.me = res[0]; state.catalog = res[1].products; state.site = res[2];
    } catch (e) { err(app, e); return; }
    if (qs.get('reset')) return resetView(qs.get('reset'));
    if (!state.me.user) return authView();
    document.getElementById('admin-link').hidden = !state.me.user.isAdmin;
    cabinet();
  }

  /* ---------- вход и регистрация ---------- */

  function authView(mode) {
    mode = mode || (qs.get('buy') ? 'register' : 'login');
    var buy = qs.get('buy') && state.catalog.find(function (p) { return p.slug === qs.get('buy'); });
    clear(app).className = 'wrap wrap--narrow';
    app.append(h('p', { class: 'kicker' }, 'Личный кабинет'), h('h1', null, mode === 'login' ? 'Вход' : 'Регистрация'));
    if (buy) app.append(h('p', { class: 'lead' }, 'Чтобы купить «' + buy.title + '», войдите или создайте аккаунт — уроки откроются здесь сразу после оплаты.'));
    else app.append(h('p', { class: 'lead' }, 'Здесь живут ваши курсы и уроки. Смотреть можно с телефона и компьютера.'));
    var tabs = h('div', { class: 'tabs', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': mode === 'login' ? 'true' : 'false', onclick: function () { authView('login'); } }, 'Вход'),
      h('button', { type: 'button', role: 'tab', 'aria-selected': mode === 'register' ? 'true' : 'false', onclick: function () { authView('register'); } }, 'Регистрация'));
    var email = h('input', { type: 'email', autocomplete: 'email', required: true, id: 'f-email' });
    var pass = h('input', { type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', minlength: '8', required: true, id: 'f-pass' });
    var name = h('input', { type: 'text', autocomplete: 'name', maxlength: '80', id: 'f-name' });
    var consent = h('input', { type: 'checkbox', id: 'f-consent' });
    var mk = h('input', { type: 'checkbox', id: 'f-mk' });
    var box = h('div');
    var submit = h('button', { class: 'btn btn--main', type: 'submit' }, mode === 'login' ? 'Войти' : 'Создать аккаунт');
    var form = h('form', { class: 'stack', novalidate: true },
      mode === 'register' ? field('Как к вам обращаться', name) : null,
      field('Почта', email),
      field(mode === 'login' ? 'Пароль' : 'Пароль — не короче 8 символов', pass),
      mode === 'register' ? h('label', { class: 'check' }, consent, h('span', null, 'Соглашаюсь на обработку почты и имени для доступа к урокам и оплаты. ', h('a', { href: 'https://yantaripepel.ru/legal/privacy.html', target: '_blank', rel: 'noopener' }, 'Политика'))) : null,
      mode === 'register' ? h('label', { class: 'check' }, mk, h('span', null, 'Присылать письма о новых уроках и наборе в клуб (можно не отмечать)')) : null,
      box, submit,
      mode === 'login' ? h('p', { class: 'small muted' }, 'Забыли пароль? Напишите нам в ', h('a', { href: VK, target: '_blank', rel: 'noopener' }, 'сообщество ВКонтакте'), ' — пришлём ссылку для нового пароля.') : null);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      submit.disabled = true;
      try {
        if (mode === 'login') await API.post('/api/auth/login', { email: email.value, password: pass.value });
        else {
          if (!consent.checked) throw new Error('Без согласия на обработку данных мы не сможем открыть доступ к урокам.');
          await API.post('/api/auth/register', { email: email.value, password: pass.value, name: name.value, consent: true, marketing: mk.checked, source: qs.get('utm_source') || document.referrer.slice(0, 100) });
        }
        await boot();
      } catch (ex) { err(box, ex); submit.disabled = false; }
    });
    app.append(tabs, form);
    email.focus();
  }

  function resetView(token) {
    clear(app).className = 'wrap wrap--narrow';
    var pass = h('input', { type: 'password', autocomplete: 'new-password', minlength: '8', id: 'f-new' });
    var box = h('div');
    var btn = h('button', { class: 'btn btn--main', type: 'submit' }, 'Сохранить пароль');
    var form = h('form', { class: 'stack' }, field('Новый пароль — не короче 8 символов', pass), box, btn);
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); btn.disabled = true;
      try {
        await API.post('/api/auth/reset', { token: token, password: pass.value });
        history.replaceState(null, '', '/account/');
        qs.delete('reset');
        await boot();
      } catch (ex) { err(box, ex); btn.disabled = false; }
    });
    app.append(h('p', { class: 'kicker' }, 'Личный кабинет'), h('h1', null, 'Новый пароль'), form);
    pass.focus();
  }

  /* ---------- кабинет ---------- */

  async function cabinet() {
    var u = state.me.user;
    clear(app).className = 'wrap';
    app.append(h('p', { class: 'kicker' }, 'Личный кабинет'), h('h1', null, u.name ? 'Здравствуйте, ' + u.name : 'Мои уроки'));
    var buySlug = qs.get('buy'), orderId = qs.get('order');
    if (orderId) app.append(orderBox(orderId));
    else if (buySlug) app.append(checkoutBox(buySlug));

    var lib = h('section', { class: 'card' }, h('h2', null, 'Мои курсы'), h('p', { class: 'muted' }, 'Загружаю…'));
    app.append(lib);
    try {
      var data = await API.get('/api/my/library');
      clear(lib).append(h('h2', null, 'Мои курсы'));
      if (!data.items.length) lib.append(h('p', { class: 'muted' }, 'Здесь появятся купленные курсы и уроки. ', h('a', { href: 'https://yantaripepel.ru/#pieces' }, 'Выбрать украшение')));
      data.items.forEach(function (p) {
        lib.append(h('div', { class: 'stack', style: 'margin-top:14px' },
          h('div', { class: 'row between' }, h('h3', null, p.title), p.expiresAt ? h('span', { class: 'pill pill--amber' }, 'до ' + dt(p.expiresAt)) : h('span', { class: 'pill pill--good' }, 'без срока')),
          lessonList(p.lessons)));
      });
      if (data.free.length) lib.append(h('h3', { style: 'margin-top:22px' }, 'Бесплатные уроки'), lessonList(data.free));
    } catch (ex) { err(lib, ex); }

    app.append(h('div', { class: 'grid', style: 'margin-top:16px' }, codeBox(), ordersBox(), profileBox()));
  }

  function lessonList(list) {
    if (!list.length) return h('p', { class: 'muted small' }, 'Уроки скоро появятся.');
    return h('ul', { class: 'list' }, list.map(function (l) {
      return h('li', null, h('span', { class: 't' }, h('a', { href: '/learn/?l=' + encodeURIComponent(l.slug) }, l.title), l.done ? h('span', { class: 'muted small' }, ' · просмотрен') : null),
        h('span', { class: 'muted small mono' }, l.hasVideo ? mins(l.duration) : 'скоро'));
    }));
  }

  function checkoutBox(slug) {
    var p = state.catalog.find(function (x) { return x.slug === slug; });
    var box = h('section', { class: 'card', style: 'margin-bottom:16px;border-color:rgba(232,160,77,.5)' });
    if (!p) { box.append(h('p', { class: 'msg msg--warn' }, 'Такого курса нет в продаже. Посмотрите все украшения на сайте.')); return box; }
    var owned = state.me.grants.some(function (g) { return g.slug === slug && !g.expiresAt; });
    box.append(h('p', { class: 'kicker' }, p.type === 'club' ? 'Клуб' : p.type === 'course' ? 'Курс' : 'Урок'), h('h2', null, p.title), h('p', { class: 'muted' }, p.subtitle));
    if (owned) { box.append(h('p', { class: 'msg msg--ok' }, 'Уже в вашем кабинете — уроки ниже.')); return box; }
    if (p.status !== 'on_sale') { box.append(h('p', { class: 'msg msg--warn' }, 'Продажи откроются ' + startLabel() + '. Анонс — в сообществе ВКонтакте.')); return box; }
    var msg = h('div');
    var btn = h('button', { class: 'btn btn--amber', type: 'button' }, 'Оплатить ' + rub(p.price));
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      try {
        var r = await API.post('/api/checkout', { product: slug });
        if (r.url) { location.href = r.url; return; }
        if (r.granted) { location.href = '/account/'; return; }
        clear(msg).append(h('p', { class: 'msg msg--ok' }, r.message));
      } catch (ex) { err(msg, ex); btn.disabled = false; }
    });
    box.append(h('div', { class: 'row', style: 'margin-top:8px' }, btn, h('span', { class: 'small muted' }, state.site.paymentsOnline ? 'Оплата картой или СБП через ЮKassa, чек придёт на почту.' : 'Пришлём ссылку на оплату в течение дня.')), msg);
    return box;
  }

  function startLabel() { return '1 декабря'; }

  function orderBox(id) {
    var box = h('section', { class: 'card', style: 'margin-bottom:16px' }, h('p', { class: 'muted' }, 'Проверяю оплату…'));
    var tries = 0;
    (async function poll() {
      try {
        var o = (await API.get('/api/orders/' + encodeURIComponent(id))).order;
        clear(box).append(h('h2', null, o.title));
        if (o.status === 'paid') { box.append(h('p', { class: 'msg msg--ok' }, 'Оплата прошла — уроки уже в кабинете.')); setTimeout(function () { history.replaceState(null, '', '/account/'); qs.delete('order'); cabinet(); }, 1500); return; }
        if (o.status === 'pending' && tries++ < 10) { box.append(h('p', { class: 'msg msg--warn' }, 'Ждём подтверждения оплаты…')); setTimeout(poll, 3000); return; }
        box.append(h('p', { class: 'msg msg--warn' }, o.status === 'pending' ? 'Оплата ещё не подтверждена. Если вы уже оплатили, доступ откроется в течение нескольких минут.' : 'Оплата не прошла. Можно попробовать ещё раз.'));
      } catch (ex) { err(box, ex); }
    })();
    return box;
  }

  function codeBox() {
    var input = h('input', { type: 'text', autocomplete: 'off', placeholder: 'YP-XXXXXX', id: 'f-code' });
    var msg = h('div');
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Активировать');
    var form = h('form', { class: 'stack' }, field('Код из подарка или розыгрыша', input), msg, btn);
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); btn.disabled = true;
      try { var r = await API.post('/api/redeem', { code: input.value }); toast('Открыт доступ: ' + r.product.title); state.me = await API.get('/api/me'); cabinet(); }
      catch (ex) { err(msg, ex); btn.disabled = false; }
    });
    return h('section', { class: 'card' }, h('h2', null, 'Код доступа'), form);
  }

  function ordersBox() {
    var o = state.me.orders;
    var LBL = { pending: ['ждёт оплаты', 'warn'], paid: ['оплачен', 'good'], canceled: ['отменён', ''], failed: ['не прошёл', 'bad'], refunded: ['возврат', ''] };
    return h('section', { class: 'card' }, h('h2', null, 'Заказы'),
      o.length ? h('ul', { class: 'list' }, o.map(function (x) {
        var l = LBL[x.status] || [x.status, ''];
        return h('li', null, h('span', { class: 't' }, x.title, h('br'), h('span', { class: 'small muted' }, '№ ' + x.id + ' · ' + dt(x.created_at))), h('span', { class: 'row' }, h('span', { class: 'mono small' }, rub(x.amount)), h('span', { class: 'pill pill--' + l[1] }, l[0])));
      })) : h('p', { class: 'muted small' }, 'Заказов пока нет.'));
  }

  function profileBox() {
    var u = state.me.user;
    var name = h('input', { type: 'text', value: u.name, maxlength: '80', id: 'p-name' });
    var phone = h('input', { type: 'tel', value: u.phone, maxlength: '40', id: 'p-phone' });
    var vk = h('input', { type: 'text', value: u.vk, maxlength: '120', placeholder: 'vk.com/…', id: 'p-vk' });
    var msg = h('div');
    var form = h('form', { class: 'stack' }, h('p', { class: 'small muted', style: 'margin:0' }, u.email), field('Имя', name), field('Телефон', phone), field('Страница ВКонтакте — для призов и вопросов', vk), msg,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, 'Сохранить'), h('button', { class: 'link', type: 'button', onclick: logout }, 'Выйти')));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await API.patch('/api/me', { name: name.value, phone: phone.value, vk: vk.value }); toast('Сохранено'); }
      catch (ex) { err(msg, ex); }
    });
    return h('section', { class: 'card' }, h('h2', null, 'Профиль'), form);
  }

  async function logout() { await API.post('/api/auth/logout'); location.href = '/account/'; }

  boot();
})();
