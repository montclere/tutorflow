import type { Drill } from "../mocks/types";

export type TrainerPhase = "question" | "correct" | "wrong";

export type TrainerState = {
  index: number;
  phase: TrainerPhase;
  solved: number;
  answer: string;
};

export function normalizeAnswer(raw: string): string {
  return raw.trim().replace(",", ".");
}

export function startTrainer(solved: number): TrainerState {
  return { index: 0, phase: "question", solved, answer: "" };
}

export function submitAnswer(state: TrainerState, drills: Drill[], raw: string): TrainerState | null {
  const answer = normalizeAnswer(raw);
  const drill = drills[state.index % drills.length];
  if (!answer || !drill) return null;
  const correct = answer === drill.answer;
  return { ...state, answer, phase: correct ? "correct" : "wrong", solved: state.solved + (correct ? 1 : 0) };
}

export function nextDrill(state: TrainerState): TrainerState {
  return { ...state, index: state.index + 1, phase: "question", answer: "" };
}
