import { View, type ViewProps } from "react-native";
import {
  MOBILE_CARD_CLASS,
  MOBILE_CARD_TIGHT_CLASS,
} from "../../lib/constants/styles";

export function MCard({ className, ...props }: ViewProps) {
  return <View className={`${MOBILE_CARD_CLASS} ${className ?? ""}`} {...props} />;
}

export function MCardTight({ className, ...props }: ViewProps) {
  return (
    <View className={`${MOBILE_CARD_TIGHT_CLASS} ${className ?? ""}`} {...props} />
  );
}

/**
 * 2-column grid using flexbox (CSS Grid not supported in RN).
 * Children should be wrapped in <View> with explicit borders.
 */
export function MCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MCardTight className={className}>
      <View className="flex-row flex-wrap">{children}</View>
    </MCardTight>
  );
}

/** Grid cell — use inside MCardGrid. Provide borders explicitly. */
export function MCardGridCell({
  children,
  className,
  borderRight = false,
  borderBottom = false,
}: {
  children: React.ReactNode;
  className?: string;
  borderRight?: boolean;
  borderBottom?: boolean;
}) {
  return (
    <View
      className={`w-1/2 items-center p-3 ${borderRight ? "border-r border-white-6" : ""} ${borderBottom ? "border-b border-white-6" : ""} ${className ?? ""}`}
    >
      {children}
    </View>
  );
}

export function MListRow({ className, ...props }: ViewProps) {
  return (
    <View
      className={`flex-row items-center justify-between px-3.5 py-2.5 ${className ?? ""}`}
      {...props}
    />
  );
}

export function MCardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`px-3.5 pt-2.5 pb-1.5 ${className ?? ""}`}>
      {children}
    </View>
  );
}
