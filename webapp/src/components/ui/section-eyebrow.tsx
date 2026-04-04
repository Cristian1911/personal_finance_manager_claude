import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

interface SectionEyebrowProps extends React.ComponentProps<"p"> {
  children: React.ReactNode;
}

export function SectionEyebrow({
  className,
  children,
  ...props
}: SectionEyebrowProps) {
  return (
    <p
      data-slot="section-eyebrow"
      className={cn(SECTION_EYEBROW_CLASS, className)}
      {...props}
    >
      {children}
    </p>
  );
}
