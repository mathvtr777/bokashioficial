// Demo data only — replace with real API data in a later phase.
export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const mainStats = [
  { key: "available", title: "Saldo disponível", value: 12458.9, desc: "Pronto para saque", icon: "wallet" },
  { key: "today", title: "Recebido hoje", value: 3250, desc: "Entradas do dia", icon: "arrowDown" },
  { key: "blocked", title: "Saldo bloqueado", value: 1840, desc: "Indisponível para saque", icon: "lock" },
  { key: "total", title: "Faturamento total", value: 48920.5, desc: "Volume total processado", icon: "chart" },
] as const;

export const secondaryStats = [
  { key: "pending", title: "Saldo a receber", value: brl(2450), desc: "Valores pendentes de liberação", icon: "clock" },
  { key: "ticket", title: "Ticket médio", value: brl(86.4), desc: "Valor médio por transação", icon: "receipt" },
  { key: "daily", title: "Média diária", value: brl(1630.68), desc: "Média diária de entradas", icon: "trend" },
  { key: "count", title: "Qtd. de transações", value: "568", desc: "Total de transações no período", icon: "swap" },
] as const;

const seed = (i: number, a: number, b: number) => Math.round(a + Math.abs(Math.sin(i * 1.7) * b) + i * 12);

export const flowData = {
  Semana: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, i) => ({
    label: d, entradas: seed(i, 1200, 900), saidas: seed(i + 3, 400, 500),
  })),
  "Mês": Array.from({ length: 30 }, (_, i) => ({
    label: `${String(i + 1).padStart(2, "0")}/10`, entradas: seed(i, 900, 1300), saidas: seed(i + 5, 300, 700),
  })),
  Ano: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m, i) => ({
    label: m, entradas: seed(i, 28000, 18000) * 1, saidas: seed(i + 2, 9000, 8000),
  })),
};

export const currencies = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", balance: "R$ 12.458,90", share: 62 },
  { code: "USDT", name: "Tether", symbol: "₮", balance: "1.240,00 USDT", share: 18 },
  { code: "BTC", name: "Bitcoin", symbol: "₿", balance: "0,0182 BTC", share: 11 },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", balance: "0,4120 ETH", share: 6 },
  { code: "BNB", name: "BNB", symbol: "B", balance: "1,850 BNB", share: 3 },
];

export type TxStatus = "Concluído" | "Pendente" | "Em análise" | "Expirado" | "Cancelado";
export const transactions: { id: string; name: string; type: "Entrada" | "Saída"; date: string; value: number; status: TxStatus }[] = [
  { id: "TX-9821", name: "Recebimento PIX", type: "Entrada", date: "14/10 18:42", value: 450, status: "Concluído" },
  { id: "TX-9820", name: "Pagamento enviado", type: "Saída", date: "14/10 16:10", value: -1200, status: "Concluído" },
  { id: "TX-9819", name: "Recebimento de checkout", type: "Entrada", date: "14/10 14:03", value: 289.9, status: "Pendente" },
  { id: "TX-9818", name: "Liberação de saldo", type: "Entrada", date: "14/10 09:30", value: 1840, status: "Em análise" },
  { id: "TX-9817", name: "Recebimento PIX", type: "Entrada", date: "13/10 21:15", value: 670.1, status: "Concluído" },
  { id: "TX-9816", name: "Pagamento enviado", type: "Saída", date: "13/10 11:48", value: -320, status: "Concluído" },
];
