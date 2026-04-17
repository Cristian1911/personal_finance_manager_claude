interface LetterMarkProps {
  bg: string;
  letter: string;
  fill?: string;
  className?: string;
  "aria-hidden"?: boolean;
}

export function LetterMark({
  bg,
  letter,
  fill = "#FFFFFF",
  className,
  "aria-hidden": ariaHidden = true,
}: LetterMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={ariaHidden}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="5" fill={bg} />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill={fill}
      >
        {letter}
      </text>
    </svg>
  );
}
