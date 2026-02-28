import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  Upload,
  FileText,
  CheckCircle,
  Square,
  CheckSquare,
  ChevronDown,
} from "lucide-react-native";
import { formatCurrency, type ReconciliationCandidate } from "@venti5/shared";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  type AccountRow,
} from "../../lib/repositories/accounts";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import {
  applyReconciliationMerge,
  createTransaction,
  getReconciliationCandidateById,
  getReconciliationCandidates,
} from "../../lib/repositories/transactions";
import {
  DEBT_PAYMENT_CATEGORY_ID,
  isDebtInflow,
} from "../../lib/transaction-semantics";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  balance?: number | null;
  currency?: string;
};

type ParsedStatement = {
  bank: string;
  statement_type: string;
  account_number?: string | null;
  card_last_four?: string | null;
  currency: string;
  transactions: ParsedTransaction[];
};

type Step = "pick" | "review" | "reconcile" | "result";
type ReviewChoice = "MERGE" | "KEEP_BOTH";

type ReconciliationPreviewItem = {
  importIndex: number;
  transaction: ParsedTransaction;
  candidate: ReconciliationCandidate;
  score: number;
  decision: "AUTO_MERGE" | "REVIEW";
};

type ReconciliationPreview = {
  autoMerge: ReconciliationPreviewItem[];
  review: ReconciliationPreviewItem[];
  unmatched: Array<{
    importIndex: number;
    transaction: ParsedTransaction;
  }>;
};

function AccountSelector({
  accounts,
  selected,
  onSelect,
}: {
  accounts: AccountRow[];
  selected: AccountRow | null;
  onSelect: (account: AccountRow) => void;
}) {
  const [open, setOpen] = useState(false);

  if (accounts.length === 0) {
    return (
      <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <Text className="text-amber-800 font-inter-medium text-sm">
          No tienes cuentas registradas.
        </Text>
        <Text className="text-amber-700 font-inter text-xs mt-1">
          Crea una cuenta primero en la pestana Cuentas.
        </Text>
      </View>
    );
  }

  const typeDef = selected
    ? ACCOUNT_TYPES.find((t) => t.value === selected.account_type)
    : null;
  const Icon = typeDef?.icon;
  const color = selected?.color ?? "#6B7280";

  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-inter-medium text-sm mb-1.5">
        Cuenta de destino <Text className="text-red-500">*</Text>
      </Text>
      <Pressable
        className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex-row items-center active:bg-gray-100"
        onPress={() => setOpen(!open)}
      >
        {selected && Icon ? (
          <>
            <View
              className="w-7 h-7 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: color + "20" }}
            >
              <Icon size={14} color={color} />
            </View>
            <Text className="flex-1 text-gray-900 font-inter-medium text-sm">
              {selected.name}
            </Text>
          </>
        ) : (
          <Text className="flex-1 text-gray-400 font-inter text-sm">
            Seleccionar cuenta...
          </Text>
        )}
        <ChevronDown size={16} color="#9CA3AF" />
      </Pressable>

      {open && (
        <View className="bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden">
          {accounts.map((account, index) => {
            const aTypeDef = ACCOUNT_TYPES.find(
              (t) => t.value === account.account_type
            );
            const AIcon = aTypeDef?.icon;
            const aColor = account.color ?? "#6B7280";
            return (
              <Pressable
                key={account.id}
                className={`flex-row items-center px-4 py-3 active:bg-gray-100 ${
                  index > 0 ? "border-t border-gray-100" : ""
                }`}
                onPress={() => {
                  onSelect(account);
                  setOpen(false);
                }}
              >
                <View
                  className="w-7 h-7 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: aColor + "20" }}
                >
                  {AIcon && <AIcon size={14} color={aColor} />}
                </View>
                <Text className="flex-1 text-gray-900 font-inter-medium text-sm">
                  {account.name}
                </Text>
                {selected?.id === account.id && (
                  <CheckSquare size={16} color="#047857" />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function ImportScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [step, setStep] = useState<Step>("pick");
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStatement | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);
  const [reconciliationPreview, setReconciliationPreview] =
    useState<ReconciliationPreview | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<Record<number, ReviewChoice>>({});
  const [importSummary, setImportSummary] = useState({
    autoMerged: 0,
    manualMerged: 0,
    leftAsSeparate: 0,
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const result = await getAllAccounts();
        setAccounts(result);
      })();
    }, [])
  );

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setDocument(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  }, []);

  const handleParse = useCallback(async () => {
    if (!document) return;
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: document.uri,
        name: document.name || "statement.pdf",
        type: "application/pdf",
      } as any);

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      const response = await fetch(`${API_URL}/api/parse-statement`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Parse failed: ${response.status}`);
      }

      const data = await response.json();
      const statements: ParsedStatement[] =
        data.statements ?? (Array.isArray(data) ? data : []);
      const stmt = statements[0];

      if (!stmt) {
        throw new Error("No se encontro informacion en el extracto");
      }

      if (!stmt.transactions?.length) {
        const typeLabel =
          stmt.statement_type === "loan"
            ? "prestamo"
            : stmt.statement_type === "credit_card"
              ? "tarjeta de credito"
              : "extracto";
        throw new Error(
          `Este ${typeLabel} no contiene transacciones para importar`
        );
      }

      setParsedData(stmt);
      const allIndices = new Set(
        stmt.transactions.map((_: ParsedTransaction, i: number) => i)
      );
      setSelected(allIndices);

      // Auto-match or auto-create an account from statement metadata
      if (session?.user?.id) {
        const typeMap: Record<string, string> = {
          savings: "CHECKING",
          credit_card: "CREDIT_CARD",
          loan: "LOAN",
        };
        const accountType = typeMap[stmt.statement_type] ?? "CHECKING";
        const currentAccounts = await getAllAccounts();
        setAccounts(currentAccounts);

        const match = currentAccounts.find(
          (a) =>
            a.institution_name?.toLowerCase() === stmt.bank?.toLowerCase() &&
            a.account_type === accountType
        );

        if (match) {
          setSelectedAccount(match);
        } else {
          // Build a name from statement data
          let name: string;
          if (stmt.card_last_four) {
            name = `${stmt.bank} ****${stmt.card_last_four}`;
          } else if (stmt.account_number) {
            name = `${stmt.bank} ${stmt.account_number}`;
          } else {
            const label =
              accountType === "CREDIT_CARD"
                ? "TC"
                : accountType === "LOAN"
                  ? "Préstamo"
                  : "Ahorros";
            name = `${stmt.bank} ${label}`;
          }
          const newId = await createAccount({
            user_id: session.user.id,
            name,
            account_type: accountType,
            institution_name: stmt.bank ?? null,
            currency_code: stmt.currency ?? "COP",
            color: "#6366f1",
          });
          const newAccount = await getAccountById(newId);
          if (newAccount) {
            setAccounts((prev) => [...prev, newAccount]);
            setSelectedAccount(newAccount);
          }
        }
      }

      setStep("review");
    } catch (error) {
      console.error("Parse error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo procesar el extracto. Verifica que sea un PDF valido.";
      Alert.alert("Error", message);
    } finally {
      setParsing(false);
    }
  }, [document, session]);

  const toggleSelect = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handlePrepareImport = useCallback(async () => {
    if (!parsedData) return;
    if (!session?.user?.id) {
      Alert.alert(
        "Inicia sesion",
        "La importacion de extractos requiere una cuenta autenticada."
      );
      return;
    }

    if (!selectedAccount) {
      Alert.alert("Error", "Selecciona una cuenta de destino.");
      return;
    }

    setImporting(true);
    try {
      const results = await Promise.all(
        Array.from(selected)
          .sort((a, b) => a - b)
          .map(async (index) => {
            const transaction = parsedData.transactions[index];
            if (!transaction) return null;

            const ranked = await getReconciliationCandidates({
              userId: session.user.id,
              accountId: selectedAccount.id,
              direction: transaction.direction,
              amount: transaction.amount,
              transactionDate: transaction.date,
              rawDescription: transaction.description,
            });

            if (!ranked.bestMatch) {
              return { type: "UNMATCHED" as const, importIndex: index, transaction };
            }

            const candidate = await getReconciliationCandidateById(
              ranked.bestMatch.candidateId
            );
            if (!candidate) {
              return { type: "UNMATCHED" as const, importIndex: index, transaction };
            }

            if (ranked.bestMatch.decision === "AUTO_MERGE") {
              return {
                type: "AUTO_MERGE" as const,
                importIndex: index,
                transaction,
                candidate,
                score: ranked.bestMatch.score,
              };
            }

            if (ranked.bestMatch.decision === "REVIEW") {
              return {
                type: "REVIEW" as const,
                importIndex: index,
                transaction,
                candidate,
                score: ranked.bestMatch.score,
              };
            }

            return { type: "UNMATCHED" as const, importIndex: index, transaction };
          })
      );

      const preview: ReconciliationPreview = {
        autoMerge: [],
        review: [],
        unmatched: [],
      };
      const nextReviewDecisions: Record<number, ReviewChoice> = {};

      for (const result of results) {
        if (!result) continue;
        if (result.type === "AUTO_MERGE") {
          preview.autoMerge.push({
            importIndex: result.importIndex,
            transaction: result.transaction,
            candidate: result.candidate,
            score: result.score,
            decision: "AUTO_MERGE",
          });
        } else if (result.type === "REVIEW") {
          preview.review.push({
            importIndex: result.importIndex,
            transaction: result.transaction,
            candidate: result.candidate,
            score: result.score,
            decision: "REVIEW",
          });
          nextReviewDecisions[result.importIndex] = "KEEP_BOTH";
        } else {
          preview.unmatched.push({
            importIndex: result.importIndex,
            transaction: result.transaction,
          });
        }
      }

      setReconciliationPreview(preview);
      setReviewDecisions(nextReviewDecisions);
      setStep("reconcile");
    } catch (error) {
      console.error("Prepare import error:", error);
      Alert.alert("Error", "No se pudo calcular la reconciliación.");
    } finally {
      setImporting(false);
    }
  }, [parsedData, selected, selectedAccount, session?.user?.id]);

  const handleImport = useCallback(async () => {
    if (!parsedData || !selectedAccount || !session?.user?.id) return;

    setImporting(true);

    try {
      const userId = session.user.id;
      let count = 0;
      let autoMerged = 0;
      let manualMerged = 0;
      let leftAsSeparate = 0;
      const autoMergeMap = new Map(
        (reconciliationPreview?.autoMerge ?? []).map((item) => [item.importIndex, item])
      );
      const reviewMap = new Map(
        (reconciliationPreview?.review ?? []).map((item) => [item.importIndex, item])
      );

      for (const index of Array.from(selected).sort((a, b) => a - b)) {
        const t = parsedData.transactions[index];
        if (!t) continue;
        const isDebtPayment = isDebtInflow({
          direction: t.direction,
          accountType: selectedAccount.account_type,
        });
        const forcedCategoryId = isDebtPayment ? DEBT_PAYMENT_CATEGORY_ID : null;

        try {
          const txId = await createTransaction({
            user_id: userId,
            account_id: selectedAccount.id,
            category_id: forcedCategoryId,
            amount: t.amount,
            currency_code: parsedData.currency ?? selectedAccount.currency_code ?? "COP",
            direction: t.direction,
            description: t.description,
            merchant_name: t.description,
            raw_description: t.description,
            transaction_date: t.date,
            provider: "OCR",
            capture_method: "PDF_IMPORT",
          });

          count++;

          const autoMatch = autoMergeMap.get(index);
          if (autoMatch) {
            await applyReconciliationMerge({
              manualTransaction: autoMatch.candidate,
              pdfTransactionId: txId,
              score: autoMatch.score,
              pdfCategoryId: forcedCategoryId,
              pdfNotes: null,
            });
            autoMerged++;
            continue;
          }

          const reviewMatch = reviewMap.get(index);
          if (reviewMatch && (reviewDecisions[index] ?? "KEEP_BOTH") === "MERGE") {
            await applyReconciliationMerge({
              manualTransaction: reviewMatch.candidate,
              pdfTransactionId: txId,
              score: reviewMatch.score,
              pdfCategoryId: forcedCategoryId,
              pdfNotes: null,
            });
            manualMerged++;
          } else {
            leftAsSeparate++;
          }
        } catch (err) {
          console.warn("Skip imported transaction:", err);
        }
      }

      setImportedCount(count);
      setImportSummary({ autoMerged, manualMerged, leftAsSeparate });
      setStep("result");
    } catch (error) {
      console.error("Import error:", error);
      Alert.alert("Error", "No se pudieron importar las transacciones.");
    } finally {
      setImporting(false);
    }
  }, [parsedData, reconciliationPreview, reviewDecisions, selected, session, selectedAccount]);

  const resetFlow = useCallback(() => {
    setStep("pick");
    setDocument(null);
    setParsedData(null);
    setSelected(new Set());
    setSelectedAccount(null);
    setReconciliationPreview(null);
    setReviewDecisions({});
    setImportedCount(0);
    setImportSummary({
      autoMerged: 0,
      manualMerged: 0,
      leftAsSeparate: 0,
    });
  }, []);

  // ===== STEP 1: Pick PDF =====
  if (step === "pick") {
    return (
      <View className="flex-1 bg-gray-100 p-4">
        <Text className="text-gray-900 font-inter-bold text-xl mb-6">
          Importar extracto
        </Text>

        <Pressable
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 items-center justify-center bg-white active:bg-gray-100"
          onPress={handlePickDocument}
        >
          <Upload size={40} color="#9CA3AF" />
          <Text className="text-gray-500 font-inter-medium text-base mt-4">
            Seleccionar extracto PDF
          </Text>
          <Text className="text-gray-400 font-inter text-sm mt-1">
            Toca para abrir el selector
          </Text>
        </Pressable>

        {document && (
          <View className="bg-white rounded-lg p-4 mt-4 flex-row items-center">
            <FileText size={20} color="#047857" />
            <View className="ml-3 flex-1">
              <Text
                className="text-gray-900 font-inter-medium text-sm"
                numberOfLines={1}
              >
                {document.name}
              </Text>
              {document.size && (
                <Text className="text-gray-400 font-inter text-xs mt-0.5">
                  {(document.size / 1024).toFixed(1)} KB
                </Text>
              )}
            </View>
          </View>
        )}

        <Pressable
          className={`mt-6 rounded-lg py-3.5 items-center ${
            document ? "bg-primary active:bg-primary-dark" : "bg-gray-200"
          }`}
          onPress={handleParse}
          disabled={!document || parsing}
        >
          {parsing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              className={`font-inter-bold text-base ${
                document ? "text-white" : "text-gray-400"
              }`}
            >
              Procesar extracto
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ===== STEP 2: Review =====
  if (step === "review") {
    const transactions = parsedData?.transactions ?? [];
    const selectedCount = selected.size;
    const canImport = selectedCount > 0 && selectedAccount !== null;

    return (
      <View className="flex-1 bg-gray-100">
        <View className="px-4 pt-4 pb-2">
          <Text className="text-gray-900 font-inter-bold text-xl">
            Revisar transacciones
          </Text>
          <Text className="text-gray-500 font-inter text-sm mt-1">
            {selectedCount} de {transactions.length} seleccionadas
          </Text>
        </View>

        <FlatList
          data={transactions}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <View className="px-4 pt-2 pb-1">
              <AccountSelector
                accounts={accounts}
                selected={selectedAccount}
                onSelect={setSelectedAccount}
              />
            </View>
          }
          renderItem={({ item, index }) => {
            const isSelected = selected.has(index);
            const isInflow = item.direction === "INFLOW";
            const isDebtPayment = isDebtInflow({
              direction: item.direction,
              accountType: selectedAccount?.account_type,
            });
            const Icon = isSelected ? CheckSquare : Square;

            return (
              <Pressable
                className="flex-row items-center px-4 py-3 bg-white active:bg-gray-100"
                onPress={() => toggleSelect(index)}
              >
                <Icon size={20} color={isSelected ? "#047857" : "#D1D5DB"} />
                <View className="flex-1 mx-3">
                  <Text
                    className="text-gray-900 font-inter-medium text-sm"
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                  <Text className="text-gray-400 font-inter text-xs mt-0.5">
                    {item.date}
                    {isDebtPayment ? " • Abono a deuda" : ""}
                  </Text>
                </View>
                <Text
                  className={`font-inter-bold text-sm ${
                    isDebtPayment
                      ? "text-sky-600"
                      : isInflow
                        ? "text-green-600"
                        : "text-gray-900"
                  }`}
                >
                  {isInflow ? "+" : "-"}
                  {formatCurrency(Math.abs(item.amount))}
                </Text>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => (
            <View className="h-px bg-gray-100 ml-12" />
          )}
        />

        {/* Bottom buttons */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex-row gap-3">
          <Pressable
            className="flex-1 rounded-lg py-3 items-center border border-gray-300 active:bg-gray-100"
            onPress={resetFlow}
          >
            <Text className="text-gray-700 font-inter-medium text-sm">
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-lg py-3 items-center ${
              canImport ? "bg-primary active:bg-primary-dark" : "bg-gray-200"
            }`}
            onPress={handlePrepareImport}
            disabled={!canImport || importing}
          >
            {importing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                className={`font-inter-bold text-sm ${
                  canImport ? "text-white" : "text-gray-400"
                }`}
              >
                Revisar conciliación
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "reconcile") {
    const preview = reconciliationPreview ?? {
      autoMerge: [],
      review: [],
      unmatched: [],
    };

    return (
      <View className="flex-1 bg-gray-100">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        >
          <Text className="text-gray-900 font-inter-bold text-xl">
            Reconciliación
          </Text>
          <Text className="mt-1 text-gray-500 font-inter text-sm">
            Evita duplicados antes de guardar el extracto.
          </Text>

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-xl bg-white p-4">
              <Text className="text-xs font-inter text-gray-500">Auto-merge</Text>
              <Text className="mt-1 text-2xl font-inter-bold text-gray-900">
                {preview.autoMerge.length}
              </Text>
            </View>
            <View className="flex-1 rounded-xl bg-white p-4">
              <Text className="text-xs font-inter text-gray-500">Revisión</Text>
              <Text className="mt-1 text-2xl font-inter-bold text-gray-900">
                {preview.review.length}
              </Text>
            </View>
            <View className="flex-1 rounded-xl bg-white p-4">
              <Text className="text-xs font-inter text-gray-500">Sin match</Text>
              <Text className="mt-1 text-2xl font-inter-bold text-gray-900">
                {preview.unmatched.length}
              </Text>
            </View>
          </View>

          {preview.autoMerge.length > 0 ? (
            <View className="mt-5 rounded-xl bg-white p-4">
              <Text className="text-sm font-inter-semibold text-gray-900">
                Coincidencias de alta confianza
              </Text>
              <View className="mt-3 gap-3">
                {preview.autoMerge.map((item) => (
                  <View
                    key={`auto-${item.importIndex}`}
                    className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"
                  >
                    <Text className="font-inter-medium text-sm text-gray-900">
                      {item.transaction.description}
                    </Text>
                    <Text className="mt-1 text-xs font-inter text-gray-600">
                      Se fusiona con{" "}
                      {item.candidate.raw_description ??
                        item.candidate.merchant_name ??
                        "movimiento manual"}
                    </Text>
                    <Text className="mt-1 text-xs font-inter text-emerald-700">
                      Score {Math.round(item.score * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {preview.review.length > 0 ? (
            <View className="mt-5 rounded-xl bg-white p-4">
              <Text className="text-sm font-inter-semibold text-gray-900">
                Revisión manual
              </Text>
              <View className="mt-3 gap-4">
                {preview.review.map((item) => {
                  const choice = reviewDecisions[item.importIndex] ?? "KEEP_BOTH";
                  return (
                    <View
                      key={`review-${item.importIndex}`}
                      className="rounded-xl border border-gray-200 p-3"
                    >
                      <Text className="font-inter-medium text-sm text-gray-900">
                        {item.transaction.description}
                      </Text>
                      <Text className="mt-1 text-xs font-inter text-gray-500">
                        Posible duplicado:{" "}
                        {item.candidate.raw_description ??
                          item.candidate.merchant_name ??
                          "movimiento manual"}
                      </Text>
                      <Text className="mt-1 text-xs font-inter text-gray-500">
                        Score {Math.round(item.score * 100)}%
                      </Text>

                      <View className="mt-3 flex-row gap-2">
                        <Pressable
                          onPress={() =>
                            setReviewDecisions((prev) => ({
                              ...prev,
                              [item.importIndex]: "MERGE",
                            }))
                          }
                          className={`flex-1 rounded-xl px-3 py-2 ${
                            choice === "MERGE" ? "bg-primary" : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-center font-inter-medium text-xs ${
                              choice === "MERGE" ? "text-white" : "text-gray-700"
                            }`}
                          >
                            Fusionar
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            setReviewDecisions((prev) => ({
                              ...prev,
                              [item.importIndex]: "KEEP_BOTH",
                            }))
                          }
                          className={`flex-1 rounded-xl px-3 py-2 ${
                            choice === "KEEP_BOTH" ? "bg-gray-900" : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-center font-inter-medium text-xs ${
                              choice === "KEEP_BOTH" ? "text-white" : "text-gray-700"
                            }`}
                          >
                            Mantener ambas
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex-row gap-3">
          <Pressable
            className="flex-1 rounded-lg py-3 items-center border border-gray-300 active:bg-gray-100"
            onPress={() => setStep("review")}
          >
            <Text className="text-gray-700 font-inter-medium text-sm">
              Volver
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-lg py-3 items-center ${
              importing ? "bg-gray-300" : "bg-primary active:bg-primary-dark"
            }`}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-inter-bold text-sm text-white">
                Confirmar importación
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ===== STEP 3: Result =====
  return (
    <View className="flex-1 bg-gray-100 items-center justify-center px-8">
      <CheckCircle size={64} color="#047857" />
      <Text className="text-gray-900 font-inter-bold text-xl mt-6">
        Importacion exitosa
      </Text>
      <Text className="text-gray-500 font-inter text-base mt-2 text-center">
        {importedCount}{" "}
        {importedCount === 1
          ? "transaccion importada"
          : "transacciones importadas"}
      </Text>
      <Text className="text-gray-400 font-inter text-sm mt-2 text-center">
        {importSummary.autoMerged} auto-merge, {importSummary.manualMerged} merge manual,{" "}
        {importSummary.leftAsSeparate} separadas
      </Text>
      {selectedAccount && (
        <Text className="text-gray-400 font-inter text-sm mt-1">
          en {selectedAccount.name}
        </Text>
      )}

      <Pressable
        className="bg-primary rounded-lg py-3.5 px-8 mt-8 active:bg-primary-dark"
        onPress={() => {
          resetFlow();
          router.navigate("/(tabs)/transactions");
        }}
      >
        <Text className="text-white font-inter-bold text-base">
          Ver transacciones
        </Text>
      </Pressable>

      <Pressable className="mt-4 py-2" onPress={resetFlow}>
        <Text className="text-gray-500 font-inter-medium text-sm">
          Importar otro extracto
        </Text>
      </Pressable>
    </View>
  );
}
