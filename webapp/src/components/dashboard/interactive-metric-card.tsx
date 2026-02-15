"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Info, Wallet, AlertCircle, Scale, DollarSign, PiggyBank, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

type MetricType = "net-worth" | "income" | "expenses" | "balance" | "savings-rate" | "budget";

interface MetricData {
  label: string;
  value: number;
  currency?: CurrencyCode;
  previousValue?: number;
  change?: number;
  target?: number;
  progress?: number;
  alert?: string;
  insight?: string;
}

interface InteractiveMetricCardProps {
  type: MetricType;
  data: MetricData;
  details?: {
    title: string;
    items: { label: string; value: string; href?: string }[];
  };
  trend?: { direction: "up" | "down" | "neutral"; percentage: number };
}

const cardConfigs: Record<MetricType, {
  icon: React.ElementType;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  indicatorColor: string;
}> = {
  "net-worth": {
    icon: Wallet,
    title: "Patrimonio Neto",
    color: "text-primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/20",
    indicatorColor: "hsl(var(--primary))",
  },
  "income": {
    icon: ArrowDownLeft,
    title: "Ingresos del mes",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    indicatorColor: "#16a34a",
  },
  "expenses": {
    icon: ArrowUpRight,
    title: "Gastos del mes",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    indicatorColor: "#ea580c",
  },
  "balance": {
    icon: Scale,
    title: "Saldo Disponible",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    indicatorColor: "#2563eb",
  },
  "savings-rate": {
    icon: PiggyBank,
    title: "Tasa de Ahorro",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    indicatorColor: "#9333ea",
  },
  "budget": {
    icon: DollarSign,
    title: "Presupuesto",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    indicatorColor: "#dc2626",
  },
};

export function InteractiveMetricCard({ 
  type, 
  data, 
  details,
  trend 
}: InteractiveMetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const config = cardConfigs[type];
  const Icon = config.icon;
  
  const isPositive = data.value >= 0;
  const showProgress = data.target !== undefined && data.progress !== undefined;
  
  return (
    <>
      <Card 
        className={`relative overflow-hidden transition-all duration-300 cursor-pointer group ${config.borderColor} hover:shadow-lg`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsDialogOpen(true)}
      >
        {/* Hover indicator line */}
        <div
          className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(to right, transparent, ${config.indicatorColor}, transparent)` }}
        />
        
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {config.title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Main Value */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {type === "savings-rate"
                ? `${data.value.toFixed(1)}%`
                : formatCurrency(Math.abs(data.value), data.currency)}
            </span>
            {isPositive && data.value > 0 && type !== "expenses" && type !== "budget" && (
              <span className="text-xs text-green-600 font-medium">+</span>
            )}
          </div>
          
          {/* Trend indicator */}
          {trend && trend.percentage !== 0 && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${
              trend.direction === "up" ? "text-green-600" : 
              trend.direction === "down" ? "text-red-600" : "text-muted-foreground"
            }`}>
              {trend.direction === "up" ? <TrendingUp className="h-3 w-3" /> : 
               trend.direction === "down" ? <TrendingDown className="h-3 w-3" /> : null}
              <span>{Math.abs(trend.percentage).toFixed(1)}% vs mes anterior</span>
            </div>
          )}
          
          {/* Progress bar for targets */}
          {showProgress && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progreso</span>
                <span>{data.progress?.toFixed(0)}%</span>
              </div>
              <Progress 
                value={Math.min(data.progress || 0, 100)} 
                className="h-1.5"
              />
              {data.target && (
                <p className="text-xs text-muted-foreground">
                  Meta: {formatCurrency(data.target, data.currency ?? "COP")}
                </p>
              )}
            </div>
          )}
          
          {/* Alert/Insight */}
          {(data.alert || data.insight) && (
            <div className={`mt-3 flex items-start gap-2 text-xs p-2 rounded-lg ${
              data.alert ? "bg-orange-500/10 text-orange-700" : "bg-blue-500/10 text-blue-700"
            }`}>
              {data.alert ? (
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              )}
              <span>{data.alert || data.insight}</span>
            </div>
          )}
          
          {/* Hover hint */}
          <div className={`mt-3 flex items-center gap-1 text-xs text-muted-foreground transition-opacity ${isHovered ? "opacity-100" : "opacity-0"}`}>
            <Info className="h-3 w-3" />
            <span>Haz clic para ver detalles</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${config.color}`} />
              {config.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Big value display */}
            <div className="text-center py-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Valor actual</p>
              <p className={`text-4xl font-bold ${isPositive ? "text-foreground" : "text-red-600"}`}>
                {type === "savings-rate"
                  ? `${data.value.toFixed(1)}%`
                  : formatCurrency(Math.abs(data.value), data.currency)}
              </p>
              {trend && (
                <div className={`flex items-center justify-center gap-1 mt-2 text-sm ${
                  trend.direction === "up" ? "text-green-600" : 
                  trend.direction === "down" ? "text-red-600" : "text-muted-foreground"
                }`}>
                  {trend.direction === "up" ? <TrendingUp className="h-4 w-4" /> : 
                   trend.direction === "down" ? <TrendingDown className="h-4 w-4" /> : null}
                  <span>{Math.abs(trend.percentage).toFixed(1)}% vs mes anterior</span>
                </div>
              )}
            </div>
            
            {/* Progress */}
            {showProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progreso hacia meta</span>
                  <span className="font-medium">{data.progress?.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(data.progress || 0, 100)} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.value, data.currency ?? "COP")} de {formatCurrency(data.target || 0, data.currency ?? "COP")}
                </p>
              </div>
            )}
            
            {/* Insights */}
            {data.insight && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">{data.insight}</p>
              </div>
            )}
            
            {/* Breakdown */}
            {details && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">{details.title}</h4>
                <div className="space-y-2">
                  {details.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-muted rounded-md transition-colors">
                      <span className="text-sm">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.value}</span>
                        {item.href && (
                          <Link href={item.href}>
                            <ArrowUpRightIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-2">
              {type === "income" && (
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/transactions?direction=INFLOW">Ver ingresos</Link>
                </Button>
              )}
              {type === "expenses" && (
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/transactions?direction=OUTFLOW">Ver gastos</Link>
                </Button>
              )}
              {type === "net-worth" && (
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/accounts">Ver cuentas</Link>
                </Button>
              )}
              <Button variant="default" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Quick stat component for smaller widgets
interface QuickStatProps {
  label: string;
  value: string;
  trend?: { direction: "up" | "down"; value: string };
  icon?: React.ElementType;
}

export function QuickStat({ label, value, trend, icon: Icon }: QuickStatProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      {Icon && (
        <div className="p-2 rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
      {trend && (
        <div className={`text-xs ${trend.direction === "up" ? "text-green-600" : "text-red-600"}`}>
          {trend.direction === "up" ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  );
}
