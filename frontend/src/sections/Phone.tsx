import { landing } from "../content/landing.ru";
import styles from "./Telegram.module.css";

const { phoneLabel, bot, messages } = landing.telegram;

export function Phone() {
  return (
    <div className={styles.phone} role="img" aria-label={phoneLabel}>
      <div className={styles.screen}>
        <div className={styles.chatHead}>
          <span className={styles.botAvatar}>{bot.avatar}</span>
          <span>
            <b>{bot.name}</b>
            <small>{bot.status}</small>
          </span>
        </div>
        <div className={styles.chat}>
          {messages.map((message) => (
            <div key={message.title} className={styles.message}>
              <b>{message.title}</b>
              {message.meta && <small>{message.meta}</small>}
              {message.buttons.length > 0 && (
                <div className={styles.keyboard}>
                  {message.buttons.map((button) => (
                    <span key={button.label} className={button.accent ? styles.keyAccent : styles.key}>
                      {button.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
