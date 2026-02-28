import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { ArrowLeft, Paperclip, Send } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useBugReport } from "../lib/bugReportMode";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getFallbackMimeType(fileName: string | null | undefined): string | null {
  const normalized = (fileName || "").toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".pdf")) return "application/pdf";
  return null;
}

function resolveAttachmentMimeType(
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): string | null {
  const normalized = mimeType?.trim().toLowerCase();
  if (
    normalized &&
    normalized !== "application/octet-stream" &&
    normalized !== "binary/octet-stream"
  ) {
    return normalized;
  }
  return getFallbackMimeType(fileName);
}

export default function BugReportScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { pendingScreenshotUri, setPendingScreenshotUri } = useBugReport();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [routeHint, setRouteHint] = useState("");
  const [areaHint, setAreaHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [attachment, setAttachment] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const canSubmit = useMemo(
    () => title.trim().length > 3 && description.trim().length > 8,
    [title, description]
  );

  function validateAttachment(
    candidate: DocumentPicker.DocumentPickerAsset
  ): string | null {
    const mimeType = resolveAttachmentMimeType(candidate.mimeType, candidate.name);
    if (!mimeType || !ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
      return "Formato no soportado. Usa JPG, PNG, WEBP o PDF.";
    }
    if (typeof candidate.size === "number" && candidate.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return "El adjunto no puede superar 10MB.";
    }
    return null;
  }

  async function handlePickAttachment() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ["image/*", "application/pdf"],
      });

      if (!result.canceled && result.assets.length > 0) {
        const selected = result.assets[0];
        const validationError = validateAttachment(selected);
        if (validationError) {
          Alert.alert("Adjunto no valido", validationError);
          return;
        }
        setAttachment(selected);
      }
    } catch (err) {
      console.error("Attachment picker error:", err);
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
    } finally {
      setPicking(false);
    }
  }

  async function handleSubmit() {
    if (!session?.user?.id) {
      Alert.alert(
        "Requiere cuenta",
        "Debes iniciar sesion para enviar reportes de bug al bucket compartido."
      );
      return;
    }

    if (!canSubmit) {
      Alert.alert(
        "Completa la informacion",
        "Agrega un titulo y una descripcion un poco mas detallada."
      );
      return;
    }

    setSubmitting(true);
    try {
      let attachmentPath: string | null = null;

      // If a screenshot was captured via bug mode, treat it as the attachment
      const screenshotAsset: DocumentPicker.DocumentPickerAsset | null =
        pendingScreenshotUri
          ? {
              uri: pendingScreenshotUri,
              name: `screenshot-${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              lastModified: Date.now(),
            }
          : null;

      const effectiveAttachment = attachment ?? screenshotAsset;

      if (effectiveAttachment) {
        const validationError = validateAttachment(effectiveAttachment);
        if (validationError) {
          throw new Error(validationError);
        }

        const contentType = resolveAttachmentMimeType(
          effectiveAttachment.mimeType,
          effectiveAttachment.name
        );
        if (!contentType) {
          throw new Error("No se pudo determinar el tipo de archivo adjunto.");
        }

        const safeName = (effectiveAttachment.name || "capture")
          .replace(/[^a-zA-Z0-9_.-]/g, "-")
          .slice(0, 80);
        const path = `${session.user.id}/${Date.now()}-${safeName}`;

        const fileResponse = await fetch(effectiveAttachment.uri);
        if (!fileResponse.ok) {
          throw new Error("No se pudo leer el archivo adjunto.");
        }
        const fileBytes = await fileResponse.arrayBuffer();
        if (fileBytes.byteLength === 0) {
          throw new Error("El archivo adjunto está vacío.");
        }
        if (fileBytes.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
          throw new Error("La captura supera el límite de 10MB.");
        }

        const { error: uploadError } = await supabase.storage
          .from("bug-reports")
          .upload(path, fileBytes, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        attachmentPath = path;
      }

      const payload = {
        user_id: session.user.id,
        source: "mobile",
        status: "OPEN",
        title: title.trim(),
        description: description.trim(),
        route_hint: routeHint.trim() || null,
        selected_area_hint: areaHint.trim() || null,
        attachment_path: attachmentPath,
        device_context: {
          platform: Platform.OS,
          appVersion: Constants.expoConfig?.version ?? null,
          runtimeVersion: Constants.expoConfig?.runtimeVersion ?? null,
        },
      };

      const { data, error } = await supabase
        .from("bug_reports")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert(
        "Reporte enviado",
        `Ticket ${data?.id ?? "creado"}. Ya puedes trabajarlo desde tu workspace.`
      );
      setPendingScreenshotUri(null);
      router.back();
    } catch (err) {
      console.error("Bug report submit error:", err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "No se pudo enviar el reporte."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-100"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2 bg-white border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ArrowLeft size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-gray-900 font-inter-bold text-base">
          Quick Capture de Bug
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <Text className="text-gray-900 font-inter-semibold text-base">
            Describe lo que fallo
          </Text>
          <Text className="text-gray-500 font-inter text-xs mt-1">
            Esto crea un ticket en Supabase y adjunta evidencia para revisarlo desde local.
          </Text>

          <Text className="mt-4 mb-1 text-sm font-inter-medium text-gray-700">
            Titulo del bug
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: En editar transaccion se solapan fecha y cuenta"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">
            Descripcion
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Que hiciste, que esperabas y que ocurrio"
            multiline
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
            style={{ minHeight: 88, textAlignVertical: "top" }}
          />

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">
            Pantalla/ruta (opcional)
          </Text>
          <TextInput
            value={routeHint}
            onChangeText={setRouteHint}
            placeholder="Ej: /transaction/123"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">
            Zona afectada (opcional)
          </Text>
          <TextInput
            value={areaHint}
            onChangeText={setAreaHint}
            placeholder="Ej: parte superior derecha, bloque fecha/cuenta"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          {pendingScreenshotUri ? (
            <View className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
              <Image
                source={{ uri: pendingScreenshotUri }}
                style={{ width: "100%", aspectRatio: 9 / 16 }}
                resizeMode="cover"
              />
              <Text className="text-center text-xs text-gray-500 font-inter py-2">
                Captura adjunta automáticamente
              </Text>
            </View>
          ) : (
            <Pressable
              className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-3 flex-row items-center justify-center active:bg-gray-50"
              onPress={handlePickAttachment}
              disabled={picking || submitting}
            >
              {picking ? (
                <ActivityIndicator color="#6B7280" />
              ) : (
                <>
                  <Paperclip size={16} color="#6B7280" />
                  <Text className="ml-2 text-gray-700 font-inter-medium text-sm">
                    Adjuntar captura o PDF
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {!pendingScreenshotUri && attachment && (
            <View className="mt-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
              <Text className="text-sky-700 font-inter text-xs" numberOfLines={2}>
                Archivo: {attachment.name}
              </Text>
              {typeof attachment.size === "number" && (
                <Text className="text-sky-700 font-inter text-xs mt-1">
                  Tamaño: {formatBytes(attachment.size)}
                </Text>
              )}
              <Pressable
                onPress={() => setAttachment(null)}
                className="mt-2 self-start rounded-md border border-sky-300 px-2 py-1 active:bg-sky-100"
                disabled={submitting}
              >
                <Text className="text-sky-700 font-inter-medium text-xs">
                  Quitar adjunto
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          className={`mt-5 rounded-xl py-3.5 items-center flex-row justify-center ${
            canSubmit && !submitting ? "bg-primary" : "bg-gray-300"
          }`}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Send size={16} color="#FFFFFF" />
              <Text className="ml-2 text-white font-inter-bold text-base">
                Enviar ticket
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
