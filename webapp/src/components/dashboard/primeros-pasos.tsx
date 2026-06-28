import { getFirstStepsData } from "@/actions/guided-experience";
import { PrimerosPasosCard } from "./primeros-pasos-card";

/**
 * Server wrapper for the guided-experience "Primeros pasos" card (D2).
 * Renders nothing once the user is activated / has dismissed or snoozed it.
 */
export async function PrimerosPasos() {
  const data = await getFirstStepsData();
  if (!data) return null;
  return <PrimerosPasosCard data={data} />;
}
