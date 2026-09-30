const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Web preview (`pnpm web`): expo-sqlite's browser build loads a wasm file and
// needs SharedArrayBuffer, which browsers only allow on a cross-origin
// isolated page. Native builds are unaffected.
config.resolver.assetExts.push("wasm");
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

// Native-only modules the web preview swaps for stand-ins in web-preview/shims.
const WEB_SHIMS = {
  "expo-secure-store": path.resolve(__dirname, "web-preview/shims/expo-secure-store.ts"),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return { type: "sourceFile", filePath: WEB_SHIMS[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
