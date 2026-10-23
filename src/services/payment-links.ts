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
  if (typeof window === "undefined") return [];
  const targetId = userId || "guest";
  try {
    const raw = localStorage.getItem(getLocalKey(targetId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as PaymentLinkRecord[];
    }
  } catch {
    // ignore
  }

  // Fallback: search across all bokashipay_payment_links_* keys
  try {
    const list: PaymentLinkRecord[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bokashipay_payment_links_")) {
        const itemRaw = localStorage.getItem(k);
        if (itemRaw) {
          const parsed = JSON.parse(itemRaw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id && !list.some((existing) => existing.id === item.id)) {
                list.push(item);
              }
            }
          }
        }
      }
    }
    return list;
  } catch {
    return [];
  }
}

function writeLocalLinks(userId: string, links: PaymentLinkRecord[]) {
  if (typeof window === "undefined") return;
  const targetId = userId || "guest";
  try {
    localStorage.setItem(getLocalKey(targetId), JSON.stringify(links));
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
  const queryUserId = userId || "guest";

  try {
    const res = await fetch(
      `/api/payment-links?userId=${encodeURIComponent(queryUserId)}`
    );
    const json = (await res.json()) as {
      success?: boolean;
      data?: { items?: PaymentLinkRecord[] };
    };
    if (res.ok && json.success && Array.isArray(json.data?.items) && json.data.items.length > 0) {
      const serverItems = json.data.items;
      writeLocalLinks(queryUserId, serverItems);
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

  // Fallback to local storage if API unreachable
  const allLocal = readLocalLinks("guest");
  const found = allLocal.find((l) => l.slug === slug || l.id === slug);
  return found || null;
}

export async function createUserPaymentLink(
  input: CreatePaymentLinkInput
): Promise<PaymentLinkRecord> {
  const effectiveUserId = input.userId || "guest";
  const payload = {
    ...input,
    userId: effectiveUserId,
  };

  try {
    const res = await fetch("/api/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        ...payload,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { item?: PaymentLinkRecord };
      error?: { message?: string };
    };

    if (res.ok && json.success && json.data?.item) {
      const created = json.data.item;
      const current = readLocalLinks(effectiveUserId);
      writeLocalLinks(effectiveUserId, [
        created,
        ...current.filter((l) => l.id !== created.id),
      ]);
      return created;
    }
  } catch {
    // fallback to local generation
  }

  // Client-side fallback if backend unreachable
  const shortCode = `${Date.now().toString(36).slice(-4)}${Math.floor(
    10 + Math.random() * 90
  )}`.toUpperCase();
  const id = `PL-${shortCode}`;
  const slug = `${(input.title || "pagamento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "pagamento"}-${shortCode.toLowerCase()}`;
  const now = new Date().toISOString();

  const fallbackRecord: PaymentLinkRecord = {
    id,
    slug,
    userId: effectiveUserId,
    title: input.title,
    description: input.description || null,
    amount: input.amount,
    currency: input.currency || "BRL",
    linkCatalogProduct: Boolean(input.linkCatalogProduct),
    catalogProductId: input.catalogProductId || null,
    catalogProductName: input.catalogProductName || null,
    photoUrl: input.photoUrl || null,
    isLimited: Boolean(input.isLimited),
    maxPayments: input.maxPayments || null,
    enableBannertime: Boolean(input.enableBannertime),
    bannertimeMinutes: input.bannertimeMinutes || null,
    hasExpiration: Boolean(input.hasExpiration),
    expiresAt: input.hasExpiration && input.expiresAt ? input.expiresAt : null,
    passFeeToCustomer: Boolean(input.passFeeToCustomer),
    redirectAfterPayment: Boolean(input.redirectAfterPayment),
    redirectUrl: input.redirectUrl || null,
    paymentMethods: input.paymentMethods || ["pix", "crypto"],
    bannerUrl: input.bannerUrl || null,
    faviconUrl: input.faviconUrl || null,
    status: "pending",
    paymentsCount: 0,
    totalReceived: 0,
    paidTransactionIds: [],
    createdAt: now,
    updatedAt: now,
  };

  const current = readLocalLinks(effectiveUserId);
  writeLocalLinks(effectiveUserId, [
    fallbackRecord,
    ...current.filter((l) => l.id !== fallbackRecord.id),
  ]);
  return fallbackRecord;
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

