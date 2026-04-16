interface BrandMarkProps {
  className?: string;
  "aria-hidden"?: boolean;
}

export function FalabellaMark({ className, "aria-hidden": ariaHidden = true }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={ariaHidden}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="24" rx="5" fill="#00A859" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="14"
        fill="#FFFFFF"
      >
        F
      </text>
    </svg>
  );
}
