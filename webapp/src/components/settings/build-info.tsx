"use client";

import { GitCommitVertical } from "lucide-react";

const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME ?? null;

function formatBuildDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function getRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "hace menos de 1 hora";
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  } catch {
    return "";
  }
}

export function BuildInfo() {
  const shortSha = buildSha.length > 7 ? buildSha.slice(0, 7) : buildSha;
  const isDev = buildSha === "dev" || buildSha === "unknown";

  return (
    <div className="rounded-2xl border border-white/6 bg-z-surface-2/40 px-4 py-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <GitCommitVertical className="size-4 shrink-0 text-z-sage-dark" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Versión{" "}
            <code className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-z-sage-light">
              {shortSha}
            </code>
          </span>
          {buildTime && !isDev ? (
            <>
              <span>
                Desplegado {formatBuildDate(buildTime)}
              </span>
              <span className="text-z-sage-dark">
                ({getRelativeTime(buildTime)})
              </span>
            </>
          ) : (
            <span>Entorno de desarrollo local</span>
          )}
        </div>
      </div>
    </div>
  );
}
