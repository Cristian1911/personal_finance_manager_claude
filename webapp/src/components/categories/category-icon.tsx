"use client";

import {
  Award,
  Baby,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Bike,
  Book,
  BookOpen,
  Briefcase,
  Building,
  Bus,
  CalendarCheck,
  Car,
  CarFront,
  Clapperboard,
  ClipboardCheck,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  FileBadge,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HardHat,
  HeartHandshake,
  HeartPulse,
  Home,
  Hospital,
  House,
  Lamp,
  Landmark,
  Laptop,
  MapPin,
  Milestone,
  Package,
  Palette,
  PawPrint,
  Pencil,
  PiggyBank,
  Pill,
  PlusCircle,
  Receipt,
  Repeat,
  School,
  ScrollText,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Sparkles,
  SquareParking,
  Stethoscope,
  Tag,
  Ticket,
  TrendingUp,
  Tv,
  Users,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Maps Lucide icon name strings (stored in DB for system categories) to components */
const ICON_MAP: Record<string, LucideIcon> = {
  // Parent zones
  home: Home,
  house: House,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
  car: Car,
  "car-front": CarFront,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  "shopping-bag": ShoppingBag,
  shield: Shield,
  "shield-check": ShieldCheck,
  "scroll-text": ScrollText,
  briefcase: Briefcase,
  wallet: Wallet,
  "plus-circle": PlusCircle,
  coins: Coins,
  "piggy-bank": PiggyBank,
  "graduation-cap": GraduationCap,
  clapperboard: Clapperboard,
  gamepad2: Gamepad2,
  // Subcategories — Hogar
  building: Building,
  "shopping-cart": ShoppingCart,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  wrench: Wrench,
  lamp: Lamp,
  // Subcategories — Comer Fuera
  bike: Bike,
  coffee: Coffee,
  // Subcategories — Transporte
  bus: Bus,
  fuel: Fuel,
  milestone: Milestone,
  "square-parking": SquareParking,
  // Subcategories — Salud
  hospital: Hospital,
  stethoscope: Stethoscope,
  receipt: Receipt,
  pill: Pill,
  smile: Smile,
  // Subcategories — Seguros
  "heart-handshake": HeartHandshake,
  "hard-hat": HardHat,
  // Subcategories — Obligaciones
  banknote: Banknote,
  "credit-card": CreditCard,
  users: Users,
  landmark: Landmark,
  "map-pin": MapPin,
  "file-badge": FileBadge,
  "clipboard-check": ClipboardCheck,
  // Subcategories — Entretenimiento
  tv: Tv,
  ticket: Ticket,
  palette: Palette,
  repeat: Repeat,
  // Subcategories — Estilo de vida
  shirt: Shirt,
  dumbbell: Dumbbell,
  gift: Gift,
  "paw-print": PawPrint,
  // Subcategories — Educación
  school: School,
  pencil: Pencil,
  "book-open": BookOpen,
  book: Book,
  // Subcategories — Ahorro e Inversión
  "trending-up": TrendingUp,
  "bar-chart-3": BarChart3,
  "calendar-check": CalendarCheck,
  // Subcategories — Ingresos
  laptop: Laptop,
  award: Award,
  "badge-dollar-sign": BadgeDollarSign,
  // Subcategories — Otros ingresos
  package: Package,
  // Generic fallback
  tag: Tag,
  baby: Baby,
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
