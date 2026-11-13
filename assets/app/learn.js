// Страница урока: плеер с водяным знаком (почта ученика), материалы, список уроков курса, прогресс.
(function () {
  'use strict';
  var app = document.getElementById('app');
  var slug = qs.get('l');

  async function boot() {
    if (!slug) { location.href = '/account/'; return; }
    var data, lib = null;
    try {
      data = await API.get('/api/lessons/' + encodeURIComponent(slug));
    } catch (e) {
      clear(app).append(h('p', { class: 'kicker' }, 'Урок'), h('h1', null, e.status === 401 ? 'Нужно войти' : 'Урок закрыт'),
        h('p', { class: 'lead' }, e.message),
        h('a', { class: 'btn btn--main', href: e.status === 401 ? '/account/' : 'https://yantaripepel.ru/#pieces' }, e.status === 401 ? 'Войти' : 'Выбрать курс'));
      return;
    }
    try { lib = await API.get('/api/my/library'); } catch (e) { lib = null; }
    render(data, lib);
  }

  function render(data, lib) {
    var l = data.lesson;
    document.title = l.title + ' — Янтарь и Пепел';
    clear(app);
    var main = h('div', { class: 'stack' });
    main.append(h('p', { class: 'kicker' }, data.courses.length ? data.courses.map(function (c) { return c.title; }).join(' · ') : 'Урок'), h('h1', null, l.title));
    main.append(player(l, data.viewer));
    if (l.summary) main.append(h('p', { class: 'lead', style: 'margin:0' }, l.summary));
    var doneBtn = h('button', { class: 'btn' + (l.done ? '' : ' btn--main'), type: 'button', disabled: l.done }, l.done ? 'Урок просмотрен' : 'Отметить просмотренным');
    doneBtn.addEventListener('click', async function () { await save(true); doneBtn.textContent = 'Урок просмотрен'; doneBtn.disabled = true; doneBtn.className = 'btn'; });
    main.append(h('div', { class: 'row' }, doneBtn));
    if (l.body) main.append(h('section', { class: 'card' }, h('h2', null, 'Конспект'), h('div', { class: 'body' }, l.body)));
    if (l.materials && l.materials.length) {
      main.append(h('section', { class: 'card' }, h('h2', null, 'Что понадобится'), h('ul', { class: 'list' }, l.materials.map(function (m) {
        return h('li', null, h('span', { class: 't' }, m.url ? h('a', { href: m.url, target: '_blank', rel: 'noopener sponsored' }, m.name) : m.name, m.note ? h('span', { class: 'small muted' }, ' — ' + m.note) : null));
      }))));
    }
    var side = h('aside', { class: 'card' }, h('h2', null, 'Уроки'));
    var course = lib && lib.items.find(function (p) { return p.lessons.some(function (x) { return x.slug === l.slug; }); });
    var list = course ? course.lessons : (lib ? lib.free : []);
    if (list.length) side.append(h('nav', { class: 'lessons', 'aria-label': 'Уроки курса' }, list.map(function (x) {
      return h('a', { href: '/learn/?l=' + encodeURIComponent(x.slug), 'aria-current': x.slug === l.slug ? 'page' : null }, x.title, x.done ? h('span', { class: 'done', 'aria-label': 'просмотрен' }, '✓') : null);
    })));
    else side.append(h('p', { class: 'muted small' }, h('a', { href: '/account/' }, 'Все мои курсы')));
    app.append(h('div', { class: 'learn' }, main, side));
  }

  var video = null, last = 0;
  function player(l, email) {
    var box = h('div', { class: 'player' });
    if (!l.videoUrl) { box.append(h('div', { class: 'player__empty' }, h('p', null, 'Видео этого урока появится совсем скоро.'))); return box; }
    video = h('video', { controls: true, playsinline: true, preload: 'metadata', controlslist: 'nodownload noplaybackrate', disablepictureinpicture: true, src: l.videoUrl });
    video.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    video.addEventListener('loadedmetadata', function () {
      if (video.videoHeight > video.videoWidth) box.classList.add('player--portrait');
      if (l.position && l.position < video.duration - 10) video.currentTime = l.position;
    });
    video.addEventListener('timeupdate', function () { if (Math.abs(video.currentTime - last) > 15) save(false); });
    video.addEventListener('pause', function () { save(false); });
    video.addEventListener('ended', function () { save(true); });
    box.append(video);
    if (email) {
      var wm = h('span', { class: 'wm', 'aria-hidden': 'true' }, email);
      box.append(wm);
      var move = function () { wm.style.top = (8 + Math.random() * 78) + '%'; wm.style.left = (4 + Math.random() * 60) + '%'; };
      move(); setInterval(move, 20000);
    }
    return box;
  }

  function save(done) {
    last = video ? video.currentTime : 0;
    return API.post('/api/progress', { lesson: slug, position: Math.round(last), done: done === true }).catch(function () {});
  }

  boot();
})();
