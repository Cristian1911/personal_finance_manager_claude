import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import { AnimatedAccordion } from "../../components/ui/AnimatedAccordion";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  Upload,
  FileText,
  CheckCircle,
  Square,
  CheckSquare,
  ChevronDown,
} from "lucide-react-native";
import {
  formatCurrency,
  type CurrencyCode,
  type ReconciliationCandidate,
} from "@zeta/shared";
import { WizardProgress } from "../../components/ui/WizardProgress";
import { StatementChip } from "../../components/import/StatementChip";
import { SectionDivider } from "../../components/import/SectionDivider";
import { CreditCardSummary } from "../../components/import/CreditCardSummary";
import { CreditCardStackCard } from "../../components/import/CreditCardStackCard";
import { ImportThemeProvider } from "../../components/import/import-theme";
import { Narrator } from "../../components/common/Narrator";
import { useTheme, themeSurfaceClasses } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  type AccountRow,
} from "../../lib/repositories/accounts";
import {
  getPdfPasswordForAccount,
  getSavedPdfPasswordsForAccounts,
  setPdfPasswordForAccount,
} from "../../lib/pdf-passwords";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../../lib/constants/styles";
import { ExpandableStatTile } from "../../components/ui/ExpandableStatTile";
import {
  applyReconciliationMerge,
  createTransaction,
  getReconciliationCandidateById,
  getReconciliationCandidates,
} from "../../lib/repositories/transactions";
import { getDestinatarioRulesForMatching } from "../../lib/repositories/destinatarios";
import {
  matchDestinatario,
  prepareDestinatarioRules,
  type PreparedDestinatarioRule,
} from "@zeta/shared";
import {
  DEBT_PAYMENT_CATEGORY_ID,
  isDebtInflow,
} from "../../lib/transaction-semantics";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

/** Normalize a bank/institution name for comparison: lowercase, no accents, no punctuation. */
function normalizeInstitution(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findMatchingAccount(
  accounts: AccountRow[],
  stmt: ParsedStatement,
  accountType: string
): AccountRow | undefined {
  const typed = accounts.filter((a) => a.account_type === accountType);
  if (!typed.length) return undefined;

  // 1. Best match: card last four found in account name (e.g. "****1234")
  if (stmt.card_last_four) {
    const m = typed.find((a) => a.name.includes(stmt.card_last_four!));
    if (m) return m;
  }

  // 2. Account number found in account name
  if (stmt.account_number) {
    const m = typed.find((a) => a.name.includes(stmt.account_number!));
    if (m) return m;
  }

  // 3. Normalized institution name — exact or bidirectional substring
  if (stmt.bank) {
    const bankNorm = normalizeInstitution(stmt.bank);
    const m = typed.find((a) => {
      if (!a.institution_name) return false;
      const instNorm = normalizeInstitution(a.institution_name);
      return instNorm === bankNorm || instNorm.includes(bankNorm) || bankNorm.includes(instNorm);
    });
    if (m) return m;
  }

  return undefined;
}

type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  balance?: number | null;
  currency?: string;
};

type StatementSummary = {
  previous_balance: number | null;
  total_credits: number | null;
  total_debits: number | null;
  final_balance: number | null;
  purchases_and_charges: number | null;
  interest_charged: number | null;
};

type CreditCardMetadata = {
  credit_limit: number | null;
  available_credit: number | null;
  interest_rate: number | null;
  late_interest_rate: number | null;
  total_payment_due: number | null;
  minimum_payment: number | null;
  payment_due_date: string | null;
};

type LoanMetadata = {
  loan_number: string | null;
  loan_type: string | null;
  initial_amount: number | null;
  disbursement_date: string | null;
  remaining_balance: number | null;
  interest_rate: number | null;
  late_interest_rate: number | null;
  total_payment_due: number | null;
  minimum_payment: number | null;
  payment_due_date: string | null;
  installments_in_default: number | null;
  statement_cut_date: string | null;
  last_payment_date: string | null;
};

type ParsedStatement = {
  bank: string;
  statement_type: "savings" | "credit_card" | "loan" | string;
  account_number?: string | null;
  card_last_four?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  currency: string;
  summary?: StatementSummary | null;
  credit_card_metadata?: CreditCardMetadata | null;
  loan_metadata?: LoanMetadata | null;
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

function ItemSeparator() {
  return <View className="ml-12 h-px bg-z-surface-2-6" />;
}

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
      <View className="mb-4 rounded-xl border border-z-alert-25 bg-z-alert-12 p-4">
        <Text className="font-inter-medium text-sm text-z-alert">
          No tienes cuentas registradas.
        </Text>
        <Text className="mt-1 font-inter text-xs text-z-sage-light">
          Crea una cuenta primero en la pestaña Cuentas.
        </Text>
      </View>
    );
  }

  const typeDef = selected
    ? ACCOUNT_TYPES.find((t) => t.value === selected.account_type)
    : null;
  const Icon = typeDef?.icon;
  const color = selected?.color ?? COLORS.sageDark;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-inter-medium text-sm text-z-sage-light">
        Cuenta de destino <Text className="text-z-debt">*</Text>
      </Text>
      <Pressable
        accessibilityLabel="Seleccionar cuenta de destino"
        accessibilityRole="button"
        className="flex-row items-center rounded-xl border border-z-sage-10 bg-z-surface-2 px-4 py-3 active:bg-z-surface-3"
        onPress={() => setOpen(!open)}
      >
        {selected && Icon ? (
          <>
            <View
              className="mr-3 h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: color + "20" }}
            >
              <Icon size={14} color={color} />
            </View>
            <Text className="flex-1 font-inter-medium text-sm text-z-white">
              {selected.name}
            </Text>
          </>
        ) : (
          <Text className="flex-1 font-inter text-sm text-z-sage-dark">
            Seleccionar cuenta...
          </Text>
        )}
        <ChevronDown size={16} color={COLORS.sageDark} />
      </Pressable>

      {open && (
        <View className="mt-1 overflow-hidden rounded-xl border border-z-sage-10 bg-z-surface-2">
          {accounts.map((account, index) => {
            const aTypeDef = ACCOUNT_TYPES.find(
              (t) => t.value === account.account_type
            );
            const AIcon = aTypeDef?.icon;
            const aColor = account.color ?? COLORS.sageDark;
            const isSelected = selected?.id === account.id;
            return (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar cuenta ${account.name}`}
                accessibilityState={{ selected: isSelected }}
                className={`flex-row items-center px-4 py-3 active:bg-z-surface-3 ${
                  index > 0 ? "border-t border-z-sage-10" : ""
                }`}
                onPress={() => {
                  onSelect(account);
                  setOpen(false);
                }}
              >
                <View
                  className="mr-3 h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: aColor + "20" }}
                >
                  {AIcon && <AIcon size={14} color={aColor} />}
                </View>
                <Text className="flex-1 font-inter-medium text-sm text-z-white">
                  {account.name}
                </Text>
                {isSelected && (
                  <CheckSquare size={16} color={COLORS.brass} />
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
  const [password, setPassword] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedStatement | null>(null);
  const [allStatements, setAllStatements] = useState<ParsedStatement[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { mode: themeMode } = useTheme();
  const neutralTheme = themeMode === "neutral";
  const inkCls = neutralTheme ? "bg-z-ink-neutral" : "bg-z-ink";
  const actionBarCls = themeSurfaceClasses(themeMode).actionBar;
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 12);
  const [reconExpanded, setReconExpanded] = useState<
    "none" | "duplicates" | "review" | "unmatched" | "merchants"
  >("none");
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [savedPdfPasswords, setSavedPdfPasswords] = useState<
    Array<{ accountId: string; accountName: string; password: string }>
  >([]);
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
        if (session?.user?.id) {
          const saved = await getSavedPdfPasswordsForAccounts(
            session.user.id,
            result
          );
          setSavedPdfPasswords(saved);
        } else {
          setSavedPdfPasswords([]);
        }
      })();
    }, [session?.user?.id])
  );

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setDocument(result.assets[0]);
        setPassword("");
      }
    } catch (error) {
      console.error("Error picking document:", error);
    }
  }, []);

  const handleParse = useCallback(async () => {
    if (!document) return;
    setParsing(true);
    const t0 = Date.now();
    const log = (step: string, extra?: unknown) => {
      const ms = Date.now() - t0;
      console.log(`[import +${ms}ms] ${step}`, extra ?? "");
    };

    try {
      log("start", { uri: document.uri, size: document.size });

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      if (!accessToken) {
        throw new Error("No hay sesión activa. Inicia sesión e intenta de nuevo.");
      }
      log("got token");

      const url = `${API_URL}/api/parse-statement`;
      log("uploading to", url);

      // expo-file-system handles multipart uploads via native NSURLSession.
      // Unlike RN fetch + FormData, it sets Content-Length correctly, supports
      // real cancellation, and doesn't hang on HTTPS + multipart + chunked bodies.
      let uploadResult: FileSystem.FileSystemUploadResult;
      try {
        uploadResult = await Promise.race<FileSystem.FileSystemUploadResult>([
          FileSystem.uploadAsync(url, document.uri, {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: "file",
            mimeType: "application/pdf",
            parameters: password.trim() ? { password: password.trim() } : {},
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("timeout-30s")),
              30_000,
            ),
          ),
        ]);
      } catch (netErr) {
        log("upload error", netErr);
        if (netErr instanceof Error && netErr.message === "timeout-30s") {
          throw new Error(
            "El servidor no respondió en 30 segundos. Intenta de nuevo.",
          );
        }
        throw new Error(
          `No se pudo conectar al servidor: ${netErr instanceof Error ? netErr.message : "red desconocida"}`,
        );
      }

      log("response", {
        status: uploadResult.status,
        bodyLen: uploadResult.body?.length ?? 0,
      });

      const rawBody = uploadResult.body ?? "";
      let parsedBody: unknown = null;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        // body wasn't valid JSON
      }

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        let errorMessage = `HTTP ${uploadResult.status}`;
        if (parsedBody && typeof parsedBody === "object") {
          const maybeError = (parsedBody as { error?: unknown; detail?: unknown });
          if (typeof maybeError.error === "string") errorMessage = maybeError.error;
          else if (typeof maybeError.detail === "string") errorMessage = maybeError.detail;
        } else if (rawBody && rawBody.length < 200) {
          errorMessage = rawBody;
        }
        log("error message", errorMessage);
        throw new Error(errorMessage);
      }

      if (!parsedBody) {
        throw new Error("Respuesta invalida del servidor");
      }
      const statements: ParsedStatement[] = Array.isArray(parsedBody)
        ? (parsedBody as ParsedStatement[])
        : (parsedBody as { statements?: ParsedStatement[] }).statements ?? [];
      log("parsed JSON", { statementCount: statements.length });
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

      setAllStatements(statements);
      setParsedData(stmt);
      const allIndices = new Set(
        stmt.transactions.map((_: ParsedTransaction, i: number) => i)
      );
      setSelected(allIndices);

      // Auto-match or auto-create an account from statement metadata
      const stmtTypeMap: Record<string, string> = {
        savings: "CHECKING",
        credit_card: "CREDIT_CARD",
        loan: "LOAN",
      };
      let targetAccountForPassword: AccountRow | null = null;
      if (session?.user?.id) {
        const typeMap = stmtTypeMap;
        const accountType = typeMap[stmt.statement_type] ?? "CHECKING";
        const currentAccounts = await getAllAccounts();
        setAccounts(currentAccounts);

        const match = findMatchingAccount(currentAccounts, stmt, accountType);

        if (match) {
          setSelectedAccount(match);
          targetAccountForPassword = match;
          // Pre-fill PDF password if stored for this account
          if (!password.trim()) {
            const storedPassword = await getPdfPasswordForAccount(
              session.user.id,
              match.id
            );
            if (storedPassword) {
              setPassword(storedPassword);
            }
          }
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
            color: COLORS.brass,
          });
          const newAccount = await getAccountById(newId);
          if (newAccount) {
            setAccounts((prev) => [...prev, newAccount]);
            setSelectedAccount(newAccount);
            targetAccountForPassword = newAccount;
          }
        }
      }

      setStep("review");

      // Offer to save the PDF password for the matched/created account
      if (
        password.trim() &&
        session?.user?.id &&
        targetAccountForPassword
      ) {
        const storedPassword = await getPdfPasswordForAccount(
          session.user.id,
          targetAccountForPassword.id
        );
        if (storedPassword !== password.trim()) {
          Alert.alert(
            "Guardar contraseña del PDF",
            `¿Guardar esta contraseña para "${targetAccountForPassword.name}"? La próxima vez se completará automáticamente.`,
            [
              { text: "No", style: "cancel" },
              {
                text: "Guardar",
                onPress: async () => {
                  await setPdfPasswordForAccount(
                    session.user.id,
                    targetAccountForPassword.id,
                    password.trim()
                  );
                  const refreshed = await getSavedPdfPasswordsForAccounts(
                    session.user.id,
                    await getAllAccounts()
                  );
                  setSavedPdfPasswords(refreshed);
                },
              },
            ]
          );
        }
      }
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
  }, [document, password, session]);

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

      // Pre-prepare destinatario rules once — mirrors webapp `step-review.tsx`
      // silent destinatario assignment. If the user has no rules yet, prepared
      // is empty and the per-tx match returns null (no-op).
      let preparedRules: PreparedDestinatarioRule[] = [];
      try {
        const rules = await getDestinatarioRulesForMatching();
        preparedRules = prepareDestinatarioRules(rules);
      } catch (err) {
        console.warn("Skipping destinatario auto-match (rules load failed):", err);
      }

      for (const index of Array.from(selected).sort((a, b) => a - b)) {
        const t = parsedData.transactions[index];
        if (!t) continue;
        const isDebtPayment = isDebtInflow({
          direction: t.direction,
          accountType: selectedAccount.account_type,
        });
        const forcedCategoryId = isDebtPayment ? DEBT_PAYMENT_CATEGORY_ID : null;

        // Destinatario auto-match — webapp runs this unconditionally for every
        // tx (including debt-payment inflows). When the user has no rules
        // (`preparedRules.length === 0`) the match is a guaranteed no-op.
        const destMatch =
          preparedRules.length > 0
            ? matchDestinatario(t.description, preparedRules)
            : null;
        const destinatarioId = destMatch?.destinatario_id ?? null;
        const matchedCategoryId = destMatch?.category_id ?? null;
        // Forced debt-payment category wins over a destinatario-suggested
        // category — the user's CC payment is semantically the debt category,
        // even if a rule happened to match the description.
        const effectiveCategoryId = forcedCategoryId ?? matchedCategoryId;
        // Mirror webapp step-review.tsx lines 246-250: USER_LEARNED when the
        // category and a destinatario both came from the match. Webapp's
        // USER_OVERRIDE branch is effectively dead in import (its `categoryId`
        // only ever comes from a destinatario hit, so a categoryId without a
        // destinatarioId can't happen). Mobile additionally has a forced
        // debt-payment category — when paired with a destinatario match the
        // result is still USER_LEARNED; when no destinatario matched, we leave
        // the source undefined so createTransaction's default (USER_CREATED)
        // fires, matching how a manual debt-payment entry would look.
        const categorizationSource =
          effectiveCategoryId && destinatarioId ? "USER_LEARNED" : undefined;
        // Webapp stamps 0.8 when category AND destinatario both came from the
        // match (step-review.tsx line 251). Mirror exactly — forced debt
        // category + matched destinatario gets 0.8 too, since webapp uses the
        // effective categoryId in its check.
        const categorizationConfidence =
          effectiveCategoryId && destinatarioId ? 0.8 : null;

        try {
          const txId = await createTransaction({
            user_id: userId,
            account_id: selectedAccount.id,
            category_id: effectiveCategoryId,
            categorization_source: categorizationSource,
            categorization_confidence: categorizationConfidence,
            destinatario_id: destinatarioId,
            amount: t.amount,
            currency_code: parsedData.currency ?? selectedAccount.currency_code ?? "COP",
            direction: t.direction,
            description: t.description,
            // Match webapp: merchant_name is only set when a destinatario rule
            // supplies a clean name. Otherwise null (raw_description carries
            // the bank's string).
            merchant_name: destMatch?.destinatario_name ?? null,
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
              pdfCategoryId: effectiveCategoryId,
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
              pdfCategoryId: effectiveCategoryId,
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
    setPassword("");
    setParsedData(null);
    setAllStatements([]);
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

  const switchStatement = useCallback(
    async (idx: number) => {
      const next = allStatements[idx];
      if (!next || !session?.user?.id) return;
      setParsedData(next);
      setSelected(
        new Set(next.transactions.map((_: ParsedTransaction, i: number) => i))
      );
      setReconciliationPreview(null);
      setReviewDecisions({});

      const stmtTypeMap: Record<string, string> = {
        savings: "CHECKING",
        credit_card: "CREDIT_CARD",
        loan: "LOAN",
      };
      const accountType = stmtTypeMap[next.statement_type] ?? "CHECKING";
      const currentAccounts = await getAllAccounts();
      setAccounts(currentAccounts);
      const match = findMatchingAccount(currentAccounts, next, accountType);
      setSelectedAccount(match ?? null);
    },
    [allStatements, session?.user?.id]
  );

  // ===== Shared derivations for Step 2 (hooks can't be inside if-branches) =====
  const transactions = parsedData?.transactions ?? [];
  const transactionCount = transactions.length;
  const currency = (parsedData?.currency ?? "COP") as CurrencyCode;
  const isCreditCard =
    parsedData?.statement_type === "credit_card" &&
    parsedData?.credit_card_metadata != null;

  const reviewHeader = useMemo(() => {
    if (!parsedData) return null;
    const activeIdx = allStatements.indexOf(parsedData);
    const multiCreditCard =
      allStatements.length > 1 &&
      allStatements.every(
        (s) => s.statement_type === "credit_card" && s.credit_card_metadata != null
      );
    return (
      <View className="px-4 pt-2">
        <View className="mb-4">
          <StatementChip
            bank={parsedData.bank}
            cardLastFour={parsedData.card_last_four}
            accountNumber={parsedData.account_number}
            periodFrom={parsedData.period_from}
            periodTo={parsedData.period_to}
          />
        </View>

        {multiCreditCard ? (
          <>
            <SectionDivider label="Por pagar" />
            {allStatements.map((s, i) => (
              <CreditCardStackCard
                key={`${s.currency ?? "COP"}-${i}`}
                currency={(s.currency ?? "COP") as CurrencyCode}
                metadata={s.credit_card_metadata!}
                summary={s.summary ?? null}
                transactionCount={s.transactions.length}
                active={i === activeIdx}
                onPress={() => switchStatement(i)}
              />
            ))}
            <View className="h-2" />
          </>
        ) : (
          isCreditCard &&
          parsedData.credit_card_metadata && (
            <>
              <SectionDivider label="Por pagar" />
              <CreditCardSummary
                metadata={parsedData.credit_card_metadata}
                summary={parsedData.summary ?? null}
                transactionCount={transactionCount}
                currency={currency}
              />
              <View className="h-4" />
            </>
          )
        )}

        <SectionDivider
          label={isCreditCard ? "Movimientos" : "Transacciones"}
        />

        <AccountSelector
          accounts={accounts}
          selected={selectedAccount}
          onSelect={setSelectedAccount}
        />
      </View>
    );
  }, [parsedData, allStatements, switchStatement, isCreditCard, transactionCount, currency, accounts, selectedAccount]);

  const renderTxnRow = useCallback(
    ({ item, index }: { item: ParsedTransaction; index: number }) => {
      const isSelected = selected.has(index);
      const isInflow = item.direction === "INFLOW";
      const isDebtPayment = isDebtInflow({
        direction: item.direction,
        accountType: selectedAccount?.account_type,
      });
      const Icon = isSelected ? CheckSquare : Square;
      const amountClass = isDebtPayment
        ? "text-z-income"
        : isInflow
          ? "text-z-income"
          : "text-z-white";

      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={`${isSelected ? "Deseleccionar" : "Seleccionar"} ${item.description}`}
          className="mx-4 flex-row items-center rounded-lg px-2 py-3 active:bg-z-surface-2"
          onPress={() => toggleSelect(index)}
        >
          <Icon
            size={20}
            color={isSelected ? COLORS.brass : COLORS.sageDark}
          />
          <View className="mx-3 flex-1">
            <Text
              className="font-inter-medium text-sm text-z-white"
              numberOfLines={1}
            >
              {item.description}
            </Text>
            <Text className="mt-0.5 font-inter text-xs text-z-sage-dark">
              {item.date}
              {isDebtPayment ? " • Abono a deuda" : ""}
            </Text>
          </View>
          <Text className={`font-inter-bold text-sm ${amountClass}`}>
            {isInflow ? "+" : "-"}
            {formatCurrency(Math.abs(item.amount), currency)}
          </Text>
        </Pressable>
      );
    },
    [selected, selectedAccount?.account_type, toggleSelect, currency],
  );

  const txnKeyExtractor = useCallback(
    (item: ParsedTransaction, index: number) =>
      `${item.date}|${item.amount}|${item.description}|${index}`,
    [],
  );

  // ===== STEP 1: Pick PDF =====
  if (step === "pick") {
    return (
      <ImportThemeProvider neutral={neutralTheme}>
      <View className={`flex-1 ${inkCls} px-4 pb-4`} style={{ paddingTop: topInset + 4 }}>
        <Text className="text-[11px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
          Paso 1 de 4
        </Text>
        <Text className="mt-1 font-inter-bold text-xl text-z-white">
          Importar extracto
        </Text>
        <View className="mt-3 mb-5">
          <WizardProgress step={1} total={4} />
        </View>

        <Pressable
          accessibilityLabel="Seleccionar extracto PDF"
          accessibilityRole="button"
          className="items-center justify-center rounded-2xl border border-z-brass-30 bg-z-brass-8 p-8 active:bg-z-brass-12"
          onPress={handlePickDocument}
        >
          <Upload size={40} color={COLORS.brass} />
          <Text className="mt-4 font-inter-semibold text-base text-z-white">
            Seleccionar extracto PDF
          </Text>
          <Text className="mt-1 font-inter text-sm text-z-sage-dark">
            Toca para abrir el selector
          </Text>
        </Pressable>

        {document && (
          <View className="mt-4 rounded-2xl border border-z-sage-10 bg-z-surface-2 p-4">
            <View className="flex-row items-center">
              <FileText size={20} color={COLORS.brass} />
              <View className="ml-3 flex-1">
                <Text
                  className="font-inter-medium text-sm text-z-white"
                  numberOfLines={1}
                >
                  {document.name}
                </Text>
                {document.size && (
                  <Text className="mt-0.5 font-inter text-xs text-z-sage-dark">
                    {(document.size / 1024).toFixed(1)} KB
                  </Text>
                )}
              </View>
            </View>

            <View className="mt-4">
              <Text className="mb-1.5 font-inter-medium text-sm text-z-sage-light">
                Contraseña del PDF
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Si el extracto está cifrado, ingrésala aquí"
                placeholderTextColor={COLORS.sageDark}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
                className="rounded-xl border border-z-sage-10 bg-z-ink px-4 py-3 font-inter text-sm text-z-white"
              />
              <Text className="mt-2 font-inter text-xs text-z-sage-dark">
                Déjalo vacío si el PDF no tiene contraseña.
              </Text>
              {savedPdfPasswords.length > 0 && (
                <View className="mt-3">
                  <Text className="mb-1.5 font-inter text-xs text-z-sage-dark">
                    Contraseñas guardadas:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {savedPdfPasswords.map((entry) => (
                      <Pressable
                        key={entry.accountId}
                        accessibilityRole="button"
                        accessibilityLabel={`Usar contraseña guardada de ${entry.accountName}`}
                        onPress={() => setPassword(entry.password)}
                        className="rounded-full border border-z-income-30 bg-z-income-12 px-3 py-1.5 active:bg-z-income-20"
                      >
                        <Text className="font-inter-medium text-xs text-z-income">
                          {entry.accountName}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Procesar extracto"
          className={`mt-6 items-center rounded-xl py-3.5 ${
            document ? `${BRASS_BUTTON_CLASS} active:opacity-90` : "bg-z-surface-2"
          }`}
          onPress={handleParse}
          disabled={!document || parsing}
        >
          {parsing ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Text
              className={`font-inter-bold text-base ${
                document ? "text-z-ink" : "text-z-sage-dark"
              }`}
            >
              Procesar extracto
            </Text>
          )}
        </Pressable>
      </View>
      </ImportThemeProvider>
    );
  }

  // ===== STEP 2: Review =====
  if (step === "review") {
    const selectedCount = selected.size;
    const canImport = selectedCount > 0 && selectedAccount !== null;

    return (
      <ImportThemeProvider neutral={neutralTheme}>
      <View className={`flex-1 ${inkCls}`} style={{ paddingTop: topInset }}>
        <View className="px-4 pt-2 pb-2">
          <Text className="text-[11px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
            Paso 2 de 4{isCreditCard ? " · Tarjeta de crédito" : ""}
          </Text>
          <Text className="mt-1 font-inter-bold text-xl text-z-white">
            Encontramos esto
          </Text>
          <View className="mt-3">
            <WizardProgress step={2} total={4} />
          </View>
          <Text className="mt-3 font-inter text-sm text-z-sage-dark">
            {selectedCount} de {transactionCount} seleccionadas
          </Text>
        </View>

        <FlatList
          data={transactions}
          keyExtractor={txnKeyExtractor}
          contentContainerStyle={{ paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
          ListHeaderComponent={reviewHeader}
          renderItem={renderTxnRow}
          ItemSeparatorComponent={ItemSeparator}
        />

        {/* Bottom buttons */}
        <View className={`absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-white-6 ${actionBarCls} p-4`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar importación"
            className={`flex-1 items-center rounded-xl py-3 ${GHOST_BUTTON_CLASS}`}
            onPress={resetFlow}
          >
            <Text className="font-inter-medium text-sm text-z-sage-light">
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar a reconciliación"
            className={`flex-1 items-center rounded-xl py-3 ${
              canImport
                ? `${BRASS_BUTTON_CLASS} active:opacity-90`
                : "bg-z-surface-2"
            }`}
            onPress={handlePrepareImport}
            disabled={!canImport || importing}
          >
            {importing ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Text
                className={`font-inter-bold text-sm ${
                  canImport ? "text-z-ink" : "text-z-sage-dark"
                }`}
              >
                Continuar
              </Text>
            )}
          </Pressable>
        </View>
      </View>
      </ImportThemeProvider>
    );
  }

  if (step === "reconcile") {
    const preview = reconciliationPreview ?? {
      autoMerge: [],
      review: [],
      unmatched: [],
    };
    const txnsCount = selected.size;
    const newMerchantNames = Array.from(
      new Set(
        preview.unmatched
          .map((i) => i.transaction.description)
          .filter((s): s is string => typeof s === "string" && s.length > 0),
      ),
    );
    const narratorLine = (() => {
      if (preview.review.length > 0)
        return `Hay ${preview.review.length} ambigu${preview.review.length === 1 ? "o" : "os"} — tú decides. Son solo unos toques.`;
      if (preview.autoMerge.length > 0)
        return `Se omiten ${preview.autoMerge.length} duplicado${preview.autoMerge.length === 1 ? "" : "s"}. El resto entra fresco.`;
      return "Sin sorpresas — nada duplicado, nada ambiguo. Dale.";
    })();

    return (
      <ImportThemeProvider neutral={neutralTheme}>
      <View className={`flex-1 ${inkCls}`} style={{ paddingTop: topInset }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        >
          <Text className="text-[11px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
            Paso 3 de 4
          </Text>
          <Text className="mt-1 font-inter-bold text-xl text-z-white">
            Reconciliación
          </Text>
          <View className="mt-3 mb-3">
            <WizardProgress step={3} total={4} />
          </View>
          {selectedAccount && (
            <View className="mt-4 flex-row items-baseline justify-between gap-3 border-b border-white-6 pb-2.5">
              <Text
                numberOfLines={1}
                className="flex-1 font-inter-semibold text-[15px] text-z-white tracking-tight"
              >
                {selectedAccount.name}
              </Text>
              <Text className="font-inter text-[11px] text-z-sage-dark">
                {txnsCount} movs
              </Text>
            </View>
          )}

          {(() => {
            const toggle = (
              target:
                | "unmatched"
                | "merchants"
                | "duplicates"
                | "review"
            ) => {
              setReconExpanded((v) => (v === target ? "none" : target));
            };
            const isRow1 =
              reconExpanded === "unmatched" || reconExpanded === "merchants";
            const isRow2 =
              reconExpanded === "duplicates" || reconExpanded === "review";
            return (
              <>
                <View className="mt-4 flex-row gap-3">
                  <View className="flex-1">
                    <ExpandableStatTile
                      label="Nuevos"
                      hint="se agregan"
                      value={preview.unmatched.length}
                      tone="income"
                      neutral={neutralTheme}
                      active={reconExpanded === "unmatched"}
                      onPress={() => toggle("unmatched")}
                    />
                  </View>
                  <View className="flex-1">
                    <ExpandableStatTile
                      label="Destinatarios"
                      hint="sugeridos"
                      value={newMerchantNames.length}
                      tone="brass"
                      neutral={neutralTheme}
                      active={reconExpanded === "merchants"}
                      onPress={() => toggle("merchants")}
                    />
                  </View>
                </View>

                <AnimatedAccordion expanded={isRow1} estimatedHeight={700}>
                  <View className="mt-3 rounded-xl border border-z-sage-10 bg-z-surface-2 p-4">
                    {reconExpanded === "unmatched" ? (
                      preview.unmatched.length === 0 ? (
                        <Narrator tone="sage">
                          No hay movimientos nuevos en este extracto. Raro pero
                          OK.
                        </Narrator>
                      ) : (
                        <>
                          <Text className="font-inter-semibold text-sm text-z-white">
                            Movimientos nuevos
                          </Text>
                          <Text className="mt-1 font-inter-italic text-xs text-z-sage-dark">
                            No coinciden con nada existente — se importan limpios.
                          </Text>
                          <View className="mt-3 gap-1.5">
                            {preview.unmatched.map((item) => (
                              <View
                                key={`unmatched-${item.importIndex}`}
                                className="rounded-lg border border-white-6 px-3 py-2"
                              >
                                <Text className="font-inter text-xs text-z-sage-light">
                                  {item.transaction.description}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </>
                      )
                    ) : newMerchantNames.length === 0 ? (
                      <Narrator tone="sage">
                        Nada por sugerir — ya tenías a todos registrados.
                      </Narrator>
                    ) : (
                      <>
                        <Text className="font-inter-semibold text-sm text-z-white">
                          Destinatarios sugeridos
                        </Text>
                        <Text className="mt-1 font-inter-italic text-xs text-z-sage-dark">
                          Después de importar, revisa cuáles quieres crear.
                        </Text>
                        <View className="mt-3 gap-1.5">
                          {newMerchantNames.map((name) => (
                            <View
                              key={`new-m-${name}`}
                              className="rounded-lg border border-white-6 px-3 py-2"
                            >
                              <Text className="font-inter text-xs text-z-sage-light">
                                {name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                </AnimatedAccordion>

                <View className="mt-3 flex-row gap-3">
                  <View className="flex-1">
                    <ExpandableStatTile
                      label="Duplicados"
                      hint="se omiten"
                      value={preview.autoMerge.length}
                      tone="brass"
                      neutral={neutralTheme}
                      active={reconExpanded === "duplicates"}
                      onPress={() => toggle("duplicates")}
                    />
                  </View>
                  <View className="flex-1">
                    <ExpandableStatTile
                      label="Ambiguos"
                      hint="tú eliges"
                      value={preview.review.length}
                      tone="alert"
                      neutral={neutralTheme}
                      active={reconExpanded === "review"}
                      onPress={() => toggle("review")}
                    />
                  </View>
                </View>

                <AnimatedAccordion expanded={isRow2} estimatedHeight={1200}>
                  <View className="mt-3 rounded-xl border border-z-sage-10 bg-z-surface-2 p-4">
                    {reconExpanded === "duplicates" ? (
                      preview.autoMerge.length === 0 ? (
                        <Narrator tone="sage">
                          Cero duplicados. Nada se pisa.
                        </Narrator>
                      ) : (
                        <>
                          <Text className="font-inter-semibold text-sm text-z-white">
                            Coincidencias de alta confianza
                          </Text>
                          <Text className="mt-1 font-inter-italic text-xs text-z-sage-dark">
                            Se fusionan automáticamente con movimientos
                            existentes.
                          </Text>
                          <View className="mt-3 gap-3">
                            {preview.autoMerge.map((item) => (
                              <View
                                key={`auto-${item.importIndex}`}
                                className="rounded-xl border border-z-income-30 bg-z-income-12 p-3"
                              >
                                <Text className="font-inter-medium text-sm text-z-white">
                                  {item.transaction.description}
                                </Text>
                                <Text className="mt-1 font-inter text-xs text-z-sage-light">
                                  Se fusiona con{" "}
                                  {item.candidate.raw_description ??
                                    item.candidate.merchant_name ??
                                    "movimiento manual"}
                                </Text>
                                <Text className="mt-1 font-inter text-xs text-z-income">
                                  Score {Math.round(item.score * 100)}%
                                </Text>
                              </View>
                            ))}
                          </View>
                        </>
                      )
                    ) : preview.review.length === 0 ? (
                      <Narrator tone="sage">
                        Sin ambigüedades. Nada que decidir.
                      </Narrator>
                    ) : (
                      <>
                        <Text className="font-inter-semibold text-sm text-z-white">
                          Decide caso por caso
                        </Text>
                        <Text className="mt-1 font-inter-italic text-xs text-z-sage-dark">
                          Coincidencias parciales — tú eliges fusionar o
                          mantener ambas.
                        </Text>
                        <View className="mt-3 gap-4">
                          {preview.review.map((item) => {
                            const choice =
                              reviewDecisions[item.importIndex] ?? "KEEP_BOTH";
                            return (
                              <View
                                key={`review-${item.importIndex}`}
                                className="rounded-xl border border-z-sage-10 p-3"
                              >
                                <Text className="font-inter-medium text-sm text-z-white">
                                  {item.transaction.description}
                                </Text>
                                <Text className="mt-1 font-inter text-xs text-z-sage-dark">
                                  Posible duplicado:{" "}
                                  {item.candidate.raw_description ??
                                    item.candidate.merchant_name ??
                                    "movimiento manual"}
                                </Text>
                                <Text className="mt-1 font-inter text-xs text-z-sage-dark">
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
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: choice === "MERGE" }}
                                    accessibilityLabel="Fusionar con movimiento existente"
                                    className={`flex-1 rounded-xl px-3 py-2 ${
                                      choice === "MERGE"
                                        ? BRASS_BUTTON_CLASS
                                        : "bg-z-surface-3"
                                    }`}
                                  >
                                    <Text
                                      className={`text-center font-inter-medium text-xs ${
                                        choice === "MERGE"
                                          ? "text-z-ink"
                                          : "text-z-sage-light"
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
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: choice === "KEEP_BOTH" }}
                                    accessibilityLabel="Mantener ambos movimientos"
                                    className={`flex-1 rounded-xl px-3 py-2 ${
                                      choice === "KEEP_BOTH"
                                        ? "bg-z-sage-dark"
                                        : "bg-z-surface-3"
                                    }`}
                                  >
                                    <Text
                                      className={`text-center font-inter-medium text-xs ${
                                        choice === "KEEP_BOTH"
                                          ? "text-z-ink"
                                          : "text-z-sage-light"
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
                      </>
                    )}
                  </View>
                </AnimatedAccordion>
              </>
            );
          })()}

          <Narrator>{narratorLine}</Narrator>
        </ScrollView>

        <View className={`absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-white-6 ${actionBarCls} p-4`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver al paso anterior"
            className={`flex-1 items-center rounded-xl py-3 ${GHOST_BUTTON_CLASS}`}
            onPress={() => setStep("review")}
          >
            <Text className="font-inter-medium text-sm text-z-sage-light">
              Volver
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Confirmar importación de ${selected.size} movimiento${selected.size === 1 ? "" : "s"}`}
            className={`flex-1 items-center rounded-xl py-3 ${
              importing
                ? "bg-z-surface-2"
                : `${BRASS_BUTTON_CLASS} active:opacity-90`
            }`}
            onPress={handleImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Text className="font-inter-bold text-sm text-z-ink">
                Confirmar {selected.size}{" "}
                {selected.size === 1 ? "movimiento" : "movimientos"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
      </ImportThemeProvider>
    );
  }

  // ===== STEP 4: Result =====
  return (
    <ImportThemeProvider neutral={neutralTheme}>
    <View className={`flex-1 items-center justify-center ${inkCls} px-8`} style={{ paddingTop: topInset }}>
      <View className="absolute left-0 right-0 top-0 px-4 pt-4">
        <Text className="text-[11px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
          Paso 4 de 4
        </Text>
        <View className="mt-3">
          <WizardProgress step={4} total={4} />
        </View>
      </View>

      <CheckCircle size={64} color={COLORS.income} />
      <Text className="mt-6 font-inter-bold text-xl text-z-white">
        Importación exitosa
      </Text>
      <Text className="mt-2 text-center font-inter text-base text-z-sage-light">
        {importedCount}{" "}
        {importedCount === 1
          ? "transacción importada"
          : "transacciones importadas"}
      </Text>
      <Text className="mt-2 text-center font-inter text-sm text-z-sage-dark">
        {importSummary.autoMerged} fusionadas automáticamente ·{" "}
        {importSummary.manualMerged} fusionadas manualmente ·{" "}
        {importSummary.leftAsSeparate} separadas
      </Text>
      {selectedAccount && (
        <Text className="mt-1 font-inter text-sm text-z-sage-dark">
          en {selectedAccount.name}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver transacciones importadas"
        className={`mt-8 rounded-xl ${BRASS_BUTTON_CLASS} px-8 py-3.5 active:opacity-90`}
        onPress={() => {
          resetFlow();
          router.navigate("/(tabs)/transactions");
        }}
      >
        <Text className="font-inter-bold text-base text-z-ink">
          Ver transacciones
        </Text>
      </Pressable>

      {(() => {
        const newMerchantCount = reconciliationPreview
          ? new Set(
              reconciliationPreview.unmatched
                .map((i) => i.transaction.description)
                .filter(
                  (s): s is string => typeof s === "string" && s.length > 0,
                ),
            ).size
          : 0;
        if (newMerchantCount === 0) return null;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Revisar ${newMerchantCount} destinatarios sugeridos`}
            className="mt-4 py-2"
            onPress={() => {
              resetFlow();
              router.navigate("/(tabs)/destinatarios" as never);
            }}
          >
            <Text className="font-inter-medium text-sm text-z-brass">
              Revisar {newMerchantCount} destinatario
              {newMerchantCount === 1 ? "" : "s"} nuevo
              {newMerchantCount === 1 ? "" : "s"}
            </Text>
          </Pressable>
        );
      })()}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Importar otro extracto"
        className="mt-4 py-2"
        onPress={resetFlow}
      >
        <Text className="font-inter-medium text-sm text-z-sage-dark">
          Importar otro extracto
        </Text>
      </Pressable>
    </View>
    </ImportThemeProvider>
  );
}

