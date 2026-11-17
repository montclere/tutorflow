import { routes, studentRoutes, teacherRoutes } from "../../config/routes.ts";
import { plural } from "../model/plural.ts";
import type { AttentionKind } from "../mocks/types.ts";

export type IconName =
  | "home"
  | "calendar"
  | "users"
  | "tasks"
  | "check"
  | "money"
  | "bolt"
  | "flag"
  | "chart";

const lessonForms: [string, string, string] = ["урок", "урока", "уроков"];
const activeForms: [string, string, string] = ["активный", "активных", "активных"];
const dayForms: [string, string, string] = ["день", "дня", "дней"];
const windowForms: [string, string, string] = ["свободное окно", "свободных окна", "свободных окон"];

export type Role = "teacher" | "student";

export type NavItem = { path: string; label: string; icon: IconName; badge?: number; matchPrefix?: string };

const teacherNav: NavItem[] = [
  { path: teacherRoutes.overview, label: "Обзор", icon: "home" },
  { path: teacherRoutes.schedule, label: "Расписание", icon: "calendar" },
  { path: teacherRoutes.students, label: "Ученики", icon: "users" },
  { path: teacherRoutes.tasksCreate, label: "Задания", icon: "tasks", matchPrefix: "/teacher/tasks" },
  { path: teacherRoutes.review, label: "Проверка", icon: "check", badge: 4 },
  { path: teacherRoutes.finance, label: "Финансы", icon: "money" },
];

const studentNav: NavItem[] = [
  { path: studentRoutes.home, label: "Главная", icon: "home" },
  { path: studentRoutes.tasks, label: "Задания", icon: "tasks", badge: 2 },
  { path: studentRoutes.trainer, label: "Тренажёр", icon: "bolt" },
  { path: studentRoutes.exam, label: "Вариант ЕГЭ", icon: "flag" },
  { path: studentRoutes.progress, label: "Прогресс", icon: "chart" },
];

export const cabinet = {
  weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  roles: [
    { id: "teacher", label: "Репетитор", path: routes.teacherCabinet },
    { id: "student", label: "Ученик", path: routes.studentCabinet },
  ] as { id: Role; label: string; path: string }[],
  nav: { teacher: teacherNav, student: studentNav } as Record<Role, NavItem[]>,
  promo: {
    teacher: { title: "ИИ-помощник", text: "Соберёт ДЗ по теме или аналоги заданий ЕГЭ за минуту." },
    student: { title: "Серия 4 дня", text: "Решай по 10 задач в день — не теряй серию." },
  } as Record<Role, { title: string; text: string }>,
  shell: {
    homeLabel: "На главную",
    roleGroupLabel: "Кабинет",
    menuLabel: "Меню",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    searchLabel: "Поиск",
    searchPlaceholder: "Поиск: ученик, задание, тема",
    notificationsLabel: "Уведомления",
    skip: "К содержимому",
  },
  notify: {
    soon: (label: string) => `${label} — скоро будет`,
  },
  common: {
    schedule: "Расписание →",
    allTasks: "Все задания →",
    students: "Ученики →",
    all: "Все →",
    solve: "Решать",
    open: "Открыть",
  },
  teacher: {
    overview: {
      greeting: (name: string) => `Добрый день, ${name}`,
      addTask: "Задание",
      addLesson: "Урок",
      today: {
        title: "Сегодня",
        tabsLabel: "День",
        days: [
          { id: "today", label: "Сегодня" },
          { id: "tomorrow", label: "Завтра" },
        ] as const,
        tabLabel: (label: string, count: number) => `${label} · ${count}`,
        join: "Войти",
        empty: "Уроков нет",
        status: {
          done: "Проведён",
          paid: "Оплачено",
          debt: "Долг",
          soon: (minutes: number) => `через ${minutes} мин`,
        },
      },
      attention: {
        title: "Требует внимания",
        empty: "Всё в порядке",
        maxItems: 5,
        actions: {
          lesson: "Проведён",
          review: "Проверить",
          debt: "Напомнить",
          package: "Продлить",
          inactive: "Написать",
        } as Record<AttentionKind, string>,
        lessonDone: "Урок отмечен проведённым",
      },
      week: {
        title: "Неделя",
        summary: (lessons: number, load: number) => `${lessons} ${plural(lessons, lessonForms)} · загрузка ${load}%`,
        chartLabel: "Уроков по дням недели",
        maxFreeWindows: 3,
        barLabel: (day: string, count: number) => `${day}: ${count} ${plural(count, lessonForms)}`,
        freeWindows: (windows: string[]) => (windows.length ? `Свободно: ${windows.join(" · ")}` : "Свободных окон нет"),
        share: "Поделиться",
        shareIntro: "Свободные окна на неделе:",
        copied: "Окна скопированы",
        copyFailed: "Не удалось скопировать",
      },
      exams: {
        title: "Подготовка к экзаменам",
        name: (student: string, exam: string) => `${student} · ${exam}`,
        progress: (days: number, weak: number) => `${days} ${plural(days, dayForms)} · слабое место №${weak}`,
        inactive: (days: number) => `не занимается ${days} ${plural(days, dayForms)}`,
        readinessLabel: (name: string) => `Готовность: ${name}`,
        trendUp: "Рост",
        trendDown: "Падение",
      },
    },
    schedule: {
      title: "Расписание",
      addLesson: "Урок",
      today: "Сегодня",
      tomorrow: "Завтра",
      pickDate: "Выбрать дату",
      views: [
        { id: "day", label: "День" },
        { id: "week", label: "Неделя" },
        { id: "month", label: "Месяц" },
        { id: "list", label: "Список" },
      ] as const,
      viewLabel: "Вид расписания",
      step: {
        day: { prev: "Предыдущий день", next: "Следующий день" },
        week: { prev: "Предыдущая неделя", next: "Следующая неделя" },
        month: { prev: "Предыдущий месяц", next: "Следующий месяц" },
        list: { prev: "Предыдущие дни", next: "Следующие дни" },
      },
      filters: {
        student: "Ученик",
        allStudents: "Все ученики",
        searchStudent: "Найти ученика",
        noStudents: "Ученик не найден",
        type: "Тип урока",
        allTypes: "Все типы",
        subject: "Предмет",
        allSubjects: "Все предметы",
        colorBy: "Цвет",
        weekend: "Выходные",
      },
      types: { individual: "Индивидуальный", group: "Групповой", trial: "Пробный" },
      colorModes: [
        { id: "student", label: "По ученикам" },
        { id: "payment", label: "По оплате" },
      ] as const,
      summary: (lessons: number, windows: number) =>
        `${lessons} ${plural(lessons, lessonForms)} · ${windows} ${plural(windows, windowForms)}`,
      pay: { paid: "оплачено", debt: "долг", low: "пакет" },
      payFull: { paid: "Оплачено", debt: "Долг", low: "Пакет заканчивается" },
      recurring: "Регулярный урок",
      free: "свободно",
      freeLabel: (day: string, start: string, end: string) => `Свободное окно: ${day}, ${start}–${end}`,
      now: "Сейчас",
      weekGridLabel: "Недельное расписание",
      monthLabel: "Расписание на месяц",
      monthDay: (count: number) => `${count} ${plural(count, lessonForms)}`,
      noLessons: "Уроков нет",
      emptyList: "Ближайших уроков нет",
      emptyFiltered: "По выбранным фильтрам уроков нет",
      next: {
        title: "Следующий урок",
        topic: "Прошлая тема",
        homework: "Домашнее задание",
        balance: "Баланс",
        note: "Заметка",
        empty: "Больше уроков нет",
      },
      lesson: {
        title: "Урок",
        duration: (minutes: number) => `${minutes} мин`,
        join: "Войти",
        move: "Перенести",
        cancel: "Отменить",
        done: "Проведён",
      },
      quick: {
        title: "Новый урок",
        student: "Ученик",
        chooseStudent: "Выберите ученика",
        duration: "Длительность",
        durations: [
          { value: "45", label: "45 минут" },
          { value: "60", label: "60 минут" },
          { value: "90", label: "90 минут" },
        ],
        defaultDuration: "60",
        repeat: "Повтор",
        repeats: [
          { value: "none", label: "Не повторять" },
          { value: "weekly", label: "Каждую неделю" },
        ],
        defaultRepeat: "none",
        save: "Создать урок",
      },
    },
    students: {
      title: "Ученики",
      subtitle: (count: number) => `${count} ${plural(count, activeForms)}`,
      import: "Импорт",
      invite: "Пригласить",
      columns: ["Ученик", "Предмет", "Уроков", "Баланс", "Прогресс", ""],
      progress: (percent: number) => `${percent}% тем освоено`,
    },
    tasks: {
      title: "Задания",
      subtitle: "Создавайте с ИИ, берите из банка, храните своё",
      manual: "Вручную",
      withAi: "С ИИ",
      tabsLabel: "Раздел заданий",
      tabs: [
        { label: "Создать с ИИ", path: teacherRoutes.tasksCreate },
        { label: "Банк ЕГЭ и ОГЭ", path: teacherRoutes.tasksBank },
        { label: "Мои задания", path: teacherRoutes.tasksMine },
      ],
      chat: {
        title: "ИИ-помощник",
        subtitle: "Настройте и опишите задание",
        placeholder: "Например: 10 задач на вероятность, как в №4",
        inputLabel: "Сообщение ИИ-помощнику",
        send: "Отправить",
        empty: "Напишите, что нужно сделать",
        messagesLabel: "Диалог с ИИ",
      },
      draft: {
        badge: "Черновик",
        replace: "Заменить",
        harder: "Сложнее",
        edit: "Изм.",
        remove: "Удалить",
        more: (count: number) => `ещё ${count} карточек…`,
        actions: ["Отправить ученику", "PDF", "В библиотеку", "В тренажёр"],
      },
      bank: {
        title: "ЕГЭ профиль · 2026",
        subtitle: "Номер задания в экзамене",
        examLabel: "Экзамен",
        note: "Источники: открытый банк ФИПИ, демоверсии и открытые варианты прошлых лет. Под цифрой — сколько заданий в банке.",
        detailTitle: (number: number, topic: string) => `№${number} · ${topic}`,
        detailSub: (count: number) => `${count} заданий · 3 прототипа`,
        analogs: "Сделать 10 аналогов",
        toTask: "В задание",
        similar: "Аналоги",
      },
      mine: {
        columns: ["Задание", "Карточек", "Выдано", "Средний балл", ""],
        assign: "Выдать",
      },
    },
    review: {
      title: "Проверка",
      subtitle: "ИИ заранее предлагает оценку. Последнее слово за вами",
      queueLabel: "Очередь проверки",
      photo: "Фото решения",
      aiSuggests: (score: string) => `ИИ предлагает: ${score}`,
      accept: (score: string) => `Принять ${score}`,
      change: "Изменить",
      rework: "На доработку",
      accepted: "Оценка принята",
      reworked: "Отправлено на доработку",
    },
    finance: {
      title: "Финансы",
      export: "Экспорт",
      addPayment: "Оплата",
      operations: "Операции",
      columns: ["Дата", "Ученик", "Операция", "Сумма"],
    },
  },
  student: {
    home: {
      trainer: "Тренажёр",
      homeworkTitle: "Мои задания",
      homeworkSub: "От преподавателя",
      weakTitle: "Подтянуть",
      weakSub: "Слабые номера по тренажёру",
      feedbackTitle: "Последний отзыв",
    },
    tasks: {
      title: "Задания",
      subtitle: "От преподавателя",
      tabsLabel: "Статус заданий",
      tabs: [
        { id: "todo", label: "К выполнению · 2" },
        { id: "wait", label: "На проверке · 1" },
        { id: "done", label: "Выполнено · 16" },
      ] as const,
      pdf: "PDF",
      submitPhoto: "Сдать фото",
      mistakes: "Работа над ошибками",
      explanations: "Разборы",
    },
    trainer: {
      title: "Тренажёр",
      subtitle: "Решай сам. Проверка мгновенная, задачи не кончаются",
      exam: "ЕГЭ профиль",
      taskNumber: (solved: number) => `Задача ${solved + 1} · аналог`,
      answerLabel: "Ответ",
      check: "Проверить",
      hint: "Подсказка",
      hintText: (hint: string) => `Подсказка: ${hint}`,
      empty: "Введите ответ",
      correct: "Верно!",
      wrong: (answer: string) => `Неверно. Правильный ответ: ${answer}`,
      next: "Следующая →",
      streakDays: "дня подряд",
      today: (solved: number, goal: number) => `сегодня ${solved} из ${goal} задач`,
      pickTitle: "Выбрать номер",
      pickSub: "Цвет — насколько освоено",
      modesTitle: "Режимы",
      modes: [
        { label: "По номеру", pressed: true },
        { label: "Мои ошибки", pressed: false },
        { label: "На время", pressed: false },
      ],
      fullVariant: "Весь вариант",
    },
    exam: {
      title: "Вариант ЕГЭ",
      subtitle: "Как на настоящем экзамене: таймер, бланк, баллы",
      badge: "Новый",
      start: "Начать",
      onPaper: "Решать на бумаге",
      historyTitle: "Мои варианты",
      runningTitle: "Вариант 3",
      runningSubtitle: "Ответы сохраняются автоматически",
      task: (current: number, total: number) => `Задание ${current} из ${total}`,
      points: (count: number) => `${count} балл`,
      answerLabel: (number: number) => `Ответ на задание ${number}`,
      save: "Сохранить",
      back: "← Назад",
      forward: "Дальше →",
      left: "Осталось",
      navLabel: "Номера заданий",
      finish: "Завершить",
      finished: "Часть 1 проверена: 9 из 12. Часть 2 ушла преподавателю",
      saved: "Ответ сохранён",
      doneUpTo: 5,
    },
    progress: {
      title: "Прогресс",
      subtitle: "ЕГЭ профиль · по номерам заданий",
      mapTitle: "Карта номеров",
      mapSub: "Чем зеленее, тем лучше",
    },
  },
  levels: ["слабо", "средне", "хорошо", "освоено"],
  placeholders: { answer: "Ответ" },
};
