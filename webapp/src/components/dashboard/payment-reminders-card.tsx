import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { CreditCard, Landmark, CalendarClock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UpcomingPayment } from "@/actions/payment-reminders";
import type { CurrencyCode } from "@/types/domain";

export function PaymentRemindersCard({
    payments,
}: {
    payments: UpcomingPayment[];
}) {
    if (payments.length === 0) return null;

    return (
        <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Próximos Pagos (Extractos)</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 pt-2">
                    {payments.slice(0, 5).map((payment) => (
                        <div
                            key={payment.id}
                            className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0"
                        >
                            <div className="flex items-center gap-3">
                                <div className="mt-0.5 p-2 rounded-lg bg-muted">
                                    {payment.account_type === "CREDIT_CARD" ? (
                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Landmark className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{payment.account_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Vence: {formatDate(payment.payment_due_date)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-destructive">
                                    {formatCurrency(
                                        payment.total_payment_due,
                                        payment.currency_code as CurrencyCode
                                    )}
                                </p>
                                <Link
                                    href={`/recurrentes?accountId=${payment.account_id}`}
                                    className="text-[10px] text-primary hover:underline font-medium"
                                >
                                    Automatizar pago
                                </Link>
                            </div>
                        </div>
                    ))}

                    <div className="pt-2">
                        <Button variant="outline" className="w-full text-xs h-8" asChild>
                            <Link href="/recurrentes">
                                Ir a pagos recurrentes
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
