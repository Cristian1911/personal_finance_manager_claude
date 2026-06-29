import { Text } from "react-native";
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
} from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";

/** Maps Lucide icon name strings (stored in DB for system categories) to RN
 * components. Mirrors the webapp `category-icon.tsx` ICON_MAP exactly so both
 * platforms render the same icon for a given category. */
const ICON_MAP: Record<string, LucideIcon> = {
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
  building: Building,
  "shopping-cart": ShoppingCart,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  wrench: Wrench,
  lamp: Lamp,
  bike: Bike,
  coffee: Coffee,
  bus: Bus,
  fuel: Fuel,
  milestone: Milestone,
  "square-parking": SquareParking,
  hospital: Hospital,
  stethoscope: Stethoscope,
  receipt: Receipt,
  pill: Pill,
  smile: Smile,
  "heart-handshake": HeartHandshake,
  "hard-hat": HardHat,
  banknote: Banknote,
  "credit-card": CreditCard,
  users: Users,
  landmark: Landmark,
  "map-pin": MapPin,
  "file-badge": FileBadge,
  "clipboard-check": ClipboardCheck,
  tv: Tv,
  ticket: Ticket,
  palette: Palette,
  repeat: Repeat,
  shirt: Shirt,
  dumbbell: Dumbbell,
  gift: Gift,
  "paw-print": PawPrint,
  school: School,
  pencil: Pencil,
  "book-open": BookOpen,
  book: Book,
  "trending-up": TrendingUp,
  "bar-chart-3": BarChart3,
  "calendar-check": CalendarCheck,
  laptop: Laptop,
  award: Award,
  "badge-dollar-sign": BadgeDollarSign,
  package: Package,
  tag: Tag,
  baby: Baby,
};

/** Lucide names are lowercase ASCII with optional hyphens; anything else (a
 * user-created category) is an emoji. */
function isEmoji(str: string): boolean {
  return !/^[a-z][a-z0-9-]*$/.test(str);
}

interface CategoryIconProps {
  icon: string;
  size?: number;
  color?: string;
}

/**
 * Renders a category icon — handles both Lucide icon names (system categories)
 * and emojis (user-created categories). The RN mirror of the webapp CategoryIcon;
 * fixes the bug where the raw icon-name string was printed as text.
 */
export function CategoryIcon({ icon, size = 16, color = COLORS.sageDark }: CategoryIconProps) {
  if (isEmoji(icon)) {
    return <Text style={{ fontSize: size }}>{icon}</Text>;
  }
  const LucideComp = ICON_MAP[icon] ?? Tag;
  return <LucideComp size={size} color={color} />;
}
