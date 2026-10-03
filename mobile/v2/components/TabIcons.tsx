import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The tab bar's icons in two states: outline when the tab is off, filled when
 * it's the one you're in (owner choice, option D: no container around the
 * icon). Same 24-unit grid and shapes as Lucide's Home/List/Calendar/Inbox,
 * so the outline versions match the rest of the app. `cut` is the bar's own
 * color: the details punched out of a filled shape (door, calendar rule, tray).
 */
export type TabIconName = "home" | "list" | "calendar" | "inbox";

export function TabIcon({ name, filled, color, cut, size = 21 }: {
  name: TabIconName;
  filled: boolean;
  color: string;
  cut: string;
  size?: number;
}) {
  const line = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && (filled ? (
        <>
          <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M10 21v-6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6z" fill={cut} />
        </>
      ) : (
        <>
          <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" {...line} />
          <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...line} />
        </>
      ))}
      {name === "list" && (filled ? (
        <>
          {[6, 12, 18].map((y) => (
            <Rect key={y} x={7.5} y={y - 1.6} width={14} height={3.2} rx={1.6} fill={color} />
          ))}
          {[6, 12, 18].map((y) => <Circle key={y} cx={3.4} cy={y} r={1.7} fill={color} />)}
        </>
      ) : (
        <Path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13" {...line} />
      ))}
      {name === "calendar" && (filled ? (
        <>
          <Rect x={3} y={4} width={18} height={18} rx={2.5} fill={color} />
          <Path d="M8 2v4M16 2v4" {...line} />
          <Path d="M3.5 10h17" stroke={cut} strokeWidth={1.8} />
          <Rect x={7} y={13.5} width={3} height={3} rx={0.8} fill={cut} />
        </>
      ) : (
        <>
          <Path d="M8 2v4M16 2v4" {...line} />
          <Rect x={3} y={4} width={18} height={18} rx={2} {...line} />
          <Path d="M3 10h18" {...line} />
        </>
      ))}
      {name === "inbox" && (filled ? (
        <>
          <Path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M3 12h5l2 3h4l2-3h5" stroke={cut} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        <>
          <Path d="M22 12h-6l-2 3h-4l-2-3H2" {...line} />
          <Path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" {...line} />
        </>
      ))}
    </Svg>
  );
}
