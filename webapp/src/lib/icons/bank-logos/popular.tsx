import { LetterMark } from "./letter-mark";

export function PopularMark(props: { className?: string; "aria-hidden"?: boolean }) {
  return <LetterMark bg="#007A33" letter="P" {...props} />;
}
