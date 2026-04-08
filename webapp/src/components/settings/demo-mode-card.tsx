"use client";

import { useTransition, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleDemoMode, clearDemoData } from "@/actions/demo";

interface DemoModeCardProps {
  initialDemoMode: boolean;
}

export function DemoModeCard({ initialDemoMode }: DemoModeCardProps) {
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const [isToggling, startToggle] = useTransition();
  const [isClearing, startClear] = useTransition();

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleDemoMode();
      if (result.success) {
        setDemoMode(result.data.demoMode);
      }
    });
  }

  function handleClear() {
    startClear(async () => {
      const result = await clearDemoData();
      if (result.success) {
        setDemoMode(false);
      }
    });
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
            <Eye className="size-4 text-z-brass" />
          </div>
          <CardTitle>Modo Demo</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Muestra datos ficticios en lugar de tus datos reales. Ideal para mostrar la app a otras personas sin revelar tu información financiera.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="demo-mode">Activar modo demo</Label>
            <p className="text-xs text-muted-foreground">
              {demoMode
                ? "El dashboard muestra datos de ejemplo"
                : "El dashboard muestra tus datos reales"}
            </p>
          </div>
          <Switch
            id="demo-mode"
            checked={demoMode}
            onCheckedChange={handleToggle}
            disabled={isToggling || isClearing}
          />
        </div>

        {demoMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isClearing || isToggling}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 size-3.5" />
            {isClearing ? "Eliminando..." : "Eliminar datos demo y desactivar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
