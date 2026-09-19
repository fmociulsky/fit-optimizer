import { AlertTriangle } from "lucide-react";
import {
  PLAN_PROFESSIONAL_WARNING,
  PLAN_WARNING_DETAIL,
} from "@/lib/disclaimers";

export function PlanWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-2 text-sm leading-relaxed">
        <p className="font-medium">{PLAN_PROFESSIONAL_WARNING}</p>
        {!compact && (
          <p className="text-muted-foreground">{PLAN_WARNING_DETAIL}</p>
        )}
      </div>
    </div>
  );
}
