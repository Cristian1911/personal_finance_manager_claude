import { connection } from "next/server";
import dynamic from "next/dynamic";
import { getUncategorizedTransactions, getUnreviewedAutoTransactions, getUserCategoryRules, getDestinatarioSuggestionsForInbox } from "@/actions/categorize";
import { getCategories } from "@/actions/categories";
import { getTagGroups } from "@/actions/tags";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import Link from "next/link";
import { Inbox, ShieldCheck, Tags } from "lucide-react";
import { CHIP_NEUTRAL_CLASS, PAGE_STACK_CLASS } from "@/lib/constants/styles";

const CategoryInbox = dynamic(
  () => import("@/components/categorize/category-inbox").then((m) => ({ default: m.CategoryInbox })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

const MobileCategoryInbox = dynamic(
  () => import("@/components/categorize/mobile-category-inbox").then((m) => ({ default: m.MobileCategoryInbox })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse lg:hidden" /> }
);

export default async function CategorizarPage() {
  await connection();
  const [transactions, unreviewedAutoTransactions, categoriesResult, userRules, tagGroupsResult, destinatarioSuggestions] = await Promise.all([
    getUncategorizedTransactions(),
    getUnreviewedAutoTransactions(),
    getCategories(),
    getUserCategoryRules(),
    getTagGroups(),
    getDestinatarioSuggestionsForInbox(),
  ]);

  const categories = categoriesResult.success ? categoriesResult.data : [];
  const tagGroups = tagGroupsResult.success ? tagGroupsResult.data : [];
  const uncategorizedCount = transactions.length;
  const autoReviewCount = unreviewedAutoTransactions.length;
  const activeRulesCount = userRules.length;

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="sub" title="Categorizar" backHref="/gestionar" />

      {/* Mobile: compact status line + inbox, nothing in between */}
      <div className="space-y-3 lg:hidden">
        <p className="text-sm text-muted-foreground">
          {uncategorizedCount} por categorizar · {activeRulesCount}{" "}
          {activeRulesCount === 1 ? "regla activa" : "reglas activas"}
        </p>
        <MobileCategoryInbox
          initialTransactions={transactions}
          autoCategorizedTransactions={unreviewedAutoTransactions}
          categories={categories}
        />
      </div>

      {/* Desktop: one line of copy + count pills + inbox */}
      <div className="hidden lg:block space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-1">
            <SectionEyebrow>Categorizar</SectionEyebrow>
            <h1 className="text-3xl font-semibold tracking-tight">Bandeja de categorización</h1>
            <p className="text-sm text-muted-foreground">
              Categoriza lo pendiente para que presupuesto, plan y destinatarios lean el mes completo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={CHIP_NEUTRAL_CLASS}>
              <Inbox className={`size-3.5 ${uncategorizedCount > 0 ? "text-z-alert" : "text-muted-foreground"}`} />
              {uncategorizedCount} sin categoría
            </span>
            <span className={CHIP_NEUTRAL_CLASS}>
              <ShieldCheck className="size-3.5 text-z-brass" />
              {autoReviewCount} auto por validar
            </span>
            <Link href="/destinatarios" className={`${CHIP_NEUTRAL_CLASS} hover:bg-white/[0.06]`}>
              <Tags className="size-3.5 text-z-sage-dark" />
              {activeRulesCount} {activeRulesCount === 1 ? "regla activa" : "reglas activas"}
            </Link>
          </div>
        </div>

        <CategoryInbox
          initialTransactions={transactions}
          autoCategorizedTransactions={unreviewedAutoTransactions}
          categories={categories}
          userRules={userRules}
          tagGroups={tagGroups}
          destinatarioSuggestions={destinatarioSuggestions}
        />
      </div>
    </div>
  );
}
