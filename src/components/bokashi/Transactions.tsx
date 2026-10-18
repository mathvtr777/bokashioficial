import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Inbox, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { brl, type TxStatus } from "@/data/mock";
import { cn } from "@/lib/utils";
import { fetchTransactions, type TransactionItem } from "@/services/transactions";
import { ReceiveDialog, ReceiveTriggerButton } from "./ReceiveDialog";
import { useAuth } from "@/contexts/AuthContext";

export function StatusBadge({ status }: { status: TxStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        status === "Concluído" &&
          "border-primary/30 bg-primary-soft/50 text-primary",
        status === "Pendente" && "border-warning/30 text-warning",
        status === "Em análise" && "border-border text-muted-foreground",
        (status === "Expirado" || status === "Cancelado") &&
          "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function TxTable({
  rows,
  searchQuery,
  filterType,
}: {
  rows?: TransactionItem[] | undefined;
  searchQuery?: string | undefined;
  filterType?: "Entrada" | "Saída" | undefined;
}) {
  const { user } = useAuth();
  const { data: queriedRows, isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => fetchTransactions(user?.id),
    enabled: rows === undefined,
    refetchInterval: 5000,
  });

  const rawList = rows ?? queriedRows ?? [];
  const q = (searchQuery || "").trim().toLowerCase();

  const list = rawList.filter((t) => {
    if (filterType && t.type !== filterType) return false;
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q)
    );
  });

  if (isLoading && !rows) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        Carregando transações da BSPAY...
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">
          Nenhuma transação encontrada
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {q
            ? "Nenhum resultado corresponde à sua busca."
            : "Sua conta ainda não possui movimentações nesta visualização."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2.5 font-medium">Transação</th>
            <th className="font-medium">Tipo</th>
            <th className="font-medium">Data</th>
            <th className="text-right font-medium">Valor</th>
            <th className="pl-4 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => {
            const inbound = t.value > 0;
            return (
              <tr
                key={t.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface"
              >
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                        inbound
                          ? "bg-primary-soft text-primary"
                          : "bg-surface-2 text-muted-foreground"
                      )}
                    >
                      {inbound ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground font-mono">
                        {t.id}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-muted-foreground">{t.type}</td>
                <td className="tabular text-muted-foreground">{t.date}</td>
                <td
                  className={cn(
                    "tabular text-right font-semibold group-data-[hidden=true]/main:blur-sm",
                    inbound ? "text-primary" : "text-foreground"
                  )}
                >
                  <div>
                    {inbound ? "+" : "−"} {brl(Math.abs(t.value))}
                  </div>
                  {t.fee && t.fee > 0 && t.status === "Concluído" ? (
                    <div className="text-[11px] font-normal text-muted-foreground">
                      Líq: {brl(Math.max(0, Math.abs(t.value) - t.fee))} (taxa{" "}
                      {brl(t.fee)})
                    </div>
                  ) : null}
                </td>
                <td className="pl-4 text-right">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Transactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: allTx = [], isFetching } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => fetchTransactions(user?.id),
    refetchInterval: 5000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["financial_stats"] });
    queryClient.invalidateQueries({ queryKey: ["currencies"] });
  };

  return (
    <div className="panel min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
            <ArrowLeftRight className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Últimas Transações</h2>
              <span
                className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400"
                title="Sincronizado em tempo real com a API BSPAY v2"
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                BSPAY Online
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sincronizadas automaticamente em tempo real com sua conta BSPAY
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            title="Atualizar transações e saldo"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </button>
          <ReceiveDialog trigger={<ReceiveTriggerButton />} />
          <Link
            to="/$section"
            params={{ section: "extrato" }}
            className="text-xs font-semibold text-primary hover:opacity-80"
          >
            Ver extrato
          </Link>
        </div>
      </div>
      <div className="mt-3">
        <TxTable rows={allTx.slice(0, 8)} />
      </div>
    </div>
  );
}
