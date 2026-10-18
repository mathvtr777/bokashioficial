import { useState, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart } from "lucide-react";
import { flowData, brl } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchTransactions } from "@/services/transactions";

type Period = keyof typeof flowData;
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`);

export function FlowChart() {
  const [period, setPeriod] = useState<Period>("Mês");
  const { user } = useAuth();

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => fetchTransactions(user?.id),
    refetchInterval: 5000,
  });

  const chartData = useMemo(() => {
    const confirmedTxs = txs.filter((t) => t.status === "Concluído");

    if (confirmedTxs.length === 0) {
      if (period === "Semana") {
        return ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => ({
          label: d,
          entradas: 0,
          saidas: 0,
        }));
      }
      if (period === "Mês") {
        return Array.from({ length: 30 }, (_, i) => ({
          label: `${String(i + 1).padStart(2, "0")}/${String(new Date().getMonth() + 1).padStart(2, "0")}`,
          entradas: 0,
          saidas: 0,
        }));
      }
      return ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((m) => ({
        label: m,
        entradas: 0,
        saidas: 0,
      }));
    }

    if (period === "Semana") {
      const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const orderedLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
      const byDay = new Map<string, { entradas: number; saidas: number }>(
        orderedLabels.map((d) => [d, { entradas: 0, saidas: 0 }])
      );
      for (const t of confirmedTxs) {
        const parsed = t.rawDate
          ? new Date(t.rawDate.includes("T") ? t.rawDate : t.rawDate.replace(" ", "T"))
          : new Date();
        const label = dayLabels[parsed.getDay()] || "Sex";
        const bucket = byDay.get(label);
        if (bucket) {
          if (t.type === "Entrada") bucket.entradas += Math.abs(t.value);
          else bucket.saidas += Math.abs(t.value);
        }
      }
      return orderedLabels.map((d) => ({
        label: d,
        entradas: Number((byDay.get(d)?.entradas ?? 0).toFixed(2)),
        saidas: Number((byDay.get(d)?.saidas ?? 0).toFixed(2)),
      }));
    }

    if (period === "Mês") {
      const daysCount = 30;
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
      return Array.from({ length: daysCount }, (_, i) => {
        const dayStr = String(i + 1).padStart(2, "0");
        const label = `${dayStr}/${currentMonth}`;
        const dayTxs = confirmedTxs.filter((t) => t.date.startsWith(dayStr));
        const entradas = dayTxs.filter((t) => t.type === "Entrada").reduce((acc, t) => acc + Math.abs(t.value), 0);
        const saidas = dayTxs.filter((t) => t.type === "Saída").reduce((acc, t) => acc + Math.abs(t.value), 0);
        return { label, entradas, saidas };
      });
    }

    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months.map((m, i) => {
      const mStr = String(i + 1).padStart(2, "0");
      const mTxs = confirmedTxs.filter((t) => {
        const parts = t.date.split("/");
        return parts[1]?.startsWith(mStr);
      });
      const entradas = mTxs.filter((t) => t.type === "Entrada").reduce((acc, t) => acc + Math.abs(t.value), 0);
      const saidas = mTxs.filter((t) => t.type === "Saída").reduce((acc, t) => acc + Math.abs(t.value), 0);
      return { label: m, entradas, saidas };
    });
  }, [txs, period]);
  return (
    <div className="panel flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><LineChart className="h-4 w-4" /></div>
          <div>
            <h2 className="text-base font-semibold">Fluxo Financeiro Diário</h2>
            <p className="text-xs text-muted-foreground">Entradas e saídas no período</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {(Object.keys(flowData) as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                p === period ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground")}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ left: -12, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tickFormatter={compact} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(v: number, n: string) => [brl(v), n === "entradas" ? "Entradas" : "Saídas"]}
            />
            <Area type="monotone" dataKey="entradas" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gIn)" />
            <Area type="monotone" dataKey="saidas" stroke="var(--chart-2)" strokeWidth={1.75} strokeDasharray="4 3" fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-1" />Entradas</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-2" />Saídas</span>
      </div>
    </div>
  );
}
