import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Scale,
  FileWarning,
} from "lucide-react";
import { brl } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import type { BspayMedRecord, BspayMedWidgets, MedStatus } from "@/integrations/bspay/server";

const EMPTY_MED_WIDGETS: BspayMedWidgets = {
  total_meds: 0,
  awaiting_defense: 0,
  legal_analysis: 0,
  closed: 0,
  total_won: 0,
  total_returned: 0,
  total_pending: 0,
  pending_infractions: 0,
};

export async function fetchClientMeds(
  userId?: string | null,
  userCreatedAt?: string | null
): Promise<{
  widgets: BspayMedWidgets;
  items: BspayMedRecord[];
}> {
  if (!userId) {
    return {
      widgets: EMPTY_MED_WIDGETS,
      items: [],
    };
  }
  const query = new URLSearchParams({
    userId,
    scope: "user",
  });
  if (userCreatedAt) {
    query.set("userCreatedAt", userCreatedAt);
  }
  const res = await fetch(`/api/bspay/meds?${query.toString()}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: { widgets: BspayMedWidgets; items: BspayMedRecord[] };
  };
  if (!res.ok || !json.success || !json.data) {
    return {
      widgets: EMPTY_MED_WIDGETS,
      items: [],
    };
  }
  return json.data;
}

export function getMedStatusBadge(status: MedStatus) {
  switch (status) {
    case "awaiting_defense":
      return {
        label: "Bloqueio Cautelar • Aguardando Defesa",
        className: "bg-warning/15 text-warning border border-warning/30",
        icon: AlertTriangle,
      };
    case "legal_analysis":
      return {
        label: "Em Análise no Banco (BACEN)",
        className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
        icon: Scale,
      };
    case "returned":
      return {
        label: "Reembolsado ao Banco do Pagador (MED)",
        className: "bg-destructive/15 text-destructive border border-destructive/30",
        icon: XCircle,
      };
    case "won":
      return {
        label: "Defesa Aceita • Saldo Liberado",
        className: "bg-primary/15 text-primary border border-primary/30",
        icon: CheckCircle2,
      };
    case "closed":
    default:
      return {
        label: "Encerrado",
        className: "bg-muted text-muted-foreground border border-border",
        icon: Clock,
      };
  }
}

export function MedAlertBanner() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["bspay_meds", user?.id],
    queryFn: () => fetchClientMeds(user?.id, user?.created_at),
    refetchInterval: 5000,
  });

  const allItems = data?.items ?? [];
  const activeOrReturnedMeds = allItems.filter(
    (m) =>
      m.status === "awaiting_defense" ||
      m.status === "legal_analysis" ||
      m.status === "returned"
  );

  if (activeOrReturnedMeds.length === 0) {
    return null;
  }

  const totalAffected = activeOrReturnedMeds.reduce((acc, m) => acc + m.amount, 0);
  const hasReturned = activeOrReturnedMeds.some((m) => m.status === "returned");

  return (
    <div
      className={`rounded-xl border p-4 shadow-lg transition-all ${
        hasReturned
          ? "border-destructive/50 bg-destructive/10"
          : "border-warning/50 bg-warning/10"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              hasReturned
                ? "bg-destructive/20 text-destructive"
                : "bg-warning/20 text-warning"
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                Aviso de MED (Mecanismo Especial de Devolução PIX)
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  hasReturned
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-warning text-black"
                }`}
              >
                {activeOrReturnedMeds.length} ocorrência(s) • {brl(totalAffected)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Um cliente/pagador solicitou reembolso diretamente dentro do próprio banco (contestação PIX via MED). O valor correspondente foi{" "}
              {hasReturned ? "devolvido ao banco de origem ou " : ""}
              bloqueado cautelarmente na sua conta.
            </p>

            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {activeOrReturnedMeds.slice(0, 4).map((med) => {
                const badge = getMedStatusBadge(med.status);
                return (
                  <div
                    key={med.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        Pagador: {med.payerName}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Ref: {med.transactionId} • {badge.label}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-xs font-bold text-destructive">
                      -{brl(med.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end lg:self-center">
          <Link
            to="/$section"
            params={{ section: "infracoes" }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
          >
            Ver Detalhes do MED <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ClientMedInfractionsPanel() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["bspay_meds", user?.id],
    queryFn: () => fetchClientMeds(user?.id, user?.created_at),
    refetchInterval: 5000,
  });

  const widgets = data?.widgets;
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <span className="text-xs text-muted-foreground">Total de MEDs</span>
          <p className="mt-1 font-display text-2xl font-bold">
            {widgets?.total_meds ?? 0}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Contestações registradas no banco
          </span>
        </div>
        <div className="panel p-4">
          <span className="text-xs text-muted-foreground">Aguardando Defesa</span>
          <p className="mt-1 font-display text-2xl font-bold text-warning">
            {widgets?.awaiting_defense ?? 0}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Em bloqueio cautelar
          </span>
        </div>
        <div className="panel p-4">
          <span className="text-xs text-muted-foreground">Valor Retido em MED</span>
          <p className="mt-1 font-display text-2xl font-bold text-warning">
            {brl(widgets?.total_pending ?? 0)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Indisponível até conclusão
          </span>
        </div>
        <div className="panel p-4">
          <span className="text-xs text-muted-foreground">Reembolsados (MED)</span>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">
            {widgets?.total_returned ?? 0}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Devolvidos ao banco origem
          </span>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              Histórico de MED (Mecanismo Especial de Devolução)
            </h3>
            <p className="text-xs text-muted-foreground">
              Sincronizado em tempo real com a adquirente BSPAY e o Banco Central
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Sincronizando status de MED com a BSPAY...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-surface py-12 text-center">
            <FileWarning className="mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-semibold">Nenhum MED registrado na sua conta</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Quando um pagador solicita reembolso/contestação de PIX diretamente no banco dele, o alerta e os detalhes do MED aparecem aqui e na sua Dashboard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">ID MED / Transação</th>
                  <th className="px-4 py-3">Pagador Contestante</th>
                  <th className="px-4 py-3">Motivo do Banco</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status MED</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((med) => {
                  const badge = getMedStatusBadge(med.status);
                  const BadgeIcon = badge.icon;
                  return (
                    <tr key={med.id} className="hover:bg-surface/60">
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <div className="font-semibold text-foreground">{med.id}</div>
                        <div className="text-muted-foreground">
                          TX: {med.transactionId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {med.payerName}
                        </div>
                        {med.payerDocument && (
                          <div className="text-[11px] text-muted-foreground">
                            Doc: {med.payerDocument}
                          </div>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-muted-foreground">
                        {med.reason}
                      </td>
                      <td className="px-4 py-3 font-display font-bold text-destructive">
                        -{brl(med.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          <BadgeIcon className="h-3 w-3" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(med.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

