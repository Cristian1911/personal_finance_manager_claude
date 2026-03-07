"use client";

import { useTransition } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toggleDashboardVisibility } from "@/actions/accounts";

interface AccountOption {
  id: string;
  name: string;
  show_in_dashboard: boolean;
}

interface DashboardAccountPickerProps {
  accounts: AccountOption[];
}

export function DashboardAccountPicker({ accounts }: DashboardAccountPickerProps) {
  const [pending, startTransition] = useTransition();

  function handleToggle(accountId: string, currentValue: boolean) {
    startTransition(async () => {
      await toggleDashboardVisibility(accountId, !currentValue);
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-xs font-medium text-muted-foreground mb-3">
          Cuentas visibles en dashboard
        </p>
        <div className="space-y-2">
          {accounts.map((account) => (
            <label
              key={account.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={account.show_in_dashboard}
                onChange={() => handleToggle(account.id, account.show_in_dashboard)}
                disabled={pending}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">{account.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
