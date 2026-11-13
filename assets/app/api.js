// Общие помощники кабинета и админки: запросы к API, разметка, форматы.
(function () {
  'use strict';
  async function call(method, url, body, headers) {
    var h = Object.assign({ 'X-AA': '1' }, headers || {});
    var payload;
    if (body instanceof Blob || body instanceof ArrayBuffer) payload = body;
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    var r = await fetch(url, { method: method, headers: h, body: payload, credentials: 'same-origin' });
    var data = {};
    try { data = await r.json(); } catch (e) { data = {}; }
    if (!r.ok || data.ok === false) {
      var err = new Error(data.error || ('Ошибка ' + r.status));
      err.status = r.status; err.code = data.code;
      throw err;
    }
    return data;
  }
  window.API = {
    get: function (u) { return call('GET', u); },
    post: function (u, b) { return call('POST', u, b || {}); },
    patch: function (u, b) { return call('PATCH', u, b || {}); },
    put: function (u, b) { return call('PUT', u, b || {}); },
    del: function (u) { return call('DELETE', u); }
  };

  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  window.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  window.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  window.rub = function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; };
  var MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  window.dt = function (iso, time) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    var s = d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
    return time ? s + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : s;
  };
  window.mins = function (sec) { return sec ? Math.round(sec / 60) + ' мин' : ''; };
  var tt = 0;
  window.toast = function (text) {
    var t = document.querySelector('.toast') || document.body.appendChild(h('div', { class: 'toast', role: 'status' }));
    t.textContent = text; t.hidden = false;
    clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 3200);
  };
  window.qs = new URLSearchParams(location.search);
})();
