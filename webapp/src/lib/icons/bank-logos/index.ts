import { BancolombiaMark } from "./bancolombia";
import { NuMark } from "./nu";
import { DaviviendaMark } from "./davivienda";
import { FalabellaMark } from "./falabella";
import { BancoBogotaMark } from "./banco-de-bogota";
import { LuloMark } from "./lulo";
import { ConfiarMark } from "./confiar";
import { PopularMark } from "./popular";
import { NequiMark } from "./nequi";

type BrandMark = (props: { className?: string; "aria-hidden"?: boolean }) => React.ReactElement;

export const BANK_LOGOS: Record<string, BrandMark> = {
  bancolombia: BancolombiaMark,
  nu: NuMark,
  davivienda: DaviviendaMark,
  falabella: FalabellaMark,
  "banco-de-bogota": BancoBogotaMark,
  lulo: LuloMark,
  confiar: ConfiarMark,
  popular: PopularMark,
  nequi: NequiMark,
};
