import { brl } from "@/data/mock";
import { fetchTransactions } from "./transactions";

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  balance: string;
  share: number;
}

interface BspayBalanceEntry {
  currency: string;
  available: string;
  allocation?: string;
}

const CURRENCY_META: Record<
  string,
  { name: string; symbol: string; decimals: number }
> = {
  BRL: { name: "Real brasileiro", symbol: "R$", decimals: 2 },
  USDT: { name: "Tether", symbol: "₮", decimals: 2 },
  BTC: { name: "Bitcoin", symbol: "₿", decimals: 4 },
  ETH: { name: "Ethereum", symbol: "Ξ", decimals: 4 },
  BNB: { name: "BNB", symbol: "B", decimals: 3 },
};

const ZERO_CURRENCIES: CurrencyItem[] = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", balance: "R$ 0,00", share: 0 },
  { code: "USDT", name: "Tether", symbol: "₮", balance: "0,00 USDT", share: 0 },
  { code: "BTC", name: "Bitcoin", symbol: "₿", balance: "0,0000 BTC", share: 0 },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", balance: "0,0000 ETH", share: 0 },
  { code: "BNB", name: "BNB", symbol: "B", balance: "0,000 BNB", share: 0 },
];

export async function fetchAdminMasterCurrencies(): Promise<CurrencyItem[]> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/bspay/balance");
      const json = (await res.json()) as {
        success?: boolean;
        data?: { balances?: BspayBalanceEntry[] };
      };
      if (res.ok && json.success && Array.isArray(json.data?.balances)) {
        const byCode = new Map(
          json.data.balances.map((b) => [b.currency, b])
        );
        const orderedCodes = ["BRL", "USDT", "BTC", "ETH", "BNB"];
        return orderedCodes.map((code) => {
          const meta = CURRENCY_META[code]!;
          const entry = byCode.get(code);
          const availNum = entry ? Number(entry.available) || 0 : 0;
          const shareNum = entry?.allocation
            ? Math.round(Number(entry.allocation) || 0)
            : 0;
          const formatted =
            code === "BRL"
              ? brl(availNum)
              : `${availNum.toLocaleString("pt-BR", {
                  minimumFractionDigits: meta.decimals,
                  maximumFractionDigits: meta.decimals,
                })} ${code}`;
          return {
            code,
            name: meta.name,
            symbol: meta.symbol,
            balance: formatted,
            share: shareNum,
          };
        });
      }
    } catch {
      // Fallback
    }
  }
  return ZERO_CURRENCIES;
}

export async function fetchCurrencies(userId?: string | null): Promise<CurrencyItem[]> {
  if (!userId) {
    return ZERO_CURRENCIES;
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

    const netEntradas = confirmedEntradas.reduce(
      (acc, t) => acc + Math.max(0, Math.abs(t.value) - (t.fee ?? 0)),
      0
    );
    const totalSaidas =
      confirmedSaidas.reduce((acc, t) => acc + Math.abs(t.value), 0) +
      analyzingSaidas.reduce((acc, t) => acc + Math.abs(t.value), 0);

    const available = Math.max(0, Number((netEntradas - totalSaidas).toFixed(2)));
    const brlFormatted = brl(available);
    const hasBalance = available > 0;

    return [
      { code: "BRL", name: "Real brasileiro", symbol: "R$", balance: brlFormatted, share: hasBalance ? 100 : 0 },
      { code: "USDT", name: "Tether", symbol: "₮", balance: "0,00 USDT", share: 0 },
      { code: "BTC", name: "Bitcoin", symbol: "₿", balance: "0,0000 BTC", share: 0 },
      { code: "ETH", name: "Ethereum", symbol: "Ξ", balance: "0,0000 ETH", share: 0 },
      { code: "BNB", name: "BNB", symbol: "B", balance: "0,000 BNB", share: 0 },
    ];
  } catch (err) {
    console.error("Error fetching currencies for user:", err);
    return ZERO_CURRENCIES;
  }
}
