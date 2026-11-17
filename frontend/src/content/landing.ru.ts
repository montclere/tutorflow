// Расширения указаны явно: этот файл загружает ещё и vite.config.ts.
import { routes } from "../config/routes.ts";
import { siteConfig } from "../config/site.ts";
import type { AuthErrorCode, StudentsRange } from "../features/auth/api/types";
import type { SubjectId } from "../features/signup/model/profile";

const { brand, trialDays, freeStudentsLimit, proPriceRub } = siteConfig;

type ChipTone = "white" | "blue" | "lime";
type AmountTrend = "plus" | "minus" | "zero";

type FlowStep = {
  number: string;
  title: string;
  text: string;
  chips: { label: string; tone: ChipTone; trend?: AmountTrend }[];
};

const howSteps: FlowStep[] = [
  {
    number: "01",
    title: "Регистрация",
    text: "Минута, без пароля",
    chips: [{ label: "Вход через Telegram", tone: "blue" }],
  },
  {
    number: "02",
    title: "Ученики",
    text: "Ссылка или импорт из Excel",
    chips: [{ label: "Ссылка скопирована ✓", tone: "white" }],
  },
  {
    number: "03",
    title: "Расписание",
    text: "Серия уроков на год за 30 секунд",
    chips: [{ label: "Вт, Чт · 16:00", tone: "blue" }],
  },
  {
    number: "04",
    title: "Урок прошёл",
    text: "Одна кнопка: списание и ДЗ",
    chips: [
      { label: "Проведён ✓", tone: "lime" },
      { label: "−1 500 ₽", tone: "white", trend: "minus" },
    ],
  },
  {
    number: "05",
    title: "Оплата и отчёт",
    text: "Оплата по ссылке, отчёт родителю",
    chips: [
      { label: "+1 500 ₽", tone: "white", trend: "plus" },
      { label: "Отчёт ✓", tone: "lime" },
    ],
  },
];

export const landing = {
  meta: {
    title: `${brand} — расписание, оплаты и ДЗ для репетитора`,
    description: `Кабинет репетитора: расписание уроков, баланс и оплаты учеников, ДЗ и напоминания родителям в Telegram. ${trialDays} дней Про бесплатно, без пароля и без карты.`,
    ogImageAlt: `${brand}: уроки, деньги и ученики в одном кабинете`,
  },

  header: {
    homeLabel: `${brand}, наверх`,
    navLabel: "Разделы",
    nav: [
      { href: "#how", label: "Как это работает" },
      { href: "#features", label: "Возможности" },
      { href: "#pricing", label: "Тарифы" },
      { href: "#faq", label: "Вопросы" },
    ],
    login: "Войти",
  },

  hero: {
    hash: "#",
    titleLines: ["Уроки", "Деньги", "Ученики"],
    lessonCard: { initials: "АИ", name: "Александр", time: "Сегодня в 16:00" },
    paymentCard: { amount: "+1 500 ₽", label: "Оплата получена" },
    reminderCard: { mark: "✓", title: "Напоминание ушло", channel: "в Telegram" },
    badge: `${trialDays} ДНЕЙ PRO БЕСПЛАТНО • БЕЗ КАРТЫ • `,
    subtitle: "Расписание, оплаты и напоминания в одном кабинете",
    cta: "Создать кабинет бесплатно",
    demo: "Смотреть демо",
  },

  ticker: {
    words: ["Расписание", "Оплаты", "Домашние задания", "Напоминания", "Тесты", "Баланс"],
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
      title: "Создайте кабинет",
      hint: "Для преподавателей",
      telegram: "Продолжить через Telegram",
      telegramBadge: "удобнее",
      google: "Продолжить через Google",
      divider: "или",
      email: "Войти по почте",
      consent: {
        before: "Принимаю ",
        offer: { label: "оферту", href: routes.offer },
        middle: " и даю согласие на обработку персональных данных по ",
        policy: { label: "политике", href: routes.privacy },
      },
      consentMissing: "Отметьте согласие с офертой, чтобы продолжить",
      studentToggle: "Я ученик или родитель",
      studentNote: "Попросите у преподавателя ссылку. По ней вы войдёте в один клик.",
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
    subtitle: "От регистрации до оплаты",
    steps: howSteps,
  },

  features: {
    titleLines: ["Всё для работы", "в одном месте"],
    subtitle: "Без Excel, тетради и пяти чатов",
    ai: {
      tag: "ИИ",
      titleLines: ["ДЗ и тесты", "за минуту"],
      text: "Опишите тему, ИИ соберёт задания. Вы проверяете и отправляете.",
      extras: ["Отчёт родителю", "План урока", "Варианты заданий"],
      prompt: "Квадратные уравнения · 10 задач · ЕГЭ",
      promptAction: "Собрать",
      results: ["10 задач", "Ответы", "Разбор", "Тест на 5 вопросов"],
    },
    balance: {
      title: "Баланс считается сам",
      rows: [
        { name: "Мария Смирнова", amount: "+4 500 ₽", trend: "plus" },
        { name: "Дмитрий Петров", amount: "−1 200 ₽", trend: "minus" },
        { name: "Александр Иванов", amount: "0 ₽", trend: "zero" },
      ] satisfies { name: string; amount: string; trend: AmountTrend }[],
    },
    homework: {
      title: "ДЗ по фото",
      text: "Ученик снимает тетрадь",
      chain: ["Сдано", "Доработать", "Принято"],
      arrow: "→",
    },
    tests: { title: "Тесты сами проверятся", score: "9", total: " / 10" },
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

  telegram: {
    tag: "Ученикам и родителям",
    title: "Всё приходит в Telegram",
    lead: "Ничего не нужно устанавливать",
    phoneLabel: "Пример сообщений бота",
    bot: { avatar: "tf", name: brand, status: "бот" },
    messages: [
      {
        title: "🔔 Урок сегодня в 16:00",
        meta: "Математика · Анна К.",
        buttons: [
          { label: "Войти", accent: false },
          { label: "Перенести", accent: true },
        ],
      },
      {
        title: "📚 Новое ДЗ",
        meta: "Квадратные уравнения · до пятницы",
        buttons: [{ label: "Открыть", accent: false }],
      },
      {
        title: "✅ ДЗ проверено",
        meta: "9 из 10 · «Отлично, обрати внимание на знаки»",
        buttons: [],
      },
      {
        title: "💳 В пакете остался 1 урок",
        meta: null,
        buttons: [{ label: "Продлить", accent: true }],
      },
    ],
  },

  pricing: {
    title: "Тарифы",
    subtitle: "Ученикам и родителям бесплатно",
    plans: [
      {
        id: "start",
        name: "Старт",
        price: "0 ₽",
        period: null,
        seal: null,
        features: [`До ${freeStudentsLimit} учеников`, "Расписание и баланс", "Напоминания об уроках"],
        cta: "Начать бесплатно",
      },
      {
        id: "pro",
        name: "Про",
        price: `${proPriceRub} ₽`,
        period: " / мес",
        seal: [`${trialDays} дней`, "бесплатно"],
        features: ["Без лимита учеников", "Напоминания о долгах", "Отчёты родителям", "Оплата по ссылке и чеки"],
        cta: "Попробовать Про",
      },
    ],
    featureMark: "✓",
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
            answer: "Никак: преподаватель присылает ссылку, вход в один клик.",
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
            answer: `Нет. Через ${trialDays} дней можно остаться на бесплатном тарифе.`,
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
      { label: "Поддержка", href: "#faq" },
    ],
  },

  mobileCta: "Создать кабинет",
};
