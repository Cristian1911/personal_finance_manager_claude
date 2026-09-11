import { Pressable, Text, View } from "react-native";
import { Globe } from "lucide-react-native";
import { buildTimeShiftHint, formatDate } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import type { TravelContext } from "../../lib/travel-context";

export type TimeEntryZone = "local" | "colombia";

type Props = {
  travel: TravelContext | null;
  /** The wall clock as stored / as typed, "YYYY-MM-DD" + "HH:mm[:ss]". */
  date: string;
  time: string | null;
  /**
   * Capture mode: which clock the picker is showing. When set, a toggle lets
   * the user switch and the hint explains what will be stored. Omit on
   * read-only surfaces (detail screen), where the clock is always Colombia's.
   */
  entryZone?: TimeEntryZone;
  onEntryZoneChange?: (zone: TimeEntryZone) => void;
};

/**
 * Travelling hint for a transaction clock.
 *
 * Read-only: "12:32 hora Colombia = 14:32 en Buenos Aires (UTC-3, +2 h)".
 * Capture:   the same, plus a Local / Colombia toggle so the user can enter
 *            the time the receipt shows and let the app store the Colombian
 *            equivalent — the correction the traveller actually wants.
 *
 * Renders nothing at home (same offset as Colombia) or without a time.
 */
export function TimeShiftHint({ travel, date, time, entryZone, onEntryZoneChange }: Props) {
  if (!travel?.isAbroad || !travel.timeZone || !time) return null;

  // In "local" entry mode the value is the device clock; express it as the
  // Colombian clock it will be stored as. Otherwise show the local reading.
  const hint =
    entryZone === "local"
      ? buildTimeShiftHint({
          date,
          time,
          deviceTimeZone: "America/Bogota",
          referenceTimeZone: travel.timeZone,
        })
      : buildTimeShiftHint({ date, time, deviceTimeZone: travel.timeZone });
  if (!hint) return null;

  const other = hint.dateShifted
    ? `${hint.localTime} del ${formatDate(hint.localDate, "dd MMM")}`
    : hint.localTime;
  const place = travel.placeLabel ?? hint.deviceLabel;
  const offset = travel.offsetLabel ?? hint.deviceOffsetLabel;
  const diff = entryZone === "local" ? invertDiff(hint.diffLabel) : hint.diffLabel;

  const sentence =
    entryZone === "local"
      ? `${hint.referenceTime} en ${place} se guarda como ${other} hora Colombia`
      : `${hint.referenceTime} hora Colombia = ${other} en ${place}`;

  return (
    <View className="mt-2 gap-2">
      <View className="flex-row items-start gap-1.5">
        <Globe size={12} color={COLORS.brass} style={{ marginTop: 2 }} />
        <Text className="flex-1 text-[11px] font-inter leading-4 text-muted-foreground">
          {sentence}
          <Text className="text-muted-foreground">{`  ·  ${offset} (${diff})`}</Text>
        </Text>
      </View>
      {entryZone && onEntryZoneChange && (
        <View
          className="flex-row self-start rounded-full border border-white-6 bg-black-10 p-0.5"
          accessibilityRole="radiogroup"
          accessibilityLabel="Zona horaria de la hora ingresada"
        >
          {(
            [
              { id: "local", label: `Hora local` },
              { id: "colombia", label: "Hora Colombia" },
            ] as const
          ).map((opt) => {
            const selected = opt.id === entryZone;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onEntryZoneChange(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`rounded-full px-3 py-1 ${selected ? "bg-z-brass-15" : ""}`}
              >
                <Text
                  className={`text-[11px] font-inter-semibold ${
                    selected ? "text-z-brass" : "text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function invertDiff(label: string): string {
  if (label.startsWith("+")) return `-${label.slice(1)}`;
  if (label.startsWith("-")) return `+${label.slice(1)}`;
  return label;
}
