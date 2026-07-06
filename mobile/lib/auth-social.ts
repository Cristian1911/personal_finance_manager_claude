import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "./supabase";

/**
 * Social sign-in for mobile. Apple uses the native sheet on iOS (and falls back
 * to the web OAuth flow on Android, where Apple has no native SDK). Google is
 * native on both. All paths end at a Supabase session via signInWithIdToken or
 * setSession; the existing onAuthStateChange listener handles navigation.
 *
 * Result convention: { error } where error is null on success / user-cancel
 * (cancel is silent — no error UI), or a message string on real failure.
 */
export type SocialResult = { error: string | null };

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let googleConfigured = false;
function configureGoogle() {
  if (googleConfigured) return;
  // Guard: the WEB client id is the token audience Supabase validates and is
  // required on BOTH platforms. It must be injected into the build (eas.json env
  // or EAS dashboard). If it's only in a local .env it inlines to undefined in
  // built binaries → GoogleSignin.configure({ undefined }) → DEVELOPER_ERROR.
  // The iOS client id is only needed on iOS, so don't let a missing one disable
  // Google sign-in on Android.
  // Throwing (instead of returning) keeps signInWithGoogle from calling native
  // SDK methods unconfigured — the caller's catch logs this message and shows
  // the friendly error, rather than a generic native init failure.
  if (!WEB_CLIENT_ID) {
    throw new Error(
      "[google-signin] Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — " +
        "Google sign-in will fail in this build. Add it to the eas.json build profile env."
    );
  }
  if (Platform.OS === "ios" && !IOS_CLIENT_ID) {
    throw new Error(
      "[google-signin] Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID — " +
        "Google sign-in will fail on iOS. Add it to the eas.json build profile env."
    );
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID, // token audience Supabase validates
    ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
  });
  googleConfigured = true;
}

export const isAppleSignInNative = Platform.OS === "ios";

export async function signInWithGoogle(): Promise<SocialResult> {
  try {
    configureGoogle();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    // v13+ resolves with { type: 'cancelled' } instead of throwing on cancel.
    if ((result as { type?: string }).type === "cancelled") {
      return { error: null }; // user cancelled — silent
    }
    // v13+ returns { type, data: { idToken } }; older returns { idToken }.
    const idToken =
      (result as { data?: { idToken?: string | null } }).data?.idToken ??
      (result as { idToken?: string | null }).idToken ??
      null;
    if (!idToken) return { error: "No se recibió el token de Google" };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    return { error: error?.message ?? null };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (
      code === statusCodes.SIGN_IN_CANCELLED ||
      code === statusCodes.IN_PROGRESS
    ) {
      return { error: null }; // user cancelled — silent
    }
    // Log the native code (DEVELOPER_ERROR=10 → config/SHA-1; audience errors →
    // Supabase provider allow-list) so real failures are diagnosable in logs.
    console.error("[google-signin] sign-in failed", {
      code,
      message: (err as { message?: string } | null)?.message ?? String(err),
    });
    return { error: "No se pudo iniciar sesión con Google" };
  }
}

export async function signInWithApple(): Promise<SocialResult> {
  if (Platform.OS === "ios") return signInWithAppleNative();
  return signInWithAppleWeb();
}

async function signInWithAppleNative(): Promise<SocialResult> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      return { error: "No se recibió el token de Apple" };
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });
    return { error: error?.message ?? null };
  } catch (err) {
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      return { error: null }; // user cancelled — silent
    }
    return { error: "No se pudo iniciar sesión con Apple" };
  }
}

// Android has no native Apple SDK → web OAuth flow, deep-linked back to the app.
// The mobile Supabase client uses the implicit flow, so the return URL carries
// the session in its fragment (#access_token=…&refresh_token=…).
async function signInWithAppleWeb(): Promise<SocialResult> {
  try {
    const redirectTo = "zeta://auth-callback";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      return { error: "No se pudo iniciar sesión con Apple" };
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return { error: null }; // dismissed

    const hashIndex = result.url.indexOf("#");
    if (hashIndex === -1) return { error: "Respuesta de Apple inválida" };
    const params = new URLSearchParams(result.url.substring(hashIndex + 1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) {
      return { error: "Respuesta de Apple inválida" };
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    return { error: sessionError?.message ?? null };
  } catch {
    return { error: "No se pudo iniciar sesión con Apple" };
  }
}
