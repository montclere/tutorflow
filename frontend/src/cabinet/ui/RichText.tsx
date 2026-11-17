import type { Rich } from "../mocks/types";

export function RichText({ parts }: { parts: Rich }) {
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === "string") return part;
        if ("sup" in part) return <sup key={index}>{part.sup}</sup>;
        return <sub key={index}>{part.sub}</sub>;
      })}
    </>
  );
}
