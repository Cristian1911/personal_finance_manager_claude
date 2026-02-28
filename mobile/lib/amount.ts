export function parseLocalizedAmount(input: string): number {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (!trimmed) return Number.NaN;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = trimmed
      .split(thousandsSeparator).join("")
      .replace(decimalSeparator, ".");
    return Number(normalized);
  }

  if (lastComma >= 0) {
    const normalized =
      trimmed.includes(",") && trimmed.split(",").length > 2
        ? trimmed.split(",").join("")
        : trimmed.replace(",", ".");
    return Number(normalized);
  }

  if (lastDot >= 0) {
    const normalized =
      trimmed.includes(".") && trimmed.split(".").length > 2
        ? trimmed.split(".").join("")
        : trimmed;
    return Number(normalized);
  }

  return Number(trimmed);
}
