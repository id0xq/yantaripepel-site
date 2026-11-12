/*
  Янтарь и Пепел — курсы, уроки, клуб и розыгрыш.
  Единственное место, где до запуска кабинета меняются названия, цены, состав курсов и даты розыгрыша.
  Сайт читает этот файл сразу; сервер кабинета (server/) берёт отсюда стартовый каталог,
  а после запуска цены и уроки правятся уже в админке — тогда сайт берёт их из кабинета.
  Между маркерами — чистый JSON: его разбирает сервер, поэтому без комментариев и висячих запятых.
*/
window.AA = window.AA || {};
window.AA.shop = /*JSON*/{
  "launch": "2026-12-01",
  "launchLabel": "1 декабря",
  "lessons": [
    {
      "slug": "vvedenie",
      "title": "Что такое серебряная глина и что купить для старта",
      "summary": "Как глина становится серебром 999 пробы, сколько стоит первое украшение и какие инструменты нужны с первого дня.",
      "free": true,
      "materials": [
        "clay",
        "base"
      ]
    },
    {
      "slug": "material",
      "title": "Работа с глиной: раскатка, текстуры, сушка",
      "summary": "Как не пересушить глину, сделать ровную толщину и красивую текстуру, как собрать детали пастой.",
      "free": false,
      "materials": [
        "clay",
        "base"
      ]
    },
    {
      "slug": "sharm",
      "title": "Шарм с камнем",
      "summary": "Подвеска с камнем, который выдерживает обжиг: форма, гнездо под камень, петля.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "stone"
      ]
    },
    {
      "slug": "kolco",
      "title": "Кольцо с камнем: размер с учётом усадки",
      "summary": "Шинка нужного размера после обжига и камень прямо в шинке.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "stone",
        "ring"
      ]
    },
    {
      "slug": "monoserga",
      "title": "Моносерьга в оправе",
      "summary": "Крупная оправа вокруг камня и швенза, которая не натирает.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "bezel"
      ]
    },
    {
      "slug": "obzhig",
      "title": "Обжиг горелкой без печи",
      "summary": "Сколько держать в огне, как понять, что серебро спеклось, и как не расплавить изделие.",
      "free": false,
      "materials": [
        "clay",
        "base"
      ]
    },
    {
      "slug": "polirovka",
      "title": "Полировка до зеркала",
      "summary": "От белого матового серебра после обжига до зеркального блеска за несколько минут.",
      "free": true,
      "materials": [
        "clay",
        "base"
      ]
    },
    {
      "slug": "zakrepka",
      "title": "Натуральные камни: пять способов закрепки после обжига",
      "summary": "Лабрадорит, аквамарин, гранат и другие камни, которые нельзя обжигать.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "bezel"
      ]
    },
    {
      "slug": "palochka",
      "title": "Палочка для волос с наконечником на резьбе",
      "summary": "Сменный наконечник, который выдерживает рывок.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "thread"
      ]
    },
    {
      "slug": "zakolka",
      "title": "Заколка «Солнце и луна» со сменным верхом",
      "summary": "Верх меняется под настроение: солнце для дня, луна для вечера.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "thread"
      ]
    },
    {
      "slug": "bulavka",
      "title": "Булавка с комплектом чармов",
      "summary": "Основа и до трёх сменных чармов, у каждого свой камень.",
      "free": false,
      "materials": [
        "clay",
        "base",
        "stone"
      ]
    }
  ],
  "materials": {
    "clay": [
      {
        "name": "Медная или бронзовая глина, 15–20 г",
        "note": "дешевле серебра и прощает ошибки — для первых проб; обжиг горелкой",
        "url": "",
        "metal": "classic",
        "forms": "base"
      },
      {
        "name": "Глина из белой бронзы или медная глина, 10–15 г",
        "note": "для колец и серёг: белая бронза светлая и ближе к серебру",
        "url": "",
        "metal": "classic",
        "forms": "skin"
      },
      {
        "name": "Серебряная глина 999, 7–10 г",
        "note": "Art Clay Silver или PMC3 — обжиг горелкой, после обжига серебро 999 пробы",
        "url": "",
        "metal": "rare"
      }
    ],
    "base": [
      {
        "name": "Бутановая горелка и огнеупорная плитка",
        "note": "",
        "url": ""
      },
      {
        "name": "Акриловый роллер и карточки для ровной толщины",
        "note": "",
        "url": ""
      },
      {
        "name": "Наждачная бумага и губки 400–2000",
        "note": "",
        "url": ""
      },
      {
        "name": "Латунная щётка и полировочные диски",
        "note": "",
        "url": ""
      }
    ],
    "stone": [
      {
        "name": "Корунд 3–5 мм",
        "note": "выдерживает обжиг — впекаем прямо в глину",
        "url": "",
        "metal": "classic"
      },
      {
        "name": "Натуральный камень: лабрадорит, аквамарин или гранат",
        "note": "обжиг не выдерживает — ставим в оправу после обжига",
        "url": "",
        "metal": "rare"
      }
    ],
    "ring": [
      {
        "name": "Кольцевой стержень и бумажная мерка размера",
        "note": "",
        "url": ""
      }
    ],
    "bezel": [
      {
        "name": "Готовая оправа под камень или проволока для лапок",
        "note": "",
        "url": ""
      }
    ],
    "thread": [
      {
        "name": "Резьбовой замок и основа палочки",
        "note": "",
        "url": ""
      }
    ]
  },
  "products": [
    {
      "slug": "pervoe-ukrashenie",
      "type": "course",
      "title": "Моё первое украшение из серебряной глины",
      "subtitle": "Три проекта: шарм, кольцо с камнем и моносерьга. Обжиг горелкой, без печи и без опыта.",
      "price": 2900,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "pin",
        "ring",
        "earring"
      ],
      "lessons": [
        "vvedenie",
        "material",
        "sharm",
        "kolco",
        "monoserga",
        "obzhig",
        "polirovka"
      ]
    },
    {
      "slug": "smennye-elementy",
      "type": "course",
      "title": "Сменные элементы и натуральные камни",
      "subtitle": "Палочка с наконечником на резьбе, заколка «Солнце и луна», булавка с чармами и закрепка натуральных камней.",
      "price": 5900,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "stick",
        "clip",
        "pin"
      ],
      "lessons": [
        "zakrepka",
        "palochka",
        "zakolka",
        "bulavka"
      ]
    },
    {
      "slug": "urok-sharm",
      "type": "lesson",
      "title": "Урок: шарм с камнем",
      "subtitle": "Один проект. Основы работы с глиной — в бесплатных уроках и в курсе.",
      "price": 390,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "pin"
      ],
      "lessons": [
        "sharm"
      ]
    },
    {
      "slug": "urok-kolco",
      "type": "lesson",
      "title": "Урок: кольцо с камнем",
      "subtitle": "Один проект. Основы работы с глиной — в бесплатных уроках и в курсе.",
      "price": 390,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "ring"
      ],
      "lessons": [
        "kolco"
      ]
    },
    {
      "slug": "urok-monoserga",
      "type": "lesson",
      "title": "Урок: моносерьга в оправе",
      "subtitle": "Один проект. Основы работы с глиной — в бесплатных уроках и в курсе.",
      "price": 390,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "earring"
      ],
      "lessons": [
        "monoserga"
      ]
    },
    {
      "slug": "urok-palochka",
      "type": "lesson",
      "title": "Урок: палочка с наконечником на резьбе",
      "subtitle": "Один проект для тех, кто уже работал с глиной.",
      "price": 990,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "stick"
      ],
      "lessons": [
        "palochka"
      ]
    },
    {
      "slug": "urok-zakolka",
      "type": "lesson",
      "title": "Урок: заколка «Солнце и луна»",
      "subtitle": "Один проект для тех, кто уже работал с глиной.",
      "price": 990,
      "accessDays": null,
      "allLessons": false,
      "status": "soon",
      "pieces": [
        "clip"
      ],
      "lessons": [
        "zakolka"
      ]
    },
    {
      "slug": "klub",
      "type": "club",
      "title": "Клуб мастерской",
      "subtitle": "Все уроки библиотеки, новый проект каждый месяц, челлендж «Первое украшение за 7 дней», разборы работ и чат.",
      "price": 790,
      "accessDays": 30,
      "allLessons": true,
      "status": "soon",
      "pieces": [],
      "lessons": []
    }
  ],
  "giveaway": {
    "active": true,
    "title": "Новогодний розыгрыш",
    "lead": "Разыгрываем три подарка среди подписчиков нашего сообщества ВКонтакте.",
    "prizes": [
      "Набор для создания украшения",
      "Готовое украшение ручной работы",
      "Доступ в клуб мастерской"
    ],
    "steps": [
      "Подпишитесь на сообщество ВКонтакте",
      "Поставьте лайк посту с розыгрышем",
      "Сделайте репост поста к себе на страницу",
      "Напишите комментарий под постом"
    ],
    "startsAt": "2026-12-02",
    "endsAt": "2026-12-26",
    "drawAt": "2026-12-27",
    "postUrl": "",
    "winners": []
  }
}/*END*/;
