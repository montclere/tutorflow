// Шрифты лежат в сборке, а не на Google Fonts: CSP разрешает только свой origin (INF-7.1).
// Каждый файл подключает все наборы символов через unicode-range — браузер скачает только нужные (кириллица, латиница).
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/unbounded/800.css";
import "@fontsource/unbounded/900.css";
