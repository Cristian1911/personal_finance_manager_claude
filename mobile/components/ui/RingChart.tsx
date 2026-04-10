import { View, Text } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { COLORS } from "../../lib/constants/colors";

interface RingChartProps {
  percentage: number;
  color?: string;
  /** Outer dimension in px. Default 48. */
  size?: number;
  label?: string;
}

export function RingChart({
  percentage,
  color = COLORS.income,
  size = 48,
  label,
}: RingChartProps) {
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const offset = Math.round((circumference - (clamped / 100) * circumference) * 100) / 100;

  return (
    <View className="items-center">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={COLORS.ringTrack} strokeWidth={4}
        />
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
        <SvgText
          x={cx} y={cy + 4}
          textAnchor="middle"
          fill={COLORS.foreground}
          fontSize={size * 0.23}
          fontWeight="bold"
        >
          {clamped}%
        </SvgText>
      </Svg>
      {label && (
        <Text className="mt-1 text-[9px] font-inter-semibold text-muted-foreground text-center">
          {label}
        </Text>
      )}
    </View>
  );
}
