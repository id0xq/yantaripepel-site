/*
  Янтарь и Пепел — изделия-проекты, металлы, камни и настройки сайта.
  После пивота 12.11.2026 сайт продаёт не украшения, а обучение: каждое изделие — проект урока
  и курса. Курсы, уроки, цены и розыгрыш — в shop.js; здесь — формы изделий для чертежей и 3D,
  металлы (бывшие грейды) и камни для примерки, ссылки на площадки.
  prices у изделий остались от предзаказа и на сайте больше не показываются.
*/
(function () {
  'use strict';

  // Корень сайта — от адреса этого файла, чтобы пути работали из /a/, /b/ и с любого хостинга.
  var ROOT = ((document.currentScript && document.currentScript.src) || '').replace(/assets\/shared\/catalog\.js.*$/, '');

  var config = {
    brand: 'Янтарь и Пепел',
    // Адрес личного кабинета (server/ на сервере в России), например 'https://lk.yantaripepel.ru'.
    // Пока пусто, кнопки покупки ведут в сообщество ВК, а «Войти» на сайте не показывается.
    app: '',

    // Наследство предзаказа: используется только старым вариантом A.
    endpoint: '',

    // Окно предзаказа. До opensAt кнопки собирают «напомнить», после closesAt — лист ожидания.
    opensAt: '2026-11-11T00:00:00+03:00',
    closesAt: '2026-11-26T23:59:59+03:00',
    gateBeforeOpen: true,

    prepay: 0.3,                   // доля предоплаты при брони, решение 02.11; null — сумму не показываем
    shipBy: '31 января 2027',      // дата отправки в карточке: даты, а не дни (вики)
    madeIn: 'Индонезия',           // страна изготовления обязательна в карточке и оферте

    // Площадки (12.11.2026). Пустая ссылка на сайте не показывается.
    links: {
      vk: 'https://vk.ru/yantaripepel',
      telegram: 'https://t.me/yantaripepel',
      bot: 'https://t.me/yantaripepel_bot',
      youtube: 'https://www.youtube.com/@yantaripepel',
      rutube: 'https://rutube.ru/u/yantaripepel',
      dzen: 'https://dzen.ru/yantaripepel',
      pinterest: 'https://www.pinterest.com/yantaripepel',
      livemaster: 'https://yantar-i-pepel.livemaster.ru',
      tiktok: 'https://www.tiktok.com/@yantaripepel',
      instagram: 'https://www.instagram.com/yantaripepel'
    },
    email: 'yantaripepel@gmail.com',

    // Яндекс Формы (forms.yandex.ru) — ссылки «Поделиться» на опубликованные формы. Пустая — кнопка не показывается.
    // waitlist — лист ожидания старта на сайте; winner — данные победителей розыгрыша (ссылку шлём только в личку).
    forms: {
      waitlist: '',
      winner: ''
    },

    metrikaId: null                // номер счётчика Яндекс Метрики, когда заведёте
  };

  // Камни. kind управляет рисунком на чертеже: огранка, игра света (ракушку вернём после пробы).
  // short — подпись в ряду камней элемента, где рядом уже сказано, что это корунд.
  var stones = {
    corundum_honey: { label: 'Медовый корунд', short: 'Медовый', color: '#d48a2c', kind: 'facet' },
    corundum_blue:  { label: 'Синий корунд',   short: 'Синий',   color: '#3c63b4', kind: 'facet' },
    corundum_pink:  { label: 'Розовый корунд', short: 'Розовый', color: '#d4709a', kind: 'facet' },
    labradorite:    { label: 'Лабрадорит',     color: '#4078cc', kind: 'flash' },   // синий, ближе к синему корунду: не путается с аквамарином
    aquamarine:     { label: 'Аквамарин',      color: '#86cdd8', kind: 'facet' },
    garnet:         { label: 'Гранат',         color: '#8c2232', kind: 'facet' }
  };

  // Два грейда (06.11). Классический — натуральные материалы: дерево, медь и бронза, серьга и
  // кольцо из белой бронзы, камень — корунд. Редкий — всё из серебра, у палочки и заколки
  // основа тоже серебряная, камни — лабрадорит, аквамарин или гранат. Ракушки пока нет.
  var lines = {
    classic: {
      label: 'Медь и бронза',
      lead: 'Медь и бронза — для первых проб',
      note: 'Медь и бронза — для первых проб: материал дешевле, прощает ошибки и тоже обжигается горелкой. Камень — корунд, он выдерживает огонь.',
      metal: 'дерево, медь и бронза', gems: 'корунд',
      stones: ['corundum_honey', 'corundum_blue', 'corundum_pink']
    },
    rare: {
      label: 'Серебро 999',
      lead: 'После обжига — настоящее серебро',
      note: 'Серебро 999 пробы — после обжига это настоящее серебро. Натуральные лабрадорит, аквамарин и гранат ставим после обжига.',
      metal: 'серебро', gems: 'лабрадорит, аквамарин или гранат',
      stones: ['labradorite', 'aquamarine', 'garnet']
    }
  };
  var LINE_IDS = ['classic', 'rare'];

  // Цены (07.11). Изделие с элементами = основа + элементы: [основа с одним элементом, каждый
  // следующий элемент]. Следующий элемент стоит столько же, сколько этот элемент отдельно,
  // поэтому в карточке, на сцене и при докупке элементов позже цена одна и та же.
  // Заданы основателями: кольцо 4 600 / 8 300, серьга в редком 8 300, палочка в редком
  // 18 300, заколка в редком 21 600; остальное — ступени под них.
  //            классический            редкий
  // серьга     3 800                   8 300
  // кольцо     4 600                   8 300
  // булавка    4 600, чарм +1 800       12 800, чарм +4 000
  // палочка    5 800, наконечник +2 300 18 300, наконечник +5 000
  // заколка    6 600, верх +2 800       21 600, верх +6 000
  var items = [
    {
      id: 'pin',
      no: '001',
      name: 'Булавка с чармами',
      short: 'Основа и до трёх сменных чармов',
      lead: 'Английская булавка с петлями и сменными чармами: шарм с камнем делаем в первом курсе, полный комплект — во втором. Носится на сумке, шнурках и ключах.',
      element: {
        label: 'Чарм', plural: 'чармы',
        choices: [
          { id: 'moon', label: 'Луна' },
          { id: 'spiral', label: 'Спираль' },
          { id: 'stone', label: 'Камень в оправе' }
        ],
        def: 'moon'
      },
      lines: ['classic', 'rare'],
      prices: { classic: [4600, 1800], rare: [12800, 4000] },
      specs: function (s) {
        return [['Длина', '75 мм'], ['Чарм', 'до 25 мм'], ['Металл', s.line === 'rare' ? 'серебро' : 'медь или бронза'], ['Крепление', 'колечко и карабин']];
      },
      typed: ['75 мм / чарм до 25 мм', 'медь, бронза или серебро', 'чарм снимается без инструмента'],
      note: 'меняй под образ',
      care: 'Шарм — в курсе «Моё первое украшение», комплект чармов — в курсе «Сменные элементы».',
      wood: false,
      skin: false,
      limit: 3,
      drawing: 'pin',
      photo: '',   // своё фото, например 'assets/photos/pin.jpg'; пусто — чертёж
      ref: ''      // фото-референс для варианта B (заменить своей съёмкой)
    },
    {
      id: 'stick',
      no: '002',
      name: 'Палочка для волос',
      short: 'Основа и сменный наконечник на резьбе',
      lead: 'Палочка и наконечник на резьбе: открутили один, поставили другой. Наконечник делаем из медной или серебряной глины.',
      element: {
        label: 'Наконечник', plural: 'наконечники',
        choices: [
          { id: 'moon', label: 'Луна' },
          { id: 'cast', label: 'Каст с камнем' },
          { id: 'sprout', label: 'Росток' }
        ],
        def: 'moon'
      },
      lines: ['classic', 'rare'],
      prices: { classic: [5800, 2300], rare: [18300, 5000] },
      specs: function (s) {
        var rare = s.line === 'rare';
        return [['Длина', '150–180 мм'], ['Наконечник', 'до 38 мм'], ['Основа', (rare ? 'серебро' : 'дерево') + ', замок на резьбе'], ['Элемент', rare ? 'серебро' : 'медь или бронза']];
      },
      typed: ['150–180 мм / наконечник до 38 мм', 'дерево с бронзой или серебро', 'наконечник на резьбе'],
      note: 'открутил — поменял',
      care: 'Наконечник на резьбе выдерживает рывок.',
      wood: true,
      skin: false,
      limit: 3,
      drawing: 'stick',
      photo: '',
      ref: ''
    },
    {
      id: 'clip',
      no: '003',
      name: 'Заколка «Солнце и луна»',
      short: 'Заколка для пучка со сменным верхом',
      lead: 'Два гладких зубца держат пучок, сменный верх меняет настроение: солнце для дня, луна для вечера. Верх делаем из глины и сажаем на резьбу.',
      element: {
        label: 'Верх', plural: 'верх',
        choices: [
          { id: 'sun', label: 'Солнце' },
          { id: 'moon', label: 'Луна' }
        ],
        def: 'sun'
      },
      lines: ['classic', 'rare'],
      prices: { classic: [6600, 2800], rare: [21600, 6000] },
      specs: function (s) {
        var rare = s.line === 'rare';
        return [['Длина', 'около 160 мм'], ['Верх', 'до 38 мм'], ['Основа', rare ? 'серебро' : 'дерево сонокелинг'], ['Элемент', rare ? 'серебро' : 'медь или бронза']];
      },
      typed: ['160 мм / верх до 38 мм', 'дерево с бронзой или серебро', 'верх меняется на резьбе'],
      note: 'день / вечер',
      care: 'Верх откручивается и меняется без инструмента.',
      wood: true,
      skin: false,
      limit: 3,
      drawing: 'clip',
      photo: '',
      ref: ''
    },
    {
      id: 'earring',
      no: '004',
      name: 'Моносерьга',
      short: 'Одна серьга, один камень',
      lead: 'Одна серьга: один камень — одна история. Крупная оправа вокруг камня — первый проект с настоящей закрепкой.',
      element: null,
      lines: ['classic', 'rare'],
      prices: { classic: [3800], rare: [8300] },
      specs: function (s) {
        var metal = s.line === 'rare' ? 'серебро' : 'белая бронза';
        return [['Длина', 'около 55 мм'], ['Металл', metal], ['Швенза', metal], ['Камень', stones[s.stone].label.toLowerCase()]];
      },
      typed: ['55 мм / белая бронза или серебро', 'корунд или полудрагоценный камень', 'одна, без пары'],
      note: 'вторая — потом',
      care: 'Вторую серьгу можно сделать по тому же уроку.',
      wood: false,
      skin: true,
      limit: 3,
      drawing: 'earring',
      photo: '',
      ref: ''
    },
    {
      id: 'ring',
      no: '005',
      name: 'Кольцо',
      short: 'Один камень, размер под вас',
      lead: 'Кольцо с камнем: шинка нужного размера с учётом усадки при обжиге, камень — прямо в шинке или в небольшой оправе.',
      element: null,
      lines: ['classic', 'rare'],
      // кольца стартуют после освоения пайки (вики, ориентир — декабрь)
      prices: { classic: [4600], rare: [8300] },
      sizes: ['15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20'],
      sizeDef: '17',
      specs: function (s) {
        var rare = s.line === 'rare';
        return [['Размер', s.size.replace('.', ',')], ['Шинка', rare ? 'серебро' : 'белая бронза'],
          rare ? ['Оправа', 'небольшая, прямо на шинке'] : ['Закрепка', 'в отверстии шинки'], ['Камень', stones[s.stone].label.toLowerCase()]];
      },
      typed: ['размеры 15–20', 'камень в шинке или в оправе', 'белая бронза или серебро'],
      note: 'по размеру',
      care: 'Как попасть в размер с учётом усадки — в уроке.',
      wood: false,
      skin: true,
      limit: 3,
      drawing: 'ring',
      photo: '',
      ref: ''
    }
  ];

  var gift = {
    id: 'gift',
    no: null,
    name: 'Сертификат',
    short: 'Номинал — цена изделия',
    lead: 'Плотная открытка с номиналом, равным цене изделия. Человек сам выберет изделие, элементы и камень; если выберет дороже номинала, доплатит разницу.',
    specs: function () { return [['Формат', 'электронный или открытка'], ['Срок', 'без ограничений']]; },
    care: 'Электронный сертификат приходит сразу после оплаты, открытка — с первой партией.',
    wood: false,
    limit: null,
    drawing: 'gift'
  };

  // Сертификаты: номинал равен цене изделия в грейде и считается из prices — если цена
  // изделия поменяется, номинал поменяется вместе с ней.
  var certificates = [
    { id: 'classic', line: 'classic', items: ['earring'] },
    { id: 'rare', line: 'rare', items: ['earring', 'ring'] }
  ];

  /* ---------- helpers ---------- */

  function asset(path) {
    return /^(https?:)?\/\//.test(path) || path.charAt(0) === '/' ? path : ROOT + path;
  }

  function fmtPrice(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  function byId(id) {
    if (id === gift.id) return gift;
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  function defaults(item) {
    if (item.id === 'gift') return { amount: certificates[0].id, format: 'digital' };
    var line = item.lines[0];
    var s = { line: line, main: item.element ? item.element.def : null, extras: [], stone: lines[line].stones[0] };
    // у изделий с элементами камень свой у каждого элемента: gems[элемент] = камень
    if (item.element) { s.gems = {}; s.gems[s.main] = s.stone; }
    if (item.sizes) s.size = item.sizeDef || item.sizes[0];
    return s;
  }

  // Номинал сертификата и что на него можно взять целиком.
  function certOf(id) {
    var c = certificates.filter(function (x) { return x.id === id; })[0] || certificates[0];
    var list = c.items.map(byId), amount = Math.min.apply(null, list.map(function (it) { return it.prices[c.line][0]; }));
    var names = list.filter(function (it) { return it.prices[c.line][0] === amount; }).map(function (it) { return it.name.toLowerCase(); });
    return { id: c.id, line: c.line, amount: amount, note: names.join(' или ') + ', ' + lines[c.line].label.toLowerCase() + ' грейд' };
  }

  // Самая доступная цена в грейде — «от» в вопросах.
  function gradeFrom(line) {
    return Math.min.apply(null, items.filter(function (it) { return it.lines.indexOf(line) >= 0; }).map(function (it) { return it.prices[line][0]; }));
  }

  function priceFrom(item) {
    return item.id === 'gift' ? certOf(certificates[0].id).amount : item.prices[item.lines[0]][0];
  }

  function price(item, s) {
    if (item.id === 'gift') return certOf(s.amount).amount;
    var p = item.prices[s.line];
    return p[0] + (p[1] || 0) * (s.extras ? s.extras.length : 0);
  }

  // Что висит на основе: выбранный элемент первым, комплект — следом.
  function parts(s) {
    return s.main ? [s.main].concat(s.extras || []) : [];
  }

  // Камень элемента; без своего — камень основного элемента.
  function gemOf(s, id) {
    return (s.gems && id && s.gems[id]) || s.stone;
  }

  // Подпись под выбором грейда: из чего это изделие и с какими камнями.
  function lineNote(item, id) {
    if (id === 'rare') return (item.wood ? 'Целиком из серебряной глины' : 'Серебряная глина 999') + ', натуральный камень ставим после обжига.';
    var metal = item.skin ? 'Бронзовая глина' : item.wood ? 'Дерево и медная или бронзовая глина' : 'Медная или бронзовая глина';
    return metal + ', корунд впекаем при обжиге.';
  }

  function choiceLabel(item, id) {
    var c = item.element ? item.element.choices.filter(function (x) { return x.id === id; })[0] : null;
    return c ? c.label : id;
  }

  // Группы выбора для карточки изделия: зависят от текущего выбора
  // (камни — от грейда, комплект — от выбранного элемента).
  function groups(item, s) {
    if (item.id === 'gift') {
      return [
        {
          id: 'amount', label: 'Номинал', type: 'radio', value: s.amount,
          choices: certificates.map(function (c) { var k = certOf(c.id); return { id: k.id, label: fmtPrice(k.amount), note: k.note }; })
        },
        {
          id: 'format', label: 'Формат', type: 'radio', value: s.format,
          choices: [{ id: 'digital', label: 'Электронный' }, { id: 'card', label: 'Открытка' }]
        }
      ];
    }
    var out = [{
      id: 'line', label: 'Металл', type: 'radio', value: s.line, hint: lineNote(item, s.line),
      choices: item.lines.map(function (l) {
        return { id: l, label: lines[l].label };
      })
    }];
    var list = lines[s.line].stones;
    if (item.element) {
      out.push({ id: 'main', label: item.element.label, type: 'radio', value: s.main, choices: item.element.choices });
      var rest = item.element.choices.filter(function (c) { return c.id !== s.main; });
      out.push({
        id: 'extras', label: 'Комплект элементов', type: 'check', value: s.extras,
        hint: rest.length > 1 ? 'Сменные ' + item.element.plural + ' к той же основе.' : 'Второй ' + item.element.plural + ' к той же основе.',
        all: rest.length > 1 ? 'Весь комплект' : null,
        choices: rest.map(function (c) { return { id: c.id, label: c.label }; })
      });
      // камни: ряд на каждый элемент, камень — одним нажатием
      out.push({
        id: 'gems', label: parts(s).length > 1 ? 'Камни' : 'Камень', type: 'gems',
        hint: s.line === 'classic' ? 'Корунд, цвет — для каждого элемента свой.' : 'Для каждого элемента — свой камень.',
        rows: parts(s).map(function (id) { return { id: 'gem:' + id, label: choiceLabel(item, id), value: gemOf(s, id) }; }),
        choices: list.map(function (id) { return { id: id, label: stones[id].short || stones[id].label, title: stones[id].label, color: stones[id].color }; })
      });
    } else {
      out.push({
        id: 'stone', label: 'Камень', type: 'radio', value: s.stone,
        choices: list.map(function (id) { return { id: id, label: stones[id].label, color: stones[id].color }; })
      });
    }
    if (item.sizes && false) {
      out.push({
        id: 'size', label: 'Размер', type: 'radio', value: s.size,
        hint: 'Внутренний диаметр в миллиметрах. Если не знаете свой, выберите примерный — уточним перед сборкой.',
        choices: item.sizes.map(function (z) { return { id: z, label: z.replace('.', ',') }; })
      });
    }
    return out;
  }

  function change(item, s, group, value, checked) {
    if (group === 'line') {
      // камни переходят в новый грейд по месту в списке: медовый → лабрадорит, синий → аквамарин…
      var from = lines[s.line].stones, to = lines[value].stones;
      var map = function (id) { var i = from.indexOf(id); return to.indexOf(id) >= 0 ? id : to[Math.max(0, Math.min(i, to.length - 1))]; };
      s.line = value;
      s.stone = map(s.stone);
      if (s.gems) Object.keys(s.gems).forEach(function (k) { s.gems[k] = map(s.gems[k]); });
    } else if (group === 'main') {
      if (s.gems && !s.gems[value]) s.gems[value] = s.stone;
      s.main = value;
      s.extras = s.extras.filter(function (x) { return x !== value; });
      if (s.gems) s.stone = s.gems[value];
    } else if (group === 'extras') {
      var rest = item.element.choices.map(function (c) { return c.id; }).filter(function (id) { return id !== s.main; });
      if (value === '*all') s.extras = checked ? rest : [];
      else if (checked && s.extras.indexOf(value) < 0) s.extras.push(value);
      else if (!checked) s.extras = s.extras.filter(function (x) { return x !== value; });
      if (s.gems) s.extras.forEach(function (id) { if (!s.gems[id]) s.gems[id] = s.stone; });
    } else if (group.indexOf('gem:') === 0) {
      var id = group.slice(4);
      s.gems[id] = value;
      if (id === s.main) s.stone = value;
    } else {
      s[group] = value;
    }
  }

  function describe(item, s) {
    if (item.id === 'gift') {
      var k = certOf(s.amount);
      return 'Номинал: ' + fmtPrice(k.amount) + ' (' + k.note + '); Формат: ' + (s.format === 'card' ? 'открытка' : 'электронный');
    }
    var out = ['Грейд: ' + lines[s.line].label];
    if (item.element) {
      out.push(item.element.label + ': ' + choiceLabel(item, s.main));
      if (s.extras.length) out.push('Комплект: ' + s.extras.map(function (id) { return choiceLabel(item, id); }).join(', '));
      out.push('Камни: ' + parts(s).map(function (id) { return choiceLabel(item, id) + ' — ' + stones[gemOf(s, id)].label.toLowerCase(); }).join(', '));
    } else {
      out.push('Камень: ' + stones[s.stone].label);
    }
    if (item.sizes) out.push('Размер: ' + s.size.replace('.', ','));
    return out.join('; ');
  }

  // Состояние окна: soon — до открытия, open — бронь, closed — после окна.
  // Для проверки на любой дате: ?state=soon|open|closed
  function phase() {
    var forced = (new URLSearchParams(location.search).get('state') || '').toLowerCase();
    if (forced === 'soon' || forced === 'open' || forced === 'closed') return forced;
    var now = Date.now();
    if (now < Date.parse(config.opensAt)) return config.gateBeforeOpen ? 'soon' : 'open';
    if (now > Date.parse(config.closesAt)) return 'closed';
    return 'open';
  }

  window.AA = window.AA || {};
  window.AA.config = config;
  window.AA.stones = stones;
  window.AA.lines = lines;
  window.AA.lineIds = LINE_IDS;
  window.AA.items = items;
  window.AA.gift = gift;
  window.AA.fmtPrice = fmtPrice;
  window.AA.asset = asset;
  window.AA.byId = byId;
  window.AA.defaults = defaults;
  window.AA.priceFrom = priceFrom;
  window.AA.price = price;
  window.AA.parts = parts;
  window.AA.lineNote = lineNote;
  window.AA.gemOf = gemOf;
  window.AA.certificates = certificates;
  window.AA.certOf = certOf;
  window.AA.gradeFrom = gradeFrom;
  window.AA.groups = groups;
  window.AA.change = change;
  window.AA.describe = describe;
  window.AA.phase = phase;
})();
