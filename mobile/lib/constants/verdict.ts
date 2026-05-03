import type { ComponentType } from "react";
import {
  Ban,
  Clock,
  ShieldCheck,
  TriangleAlert,
  type LucideProps,
} from "lucide-react-native";
import type { PurchaseDecisionResult } from "@zeta/shared";
import { COLORS } from "./colors";

export type Verdict = PurchaseDecisionResult["verdict"];

export type VerdictMeta = {
  /** Long form label — used in puedo-pagar verdict hero. */
  label: string;
  /** Short form label — used in Deseos row chips. */
  shortLabel: string;
  icon: ComponentType<LucideProps>;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  scoreColor: string;
  border: string;
  narratorTone: "brass" | "sage";
};

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  BUY: {
    label: "Sí, adelante",
    shortLabel: "Adelante",
    icon: ShieldCheck,
    iconColor: COLORS.income,
    badgeBg: "bg-z-income-12",
    badgeText: "text-z-income",
    scoreColor: "text-z-income",
    border: "border-z-income-30",
    narratorTone: "brass",
  },
  BUY_WITH_CAUTION: {
    label: "Sí, con cautela",
    shortLabel: "Con cautela",
    icon: TriangleAlert,
    iconColor: COLORS.alert,
    badgeBg: "bg-z-alert-12",
    badgeText: "text-z-alert",
    scoreColor: "text-z-alert",
    border: "border-z-alert-25",
    narratorTone: "brass",
  },
  WAIT: {
    label: "Mejor espera",
    shortLabel: "Espera",
    icon: Clock,
    iconColor: COLORS.expense,
    badgeBg: "bg-z-expense-12",
    badgeText: "text-z-expense",
    scoreColor: "text-z-expense",
    border: "border-z-expense-30",
    narratorTone: "sage",
  },
  NOT_RECOMMENDED: {
    label: "No recomendado",
    shortLabel: "No",
    icon: Ban,
    iconColor: COLORS.debt,
    badgeBg: "bg-z-debt-12",
    badgeText: "text-z-debt",
    scoreColor: "text-z-debt",
    border: "border-z-debt-30",
    narratorTone: "sage",
  },
};
