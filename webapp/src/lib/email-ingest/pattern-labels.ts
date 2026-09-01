import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building,
  CalendarClock,
  CreditCard,
  Mail,
  QrCode,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";

export type EmailPatternLabel = { label: string; icon: LucideIcon };

/**
 * Human label + icon for every alert family the Bancolombia email parser
 * emits. Shared by every surface that lists queued email transactions so the
 * same alert never reads differently between the desktop card, the mobile
 * Herramientas panel and the /import/correo inbox.
 */
export const EMAIL_PATTERN_LABELS: Record<
  ParsedEmailTransaction["pattern_type"],
  EmailPatternLabel
> = {
  retiro: { label: "Retiro ATM", icon: Banknote },
  compra_debito: { label: "Compra débito", icon: CreditCard },
  compra_credito: { label: "Compra crédito", icon: CreditCard },
  compra_asociada: { label: "Compra", icon: CreditCard },
  transferencia: { label: "Transferencia", icon: ArrowUpRight },
  boton_bancolombia: { label: "Botón Bancolombia", icon: Building },
  qr_transferencia: { label: "Transferencia QR", icon: QrCode },
  qr_pago: { label: "Pago QR", icon: QrCode },
  qr_recibido: { label: "QR recibido", icon: QrCode },
  pago_pse: { label: "Pago PSE", icon: Building },
  bre_b: { label: "Bre-B", icon: Wallet },
  pago_recibido: { label: "Pago recibido", icon: ArrowDownLeft },
  pago_recibido_cuenta: { label: "Pago recibido", icon: ArrowDownLeft },
  nomina: { label: "Nómina", icon: Banknote },
  avance: { label: "Avance", icon: CreditCard },
  transferencia_recibida: { label: "Transferencia recibida", icon: ArrowDownLeft },
  transferencia_recibida_llave: { label: "Transferencia recibida", icon: ArrowDownLeft },
  recarga: { label: "Recarga", icon: Smartphone },
  factura_programada: { label: "Factura programada", icon: CalendarClock },
};

export function getEmailPatternLabel(patternType: string): EmailPatternLabel {
  return (
    (EMAIL_PATTERN_LABELS as Record<string, EmailPatternLabel>)[patternType] ?? {
      label: patternType,
      icon: Mail,
    }
  );
}
