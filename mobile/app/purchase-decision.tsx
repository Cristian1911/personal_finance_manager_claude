import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  formatCurrency,
  type PurchaseDecisionResult,
  type PurchaseFundingType,
  type PurchaseUrgency,
} from "@venti5/shared";
import { getAllAccounts, type AccountRow } from "../lib/repositories/accounts";
import { analyzeLocally } from "../lib/services/purchase-decision";
import { KeyboardScreen } from "../components/common/KeyboardScreen";

const urgencyOptions: { value: PurchaseUrgency; label: string }[] = [
  { value: "NECESSARY", label: "Necesidad" },
  { value: "USEFUL", label: "Util" },
  { value: "IMPULSE", label: "Capricho" },
];

const fundingOptions: { value: PurchaseFundingType; label: string }[] = [
  { value: "ONE_TIME", label: "Pago unico" },
  { value: "INSTALLMENTS", label: "Cuotas" },
];

const verdictMeta: Record<
  PurchaseDecisionResult["verdict"],
  { label: string; bg: string; text: string; border: string }
> = {
  BUY: {
    label: "Si",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  BUY_WITH_CAUTION: {
    label: "Si, pero con cautela",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  WAIT: {
    label: "Mejor espera",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  NOT_RECOMMENDED: {
    label: "No recomendado",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
};

const severityDot: Record<string, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

export default function PurchaseDecisionScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [amount, setAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<PurchaseUrgency>("USEFUL");
  const [fundingType, setFundingType] = useState<PurchaseFundingType>("ONE_TIME");
  const [installments, setInstallments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseDecisionResult | null>(null);

  useEffect(() => {
    getAllAccounts().then((rows) => {
      const payable = rows.filter(
        (r) => r.is_active === 1 && r.account_type !== "LOAN"
      );
      setAccounts(payable);
      if (payable.length > 0 && !selectedAccountId) {
        setSelectedAccountId(payable[0].id);
      }
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    setError(null);
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Ingresa un monto valido");
      return;
    }
    if (!selectedAccountId) {
      setError("Selecciona una cuenta");
      return;
    }

    setLoading(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const res = await analyzeLocally({
        amount: numAmount,
        accountId: selectedAccountId,
        urgency,
        fundingType,
        installments:
          fundingType === "INSTALLMENTS" ? Number(installments) || 1 : null,
        month,
      });
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al analizar la compra"
      );
    } finally {
      setLoading(false);
    }
  }, [amount, selectedAccountId, urgency, fundingType, installments]);

  const meta = result ? verdictMeta[result.verdict] : null;

  return (
    <KeyboardScreen
      title="¿Deberia comprar esto?"
      onBack={() => router.back()}
    >
      {/* Amount */}
      <Text className="text-sm font-inter-medium text-gray-700 mb-1">
        Monto
      </Text>
      <TextInput
        className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900 mb-4"
        placeholder="Ej: 250000"
        placeholderTextColor="#9CA3AF"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      {/* Account picker */}
      <Text className="text-sm font-inter-medium text-gray-700 mb-2">
        Cuenta
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {accounts.map((a) => {
          const selected = a.id === selectedAccountId;
          return (
            <Pressable
              key={a.id}
              onPress={() => setSelectedAccountId(a.id)}
              className={`rounded-full border px-3 py-1.5 ${
                selected
                  ? "border-primary bg-emerald-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-inter-medium ${
                  selected ? "text-primary" : "text-gray-700"
                }`}
              >
                {a.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Urgency */}
      <Text className="text-sm font-inter-medium text-gray-700 mb-2">
        Urgencia
      </Text>
      <View className="flex-row gap-2 mb-4">
        {urgencyOptions.map((opt) => {
          const selected = urgency === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setUrgency(opt.value)}
              className={`flex-1 rounded-xl border py-2.5 items-center ${
                selected
                  ? "border-primary bg-emerald-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-inter-semibold ${
                  selected ? "text-primary" : "text-gray-700"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Funding type */}
      <Text className="text-sm font-inter-medium text-gray-700 mb-2">
        Forma de pago
      </Text>
      <View className="flex-row gap-2 mb-4">
        {fundingOptions.map((opt) => {
          const selected = fundingType === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setFundingType(opt.value)}
              className={`flex-1 rounded-xl border py-2.5 items-center ${
                selected
                  ? "border-primary bg-emerald-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-inter-semibold ${
                  selected ? "text-primary" : "text-gray-700"
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Installments count */}
      {fundingType === "INSTALLMENTS" && (
        <>
          <Text className="text-sm font-inter-medium text-gray-700 mb-1">
            Numero de cuotas
          </Text>
          <TextInput
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900 mb-4"
            placeholder="Ej: 12"
            placeholderTextColor="#9CA3AF"
            value={installments}
            onChangeText={setInstallments}
            keyboardType="numeric"
          />
        </>
      )}

      {/* Error */}
      {error && (
        <View className="rounded-xl border border-red-200 bg-red-50 p-3 mb-4">
          <Text className="text-sm text-red-700 font-inter">{error}</Text>
        </View>
      )}

      {/* Analyze button */}
      <Pressable
        onPress={handleAnalyze}
        disabled={loading}
        className={`rounded-xl py-3.5 items-center mb-6 ${
          loading ? "bg-emerald-400" : "bg-primary active:bg-emerald-700"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-inter-bold text-base">
            Analizar
          </Text>
        )}
      </Pressable>

      {/* Results */}
      {result && meta && (
        <View className="gap-4">
          {/* Verdict */}
          <View
            className={`rounded-2xl border p-4 ${meta.bg} ${meta.border}`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View
                className={`rounded-full border px-3 py-1 ${meta.bg} ${meta.border}`}
              >
                <Text className={`text-sm font-inter-bold ${meta.text}`}>
                  {meta.label}
                </Text>
              </View>
              <Text className={`text-2xl font-inter-bold ${meta.text}`}>
                {result.score}/100
              </Text>
            </View>
            <Text className="text-sm font-inter text-gray-700">
              {result.summary}
            </Text>
          </View>

          {/* Metrics grid */}
          <View className="rounded-2xl bg-white border border-gray-100 p-4">
            <Text className="text-sm font-inter-semibold text-gray-900 mb-3">
              Impacto financiero
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <MetricTile
                label="Desembolso inicial"
                value={formatCurrency(result.metrics.effectiveImmediateImpact)}
              />
              <MetricTile
                label="Colchón de liquidez"
                value={formatCurrency(result.metrics.projectedLiquidBuffer)}
              />
              <MetricTile
                label="Colchón recomendado"
                value={formatCurrency(result.metrics.recommendedBuffer)}
              />
              <MetricTile
                label="Flujo libre mensual"
                value={formatCurrency(result.metrics.monthlyFreeCashflow)}
              />
              {result.metrics.estimatedMonthlyInstallment > 0 && (
                <MetricTile
                  label="Cuota estimada"
                  value={formatCurrency(
                    result.metrics.estimatedMonthlyInstallment
                  )}
                />
              )}
              {result.metrics.selectedAccountUtilizationAfter != null && (
                <MetricTile
                  label="Uso del cupo después"
                  value={`${result.metrics.selectedAccountUtilizationAfter.toFixed(0)}%`}
                />
              )}
            </View>
          </View>

          {/* Reasons */}
          {result.reasons.length > 0 && (
            <View className="rounded-2xl bg-white border border-gray-100 p-4">
              <Text className="text-sm font-inter-semibold text-gray-900 mb-3">
                Por que
              </Text>
              <View className="gap-3">
                {result.reasons.map((r, i) => (
                  <View key={i} className="flex-row gap-2">
                    <View
                      className={`mt-1.5 h-2 w-2 rounded-full ${severityDot[r.severity]}`}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-inter-semibold text-gray-900">
                        {r.title}
                      </Text>
                      <Text className="text-xs font-inter text-gray-500 mt-0.5">
                        {r.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <View className="rounded-2xl bg-white border border-gray-100 p-4">
              <Text className="text-sm font-inter-semibold text-gray-900 mb-3">
                Que podrias hacer en vez
              </Text>
              <View className="gap-3">
                {result.alternatives.map((a, i) => (
                  <View key={i}>
                    <Text className="text-sm font-inter-semibold text-gray-900">
                      {a.title}
                    </Text>
                    <Text className="text-xs font-inter text-gray-500 mt-0.5">
                      {a.detail}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </KeyboardScreen>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="w-[47%] rounded-xl bg-gray-50 border border-gray-100 p-3">
      <Text className="text-[10px] font-inter text-gray-500 uppercase">
        {label}
      </Text>
      <Text className="text-sm font-inter-bold text-gray-900 mt-0.5">
        {value}
      </Text>
    </View>
  );
}
