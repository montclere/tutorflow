import { useSyncExternalStore } from "react";
import { getStudentDetails, getStudents } from "../data";
import { weakTopics } from "../model/studentTasks";
import { respond, type AssistantParams, type StudentWeakness } from "./assistant";
import { getDraft, setDraftItems } from "./draft";
import type { TaskItem } from "./types";

/** Диалог с ИИ-помощником живёт, пока открыт кабинет: переход между вкладками его не сбрасывает. */
export type ChatMessage = {
  id: number;
  author: "me" | "ai";
  text: string;
  tone?: "draft" | "info" | "refused";
  /** Сколько задач добавилось (может быть 0 при замене). */
  delta?: number;
  /** Черновик до изменения — для «Отменить». */
  undo?: TaskItem[];
  undone?: boolean;
};

type ChatState = { messages: ChatMessage[]; params: AssistantParams; thinking: boolean };

const THINKING_MS = 450;

let state: ChatState = {
  messages: [],
  params: { subject: "russian", exam: "ege-russian", difficulty: null, count: 5 },
  thinking: false,
};
let nextId = 1;
const listeners = new Set<() => void>();

function set(patch: Partial<ChatState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribeChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChat(): ChatState {
  return state;
}

export function useChat(): ChatState {
  return useSyncExternalStore(subscribeChat, getChat);
}

export function setParams(patch: Partial<AssistantParams>): void {
  set({ params: { ...state.params, ...patch } });
}

/** Слабые места учеников — темы ошибок и номера; в запрос к модели имя не передаётся. */
function weaknesses(): StudentWeakness[] {
  return getStudents()
    .filter((student) => student.status === "active")
    .map((student) => ({ name: student.name, topics: weakTopics(getStudentDetails(student.id).tasks).map((item) => item.topic), numbers: student.exam?.weak ?? [] }));
}

export function sendToAssistant(request: string, now: () => number = Date.now): boolean {
  const text = request.trim();
  if (!text || state.thinking) return false;
  set({ messages: [...state.messages, { id: nextId++, author: "me", text }], thinking: true });
  setTimeout(() => {
    const before = getDraft().items;
    const reply = respond(text, { params: state.params, draft: before, seed: now(), students: weaknesses() });
    const message: ChatMessage = { id: nextId++, author: "ai", text: reply.text, tone: reply.kind };
    if (reply.kind === "draft") {
      setDraftItems(reply.items);
      message.delta = getDraft().items.length - before.length;
      message.undo = before;
    }
    set({ messages: [...state.messages, message], thinking: false });
  }, THINKING_MS);
  return true;
}

export function undoMessage(id: number): void {
  const message = state.messages.find((item) => item.id === id);
  if (!message?.undo || message.undone) return;
  setDraftItems(message.undo);
  set({ messages: state.messages.map((item) => (item.id === id ? { ...item, undone: true } : item)) });
}
