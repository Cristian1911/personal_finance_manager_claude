"use client";

import { Globe } from "lucide-react";
import { buildTimeShiftHint, localWallTimeToColombia } from "@zeta/shared";
import { useDeviceTimeZone } from "@/hooks/use-device-timezone";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

interface TimeShiftHintProps {
  /** "YYYY-MM-DD" as stored (Colombian calendar day). */
  date: string;
  /** "HH:mm[:ss]" as stored (Colombian clock). Nothing renders without it. */
  time: string | null | undefined;
  /**
   * When provided, offers "Usar hora local": treats the typed time as the
   * device-zone clock and hands back the equivalent Colombian date + time.
   * Omit on read-only surfaces.
   */
  onApplyLocal?: (next: { date: string; time: string }) => void;
  className?: string;
}

/**
 * Shows how a Colombian wall clock reads where the phone currently is
 * ("14:32 en Buenos Aires · UTC-3 · +2 h"). Renders nothing when the device
 * is on Colombia's offset, so it only appears while travelling.
 */
export function TimeShiftHint({ date, time, onApplyLocal, className }: TimeShiftHintProps) {
  const deviceTimeZone = useDeviceTimeZone();
  const hint = buildTimeShiftHint({ date, time, deviceTimeZone });
  if (!hint) return null;

  const local = hint.dateShifted
    ? `${hint.localTime} del ${formatDate(hint.localDate, "dd MMM")}`
    : hint.localTime;

  function applyLocal() {
    if (!onApplyLocal || !deviceTimeZone || !time) return;
    const next = localWallTimeToColombia(date, time.slice(0, 5), deviceTimeZone);
    if (next) onApplyLocal(next);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-muted-foreground",
        className,
      )}
      role="note"
    >
      <Globe className="size-3 shrink-0 text-z-brass" aria-hidden />
      <span>
        <span className="tabular-nums">{hint.referenceTime}</span> hora Colombia ={" "}
        <span className="tabular-nums text-z-sage-light">{local}</span> en {hint.deviceLabel}
      </span>
      <span className="text-white/25">·</span>
      <span className="tabular-nums">
        {hint.deviceOffsetLabel} ({hint.diffLabel})
      </span>
      {onApplyLocal && (
        <>
          <span className="text-white/25">·</span>
          <button
            type="button"
            onClick={applyLocal}
            className="font-medium text-z-brass underline-offset-2 hover:underline"
          >
            Ingresé la hora local
          </button>
        </>
      )}
    </div>
  );
}
