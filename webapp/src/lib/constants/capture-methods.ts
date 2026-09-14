import type { Database } from "@/types/database";

export type CaptureMethod = Database["public"]["Enums"]["transaction_capture_method"];

/** Short Spanish label for where a transaction came from. */
export const CAPTURE_METHOD_LABELS: Record<CaptureMethod, string> = {
  PDF_IMPORT: "Extracto PDF",
  EMAIL_PDF_IMPORT: "PDF por correo",
  EMAIL_IMPORT: "Correo",
  OCR_BATCH: "Pantallazos",
  OCR_SINGLE: "Pantallazo",
  MANUAL_FORM: "Manual",
  TEXT_QUICK_CAPTURE: "Captura rápida",
};

export function captureMethodLabel(method: string | null | undefined): string {
  if (method && method in CAPTURE_METHOD_LABELS) {
    return CAPTURE_METHOD_LABELS[method as CaptureMethod];
  }
  return "Manual";
}
