import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "../../../..");

export const getDesignTokensSchema = {
  section: z
    .enum(["all", "tokens", "design"])
    .optional()
    .describe("Qué archivo(s) leer (por defecto: all)"),
};

export const getDesignTokensDescription =
  "Lee los design tokens de Zeta (TOKENS.md) y la guía de sistema de diseño (DESIGN.md).";

export function getDesignTokensHandler(args: {
  section?: "all" | "tokens" | "design";
}) {
  const section = args.section ?? "all";
  const content: Array<{ type: "text"; text: string }> = [];

  if (section === "all" || section === "tokens") {
    try {
      const tokens = readFileSync(
        join(PROJECT_ROOT, "docs/design-system/TOKENS.md"),
        "utf-8"
      );
      content.push({ type: "text", text: `# TOKENS.md\n\n${tokens}` });
    } catch {
      content.push({ type: "text", text: "TOKENS.md no encontrado" });
    }
  }

  if (section === "all" || section === "design") {
    try {
      const design = readFileSync(
        join(PROJECT_ROOT, "webapp/DESIGN.md"),
        "utf-8"
      );
      content.push({ type: "text", text: `# DESIGN.md\n\n${design}` });
    } catch {
      content.push({ type: "text", text: "DESIGN.md no encontrado" });
    }
  }

  return { content };
}
