import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  Upload,
  FileText,
  CheckCircle,
  Square,
  CheckSquare,
} from "lucide-react-native";
import { formatCurrency } from "@venti5/shared";
import * as Crypto from "expo-crypto";
import { getDatabase } from "../../lib/db/database";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

async function computeIdempotencyKey(params: {
  provider: string;
  transactionDate: string;
  amount: number;
  rawDescription: string;
}): Promise<string> {
  const payload = [
    params.provider,
    "",
    params.transactionDate,
    params.amount.toFixed(2),
    params.rawDescription,
    "",
  ].join("|");
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload
  );
}

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

type Step = "pick" | "review" | "result";

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

      // Get current access token for auth
      const { data: { session: currentSession } } = await supabase.auth.getSession();
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
      // API returns { statements: [...] }
      const statements: ParsedStatement[] = data.statements ?? (Array.isArray(data) ? data : []);
      const stmt = statements[0];

      if (!stmt) {
        throw new Error("No se encontro informacion en el extracto");
      }

      if (!stmt.transactions?.length) {
        const typeLabel =
          stmt.statement_type === "loan" ? "prestamo" :
          stmt.statement_type === "credit_card" ? "tarjeta de credito" :
          "extracto";
        throw new Error(
          `Este ${typeLabel} no contiene transacciones para importar`
        );
      }

      setParsedData(stmt);

      // Select all by default
      const allIndices = new Set(
        stmt.transactions.map((_: ParsedTransaction, i: number) => i)
      );
      setSelected(allIndices);
      setStep("review");
    } catch (error) {
      console.error("Parse error:", error);
      const message = error instanceof Error ? error.message : "No se pudo procesar el extracto. Verifica que sea un PDF valido.";
      Alert.alert("Error", message);
    } finally {
      setParsing(false);
    }
  }, [document]);

  const toggleSelect = useCallback(
    (index: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!parsedData || !session?.user?.id) return;
    setImporting(true);

    try {
      const db = await getDatabase();
      const userId = session.user.id;
      const now = new Date().toISOString();
      let count = 0;

      // Disable FK checks for import — account_id may not exist locally yet
      await db.execAsync("PRAGMA foreign_keys = OFF");

      for (const index of selected) {
        const t = parsedData.transactions[index];
        if (!t) continue;

        const idempotencyKey = await computeIdempotencyKey({
          provider: parsedData.bank || "manual",
          transactionDate: t.date,
          amount: t.amount,
          rawDescription: t.description,
        });

        const txId = Crypto.randomUUID();

        // Insert transaction (skip duplicates)
        try {
          await db.runAsync(
            `INSERT OR IGNORE INTO transactions
              (id, user_id, account_id, amount, direction, description, merchant_name, raw_description, transaction_date, status, idempotency_key, is_excluded, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, 0, ?, ?)`,
            [
              txId,
              userId,
              "", // account_id will be matched later during sync
              t.amount,
              t.direction,
              t.description,
              null, // merchant_name
              null, // raw_description
              t.date,
              idempotencyKey,
              now,
              now,
            ]
          );

          // Don't queue for sync yet — account_id is required by Supabase
          // Transactions will be synced once an account is assigned

          count++;
        } catch (err) {
          // Skip duplicate idempotency key errors
          console.warn("Skip duplicate:", err);
        }
      }

      await db.execAsync("PRAGMA foreign_keys = ON");

      setImportedCount(count);
      setStep("result");
    } catch (error) {
      console.error("Import error:", error);
      const db2 = await getDatabase();
      await db2.execAsync("PRAGMA foreign_keys = ON");
      Alert.alert("Error", "No se pudieron importar las transacciones.");
    } finally {
      setImporting(false);
    }
  }, [parsedData, selected, session]);

  const resetFlow = useCallback(() => {
    setStep("pick");
    setDocument(null);
    setParsedData(null);
    setSelected(new Set());
    setImportedCount(0);
  }, []);

  // ===== STEP 1: Pick PDF =====
  if (step === "pick") {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Text className="text-gray-900 font-inter-bold text-xl mb-6">
          Importar extracto
        </Text>

        <Pressable
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 items-center justify-center bg-white active:bg-gray-50"
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
            <FileText size={20} color="#10B981" />
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

    return (
      <View className="flex-1 bg-gray-50">
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
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item, index }) => {
            const isSelected = selected.has(index);
            const isInflow = item.direction === "INFLOW";
            const Icon = isSelected ? CheckSquare : Square;

            return (
              <Pressable
                className="flex-row items-center px-4 py-3 bg-white active:bg-gray-50"
                onPress={() => toggleSelect(index)}
              >
                <Icon
                  size={20}
                  color={isSelected ? "#10B981" : "#D1D5DB"}
                />
                <View className="flex-1 mx-3">
                  <Text
                    className="text-gray-900 font-inter-medium text-sm"
                    numberOfLines={1}
                  >
                    {item.description}
                  </Text>
                  <Text className="text-gray-400 font-inter text-xs mt-0.5">
                    {item.date}
                  </Text>
                </View>
                <Text
                  className={`font-inter-bold text-sm ${
                    isInflow ? "text-green-600" : "text-gray-900"
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
            className="flex-1 rounded-lg py-3 items-center border border-gray-300 active:bg-gray-50"
            onPress={resetFlow}
          >
            <Text className="text-gray-700 font-inter-medium text-sm">
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 rounded-lg py-3 items-center ${
              selectedCount > 0
                ? "bg-primary active:bg-primary-dark"
                : "bg-gray-200"
            }`}
            onPress={handleImport}
            disabled={selectedCount === 0 || importing}
          >
            {importing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                className={`font-inter-bold text-sm ${
                  selectedCount > 0 ? "text-white" : "text-gray-400"
                }`}
              >
                Importar {selectedCount} transacciones
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ===== STEP 3: Result =====
  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-8">
      <CheckCircle size={64} color="#10B981" />
      <Text className="text-gray-900 font-inter-bold text-xl mt-6">
        Importacion exitosa
      </Text>
      <Text className="text-gray-500 font-inter text-base mt-2 text-center">
        {importedCount}{" "}
        {importedCount === 1
          ? "transaccion importada"
          : "transacciones importadas"}
      </Text>

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
