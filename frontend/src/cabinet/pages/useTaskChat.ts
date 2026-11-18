import { useState } from "react";
import { appendExchange } from "../model/chat";
import { getTaskLab } from "../data";

export function useTaskChat() {
  const lab = getTaskLab();
  const [messages, setMessages] = useState(lab.messages);
  const [draft, setDraft] = useState("");

  const send = (request: string): boolean => {
    const next = appendExchange(messages, request, lab.aiReply);
    if (!next) return false;
    setMessages(next);
    setDraft("");
    return true;
  };

  return { messages, draft, setDraft, send };
}
