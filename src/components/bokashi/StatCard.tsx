import {
  ArrowDownToLine, BarChart3, Clock, Lock, Receipt, Repeat2, TrendingUp, Wallet, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  wallet: Wallet, arrowDown: ArrowDownToLine, lock: Lock, chart: BarChart3,
  clock: Clock, receipt: Receipt, trend: TrendingUp, swap: Repeat2,
};

export function StatCard({ title, value, desc, icon, compact }: { title: string; value: string; desc: string; icon: string; compact?: boolean }) {
  const Icon = icons[icon] ?? Wallet;
  return (
    <div className={cn("panel stat-accent group flex items-start justify-between gap-3 transition-colors hover:border-primary/40 hover:bg-surface",
      compact ? "p-4" : "p-5")}>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
        <p className={cn("tabular mt-1.5 truncate font-display font-bold tracking-tight group-data-[hidden=true]/main:blur-sm",
          compact ? "text-lg" : "text-2xl")}>{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className={cn("grid shrink-0 place-items-center rounded-lg bg-primary-soft text-primary", compact ? "h-8 w-8" : "h-10 w-10")}>
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.75} />
      </div>
    </div>
  );
}
