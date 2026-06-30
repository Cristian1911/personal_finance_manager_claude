import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { RecurrenceFrequency, TransactionDirection } from "@zeta/shared";
import { MobileHeader } from "../../../components/ui/MobileHeader";
import { COLORS } from "../../../lib/constants/colors";
import { useAuth } from "../../../lib/auth";
import { getAllAccounts, type AccountRow } from "../../../lib/repositories/accounts";
import {
  getAllCategories,
  type CategoryRow,
} from "../../../lib/repositories/categories";
import {
  getAllDestinatarios,
  type DestinatarioWithCount,
} from "../../../lib/repositories/destinatarios";
import {
  getTemplateById,
  updateRecurringTemplate,
} from "../../../lib/repositories/recurring";
import {
  RecurringForm,
  type RecurringFormValues,
} from "../../../components/recurrentes/RecurringForm";

export default function EditRecurrenteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [destinatarios, setDestinatarios] = useState<DestinatarioWithCount[]>([]);
  const [initial, setInitial] = useState<Partial<RecurringFormValues> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [a, c, d, tpl] = await Promise.all([
        getAllAccounts(),
        getAllCategories(),
        getAllDestinatarios(),
        getTemplateById(id),
      ]);
      setAccounts(a);
      setCategories(c);
      setDestinatarios(d);
      if (!tpl) {
        Alert.alert("Error", "No se encontró la recurrente.");
        router.back();
        return;
      }
      setInitial({
        merchant_name: tpl.merchant_name ?? "",
        direction: tpl.direction as TransactionDirection,
        amount: tpl.amount,
        account_id: tpl.account_id,
        currency_code: tpl.currency_code,
        frequency: tpl.frequency,
        start_date: tpl.start_date,
        end_date: tpl.end_date,
        category_id: tpl.category_id,
        destinatario_id: tpl.destinatario_id,
        transfer_source_account_id: tpl.transfer_source_account_id,
        description: tpl.description,
        day_of_month: tpl.day_of_month,
        day_of_week: tpl.day_of_week,
      });
    } catch (error) {
      console.error("Failed to load recurrente:", error);
      Alert.alert("Error", "No se pudo cargar la recurrente.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSubmit = useCallback(
    async (values: RecurringFormValues) => {
      if (!session?.user?.id || !id) return;
      setSaving(true);
      try {
        const account = accounts.find((a) => a.id === values.account_id);
        await updateRecurringTemplate(id, {
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
          day_of_month: values.day_of_month,
          day_of_week: values.day_of_week,
          account_type: account?.account_type ?? null,
        });
        router.back();
      } catch (error) {
        console.error("Failed to update recurrente:", error);
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la recurrente."
        );
        setSaving(false);
      }
    },
    [accounts, session?.user?.id, id, router]
  );

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Editar recurrente" />
      {loading || !initial ? (
        <View
          className="flex-1 items-center justify-center"
          accessibilityLabel="Cargando recurrente"
        >
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <RecurringForm
          key={id}
          accounts={accounts}
          categories={categories}
          destinatarios={destinatarios}
          initial={initial}
          submitLabel="Actualizar"
          saving={saving}
          onSubmit={handleSubmit}
        />
      )}
    </View>
  );
}
