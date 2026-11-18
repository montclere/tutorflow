// Расширения указаны явно: этот файл загружает ещё и vite.config.ts.
import { routes, studentRoutes, teacherRoutes } from "../config/routes.ts";
import { siteConfig } from "../config/site.ts";
import type { AuthErrorCode, StudentsRange } from "../features/auth/api/types";
import type { SubjectId } from "../features/signup/model/profile";

const { brand, trialDays, freeStudentsLimit, proPriceRub } = siteConfig;

type SceneTone = "lime" | "plus" | "minus";

type FlowStep = {
  number: string;
  title: string;
  short: string;
  text: string;
  /** Строки мини-экрана: подпись слева, значение справа. */
  scene: { label: string; value: string; tone?: SceneTone }[];
};

const howSteps: FlowStep[] = [
  {
    number: "01",
    title: "Регистрация",
    short: "Минута, без пароля",
    text: "Вход через Telegram, Google или почту. Демо-ученики появятся сразу — есть на чём попробовать.",
    scene: [
      { label: "Вход через Telegram", value: "готово", tone: "lime" },
      { label: "Предмет", value: "математика" },
      { label: "Демо-ученики", value: "добавлены" },
    ],
  },
  {
    number: "02",
    title: "Ученики",
    short: "Ссылка или Excel",
    text: "Отправьте ссылку-приглашение или загрузите таблицу — ученики появятся вместе с балансами.",
    scene: [
      { label: "Приглашение", value: "скопировано", tone: "lime" },
      { label: "Мария Смирнова", value: "подключилась" },
      { label: "Импорт из Excel", value: "12 учеников" },
    ],
  },
  {
    number: "03",
    title: "Расписание",
    short: "Серия уроков за 30 секунд",
    text: "Задайте дни и время один раз — регулярные уроки встанут в расписание на весь учебный год.",
    scene: [
      { label: "Мария · Вт и Чт", value: "16:00" },
      { label: "Повтор", value: "каждую неделю", tone: "lime" },
      { label: "До конца мая", value: "56 уроков" },
    ],
  },
  {
    number: "04",
    title: "Урок прошёл",
    short: "Одна кнопка",
    text: "Нажмите «Проведён»: урок спишется с баланса, а ДЗ уйдёт ученику в Telegram.",
    scene: [
      { label: "Мария · 16:00", value: "проведён", tone: "lime" },
      { label: "Списано с баланса", value: "−1 500 ₽", tone: "minus" },
      { label: "ДЗ отправлено", value: "до пятницы" },
    ],
  },
  {
    number: "05",
    title: "Оплата и отчёт",
    short: "Ссылка, чек, отчёт",
    text: "Ученик платит по ссылке, чек формируется сам, родитель получает отчёт за месяц.",
    scene: [
      { label: "Оплата по СБП", value: "+1 500 ₽", tone: "plus" },
      { label: "Чек", value: "отправлен", tone: "lime" },
      { label: "Отчёт родителю", value: "за ноябрь" },
    ],
  },
];

type ShowcaseItem = {
  id: string;
  title: string;
  text: string;
  points: string[];
  image: string;
  imageAlt: string;
  href: string;
};

const showcase: ShowcaseItem[] = [
  {
    id: "ai",
    title: "ИИ собирает ДЗ",
    text: "Опишите тему — ИИ подберёт задачи из банка и аналоги с ответами. Вы правите и назначаете.",
    points: ["Банк ЕГЭ и ОГЭ", "Ответы и разбор"],
    image: "/demo/features/ai.webp",
    imageAlt: "Экран «Задания»: ИИ-помощник собрал восемь задач по уравнениям с ответами",
    href: teacherRoutes.tasksCreate,
  },
  {
    id: "review",
    title: "Проверка с подсказкой",
    text: "Ученик присылает фото решения, ИИ предлагает оценку и показывает ошибку. Последнее слово за вами.",
    points: ["ДЗ по фото", "Принять или вернуть"],
    image: "/demo/features/review.webp",
    imageAlt: "Экран «Проверка»: фото решения ученика и оценка, предложенная ИИ",
    href: teacherRoutes.review,
  },
  {
    id: "schedule",
    title: "Расписание",
    text: "День, неделя, месяц или список. Регулярные уроки, долги и свободное время видны сразу.",
    points: ["Повтор уроков", "Свободные окна"],
    image: "/demo/features/schedule.webp",
    imageAlt: "Экран «Расписание»: неделя с уроками учеников и пометками о долге",
    href: teacherRoutes.schedule,
  },
  {
    id: "students",
    title: "Баланс учеников",
    text: "Долг или предоплата пересчитываются сами после каждого урока и оплаты.",
    points: ["Поурочно и абонементы", "Фильтр должников"],
    image: "/demo/features/students.webp",
    imageAlt: "Экран «Ученики»: таблица с тарифами, долгами, предоплатами и следующим уроком",
    href: teacherRoutes.students,
  },
  {
    id: "finance",
    title: "Финансы месяца",
    text: "Сколько пришло, сколько ожидается до конца месяца и кто должен — на одном экране.",
    points: ["Прогноз прихода", "Напомнить о долге"],
    image: "/demo/features/finance.webp",
    imageAlt: "Экран «Финансы»: приход за месяц, ожидаемые оплаты, долги и предоплаты",
    href: teacherRoutes.finance,
  },
  {
    id: "trainer",
    title: "Тренажёр ученика",
    text: "Ученик решает сам: проверка мгновенная, слабые номера подсвечены цветом.",
    points: ["Вариант ЕГЭ с таймером", "Прогресс по номерам"],
    image: "/demo/features/trainer.webp",
    imageAlt: "Экран «Тренажёр» ученика: задача, поле ответа и карта освоенных номеров",
    href: studentRoutes.trainer,
  },
];

export const landing = {
  meta: {
    title: `${brand} — расписание, оплаты и ДЗ для репетитора`,
    description: `Кабинет репетитора: расписание уроков, баланс и оплаты учеников, ДЗ и напоминания родителям в Telegram. ${trialDays} дней Про бесплатно, без пароля и без карты.`,
    ogImageAlt: `${brand}: уроки, оплаты и ученики в одном кабинете`,
  },

  header: {
    homeLabel: `${brand}, наверх`,
    navLabel: "Разделы",
    nav: [
      { href: "#how", label: "Как это работает" },
      { href: "#ai", label: "ИИ-помощник" },
      { href: "#features", label: "Возможности" },
      { href: "#demo", label: "Демо" },
      { href: "#pricing", label: "Тарифы" },
      { href: "#faq", label: "Вопросы" },
    ],
    login: "Войти",
  },

  hero: {
    hash: "#",
    titleLines: ["Уроки", "Оплаты", "Ученики"],
    lessonCard: { initials: "АИ", name: "Александр", time: "Сегодня в 16:00" },
    paymentCard: { amount: "+1 500 ₽", label: "Оплата получена" },
    reminderCard: { mark: "✓", title: "Напоминание ушло", channel: "в Telegram" },
    badge: `${trialDays} ДНЕЙ PRO БЕСПЛАТНО • БЕЗ КАРТЫ • `,
    subtitle: "Кабинет репетитора с ИИ‑помощником: расписание, оплаты и домашние задания",
    cta: "Создать кабинет бесплатно",
    demo: "Смотреть демо",
  },

  ticker: {
    words: ["ИИ-помощник", "Расписание", "Оплаты", "Домашние задания", "Напоминания", "Тесты", "Баланс"],
    separator: "✦",
  },

  signup: {
    tag: "Регистрация",
    title: "Кабинет за одну минуту",
    perks: [`${trialDays} дней Про бесплатно`, "Без пароля и без карты", "Демо-ученики с первой минуты"],
    perkMark: "✓",
  },

  wizard: {
    method: {
      title: "Вход и регистрация",
      hint: "Для репетиторов",
      telegram: "Продолжить через Telegram",
      telegramBadge: "удобнее",
      google: "Продолжить через Google",
      divider: "или",
      email: "Продолжить по почте",
      consent: {
        before: "Принимаю ",
        offer: { label: "оферту", href: routes.offer },
        middle: " и даю согласие на обработку персональных данных по ",
        policy: { label: "политике", href: routes.privacy },
      },
      consentMissing: "Отметьте согласие с офертой, чтобы продолжить",
      studentToggle: "Я ученик или родитель",
      studentNote: "Попросите у репетитора ссылку. По ней вы войдёте в один клик.",
    },
    email: {
      back: "← Другой способ",
      title: "Вход по почте",
      hint: "Пришлём код из 6 цифр",
      label: "Почта",
      placeholder: "anna@mail.ru",
      submit: "Получить код",
    },
    code: {
      back: "← Изменить почту",
      title: "Введите код",
      hint: (email: string) => `Отправили на ${email}.`,
      groupLabel: "Код из письма",
      digitLabel: (position: number) => `Цифра ${position}`,
      resend: "Отправить код ещё раз",
      resendIn: (seconds: number) => `Отправить код ещё раз через ${seconds} с`,
      resent: "Отправили новый код",
    },
    profile: {
      title: "Пара вопросов",
      hint: "Подберём демо под ваш предмет",
      nameLabel: "Как к вам обращаться",
      namePlaceholder: "Анна Кузнецова",
      subjectsLabel: "Что преподаёте",
      subjects: {
        math: "Математика",
        english: "Английский",
        russian: "Русский",
        physics: "Физика",
        chemistry: "Химия",
        other: "Другое",
      } satisfies Record<SubjectId, string>,
      studentsLabel: "Сколько у вас учеников",
      studentsRanges: {
        upTo5: "до 5",
        from6To15: "6–15",
        from16To30: "16–30",
        over30: "больше 30",
      } satisfies Record<StudentsRange, string>,
      timezoneLabel: "Часовой пояс:",
      timezoneUnknown: "определим автоматически",
      submit: "Создать кабинет",
      nameRequired: "Напишите, как к вам обращаться",
      subjectsRequired: "Выберите хотя бы один предмет",
    },
    done: {
      mark: "✓",
      title: (firstName: string) => `${firstName}, кабинет готов`,
      text: (subject: string) => `Добавили демо-учеников (${subject}) и уроки на неделю.`,
      checklist: ["Добавьте первого ученика", "Поставьте урок в расписание", "Отметьте урок проведённым"],
      go: "Перейти в кабинет",
    },
    errors: {
      cancelled: "Вход отменён. Попробуйте ещё раз.",
      signatureInvalid: "Не получилось подтвердить вход через Telegram. Попробуйте ещё раз.",
      invalidEmail: "Проверьте адрес почты: похоже, в нём ошибка",
      tooManyRequests: "Код уже отправлен. Новый можно запросить через минуту.",
      invalidCode: "Неверный код. Проверьте письмо и введите код ещё раз.",
      codeExpired: "Код устарел. Запросите новый.",
      attemptsExceeded: "Попытки закончились. Запросите новый код.",
      validation: "Проверьте данные и попробуйте ещё раз.",
      unavailable: "Регистрация временно недоступна. Попробуйте позже.",
      unknown: "Что-то пошло не так. Попробуйте ещё раз.",
    } satisfies Record<AuthErrorCode, string>,
  },

  timezoneCities: {
    Moscow: "Москва",
    Kaliningrad: "Калининград",
    Samara: "Самара",
    Yekaterinburg: "Екатеринбург",
    Omsk: "Омск",
    Novosibirsk: "Новосибирск",
    Barnaul: "Барнаул",
    Tomsk: "Томск",
    Krasnoyarsk: "Красноярск",
    Irkutsk: "Иркутск",
    Yakutsk: "Якутск",
    Vladivostok: "Владивосток",
  } as Record<string, string>,

  how: {
    titleLines: ["Как это", "работает"],
    steps: howSteps,
  },

  ai: {
    tag: "ИИ-помощник",
    titleLines: ["Рутину", "берёт ИИ"],
    lead: "Готовит задания и тесты, проверяет решения и пишет отчёты. Вы смотрите результат и решаете, что отправить.",
    cta: "Попробовать ИИ в демо",
    demoLabel: "Открыть ИИ-помощника в демо-кабинете",
    chat: {
      request: "Квадратные уравнения · 10 задач · ЕГЭ · с разбором",
      author: "ИИ",
      reply: "Готово: 6 задач из банка ФИПИ и 4 новых аналога. Ответы проверены, к трём добавил разбор.",
      results: ["10 задач", "Ответы", "Разбор", "Тест на 5 вопросов"],
      action: "Назначить",
    },
    abilities: [
      {
        icon: "tasks" as const,
        title: "ДЗ и тесты по теме",
        text: "Задачи из банка ЕГЭ и ОГЭ и новые аналоги с проверенными ответами.",
        saves: "Без поиска по сборникам",
      },
      {
        icon: "check" as const,
        title: "Проверка решений",
        text: "Читает фото из тетради, предлагает оценку и показывает, где ошибка.",
        saves: "Ошибку находит за вас",
      },
      {
        icon: "report" as const,
        title: "Отчёты родителям",
        text: "Собирает месяц в короткий отчёт: уроки, ДЗ, тесты и над чем работать.",
        saves: "Без писем вручную",
      },
      {
        icon: "trainer" as const,
        title: "Тренажёр ученику",
        text: "Подбирает похожие задачи без конца — ученик тренируется сам.",
        saves: "Практика без вашего времени",
      },
    ],
    trust: "Ученику ничего не уходит без вашей проверки — последнее слово всегда за вами.",
  },

  features: {
    titleLines: ["Всё для работы", "в одном месте"],
    listLabel: "Возможности кабинета",
    demoLink: "Открыть в демо",
    items: showcase,
    report: {
      title: "Отчёт родителю в один клик",
      items: [
        { label: "Ноябрь" },
        { label: "Уроки", value: "8/8" },
        { label: "ДЗ", value: "100%" },
        { label: "Тесты", value: "85%" },
      ],
    },
    payment: {
      title: "Оплата по ссылке и чеки",
      items: ["СБП", "+1 500 ₽ на балансе", "Чек отправлен ✓"],
    },
  },

  demo: {
    tag: "Демо",
    titleLines: ["Кабинет", "изнутри"],
    lead: "Расписание, ученики и финансы на тестовых данных. Без регистрации.",
    cta: "Открыть демо",
    imageAlt: "Обзор кабинета репетитора: ближайшие занятия, что требует внимания, нагрузка недели",
  },

  telegram: {
    tag: "Ученикам и родителям",
    title: "Всё приходит в Telegram",
    lead: "Ничего не нужно устанавливать",
    phoneLabel: "Пример сообщений бота",
    bot: { avatar: "tf", name: brand, status: "бот" },
    messages: [
      {
        icon: "bell" as const,
        title: "Урок сегодня в 16:00",
        meta: "Математика · Анна К.",
        buttons: [
          { label: "Войти", accent: false },
          { label: "Перенести", accent: true },
        ],
      },
      {
        icon: "book" as const,
        title: "Новое ДЗ",
        meta: "Квадратные уравнения · до пятницы",
        buttons: [{ label: "Открыть", accent: false }],
      },
      {
        icon: "done" as const,
        title: "ДЗ проверено",
        meta: "9 из 10 · «Отлично, обрати внимание на знаки»",
        buttons: [],
      },
      {
        icon: "card" as const,
        title: "В пакете остался 1 урок",
        meta: null,
        buttons: [{ label: "Продлить", accent: true }],
      },
    ],
  },

  testimonials: {
    // Примеры для макета. Пока sample = true, раздел виден только в режиме разработки (LANDING-9).
    sample: true,
    titleLines: ["Что говорят", "репетиторы"],
    carouselLabel: "Отзывы репетиторов",
    prev: "Предыдущий отзыв",
    next: "Следующий отзыв",
    items: [
      {
        initials: "ОК",
        name: "Ольга К.",
        role: "Репетитор по математике",
        quote: "Раньше по вечерам сверяла оплаты по переписке. Теперь открываю финансы и сразу вижу, кто должен.",
        highlight: "Без вечерней сверки",
      },
      {
        initials: "ДС",
        name: "Денис С.",
        role: "Репетитор по английскому",
        quote: "Ученики переносят урок прямо из напоминания в Telegram. Расписание больше не собираю по чатам.",
        highlight: "Переносы без переписки",
      },
      {
        initials: "МВ",
        name: "Марина В.",
        role: "Репетитор по химии",
        quote: "ИИ собирает черновик ДЗ за минуту, я убираю лишнее и назначаю. Родителям отчёт уходит сам.",
        highlight: "ДЗ за минуту",
      },
      {
        initials: "АЛ",
        name: "Артём Л.",
        role: "Репетитор по физике",
        quote: "Абонементы считал в заметках и путался. Теперь вижу, сколько уроков осталось, и напоминаю продлить в один клик.",
        highlight: "Абонементы под контролем",
      },
      {
        initials: "ИП",
        name: "Ирина П.",
        role: "Репетитор по русскому",
        quote: "Родители перестали спрашивать «как успехи». Раз в месяц получают отчёт с уроками, ДЗ и тестами.",
        highlight: "Меньше вопросов от родителей",
      },
      {
        initials: "СН",
        name: "Сергей Н.",
        role: "Репетитор по информатике",
        quote: "Неделя видна целиком, свободные окна подсвечены — нового ученика ставлю в расписание за минуту.",
        highlight: "Свободные окна на виду",
      },
    ],
  },

  pricing: {
    title: "Тарифы",
    plans: [
      {
        id: "start",
        name: "Старт",
        price: "0 ₽",
        period: null,
        priceNote: "Бесплатно навсегда",
        seal: null,
        featuresTitle: "Что входит",
        features: [
          { title: `До ${freeStudentsLimit} учеников`, text: "Ученики и родители подключаются по ссылке" },
          { title: "Расписание", text: "Регулярные уроки, переносы и свободные окна" },
          { title: "Баланс и оплаты", text: "Долг и предоплата считаются сами" },
          { title: "Напоминания об уроках", text: "Ученику в Telegram или на почту" },
        ],
        cta: "Начать бесплатно",
      },
      {
        id: "pro",
        name: "Про",
        price: `${proPriceRub} ₽`,
        period: " / мес",
        priceNote: `Первые ${trialDays} дней бесплатно, без карты`,
        seal: [`${trialDays} дней`, "бесплатно"],
        featuresTitle: "Всё из «Старта», плюс",
        features: [
          { title: "Без лимита учеников", text: "Сколько угодно учеников и групп" },
          { title: "ИИ-помощник", text: "Собирает ДЗ и тесты, проверяет решения по фото" },
          { title: "Финансы и долги", text: "Прогноз прихода и напоминания о долгах" },
          { title: "Отчёты родителям", text: "Уроки, ДЗ и тесты за месяц в один клик" },
          { title: "Оплата по ссылке", text: "СБП и чеки для самозанятых" },
        ],
        cta: "Попробовать Про",
      },
    ],
  },

  faq: {
    title: "Вопросы",
    tabsLabel: "Кому вопросы",
    tabs: [
      {
        id: "teachers",
        label: "Репетиторам",
        items: [
          {
            question: "Сколько это стоит?",
            answer: `До ${freeStudentsLimit} учеников бесплатно. Про стоит ${proPriceRub} ₽ в месяц, первые ${trialDays} дней бесплатно.`,
          },
          {
            question: "Можно перенести базу из Excel?",
            answer: "Да. Загрузите таблицу, ученики появятся вместе с балансами.",
          },
          {
            question: "Работает с Zoom, Meet и Телемостом?",
            answer: "Да. Ссылка прикрепляется к уроку, ученик входит по кнопке.",
          },
          {
            question: "Как работает ИИ?",
            answer: "Готовит черновики ДЗ, тестов и отчётов. Ученику ничего не уходит без вашей проверки.",
          },
          { question: "Есть групповые уроки?", answer: "Да, в одном расписании с индивидуальными." },
          {
            question: "А если ученик отменил урок поздно?",
            answer: "Система предложит списать урок. Вы решаете: списать или простить.",
          },
        ],
      },
      {
        id: "students",
        label: "Ученикам и родителям",
        items: [
          {
            question: "Нужно что-то устанавливать?",
            answer: "Нет. Напоминания приходят в Telegram или на почту, кабинет открывается в браузере.",
          },
          {
            question: "Как зарегистрироваться ученику?",
            answer: "Регистрироваться не нужно: репетитор присылает ссылку, вход в один клик.",
          },
          { question: "Как перенести урок?", answer: "Кнопка «Перенести» прямо в напоминании." },
          { question: "Что видит родитель?", answer: "Расписание, оплаты и ежемесячный отчёт об успехах." },
        ],
      },
      {
        id: "payments",
        label: "Оплата и данные",
        items: [
          { question: "Где хранятся данные?", answer: "На серверах в России, по закону о персональных данных." },
          {
            question: "Я самозанятый. Что с чеками?",
            answer: "При оплате по ссылке чек формируется автоматически.",
          },
          {
            question: "Нужна карта для пробного периода?",
            answer: "Нет. После пробного периода можно остаться на бесплатном тарифе.",
          },
          { question: "Можно забрать данные?", answer: "Да, выгрузка в Excel в любой момент." },
        ],
      },
    ],
  },

  final: {
    hash: "#",
    titleLines: ["Без", "тетрадки"],
    cta: "Создать кабинет бесплатно",
  },

  footer: {
    copyright: `© 2026 ${brand}`,
    navLabel: "Документы",
    links: [
      { label: "Оферта", href: routes.offer },
      { label: "Политика конфиденциальности", href: routes.privacy },
    ],
    support: "Поддержка",
    faq: { label: "Вопросы", href: "#faq" },
  },

  legal: {
    back: "← На главную",
    pending: "Документ готовится и скоро появится на этой странице.",
    docs: {
      offer: { title: "Оферта", metaTitle: `Оферта — ${brand}` },
      privacy: { title: "Политика конфиденциальности", metaTitle: `Политика конфиденциальности — ${brand}` },
    },
  },

  mobileCta: "Создать кабинет",
};
