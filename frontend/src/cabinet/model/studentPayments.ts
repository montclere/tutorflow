import type { PaymentMove } from "../mocks/types";

export type PaymentFilter = "all" | "payment" | "lesson";

export function paymentHistory(moves: PaymentMove[], filter: PaymentFilter): PaymentMove[] {
  return moves.filter((move) => filter === "all" || (filter === "payment" ? move.amount > 0 : move.amount < 0)).sort((a, b) => b.date.localeCompare(a.date));
}
