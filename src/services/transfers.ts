import { createTransaction, type TransactionItem } from "./transactions";

export type TransferMode = "external" | "internal";
export type PixKeyType = "phone" | "cpf_cnpj" | "email" | "random";

export interface TransferRequest {
  mode: TransferMode;
  currency: string;
  amount: number;
  pixKeyType?: PixKeyType;
  pixKey: string;
  description?: string;
  clientName?: string | undefined;
  clientEmail?: string | undefined;
}

export interface TransferResult {
  transaction: TransactionItem;
  fee: number;
  netAmount: number;
  totalDebited: number;
  acquirerReference: string;
  acquirerStatus: string;
  queuedForApproval?: boolean | undefined;
}

export const TRANSFER_FEE_RATE = 0.02; // 2%
export const TRANSFER_MIN_FEE = 0.9; // R$ 0,90

export function calculateTransferFee(amount: number, mode: TransferMode): number {
  if (amount <= 0 || mode === "internal") return 0;
  const percentageFee = amount * TRANSFER_FEE_RATE;
  return Number(Math.max(TRANSFER_MIN_FEE, percentageFee).toFixed(2));
}

/**
 * Envia a solicitação de saque/transferência para a fila de aprovação manual do Admin
 * (ou executa diretamente caso disparado pelo Admin).
 */
export async function executeTransfer(
  request: TransferRequest,
  userId?: string | null
): Promise<TransferResult> {
  const fee = calculateTransferFee(request.amount, request.mode);
  const totalDebited = Number((request.amount + fee).toFixed(2));
  const userTag = userId
    ? `U_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}-`
    : "";
  const externalId = `BKP-OUT-${userTag}${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const res = await fetch("/api/bspay/transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: request.mode,
      currency: request.currency,
      amount: request.amount,
      pixKeyType: request.pixKeyType,
      pixKey: request.pixKey,
      description: request.description,
      externalId,
      clientName: request.clientName,
      clientEmail: request.clientEmail,
      userId,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: {
      transactionId?: string;
      status?: string;
      queuedForApproval?: boolean;
    };
    error?: { message?: string };
  };

  if (!res.ok || !payload.success) {
    throw new Error(
      payload.error?.message ||
        "Não foi possível processar a transferência na BSPAY."
    );
  }

  const acquirerReference = payload.data?.transactionId || externalId;
  const acquirerStatus = payload.data?.status || "pending_approval";
  const queuedForApproval = Boolean(payload.data?.queuedForApproval);

  const labelPrefix =
    request.mode === "internal" ? "Transferência interna" : "Saque PIX";
  const detail = request.description?.trim()
    ? `${request.description.trim()} (${request.pixKey})`
    : request.pixKey;

  const txStatus =
    acquirerStatus === "confirmed"
      ? "Concluído"
      : queuedForApproval || acquirerStatus === "pending_approval"
      ? "Em análise"
      : "Pendente";

  const transaction = await createTransaction(
    {
      id: acquirerReference,
      externalId,
      name: `${labelPrefix} — ${detail}`,
      type: "Saída",
      value: totalDebited,
      status: txStatus,
    },
    userId
  );

  return {
    transaction,
    fee,
    netAmount: request.amount,
    totalDebited,
    acquirerReference,
    acquirerStatus,
    queuedForApproval,
  };
}
