export const env = {
  // Демо-сборка: регистрация и кабинет на тестовых данных, без сервера (INF-7.2). Рабочая сборка — только API.
  demo: import.meta.env.VITE_DEMO === "1",
  demoUrl: import.meta.env.VITE_DEMO_URL || null,
  supportUrl: import.meta.env.VITE_SUPPORT_URL || null,
} as const;
