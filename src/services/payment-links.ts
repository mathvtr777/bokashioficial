import type {
  CreatePaymentLinkInput,
  PaymentLinkMethod,
  PaymentLinkRecord,
  PaymentLinkStatus,
} from "@/integrations/bspay/server";
import { RECEIVE_FEE_RATE, RECEIVE_MIN_FEE } from "./receives";

export type {
  CreatePaymentLinkInput,
  PaymentLinkMethod,
  PaymentLinkRecord,
  PaymentLinkStatus,
};

const getLocalKey = (userId: string) => `bokashipay_payment_links_${userId}`;

function readLocalLinks(userId?: string | null): PaymentLinkRecord[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(getLocalKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? (parsed as PaymentLinkRecord[]).filter((l) => l.userId === userId)
      : [];
  } catch {
    return [];
  }
}

function writeLocalLinks(userId: string, links: PaymentLinkRecord[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(getLocalKey(userId), JSON.stringify(links));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Calcula o valor final cobrado do cliente quando a opção "Repassar taxa" está ativada,
 * garantindo que o lojista receba o valor integral sem desconto.
 */
export function calculateCustomerTotalWithPassedFee(amount: number): {
  customerTotal: number;
  fee: number;
  merchantNet: number;
} {
  if (amount <= 0) {
    return { customerTotal: 0, fee: 0, merchantNet: 0 };
  }
  const grossByRate = amount / (1 - RECEIVE_FEE_RATE);
  const grossByMin = amount + RECEIVE_MIN_FEE;
  const customerTotal = Number(Math.max(grossByRate, grossByMin).toFixed(2));
  const fee = Number((customerTotal - amount).toFixed(2));
  return {
    customerTotal,
    fee,
    merchantNet: Number(amount.toFixed(2)),
  };
}

export async function fetchUserPaymentLinks(
  userId?: string | null
): Promise<PaymentLinkRecord[]> {
  if (!userId) return [];

  try {
    const res = await fetch(
      `/api/payment-links?userId=${encodeURIComponent(userId)}`
    );
    const json = (await res.json()) as {
      success?: boolean;
      data?: { items?: PaymentLinkRecord[] };
    };
    if (res.ok && json.success && Array.isArray(json.data?.items)) {
      const serverItems = json.data.items;
      writeLocalLinks(userId, serverItems);
      return serverItems;
    }
  } catch {
    // fallback to local storage
  }

  return readLocalLinks(userId);
}

export async function fetchPaymentLinkBySlug(
  slug: string
): Promise<PaymentLinkRecord | null> {
  if (!slug) return null;
  try {
    const res = await fetch(
      `/api/payment-links?slug=${encodeURIComponent(slug)}`
    );
    const json = (await res.json()) as {
      success?: boolean;
      data?: { item?: PaymentLinkRecord };
    };
    if (res.ok && json.success && json.data?.item) {
      return json.data.item;
    }
  } catch {
    // ignore error
  }
  return null;
}

export async function createUserPaymentLink(
  input: CreatePaymentLinkInput
): Promise<PaymentLinkRecord> {
  const res = await fetch("/api/payment-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      ...input,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { item?: PaymentLinkRecord };
    error?: { message?: string };
  };

  if (!res.ok || !json.success || !json.data?.item) {
    throw new Error(
      json.error?.message || "Não foi possível criar o link de pagamento."
    );
  }

  const created = json.data.item;
  const current = readLocalLinks(input.userId);
  writeLocalLinks(input.userId, [
    created,
    ...current.filter((l) => l.id !== created.id),
  ]);
  return created;
}

export async function updateUserPaymentLink(
  id: string,
  userId: string,
  patch: Partial<CreatePaymentLinkInput> & { status?: PaymentLinkStatus }
): Promise<PaymentLinkRecord> {
  const res = await fetch("/api/payment-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update",
      id,
      userId,
      ...patch,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { item?: PaymentLinkRecord };
    error?: { message?: string };
  };

  if (!res.ok || !json.success || !json.data?.item) {
    throw new Error(
      json.error?.message || "Não foi possível atualizar o link de pagamento."
    );
  }

  const updated = json.data.item;
  const current = readLocalLinks(userId);
  writeLocalLinks(
    userId,
    current.map((l) => (l.id === updated.id ? updated : l))
  );
  return updated;
}

export async function toggleUserPaymentLinkStatus(
  id: string,
  userId: string,
  status: PaymentLinkStatus
): Promise<PaymentLinkRecord> {
  const res = await fetch("/api/payment-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "toggle_status",
      id,
      userId,
      status,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { item?: PaymentLinkRecord };
    error?: { message?: string };
  };

  if (!res.ok || !json.success || !json.data?.item) {
    throw new Error(
      json.error?.message || "Não foi possível alterar o status do link."
    );
  }

  return json.data.item;
}

export async function deleteUserPaymentLink(
  id: string,
  userId: string
): Promise<void> {
  await fetch("/api/payment-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "delete",
      id,
      userId,
    }),
  });

  const current = readLocalLinks(userId);
  writeLocalLinks(
    userId,
    current.filter((l) => l.id !== id && l.slug !== id)
  );
}

export async function notifyPaymentLinkPaid(
  slugOrId: string,
  transactionId: string,
  paidAmount: number
): Promise<PaymentLinkRecord | null> {
  try {
    const res = await fetch("/api/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_payment",
        slug: slugOrId,
        transactionId,
        paidAmount,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { item?: PaymentLinkRecord };
    };
    return json.data?.item ?? null;
  } catch {
    return null;
  }
}

