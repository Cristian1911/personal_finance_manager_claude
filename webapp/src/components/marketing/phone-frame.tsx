import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div className={`mx-auto w-[280px] shrink-0 ${className ?? ""}`}>
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-z-ink shadow-2xl shadow-black/30">
        {/* Notch */}
        <div className="flex justify-center py-2">
          <div className="h-[5px] w-20 rounded-full bg-white/10" />
        </div>
        {/* Screen */}
        <div className="px-1 pb-2">
          <div className="overflow-hidden rounded-[1.25rem] bg-background">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
