import type { CurrencyCode } from "@/types/domain";

export const CURRENCIES: {
  code: CurrencyCode;
  name: string;
  name_es: string;
}[] = [
  { code: "COP", name: "Colombian Peso", name_es: "Peso Colombiano" },
  { code: "USD", name: "US Dollar", name_es: "Dólar Estadounidense" },
  { code: "BRL", name: "Brazilian Real", name_es: "Real Brasileño" },
  { code: "MXN", name: "Mexican Peso", name_es: "Peso Mexicano" },
  { code: "EUR", name: "Euro", name_es: "Euro" },
  { code: "PEN", name: "Peruvian Sol", name_es: "Sol Peruano" },
  { code: "CLP", name: "Chilean Peso", name_es: "Peso Chileno" },
  { code: "ARS", name: "Argentine Peso", name_es: "Peso Argentino" },
];
