import { Suspense } from "react";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { NewTransactionPageContent } from "@/components/mobile/new-transaction-page-content";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";

export default function NewTransactionPage() {
  return (
    <>
      <MobileHeader variant="sub" title="Nueva transacción" backHref="/transactions" />
      <div className={MOBILE_TAB_BAR_CLEARANCE_CLASS}>
        <div className="mx-auto max-w-lg px-4 py-6">
          <Suspense>
            <NewTransactionPageContent />
          </Suspense>
        </div>
      </div>
    </>
  );
}
