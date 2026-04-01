import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandIconProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function BrandIcon({
  className,
  imageClassName,
  priority = false,
}: BrandIconProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src="/zeta-logo.png"
        alt="Zeta"
        fill
        priority={priority}
        sizes="(max-width: 768px) 40px, 48px"
        className={cn("object-contain", imageClassName)}
      />
    </div>
  );
}
