"use client";

import {
  Home,
  Utensils,
  Car,
  HeartPulse,
  Sparkles,
  Shield,
  Briefcase,
  PlusCircle,
  Tag,
  GraduationCap,
  Baby,
  Gamepad2,
  Coffee,
  TrendingUp,
  Landmark,
  CreditCard,
  Gift,
  Smartphone,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Maps Lucide icon name strings (stored in DB for system categories) to components */
const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  shield: Shield,
  briefcase: Briefcase,
  "plus-circle": PlusCircle,
  tag: Tag,
  "graduation-cap": GraduationCap,
  baby: Baby,
  gamepad2: Gamepad2,
  coffee: Coffee,
  "trending-up": TrendingUp,
  landmark: Landmark,
  "credit-card": CreditCard,
  gift: Gift,
  smartphone: Smartphone,
  wrench: Wrench,
};

/** Returns true if the string is an emoji (not a Lucide icon name) */
function isEmoji(str: string): boolean {
  // Emojis are typically 1-2 chars with high code points, or use combining marks
  // Lucide names are always lowercase ASCII with optional hyphens
  return !/^[a-z][a-z0-9-]*$/.test(str);
}

interface CategoryIconProps {
  icon: string;
  className?: string;
}

/**
 * Renders a category icon — handles both Lucide icon names (system categories)
 * and emojis (user-created categories via the IconPicker).
 */
export function CategoryIcon({ icon, className }: CategoryIconProps) {
  if (isEmoji(icon)) {
    return <span className={className}>{icon}</span>;
  }

  const LucideComp = ICON_MAP[icon] ?? Tag;
  return <LucideComp className={className} />;
}

/**
 * Get the Lucide component for a given icon string, or null if it's an emoji.
 * Use this when you need the component reference (e.g., for inline rendering
 * where you don't want a wrapper span).
 */
export function getLucideIcon(icon: string): LucideIcon | null {
  if (isEmoji(icon)) return null;
  return ICON_MAP[icon] ?? Tag;
}
