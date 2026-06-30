import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { RecurrenceFrequency } from "@zeta/shared";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { COLORS } from "../../lib/constants/colors";
import { useAuth } from "../../lib/auth";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { getAllCategories, type CategoryRow } from "../../lib/repositories/categories";
import {
  getAllDestinatarios,
  type DestinatarioWithCount,
} from "../../lib/repositories/destinatarios";
import { createRecurringTemplate } from "../../lib/repositories/recurring";
import {
  RecurringForm,
  type RecurringFormValues,
} from "../../components/recurrentes/RecurringForm";

export default function NewRecurrenteScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [destinatarios, setDestinatarios] = useState<DestinatarioWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, c, d] = await Promise.all([
        getAllAccounts(),
        getAllCategories(),
        getAllDestinatarios(),
      ]);
      setAccounts(a);
      setCategories(c);
      setDestinatarios(d);
    } catch (error) {
      console.error("Failed to load recurrente form data:", error);
      Alert.alert(
        "Error",
        "No se pudieron cargar los datos para crear la recurrente."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSubmit = useCallback(
    async (values: RecurringFormValues) => {
      if (!session?.user?.id) return;
      setSaving(true);
      try {
        const account = accounts.find((a) => a.id === values.account_id);
        await createRecurringTemplate({
          user_id: session.user.id,
          account_id: values.account_id,
          amount: values.amount,
          currency_code: values.currency_code,
          direction: values.direction,
          frequency: values.frequency as RecurrenceFrequency,
          start_date: values.start_date,
          end_date: values.end_date,
          merchant_name: values.merchant_name,
          description: values.description,
          category_id: values.category_id,
          destinatario_id: values.destinatario_id,
          transfer_source_account_id: values.transfer_source_account_id,
          account_type: account?.account_type ?? null,
        });
        router.back();
      } catch (error) {
        console.error("Failed to create recurrente:", error);
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo crear la recurrente."
        );
        setSaving(false);
      }
    },
    [accounts, session?.user?.id, router]
  );

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Nueva recurrente" />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <RecurringForm
          accounts={accounts}
          categories={categories}
          destinatarios={destinatarios}
          submitLabel="Crear recurrente"
          saving={saving}
          onSubmit={handleSubmit}
        />
      )}
    </View>
  );
}
