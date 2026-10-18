import type { BspayTransactionRecord } from "@/integrations/bspay/server";

export type ReceiveMode = "charge" | "static_qr";

export interface ReceiveRequest {
  mode: ReceiveMode;
  currency: string;
  amount: number;
  description?: string | undefined;
}

export interface ReceiveResult {
  transactionId: string;
  externalId: string;
  status: string;
  currency: string;
  amount: number;
  fee: number;
  netAmount: number;
  qrcode: string;
  pixKey?: string | undefined;
  address?: string | undefined;
  chain?: string | undefined;
  expiresAt?: string | undefined;
  expirationSeconds?: number | undefined;
  payerName?: string | null | undefined;
}

export const RECEIVE_FEE_RATE = 0.03; // 3%
export const RECEIVE_MIN_FEE = 0.9; // R$ 0,90

export function calculateReceiveFee(amount: number): number {
  if (amount <= 0) return 0;
  const percentageFee = amount * RECEIVE_FEE_RATE;
  return Number(Math.max(RECEIVE_MIN_FEE, percentageFee).toFixed(2));
}

/**
 * Gera uma cobrança (Cash-in PIX/Cripto) ou um QR Code fixo (Static Wallet) via BSPAY API v2.
 */
export async function executeReceive(
  request: ReceiveRequest,
  userId?: string | null
): Promise<ReceiveResult> {
  const userTag = userId
    ? `U_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}-`
    : "";
  const externalId = `BKP-IN-${userTag}${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const res = await fetch("/api/bspay/receive", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: request.mode,
      currency: request.currency,
      amount: request.amount,
      description: request.description,
      externalId,
      userId,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: {
      transactionId?: string;
      status?: string;
      currency?: string;
      amount?: number;
      fee?: number;
      qrcode?: string;
      pixKey?: string;
      address?: string;
      chain?: string;
      expiresAt?: string;
      expirationSeconds?: number;
    };
    error?: { message?: string };
  };

  if (!res.ok || !payload.success || !payload.data) {
    throw new Error(
      payload.error?.message ||
        "Não foi possível gerar o pagamento na BSPAY."
    );
  }

  const data = payload.data;
  const amount = Number(data.amount ?? request.amount ?? 0);
  const fee = calculateReceiveFee(amount);
  const netAmount = Math.max(0, Number((amount - fee).toFixed(2)));
  const transactionId = data.transactionId || externalId;
  const status = data.status || "pending";

  return {
    transactionId,
    externalId,
    status,
    currency: data.currency || request.currency,
    amount,
    fee,
    netAmount,
    qrcode: data.qrcode || "",
    pixKey: data.pixKey,
    address: data.address,
    chain: data.chain,
    expiresAt: data.expiresAt,
    expirationSeconds: data.expirationSeconds,
  };
}

/**
 * Consulta o status em tempo real de uma transação na BSPAY.
 */
export async function checkReceiveStatus(
  transactionId: string,
  externalId?: string
): Promise<{
  confirmed: boolean;
  status: string;
  payerName?: string | null | undefined;
  fee?: number | undefined;
  amount?: number | undefined;
}> {
  const query = new URLSearchParams();
  if (transactionId && !transactionId.startsWith("WALLET-")) {
    query.set("transactionId", transactionId);
  } else if (externalId) {
    query.set("externalId", externalId);
  }

  const res = await fetch(`/api/bspay/transactions?${query.toString()}`);
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { items?: BspayTransactionRecord[] };
  };

  const items = json.data?.items ?? [];
  const match =
    items.find(
      (i) =>
        i.transaction_id === transactionId ||
        (externalId && i.external_id === externalId)
    ) ?? items[0];

  if (!match) {
    return { confirmed: false, status: "pending" };
  }

  const rawStatus = (match.status || "pending").toLowerCase();
  const confirmed =
    rawStatus === "confirmed" ||
    rawStatus === "paid" ||
    rawStatus === "completed" ||
    Boolean(match.confirmed_at);

  return {
    confirmed,
    status: confirmed ? "confirmed" : rawStatus,
    payerName: match.payer?.name,
    fee: match.fee_amount != null ? Number(match.fee_amount) : undefined,
    amount: match.amount != null ? Number(match.amount) : undefined,
  };
}
