import { cn } from "@/lib/utils";
import {
  MOBILE_CARD_CLASS,
  MOBILE_CARD_TIGHT_CLASS,
} from "@/lib/constants/styles";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function MCard({ className, ...props }: CardProps) {
  return <div className={cn(MOBILE_CARD_CLASS, className)} {...props} />;
}

export function MCardTight({ className, ...props }: CardProps) {
  return <div className={cn(MOBILE_CARD_TIGHT_CLASS, className)} {...props} />;
}

export function MCardGrid({ children, className }: CardProps) {
  return (
    <MCardTight className={className}>
      <div className="grid grid-cols-2 [&>*]:p-3 [&>*]:text-center [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b [&>*]:border-white/4">
        {children}
      </div>
    </MCardTight>
  );
}

export function MListRow({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3.5 py-2.5 [&+&]:border-t [&+&]:border-white/4",
        className,
      )}
      {...props}
    />
  );
}

export function MCardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("px-3.5 pt-2.5 pb-1.5", className)}>{children}</div>
  );
}
