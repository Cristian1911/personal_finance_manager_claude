import { useLocalSearchParams } from "expo-router";
import { DestinatarioDetail } from "../../../components/destinatarios/DestinatarioDetail";

export default function DestinatarioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DestinatarioDetail id={id!} />;
}
