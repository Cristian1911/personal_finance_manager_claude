import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { PANEL_INSET_INTERACTIVE_CLASS } from "@/lib/constants/styles";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

interface StatementSnapshotsCardProps {
  accountId: string;
  count: number;
  lastPeriod?: string;
}

export function StatementSnapshotsCard({
  accountId,
  count,
  lastPeriod,
}: StatementSnapshotsCardProps) {
  if (count === 0) return null;

  return (
    <Link
      href={`/accounts/${accountId}/snapshots`}
      className={cn(
        PANEL_INSET_INTERACTIVE_CLASS,
        "flex items-center gap-3 px-4 py-3"
      )}
    >
      <FileText className="h-4 w-4 shrink-0 text-z-sage-dark" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-z-white">
          Extractos ({count})
        </p>
        {lastPeriod && (
          <p className="text-xs text-z-sage-dark">
            Último: {formatDate(lastPeriod, "MMM yyyy")}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-z-sage-dark" />
    </Link>
  );
}
