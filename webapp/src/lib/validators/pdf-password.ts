import { z } from "zod";
import { uuidStr } from "./shared";

const SCOPES = ["global", "bank", "account"] as const;

export const pdfPasswordSchema = z
  .object({
    alias: z.string().min(1, "El alias es requerido").max(60),
    password: z.string().min(1, "La contraseña es requerida").max(200),
    scope: z.enum(SCOPES),
    bank_key: z
      .string()
      .max(40)
      .optional()
      .nullable()
      .transform((v) => v || null),
    account_id: uuidStr()
      .optional()
      .nullable()
      .transform((v) => v || null),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "account" && !data.account_id) {
      ctx.addIssue({
        code: "custom",
        path: ["account_id"],
        message: "Selecciona una cuenta",
      });
    }
    if (data.scope === "bank" && !data.bank_key) {
      ctx.addIssue({
        code: "custom",
        path: ["bank_key"],
        message: "Selecciona un banco",
      });
    }
    if (data.scope !== "account" && data.account_id) {
      ctx.addIssue({
        code: "custom",
        path: ["account_id"],
        message: "La cuenta solo aplica para alcance por cuenta",
      });
    }
    if (data.scope !== "bank" && data.bank_key) {
      ctx.addIssue({
        code: "custom",
        path: ["bank_key"],
        message: "El banco solo aplica para alcance por banco",
      });
    }
  });

export const pdfPasswordUpdateSchema = z
  .object({
    id: uuidStr(),
    alias: z.string().min(1).max(60).optional(),
    password: z.string().min(1).max(200).optional(),
  })
  .refine((d) => d.alias || d.password, {
    message: "Nada que actualizar",
  });

export type PdfPasswordFormData = z.infer<typeof pdfPasswordSchema>;
export type PdfPasswordScope = (typeof SCOPES)[number];
