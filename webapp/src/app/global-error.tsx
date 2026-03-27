"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: "1rem",
          textAlign: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Algo salió mal
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
          Ocurrió un error crítico. Por favor recarga la página.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid #d1d5db",
            borderRadius: "0.375rem",
            cursor: "pointer",
            background: "white",
          }}
        >
          Intentar de nuevo
        </button>
        <a href="/" style={{ color: "#4f46e5", fontSize: "0.875rem" }}>
          Volver al inicio
        </a>
      </body>
    </html>
  );
}
