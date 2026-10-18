import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/bokashi/AppShell";
import { StatCard } from "@/components/bokashi/StatCard";
import { FlowChart } from "@/components/bokashi/FlowChart";
import { QuickActions } from "@/components/bokashi/QuickActions";
import { Balances } from "@/components/bokashi/Balances";
import { Transactions } from "@/components/bokashi/Transactions";
import { MedAlertBanner } from "@/components/bokashi/MedAlertBanner";
import { brl } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStats, type StatItem } from "@/services/stats";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Resumo Financeiro — BokashiPay" },
      { name: "description", content: "Painel financeiro BokashiPay: saldos, fluxo, ações rápidas e transações." },
      { property: "og:title", content: "Resumo Financeiro — BokashiPay" },
      { property: "og:description", content: "Painel financeiro BokashiPay: saldos, fluxo e transações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const emptyMain: StatItem[] = [
  { key: "available", title: "Saldo disponível", value: 0, desc: "Pronto para saque", icon: "wallet" },
  { key: "today", title: "Recebido hoje", value: 0, desc: "Entradas do dia", icon: "arrowDown" },
  { key: "blocked", title: "Saldo bloqueado", value: 0, desc: "Indisponível para saque", icon: "lock" },
  { key: "total", title: "Faturamento total", value: 0, desc: "Volume total processado", icon: "chart" },
];

const emptySecondary: StatItem[] = [
  { key: "pending", title: "Saldo a receber", value: "R$ 0,00", desc: "Valores pendentes de liberação", icon: "clock" },
  { key: "ticket", title: "Ticket médio", value: "R$ 0,00", desc: "Valor médio por transação", icon: "receipt" },
  { key: "daily", title: "Média diária", value: "R$ 0,00", desc: "Média diária de entradas", icon: "trend" },
  { key: "count", title: "Qtd. de transações", value: "0", desc: "Total de transações no período", icon: "swap" },
];

export function Dashboard() {
  const { user } = useAuth();
  const { data: statsData } = useQuery({
    queryKey: ["financial_stats", user?.id],
    queryFn: () => fetchStats(user?.id),
    refetchInterval: 5000,
  });

  const mainStats: readonly StatItem[] = statsData?.main ?? emptyMain;
  const secondaryStats = statsData?.secondary ?? emptySecondary;

  return (
    <AppShell title="Resumo Financeiro" subtitle="Visão geral das suas finanças">
      <div className="space-y-4">
        <MedAlertBanner />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {mainStats.map((s) => (
            <StatCard
              key={s.key}
              title={s.title}
              value={typeof s.value === "number" ? brl(s.value) : s.value}
              desc={s.desc}
              icon={s.icon}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <FlowChart />
          <QuickActions />
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {secondaryStats.map((s) => (
            <StatCard
              key={s.key}
              compact
              title={s.title}
              value={String(s.value)}
              desc={s.desc}
              icon={s.icon}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Balances />
          <Transactions />
        </div>
      </div>
    </AppShell>
  );
}

