import { brl } from "@/data/mock";
import { fetchTransactions } from "./transactions";

export interface StatItem {
  key: string;
  title: string;
  value: number | string;
  desc: string;
  icon: string;
}

const ZERO_STATS: { main: StatItem[]; secondary: StatItem[] } = {
  main: [
    { key: "available", title: "Saldo disponível", value: 0, desc: "Pronto para saque", icon: "wallet" },
    { key: "today", title: "Recebido hoje", value: 0, desc: "Entradas do dia", icon: "arrowDown" },
    { key: "blocked", title: "Saldo bloqueado", value: 0, desc: "Indisponível para saque", icon: "lock" },
    { key: "total", title: "Faturamento total", value: 0, desc: "Volume total processado", icon: "chart" },
  ],
  secondary: [
    { key: "pending", title: "Saldo a receber", value: "R$ 0,00", desc: "Valores pendentes de liberação", icon: "clock" },
    { key: "ticket", title: "Ticket médio", value: "R$ 0,00", desc: "Valor médio por transação", icon: "receipt" },
    { key: "daily", title: "Média diária", value: "R$ 0,00", desc: "Média diária de entradas", icon: "trend" },
    { key: "count", title: "Qtd. de transações", value: "0", desc: "Total de transações no período", icon: "swap" },
  ],
};

export async function fetchStats(userId?: string | null): Promise<{
  main: StatItem[];
  secondary: StatItem[];
}> {
  if (!userId) {
    return ZERO_STATS;
  }

  try {
    const txs = await fetchTransactions(userId);

    const confirmedEntradas = txs.filter(
      (t) => t.type === "Entrada" && t.status === "Concluído"
    );
    const confirmedSaidas = txs.filter(
      (t) => t.type === "Saída" && t.status === "Concluído"
    );
    const analyzingSaidas = txs.filter(
      (t) => t.type === "Saída" && t.status === "Em análise"
    );
    const analyzingEntradas = txs.filter(
      (t) => t.type === "Entrada" && t.status === "Em análise"
    );

    const txTotalRevenue = Number(
      confirmedEntradas
        .reduce((acc, t) => acc + Math.abs(t.value), 0)
        .toFixed(2)
    );

    const netEntradas = confirmedEntradas.reduce(
      (acc, t) => acc + Math.max(0, Math.abs(t.value) - (t.fee ?? 0)),
      0
    );

    const totalSaidas =
      confirmedSaidas.reduce((acc, t) => acc + Math.abs(t.value), 0) +
      analyzingSaidas.reduce((acc, t) => acc + Math.abs(t.value), 0);

    const txAvailable = Math.max(
      0,
      Number((netEntradas - totalSaidas).toFixed(2))
    );

    const txBlocked = Number(
      (
        analyzingSaidas.reduce((acc, t) => acc + Math.abs(t.value), 0) +
        analyzingEntradas.reduce((acc, t) => acc + Math.abs(t.value), 0)
      ).toFixed(2)
    );

    const txPending = Number(
      txs
        .filter((t) => t.status === "Pendente" && t.value > 0)
        .reduce((acc, t) => acc + t.value, 0)
        .toFixed(2)
    );

    const todayStr = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const txTodayIn = Number(
      confirmedEntradas
        .filter((t) => t.date.includes(todayStr))
        .reduce((acc, t) => acc + Math.abs(t.value), 0)
        .toFixed(2)
    );

    const txAvgTicket =
      confirmedEntradas.length > 0
        ? txTotalRevenue / confirmedEntradas.length
        : 0;
    const txDailyAvg = txTotalRevenue > 0 ? txTotalRevenue / 30 : 0;

    return {
      main: [
        {
          key: "available",
          title: "Saldo disponível",
          value: txAvailable,
          desc: "Pronto para saque",
          icon: "wallet",
        },
        {
          key: "today",
          title: "Recebido hoje",
          value: txTodayIn,
          desc: "Entradas do dia",
          icon: "arrowDown",
        },
        {
          key: "blocked",
          title: "Saldo bloqueado",
          value: txBlocked,
          desc: "Indisponível para saque",
          icon: "lock",
        },
        {
          key: "total",
          title: "Faturamento total",
          value: txTotalRevenue,
          desc: "Volume total processado",
          icon: "chart",
        },
      ],
      secondary: [
        {
          key: "pending",
          title: "Saldo a receber",
          value: brl(txPending),
          desc: "Valores pendentes de liberação",
          icon: "clock",
        },
        {
          key: "ticket",
          title: "Ticket médio",
          value: brl(txAvgTicket),
          desc: "Valor médio por transação",
          icon: "receipt",
        },
        {
          key: "daily",
          title: "Média diária",
          value: brl(txDailyAvg),
          desc: "Média diária de entradas",
          icon: "trend",
        },
        {
          key: "count",
          title: "Qtd. de transações",
          value: String(confirmedEntradas.length),
          desc: "Total de transações no período",
          icon: "swap",
        },
      ],
    };
  } catch (err) {
    console.error("Error calculating stats:", err);
    return ZERO_STATS;
  }
}
