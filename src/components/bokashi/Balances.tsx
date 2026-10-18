import { Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchCurrencies } from "@/services/balances";
import { useAuth } from "@/contexts/AuthContext";

export function Balances() {
  const { user } = useAuth();
  const { data: currenciesList = [] } = useQuery({
    queryKey: ["currencies", user?.id],
    queryFn: () => fetchCurrencies(user?.id),
    refetchInterval: 5000,
  });

  return (
    <div className="panel p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><Coins className="h-4 w-4" /></div>
        <div>
          <h2 className="text-base font-semibold">Saldos por Moeda</h2>
          <p className="text-xs text-muted-foreground">Saldos disponíveis por moeda</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {currenciesList.map((c) => (
          <li key={c.code} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface-2 font-display text-sm font-bold">{c.symbol}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{c.name} <span className="font-normal text-muted-foreground">{c.code}</span></p>
                <p className="tabular shrink-0 text-sm font-semibold group-data-[hidden=true]/main:blur-sm">{c.balance}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.share}%` }} />
                </div>
                <span className="tabular w-9 text-right text-xs text-muted-foreground">{c.share}%</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
