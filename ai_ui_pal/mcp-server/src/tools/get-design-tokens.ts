import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";

// Cache file contents after first read — these are static docs
let tokensCache: string | null = null;
let designCache: string | null = null;

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
      tokensCache ??= readFileSync(join(PROJECT_ROOT, "docs/design-system/TOKENS.md"), "utf-8");
      content.push({ type: "text", text: `# TOKENS.md\n\n${tokensCache}` });
    } catch {
      content.push({ type: "text", text: "TOKENS.md no encontrado" });
    }
  }

  if (section === "all" || section === "design") {
    try {
      designCache ??= readFileSync(join(PROJECT_ROOT, "webapp/DESIGN.md"), "utf-8");
      content.push({ type: "text", text: `# DESIGN.md\n\n${designCache}` });
    } catch {
      content.push({ type: "text", text: "DESIGN.md no encontrado" });
    }
  }

  return { content };
}
