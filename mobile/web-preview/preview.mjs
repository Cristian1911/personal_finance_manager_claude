// Web preview of the React Native app (same code, Expo web). Never production data:
// the app gets the zeta-dev project when SUPABASE_DEV_URL/_PUBLISHABLE_KEY are set,
// otherwise no Supabase at all (use "Probar demo sin cuenta").
//
//   pnpm --filter mobile preview:web                    dev server with hot reload (open http://localhost:8090)
//   pnpm --filter mobile preview:web:shots [route ...]  build + screenshots (see shoot.mjs)
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_REF = "tgkhaxipfgskxydotdtu";
const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [mode = "dev", ...rest] = process.argv.slice(2);

// Set explicitly (even to "") so values from a local mobile/.env never apply: Expo does not
// override variables that already exist in the environment.
const env = {
  ...process.env,
  EXPO_PUBLIC_ZETA_V2: "1",
  EXPO_PUBLIC_SUPABASE_URL: process.env.SUPABASE_DEV_URL ?? "",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_DEV_PUBLISHABLE_KEY ?? "",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "",
};
if (env.EXPO_PUBLIC_SUPABASE_URL.includes(PRODUCTION_REF)) {
  console.error("La vista web no se conecta a producción. Usa el proyecto zeta-dev o el modo demo.");
  process.exit(1);
}
console.log(env.EXPO_PUBLIC_SUPABASE_URL ? "Supabase: zeta-dev" : "Supabase: sin conexión (usa el modo demo)");

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: mobileDir, env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// expo-sqlite on web needs SharedArrayBuffer, which the browser only allows on a
// cross-origin isolated page. Expo's dev server sends the HTML page before any
// Metro middleware runs, so the headers are added by this proxy in front of it
// (the exported build gets them from shoot.mjs).
const ISOLATION_HEADERS = {
  "cross-origin-embedder-policy": "credentialless",
  "cross-origin-opener-policy": "same-origin",
};

function startIsolationProxy(port, target) {
  const server = http.createServer((req, res) => {
    const upstream = http.request(
      { host: "127.0.0.1", port: target, path: req.url, method: req.method, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...ISOLATION_HEADERS });
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end("El servidor de Expo no responde; revisa la terminal."));
    req.pipe(upstream);
  });
  // Hot reload and dev tools use websockets: pass the upgrade through untouched.
  server.on("upgrade", (req, socket, head) => {
    const up = net.connect(target, "127.0.0.1", () => {
      const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
      up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
      up.write(head);
      socket.pipe(up).pipe(socket);
    });
    up.on("error", () => socket.destroy());
    socket.on("error", () => up.destroy());
  });
  // Listen only once Expo answers, so the first page load never hits a dead upstream.
  const waitForExpo = () => {
    const probe = net.connect(target, "127.0.0.1", () => {
      probe.end();
      server.listen(port, () => console.log(`\nVista web lista: http://localhost:${port}\n`));
    });
    probe.on("error", () => setTimeout(waitForExpo, 1000));
  };
  waitForExpo();
}

if (mode === "dev") {
  const expoPort = Number(process.env.EXPO_PORT ?? 8081);
  startIsolationProxy(Number(process.env.PORT ?? 8090), expoPort);
  const expo = spawn("npx", ["expo", "start", "--port", String(expoPort)], { cwd: mobileDir, env, stdio: "inherit" });
  expo.on("exit", (code) => process.exit(code ?? 0));
} else if (mode === "shots") {
  const out = path.resolve(process.env.OUT ?? path.join(mobileDir, "web-preview", "out"));
  const build = path.join(out, "build");
  // --clear: EXPO_PUBLIC_* values are inlined at build time and Metro's cache would keep old ones.
  run("npx", ["expo", "export", "--platform", "web", "--clear", "--output-dir", build]);
  run("node", [path.join(mobileDir, "web-preview", "shoot.mjs"), build, path.join(out, "shots"), ...rest]);
} else {
  console.error(`Modo desconocido: ${mode} (usa "dev" o "shots")`);
  process.exit(1);
}
