import type { ChatMessage } from "../mocks/types";

export function appendExchange(
  messages: ChatMessage[],
  request: string,
  reply: (request: string) => string,
): ChatMessage[] | null {
  const text = request.trim();
  if (!text) return null;
  return [...messages, { author: "me", text }, { author: "ai", text: reply(text) }];
}
