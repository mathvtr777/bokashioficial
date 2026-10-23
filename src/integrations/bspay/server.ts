const DEFAULT_BSPAY_API_URL = "https://api.bspay.co";
const DEFAULT_CLIENT_ID = "mathvtr2_f123bbeafb496828";
const DEFAULT_CLIENT_SECRET =
  "400c6e44cef34442f99a44a383d19a481ef4ebd9732c2a918bcea19747c8aa27";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function getCredentials() {
  const env = typeof process !== "undefined" ? process.env : {};
  const clientId = env?.["BSPAY_CLIENT_ID"] || DEFAULT_CLIENT_ID;
  const clientSecret = env?.["BSPAY_CLIENT_SECRET"] || DEFAULT_CLIENT_SECRET;
  const apiUrl = (env?.["BSPAY_API_URL"] || DEFAULT_BSPAY_API_URL).replace(/\/+$/, "");
  return { clientId, clientSecret, apiUrl };
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  const raw = `${clientId}:${clientSecret}`;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "utf-8").toString("base64");
  }
  return btoa(raw);
}

export async function getBspayAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret, apiUrl } = getCredentials();
  const basicAuth = encodeBasicAuth(clientId, clientSecret);

  const res = await fetch(`${apiUrl}/v2/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
  });

  const payload = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    data?: { access_token?: string; expires_in?: number };
    error?: { message?: string; code?: string } | string;
    message?: string;
  };

  const token = payload.access_token || payload.data?.access_token;
  const expiresIn = payload.expires_in || payload.data?.expires_in || 3600;

  if (!res.ok || !token) {
    const errMsg =
      (typeof payload.error === "object" && payload.error?.message) ||
      (typeof payload.error === "string" && payload.error) ||
      payload.message ||
      `Falha ao autenticar na BSPAY (HTTP ${res.status})`;
    throw new Error(errMsg);
  }

  cachedToken = {
    accessToken: token,
    expiresAt: now + expiresIn * 1000,
  };

  return token;
}

export interface BspayTransferInput {
  mode: "external" | "internal";
  currency: string;
  amount: number;
  pixKeyType?: "phone" | "cpf_cnpj" | "email" | "random";
  pixKey: string;
  description?: string;
  externalId: string;
  clientName?: string | undefined;
  clientEmail?: string | undefined;
  userId?: string | null | undefined;
  executeImmediately?: boolean | undefined;
}

function resolveBspayKeyType(
  pixKeyType: BspayTransferInput["pixKeyType"],
  pixKey: string
): "cpf" | "cnpj" | "email" | "phone" | "random" {
  if (pixKeyType === "cpf_cnpj") {
    const digits = pixKey.replace(/\D/g, "");
    return digits.length > 11 ? "cnpj" : "cpf";
  }
  if (pixKeyType === "email") return "email";
  if (pixKeyType === "random") return "random";
  return "phone";
}

function normalizePixKey(
  keyType: "cpf" | "cnpj" | "email" | "phone" | "random",
  rawKey: string
): string {
  const trimmed = rawKey.trim();
  if (keyType === "cpf" || keyType === "cnpj") {
    return trimmed.replace(/\D/g, "");
  }
  if (keyType === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return trimmed;
    if (trimmed.startsWith("+")) return `+${digits}`;
    return digits.startsWith("55") && digits.length >= 12 ? `+${digits}` : digits;
  }
  return trimmed;
}

export async function processBspayTransfer(input: BspayTransferInput) {
  const { apiUrl } = getCredentials();
  const token = await getBspayAccessToken();

  if (input.mode === "internal") {
    const body = JSON.stringify({
      username: input.pixKey.trim(),
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency || "BRL",
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      external_id: input.externalId,
    });

    const res = await fetch(`${apiUrl}/v2/internal_transfers/payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: {
        transaction_id?: string;
        status?: string;
        amount?: string | number;
      };
      error?: { code?: string; message?: string };
      message?: string;
    };

    if (!res.ok || json.success === false) {
      throw new Error(
        json.error?.message ||
          json.message ||
          `Erro na transferência interna BSPAY (HTTP ${res.status})`
      );
    }

    return {
      transactionId: json.data?.transaction_id || input.externalId,
      status: json.data?.status || "confirmed",
      raw: json,
    };
  }

  // External Cash-out (PIX / Cripto)
  const isCrypto = ["USDT", "USDC", "BTC", "ETH", "SOL", "BNB"].includes(
    input.currency
  );
  const bspayKeyType = resolveBspayKeyType(input.pixKeyType, input.pixKey);
  const normalizedKey = isCrypto
    ? input.pixKey.trim()
    : normalizePixKey(bspayKeyType, input.pixKey);

  const defaultCryptoNetwork: Record<string, string> = {
    USDT: "tron",
    USDC: "polygon",
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    BNB: "bsc",
  };

  const payload: Record<string, unknown> = {
    external_id: input.externalId,
    amount: Number(input.amount.toFixed(isCrypto ? 8 : 2)),
    currency: input.currency || "BRL",
    key: normalizedKey,
    ...(isCrypto
      ? { network: defaultCryptoNetwork[input.currency] || "tron" }
      : { key_type: bspayKeyType }),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
  };

  const body = JSON.stringify(payload);

  const res = await fetch(`${apiUrl}/v2/transactions/cashout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    transaction_id?: string;
    data?: {
      transaction_id?: string;
      status?: string;
    };
    error?: { code?: string; message?: string };
    message?: string;
  };

  if (!res.ok || json.success === false) {
    throw new Error(
      json.error?.message ||
        json.message ||
        `Erro ao processar saque na BSPAY (HTTP ${res.status})`
    );
  }

  return {
    transactionId:
      json.data?.transaction_id || json.transaction_id || input.externalId,
    status: json.data?.status || "pending",
    raw: json,
  };
}

export async function fetchBspayBalance() {
  const { apiUrl } = getCredentials();
  const token = await getBspayAccessToken();

  const res = await fetch(`${apiUrl}/v2/account/balance`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: unknown;
    error?: { code?: string; message?: string };
    message?: string;
  };

  if (!res.ok || json.success === false) {
    throw new Error(
      json.error?.message ||
        json.message ||
        `Erro ao consultar saldo na BSPAY (HTTP ${res.status})`
    );
  }

  const rawData = (json.data || {}) as {
    balances?: Array<{ currency: string; available: string; allocation?: string }>;
  };

  const withdrawals = listWithdrawalRequests();
  const pendingWithdrawalsBrl = withdrawals
    .filter((w) => w.status === "PENDING_APPROVAL" && w.currency === "BRL")
    .reduce((acc, w) => acc + w.amount, 0);

  const manualApprovedBrl = withdrawals
    .filter(
      (w) =>
        w.status === "APPROVED" &&
        w.currency === "BRL" &&
        w.bspayTransactionId === w.id
    )
    .reduce((acc, w) => acc + w.amount, 0);

  const localMeds = loadAdminMeds();
  const activeMedHoldBrl = localMeds
    .filter(
      (m) => m.status === "awaiting_defense" || m.status === "legal_analysis"
    )
    .reduce((acc, m) => acc + m.amount, 0);

  const returnedMedBrl = localMeds
    .filter((m) => m.status === "returned" && m.source === "admin_control")
    .reduce((acc, m) => acc + m.amount, 0);

  const totalDeduction =
    pendingWithdrawalsBrl + manualApprovedBrl + activeMedHoldBrl + returnedMedBrl;

  const adjustedBalances = Array.isArray(rawData.balances)
    ? rawData.balances.map((b) => {
        if (b.currency !== "BRL") return b;
        const rawAvail = Number(b.available) || 0;
        const nextAvail = Math.max(0, rawAvail - totalDeduction);
        return {
          ...b,
          available: nextAvail.toFixed(2),
        };
      })
    : [];

  return {
    ...rawData,
    balances: adjustedBalances,
    blockedBrl: pendingWithdrawalsBrl + activeMedHoldBrl,
    pendingWithdrawalsBrl,
    activeMedHoldBrl,
    returnedMedBrl,
  };
}

export interface BspayReceiveInput {
  mode: "charge" | "static_qr";
  currency: string;
  amount?: number | undefined;
  description?: string | undefined;
  externalId: string;
  payerName?: string | undefined;
  payerDocument?: string | undefined;
  userId?: string | null | undefined;
}

export interface BspayReceiveOutput {
  transactionId: string;
  status: string;
  currency: string;
  amount: number;
  fee: number;
  qrcode: string;
  pixKey?: string | undefined;
  address?: string | undefined;
  chain?: string | undefined;
  expiresAt?: string | undefined;
  expirationSeconds?: number | undefined;
  raw: unknown;
}

export async function processBspayReceive(
  input: BspayReceiveInput
): Promise<BspayReceiveOutput> {
  const { apiUrl } = getCredentials();
  const token = await getBspayAccessToken();

  const currency = input.currency || "BRL";
  const isCrypto = ["USDT", "USDC", "BTC", "ETH", "SOL", "BNB"].includes(
    currency
  );
  const defaultCryptoChain: Record<string, string> = {
    USDT: "tron",
    USDC: "polygon",
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    BNB: "bsc",
  };
  const chain = isCrypto ? defaultCryptoChain[currency] || "tron" : undefined;

  if (input.mode === "static_qr") {
    const payload: Record<string, unknown> = {
      currency,
      ...(chain ? { chain } : {}),
    };

    const res = await fetch(`${apiUrl}/v2/transactions/wallet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: {
        wallet_id?: number | string;
        pix_key?: string;
        qrcode?: string;
        address?: string;
        currency?: string;
        chain?: string;
        created_at?: string;
      };
      error?: { code?: string; message?: string };
      message?: string;
    };

    if (!res.ok || json.success === false) {
      throw new Error(
        json.error?.message ||
          json.message ||
          `Erro ao gerar QR Code fixo na BSPAY (HTTP ${res.status})`
      );
    }

    const codeOrAddress =
      json.data?.qrcode || json.data?.address || json.data?.pix_key || "";

    const resolvedTxId = json.data?.wallet_id
      ? `WALLET-${json.data.wallet_id}`
      : input.externalId;

    if (input.userId) {
      registerUserTransactionOwnership(
        input.userId,
        resolvedTxId,
        input.externalId
      );
    }

    return {
      transactionId: resolvedTxId,
      status: "pending",
      currency: json.data?.currency || currency,
      amount: Number(input.amount || 0),
      fee: 0,
      qrcode: codeOrAddress,
      pixKey: json.data?.pix_key,
      address: json.data?.address,
      chain: json.data?.chain || chain,
      raw: json,
    };
  }

  // Mode: "charge" -> POST /v2/transactions/cashin
  const amount = Number((input.amount || 0).toFixed(isCrypto ? 8 : 2));
  const payload: Record<string, unknown> = {
    amount,
    currency,
    external_id: input.externalId,
    ...(chain ? { chain } : {}),
    ...(currency === "BRL"
      ? {
          payer: {
            name: input.payerName?.trim() || "Cliente BokashiPay",
            document:
              input.payerDocument?.replace(/\D/g, "") || "11370243480",
          },
        }
      : {}),
  };

  const res = await fetch(`${apiUrl}/v2/transactions/cashin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: {
      transaction_id?: string;
      external_id?: string;
      currency?: string;
      amount?: number | string;
      fee?: number | string;
      payment_method?: string;
      payment_info?: {
        qrcode?: string;
        address?: string;
        chain?: string;
        expiration?: number;
        expires_at?: string;
      };
      qrcode?: string;
      status?: string;
    };
    error?: { code?: string; message?: string };
    message?: string;
  };

  if (!res.ok || json.success === false) {
    throw new Error(
      json.error?.message ||
        json.message ||
        `Erro ao gerar cobrança na BSPAY (HTTP ${res.status})`
    );
  }

  const paymentInfo = json.data?.payment_info;
  const qrcode =
    paymentInfo?.qrcode ||
    paymentInfo?.address ||
    json.data?.qrcode ||
    "";

  const resolvedTxId = json.data?.transaction_id || input.externalId;

  if (input.userId) {
    registerUserTransactionOwnership(
      input.userId,
      resolvedTxId,
      input.externalId
    );
    void notifyUserPixGeneratedIfEligible(
      input.userId,
      resolvedTxId,
      input.externalId,
      Number(json.data?.amount ?? amount),
      input.description
    );
  }

  return {
    transactionId: resolvedTxId,
    status: json.data?.status || "pending",
    currency: json.data?.currency || currency,
    amount: Number(json.data?.amount ?? amount),
    fee: Number(json.data?.fee ?? 0),
    qrcode,
    address: paymentInfo?.address,
    chain: paymentInfo?.chain || chain,
    expiresAt: paymentInfo?.expires_at,
    expirationSeconds: paymentInfo?.expiration,
    raw: json,
  };
}

export interface BspayTransactionRecord {
  source?: string | null | undefined;
  end_to_end_id?: string | null | undefined;
  pix_code?: string | null | undefined;
  confirmed_at?: string | null | undefined;
  refunded_at?: string | null | undefined;
  status?: string | null | undefined;
  old_balance?: string | number | null | undefined;
  new_balance?: string | number | null | undefined;
  transaction_id?: string | null | undefined;
  external_id?: string | null | undefined;
  direction?: "credit" | "debit" | "swap" | string | null | undefined;
  amount?: string | number | null | undefined;
  fee_amount?: string | number | null | undefined;
  description?: string | null | undefined;
  created_at?: string | null | undefined;
  updated_at?: string | null | undefined;
  currency?: string | null | undefined;
  payer?: {
    name?: string | null | undefined;
    document?: string | null | undefined;
  } | null | undefined;
  receiver?: {
    name?: string | null | undefined;
    document?: string | null | undefined;
  } | null | undefined;
  generated?: {
    name?: string | null | undefined;
    document?: string | null | undefined;
    email?: string | null | undefined;
  } | null | undefined;
  conversion?: {
    from?: {
      amount?: string | number | null | undefined;
      currency?: string | null | undefined;
    } | null | undefined;
    to?: {
      amount?: string | number | null | undefined;
      currency?: string | null | undefined;
    } | null | undefined;
  } | null | undefined;
}

export interface BspayTransactionsFilter {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: string | null | undefined;
  type?: string | null | undefined;
  currency?: string | null | undefined;
  source?: string | null | undefined;
  transactionId?: string | null | undefined;
  externalId?: string | null | undefined;
  userId?: string | null | undefined;
  userCreatedAt?: string | null | undefined;
  scope?: "user" | "admin" | null | undefined;
}

export async function fetchBspayTransactions(
  filter: BspayTransactionsFilter = {}
) {
  const isSpecificLookup = Boolean(filter.transactionId || filter.externalId);
  const isAdminScope = filter.scope === "admin";

  // If this is a client list request without an authenticated userId, never leak global account transactions
  if (!isAdminScope && !isSpecificLookup && !filter.userId) {
    return {
      items: [],
      pagination: {
        page: filter.page ?? 1,
        page_size: filter.pageSize ?? 50,
        count: 0,
        total: 0,
        total_pages: 0,
      },
      summary: {
        total_transactions: 0,
        total_in: "0.00",
        total_out: "0.00",
        total_fees: "0.00",
      },
    };
  }

  const { apiUrl } = getCredentials();
  const token = await getBspayAccessToken();

  const payload: Record<string, unknown> = {
    page: filter.page ?? 1,
    page_size: filter.pageSize ?? 50,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.currency ? { currency: filter.currency } : {}),
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.transactionId ? { transaction_id: filter.transactionId } : {}),
    ...(filter.externalId ? { external_id: filter.externalId } : {}),
  };

  const res = await fetch(`${apiUrl}/v2/account/transactions/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: {
      items?: BspayTransactionRecord[];
      pagination?: {
        page?: number;
        page_size?: number;
        count?: number;
        total?: number;
        total_pages?: number;
      };
      summary?: {
        total_transactions?: number;
        total_in?: string | number;
        total_out?: string | number;
        total_fees?: string | number;
      };
    };
    error?: { code?: string; message?: string };
    message?: string;
  };

  if (!res.ok || json.success === false) {
    throw new Error(
      json.error?.message ||
        json.message ||
        `Erro ao listar transações na BSPAY (HTTP ${res.status})`
    );
  }

  const rawItems = json.data?.items ?? [];
  const legacyOwnerUserId =
    !isAdminScope && filter.userId
      ? await resolvePrimaryLegacyUserId()
      : null;

  const filteredItems = applyAdminTxOverridesToBspay(rawItems, {
    userId: filter.userId,
    userCreatedAt: filter.userCreatedAt,
    scope: isAdminScope || isSpecificLookup ? "admin" : "user",
    legacyOwnerUserId,
  });

  // Trigger real-time ntfy push notification for newly confirmed PIX payments
  try {
    const store = loadUserTxOwners();
    const allNtfy = loadAllNtfySettings();
    const nowMs = Date.now();
    for (const item of filteredItems) {
      if ((item.direction || "credit") !== "credit") continue;
      const rawStatus = (item.status || "").toLowerCase();
      const isConfirmed =
        rawStatus === "confirmed" ||
        rawStatus === "paid" ||
        rawStatus === "completed" ||
        Boolean(item.confirmed_at);
      if (!isConfirmed) continue;

      const txId = item.transaction_id ? String(item.transaction_id) : "";
      const extId = item.external_id ? String(item.external_id) : "";
      const ownerId =
        (txId && store.byTxId[txId]) ||
        (extId && store.byTxId[extId]) ||
        filter.userId ||
        null;
      if (!ownerId) continue;

      // Credit affiliate commission if this user was referred by an affiliate
      try {
        const affStore = loadAffiliatesStore();
        const refRecord = affStore.referrals.find(
          (r) => r.referredUserId === ownerId && r.status === "active"
        );
        const uniqueSourceId = txId || extId;
        if (
          refRecord &&
          uniqueSourceId &&
          !affStore.commissions.some((c) => c.sourceTxId === uniqueSourceId)
        ) {
          const affProfile = ensureAffiliateProfile(refRecord.affiliateUserId);
          const rawAmt = Number(item.amount || 0);
          const rawFee = Number(item.fee_amount || 0);
          const feeProfit =
            rawFee > 0
              ? rawFee
              : rawAmt > 0
                ? Number(Math.max(0.9, rawAmt * 0.025).toFixed(2))
                : 0;
          const commAmt = Number(
            ((feeProfit * affProfile.commissionPercent) / 100).toFixed(2)
          );
          if (commAmt > 0) {
            const newComm: AffiliateCommissionEntry = {
              id: `COM-${Date.now().toString(36).toUpperCase()}-${Math.floor(
                100 + Math.random() * 900
              )}`,
              affiliateUserId: affProfile.userId,
              referredUserId: ownerId,
              referredName: refRecord.referredName,
              sourceTxId: uniqueSourceId,
              platformProfitAmount: feeProfit,
              commissionPercent: affProfile.commissionPercent,
              commissionAmount: commAmt,
              description: `${affProfile.commissionPercent}% sobre taxa de transação (${refRecord.referredName})`,
              createdAt: item.confirmed_at || item.created_at || new Date().toISOString(),
            };
            affStore.commissions = [newComm, ...affStore.commissions];
            saveAffiliatesStore(affStore);
          }
        }
      } catch {
        // ignore affiliate commission auto-calc error
      }

      const userSettings = allNtfy[ownerId];
      if (!userSettings) continue;

      const watchedSet = new Set(userSettings.watchedTxIds ?? []);
      const isWatched =
        (txId && watchedSet.has(txId)) || (extId && watchedSet.has(extId));

      let isRecent = false;
      const timeStr = item.confirmed_at || item.created_at;
      if (timeStr) {
        const parsedMs = new Date(
          timeStr.includes("T") ? timeStr : timeStr.replace(" ", "T")
        ).getTime();
        if (!isNaN(parsedMs) && nowMs - parsedMs <= 30 * 60 * 1000) {
          isRecent = true;
        }
      }

      if (isWatched || isRecent) {
        void notifyUserPixPaidIfEligible(
          ownerId,
          txId || extId,
          Number(item.amount || 0),
          item.payer?.name
            ? `Pagador: ${item.payer.name}`
            : item.description || null,
          extId || null
        );
      }
    }
  } catch {
    // ignore notification check errors
  }

  return {
    items: filteredItems,
    pagination: json.data?.pagination,
    summary: json.data?.summary,
  };
}

import fs from "node:fs";
import path from "node:path";

interface UserTxOwnershipStore {
  byTxId: Record<string, string>;
  legacyOwnerUserId?: string | null;
}

const USER_TX_OWNERS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "user-tx-owners.json"
);

let memoryTxOwners: UserTxOwnershipStore | null = null;

function loadUserTxOwners(): UserTxOwnershipStore {
  if (memoryTxOwners) return memoryTxOwners;
  try {
    if (fs.existsSync(USER_TX_OWNERS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(USER_TX_OWNERS_FILE, "utf-8")
      ) as Partial<UserTxOwnershipStore>;
      memoryTxOwners = {
        byTxId:
          parsed.byTxId && typeof parsed.byTxId === "object"
            ? parsed.byTxId
            : {},
        legacyOwnerUserId: parsed.legacyOwnerUserId ?? null,
      };
      return memoryTxOwners;
    }
  } catch {
    // ignore read error
  }
  memoryTxOwners = { byTxId: {}, legacyOwnerUserId: null };
  return memoryTxOwners;
}

function saveUserTxOwners(store: UserTxOwnershipStore) {
  memoryTxOwners = store;
  try {
    const dir = path.dirname(USER_TX_OWNERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      USER_TX_OWNERS_FILE,
      JSON.stringify(store, null, 2),
      "utf-8"
    );
  } catch {
    // ignore write error
  }
}

export function getUserIdExternalTag(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
  return `U_${clean}`;
}

export function registerUserTransactionOwnership(
  userId: string,
  transactionId?: string | null,
  externalId?: string | null
) {
  if (!userId) return;
  const store = loadUserTxOwners();
  const nextByTxId = { ...store.byTxId };
  let changed = false;
  if (transactionId && nextByTxId[transactionId] !== userId) {
    nextByTxId[transactionId] = userId;
    changed = true;
  }
  if (externalId && nextByTxId[externalId] !== userId) {
    nextByTxId[externalId] = userId;
    changed = true;
  }
  if (changed) {
    saveUserTxOwners({
      ...store,
      byTxId: nextByTxId,
    });
  }
}

async function resolvePrimaryLegacyUserId(): Promise<string | null> {
  const store = loadUserTxOwners();
  if (store.legacyOwnerUserId) {
    return store.legacyOwnerUserId;
  }

  try {
    const env = typeof process !== "undefined" ? process.env : {};
    const supabaseUrl = env?.["VITE_SUPABASE_URL"];
    const serviceRoleKey = env?.["SUPABASE_SERVICE_ROLE_KEY"];
    if (!supabaseUrl || !serviceRoleKey) return null;

    const res = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/admin/users?page=1&per_page=50`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as {
      users?: Array<{ id?: string; created_at?: string }>;
    };
    const users = Array.isArray(data.users) ? data.users : [];
    if (users.length === 0) return null;

    const sorted = [...users]
      .filter((u) => Boolean(u.id && u.created_at))
      .sort(
        (a, b) =>
          new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
      );

    const oldestUserId = sorted[0]?.id || null;
    if (oldestUserId) {
      saveUserTxOwners({
        ...loadUserTxOwners(),
        legacyOwnerUserId: oldestUserId,
      });
    }
    return oldestUserId;
  } catch {
    return null;
  }
}

export function doesTxBelongToUser(
  item: BspayTransactionRecord,
  userId: string,
  legacyOwnerUserId?: string | null,
  userCreatedAt?: string | null
): boolean {
  if (!userId) return false;
  const txId = item.transaction_id ? String(item.transaction_id) : "";
  const extId = item.external_id ? String(item.external_id) : "";

  const store = loadUserTxOwners();
  const mappedOwner =
    (txId && store.byTxId[txId]) || (extId && store.byTxId[extId]);
  if (mappedOwner) {
    return mappedOwner === userId;
  }

  // Check if external_id contains an explicit per-user tag (e.g. BKP-IN-U_XXXX-...)
  const userTag = getUserIdExternalTag(userId);
  if (extId.includes("-U_")) {
    if (extId.includes(`-${userTag}-`)) {
      registerUserTransactionOwnership(userId, txId, extId);
      return true;
    }
    return false;
  }

  // Check if withdrawal request with this id/externalId belongs to a specific user
  const withdrawals = loadWithdrawals();
  const matchingWithdrawal = withdrawals.find(
    (w) =>
      (txId && (w.id === txId || w.bspayTransactionId === txId)) ||
      (extId && w.externalId === extId)
  );
  if (matchingWithdrawal?.userId) {
    if (matchingWithdrawal.userId === userId) {
      registerUserTransactionOwnership(userId, txId, extId);
      return true;
    }
    return false;
  }

  // Chronological guard: a user account can NEVER own a transaction created before the account existed
  if (userCreatedAt && item.created_at) {
    const userTime = new Date(userCreatedAt).getTime();
    const txRaw = item.created_at.includes("T")
      ? item.created_at
      : item.created_at.replace(" ", "T");
    const txTime = new Date(txRaw).getTime();
    if (!isNaN(userTime) && !isNaN(txTime) && userTime > txTime + 60_000) {
      return false;
    }
  }

  // Legacy untagged transactions (created before multi-user tagging) belong ONLY to the original/oldest account
  if (legacyOwnerUserId) {
    if (userId === legacyOwnerUserId) {
      registerUserTransactionOwnership(userId, txId, extId);
      return true;
    }
    return false;
  }

  return false;
}

interface AdminTxOverrides {
  deletedIds: string[];
  statusOverrides: Record<string, string>;
}

const OVERRIDES_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "admin-tx-overrides.json"
);

let memoryOverrides: AdminTxOverrides | null = null;

function loadAdminTxOverrides(): AdminTxOverrides {
  if (memoryOverrides) return memoryOverrides;
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(OVERRIDES_FILE, "utf-8")
      ) as Partial<AdminTxOverrides>;
      memoryOverrides = {
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
        statusOverrides:
          parsed.statusOverrides && typeof parsed.statusOverrides === "object"
            ? parsed.statusOverrides
            : {},
      };
      return memoryOverrides;
    }
  } catch {
    // fallback to empty in-memory overrides
  }
  memoryOverrides = { deletedIds: [], statusOverrides: {} };
  return memoryOverrides;
}

function saveAdminTxOverrides(overrides: AdminTxOverrides) {
  memoryOverrides = overrides;
  try {
    const dir = path.dirname(OVERRIDES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), "utf-8");
  } catch {
    // ignore fs write error in read-only environments
  }
}

export function recordAdminTxDelete(id: string, externalId?: string | null) {
  const current = loadAdminTxOverrides();
  const nextSet = new Set(current.deletedIds);
  if (id) nextSet.add(id);
  if (externalId) nextSet.add(externalId);
  saveAdminTxOverrides({
    ...current,
    deletedIds: Array.from(nextSet),
  });
}

export function recordAdminTxStatus(
  id: string,
  status: string,
  externalId?: string | null
) {
  const current = loadAdminTxOverrides();
  const nextStatus = { ...current.statusOverrides };
  if (id) nextStatus[id] = status;
  if (externalId) nextStatus[externalId] = status;
  saveAdminTxOverrides({
    ...current,
    statusOverrides: nextStatus,
  });
}

export function applyAdminTxOverridesToBspay(
  items: BspayTransactionRecord[],
  options?: {
    userId?: string | null | undefined;
    userCreatedAt?: string | null | undefined;
    scope?: "user" | "admin" | undefined;
    legacyOwnerUserId?: string | null | undefined;
  }
): BspayTransactionRecord[] {
  const { deletedIds, statusOverrides } = loadAdminTxOverrides();
  const deletedSet = new Set(deletedIds);
  const isUserScoped = options?.scope === "user";
  const targetUserId = options?.userId || null;

  if (isUserScoped && !targetUserId) {
    return [];
  }

  const meds = loadAdminMeds();
  const medByTxId = new Map<string, BspayMedRecord>();
  for (const m of meds) {
    if (m.transactionId) medByTxId.set(m.transactionId, m);
    if (m.externalId) medByTxId.set(m.externalId, m);
  }

  const withdrawals = loadWithdrawals();
  const existingIds = new Set<string>();
  for (const it of items) {
    if (it.transaction_id) existingIds.add(String(it.transaction_id));
    if (it.external_id) existingIds.add(String(it.external_id));
  }

  const scopedItems = isUserScoped
    ? items.filter((it) =>
        doesTxBelongToUser(
          it,
          targetUserId!,
          options?.legacyOwnerUserId,
          options?.userCreatedAt
        )
      )
    : items;

  const syntheticWithdrawalRecords: BspayTransactionRecord[] = withdrawals
    .filter(
      (w) =>
        (!isUserScoped || w.userId === targetUserId) &&
        !deletedSet.has(w.id) &&
        !deletedSet.has(w.externalId) &&
        !existingIds.has(w.id) &&
        !existingIds.has(w.externalId) &&
        (!w.bspayTransactionId || !existingIds.has(w.bspayTransactionId))
    )
    .map((w) => ({
      source: w.mode === "internal" ? "internal_transfer" : "cashout",
      direction: "debit",
      transaction_id: w.bspayTransactionId || w.id,
      external_id: w.externalId,
      amount: String(w.amount.toFixed(2)),
      fee_amount: "0.00",
      currency: w.currency || "BRL",
      status:
        w.status === "APPROVED"
          ? "confirmed"
          : w.status === "REJECTED"
          ? "cancelled"
          : "analyzing",
      confirmed_at: w.status === "APPROVED" ? w.decidedAt || w.createdAt : null,
      created_at: w.createdAt,
      description:
        w.description ||
        `Saque PIX (${w.clientName}) → ${w.pixKey}`,
      receiver: {
        name: `${w.clientName} (${w.pixKey})`,
        document: w.pixKey,
      },
    }));

  const combined = [...syntheticWithdrawalRecords, ...scopedItems];

  return combined
    .filter((item) => {
      const txId = item.transaction_id ? String(item.transaction_id) : "";
      const extId = item.external_id ? String(item.external_id) : "";
      if (txId && deletedSet.has(txId)) return false;
      if (extId && deletedSet.has(extId)) return false;
      return true;
    })
    .map((item) => {
      const txId = item.transaction_id ? String(item.transaction_id) : "";
      const extId = item.external_id ? String(item.external_id) : "";

      const linkedMed =
        (txId && medByTxId.get(txId)) || (extId && medByTxId.get(extId));
      if (linkedMed) {
        if (
          linkedMed.status === "awaiting_defense" ||
          linkedMed.status === "legal_analysis"
        ) {
          return {
            ...item,
            status: "analyzing",
            description: `[MED EM ANÁLISE] ${item.description || "Contestação PIX"}`,
          };
        }
        if (linkedMed.status === "returned") {
          return {
            ...item,
            status: "refunded",
            refunded_at: linkedMed.updatedAt || linkedMed.createdAt,
            description: `[REEMBOLSADO VIA MED] ${item.description || "Devolução PIX"}`,
          };
        }
      }

      const override =
        (txId && statusOverrides[txId]) || (extId && statusOverrides[extId]);
      if (!override) return item;

      const mappedRawStatus =
        override === "Concluído"
          ? "confirmed"
          : override === "Em análise"
          ? "analyzing"
          : override === "Cancelado"
          ? "cancelled"
          : "pending";

      return {
        ...item,
        status: mappedRawStatus,
        confirmed_at:
          override === "Concluído"
            ? item.confirmed_at || new Date().toISOString()
            : null,
      };
    });
}

// ==========================================
// 1. FILA DE APROVAÇÃO MANUAL DE SAQUES
// ==========================================
export interface WithdrawalRequest {
  id: string;
  externalId: string;
  clientName: string;
  clientEmail: string;
  userId?: string | null | undefined;
  mode: "external" | "internal";
  currency: string;
  amount: number;
  pixKeyType: "phone" | "cpf_cnpj" | "email" | "random";
  pixKey: string;
  description?: string | undefined;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt?: string | null | undefined;
  bspayTransactionId?: string | null | undefined;
  bspayNote?: string | null | undefined;
}

const WITHDRAWALS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "admin-withdrawals.json"
);

let memoryWithdrawals: WithdrawalRequest[] | null = null;

function loadWithdrawals(): WithdrawalRequest[] {
  if (memoryWithdrawals) return memoryWithdrawals;
  try {
    if (fs.existsSync(WITHDRAWALS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(WITHDRAWALS_FILE, "utf-8")
      ) as unknown;
      if (Array.isArray(parsed)) {
        memoryWithdrawals = parsed as WithdrawalRequest[];
        return memoryWithdrawals;
      }
    }
  } catch {
    // ignore read error
  }
  memoryWithdrawals = [];
  return memoryWithdrawals;
}

function saveWithdrawals(list: WithdrawalRequest[]) {
  memoryWithdrawals = list;
  try {
    const dir = path.dirname(WITHDRAWALS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WITHDRAWALS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // ignore write error
  }
}

export function listWithdrawalRequests(userId?: string | null): WithdrawalRequest[] {
  const { deletedIds } = loadAdminTxOverrides();
  const deletedSet = new Set(deletedIds);
  const all = loadWithdrawals().filter(
    (w) => !deletedSet.has(w.id) && !deletedSet.has(w.externalId)
  );
  if (userId) {
    return all.filter((w) => w.userId === userId);
  }
  return all;
}

export function createWithdrawalRequest(
  input: BspayTransferInput
): WithdrawalRequest {
  const list = loadWithdrawals();
  const id = `WD-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const req: WithdrawalRequest = {
    id,
    externalId: input.externalId || id,
    clientName: (input.clientName || "").trim() || "mathvtr2 (Cliente BokashiPay)",
    clientEmail: (input.clientEmail || "").trim() || "cliente@bokashipay.com",
    userId: input.userId ?? null,
    mode: input.mode || "external",
    currency: input.currency || "BRL",
    amount: Number(input.amount) || 0,
    pixKeyType: input.pixKeyType || "cpf_cnpj",
    pixKey: input.pixKey.trim(),
    description: input.description,
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  };

  if (req.userId) {
    registerUserTransactionOwnership(req.userId, req.id, req.externalId);
  }

  saveWithdrawals([req, ...list]);
  return req;
}

export async function decideWithdrawalRequest(
  id: string,
  decision: "approve" | "force_approve" | "reject",
  note?: string
): Promise<{
  item: WithdrawalRequest;
  bspayDispatched: boolean;
  bspayWarning?: string | undefined;
}> {
  const list = loadWithdrawals();
  const idx = list.findIndex((w) => w.id === id || w.externalId === id);
  if (idx === -1) {
    throw new Error("Solicitação de saque não encontrada.");
  }

  const target = list[idx]!;
  const now = new Date().toISOString();

  if (decision === "reject") {
    const updated: WithdrawalRequest = {
      ...target,
      status: "REJECTED",
      decidedAt: now,
      bspayNote: note || "Saque recusado manualmente pelo administrador.",
    };
    const next = [...list];
    next[idx] = updated;
    saveWithdrawals(next);
    recordAdminTxStatus(target.id, "Cancelado", target.externalId);
    return { item: updated, bspayDispatched: false };
  }

  // Approve: execute real PIX payout on BSPAY API v2
  let bspayTxId: string | null = target.bspayTransactionId || null;
  let bspayDispatched = false;
  let bspayWarning: string | undefined;

  if (decision === "approve") {
    try {
      const bspayRes = await processBspayTransfer({
        mode: target.mode,
        currency: target.currency,
        amount: target.amount,
        pixKeyType: target.pixKeyType,
        pixKey: target.pixKey,
        description:
          target.description || `Saque aprovado BokashiPay - ${target.clientName}`,
        externalId: target.externalId,
        executeImmediately: true,
      });
      bspayTxId = bspayRes.transactionId;
      bspayDispatched = true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao disparar PIX na BSPAY";
      bspayWarning = msg;
    }
  }

  const updated: WithdrawalRequest = {
    ...target,
    status: "APPROVED",
    decidedAt: now,
    bspayTransactionId: bspayTxId || target.id,
    bspayNote: bspayDispatched
      ? "Aprovado pelo Admin e disparado via BSPAY API v2."
      : bspayWarning
      ? `Aprovado no painel Admin (Aviso BSPAY: ${bspayWarning})`
      : "Aprovado manualmente pelo Admin.",
  };

  if (target.userId && bspayTxId) {
    registerUserTransactionOwnership(target.userId, bspayTxId, target.externalId);
  }

  const next = [...list];
  next[idx] = updated;
  saveWithdrawals(next);
  recordAdminTxStatus(target.id, "Concluído", target.externalId);

  return {
    item: updated,
    bspayDispatched,
    bspayWarning,
  };
}

// ==========================================
// 2. SISTEMA DE CONTROLE DE MED (MECANISMO ESPECIAL DE DEVOLUÇÃO)
// ==========================================
export type MedStatus =
  | "awaiting_defense"
  | "legal_analysis"
  | "returned"
  | "won"
  | "closed";

export interface BspayMedRecord {
  id: string;
  transactionId: string;
  externalId?: string | null | undefined;
  endToEndId?: string | null | undefined;
  clientName: string;
  clientEmail?: string | null | undefined;
  userId?: string | null | undefined;
  payerName: string;
  payerDocument?: string | null | undefined;
  amount: number;
  reason: string;
  status: MedStatus;
  source: "bspay_api" | "admin_control";
  createdAt: string;
  updatedAt?: string | null | undefined;
  defenseNotes?: string | null | undefined;
}

export interface BspayMedWidgets {
  total_meds: number;
  awaiting_defense: number;
  legal_analysis: number;
  closed: number;
  total_won: number;
  total_returned: number;
  total_pending: number;
  pending_infractions: number;
}

const MEDS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "admin-meds.json"
);

let memoryMeds: BspayMedRecord[] | null = null;

function loadAdminMeds(): BspayMedRecord[] {
  if (memoryMeds) return memoryMeds;
  try {
    if (fs.existsSync(MEDS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(MEDS_FILE, "utf-8")) as unknown;
      if (Array.isArray(parsed)) {
        memoryMeds = parsed as BspayMedRecord[];
        return memoryMeds;
      }
    }
  } catch {
    // ignore
  }
  memoryMeds = [];
  return memoryMeds;
}

function saveAdminMeds(list: BspayMedRecord[]) {
  memoryMeds = list;
  try {
    const dir = path.dirname(MEDS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MEDS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

export function createMedRecord(input: {
  transactionId?: string | undefined;
  externalId?: string | null | undefined;
  endToEndId?: string | null | undefined;
  clientName: string;
  clientEmail?: string | null | undefined;
  userId?: string | null | undefined;
  payerName?: string | undefined;
  payerDocument?: string | undefined;
  amount: number;
  reason?: string | undefined;
  status?: MedStatus | undefined;
}): BspayMedRecord {
  const list = loadAdminMeds();
  const id = `MED-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const txId =
    (input.transactionId || "").trim() ||
    `TX-MED-${Math.floor(1000 + Math.random() * 9000)}`;

  const store = loadUserTxOwners();
  const inferredUserId =
    input.userId ||
    (txId && store.byTxId[txId]) ||
    (input.externalId && store.byTxId[input.externalId]) ||
    store.legacyOwnerUserId ||
    null;

  const record: BspayMedRecord = {
    id,
    transactionId: txId,
    externalId: input.externalId || null,
    endToEndId:
      input.endToEndId ||
      `E00000000${new Date().toISOString().replace(/\D/g, "").slice(0, 12)}${Math.floor(
        100000 + Math.random() * 900000
      )}`,
    clientName: input.clientName.trim() || "mathvtr2",
    clientEmail: input.clientEmail || null,
    userId: inferredUserId,
    payerName: (input.payerName || "").trim() || "Pagador Contestante (Banco Origem)",
    payerDocument: input.payerDocument || "***.***.***-**",
    amount: Math.abs(Number(input.amount) || 0),
    reason:
      (input.reason || "").trim() ||
      "Solicitação de reembolso via MED (Mecanismo Especial de Devolução) aberta pelo titular no banco de origem.",
    status: input.status || "awaiting_defense",
    source: "admin_control",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveAdminMeds([record, ...list]);
  return record;
}

export function updateMedRecordStatus(
  id: string,
  status: MedStatus,
  defenseNotes?: string
): BspayMedRecord {
  const list = loadAdminMeds();
  const idx = list.findIndex(
    (m) => m.id === id || m.transactionId === id || m.externalId === id
  );
  if (idx === -1) {
    throw new Error("Registro de MED não encontrado.");
  }
  const updated: BspayMedRecord = {
    ...list[idx]!,
    status,
    updatedAt: new Date().toISOString(),
    defenseNotes: defenseNotes ?? list[idx]!.defenseNotes,
  };
  const next = [...list];
  next[idx] = updated;
  saveAdminMeds(next);
  return updated;
}

export function deleteMedRecord(id: string): void {
  const list = loadAdminMeds();
  saveAdminMeds(list.filter((m) => m.id !== id && m.transactionId !== id));
}

export async function fetchBspayMedInfractions(options?: {
  userId?: string | null | undefined;
  userCreatedAt?: string | null | undefined;
  scope?: "user" | "admin" | null | undefined;
}): Promise<{
  widgets: BspayMedWidgets;
  items: BspayMedRecord[];
}> {
  const isAdminScope = options?.scope === "admin";
  const targetUserId = options?.userId || null;

  if (!isAdminScope && !targetUserId) {
    return {
      widgets: {
        total_meds: 0,
        awaiting_defense: 0,
        legal_analysis: 0,
        closed: 0,
        total_won: 0,
        total_returned: 0,
        total_pending: 0,
        pending_infractions: 0,
      },
      items: [],
    };
  }

  const { apiUrl } = getCredentials();
  const localMeds = loadAdminMeds();
  const seenIds = new Set<string>(
    localMeds.flatMap((m) =>
      [m.id, m.transactionId, m.externalId || ""].filter(Boolean)
    )
  );

  const bspayMeds: BspayMedRecord[] = [];

  try {
    const token = await getBspayAccessToken();
    const res = await fetch(`${apiUrl}/v2/account/infractions?page=1&page_size=50`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: {
        widgets?: Partial<BspayMedWidgets>;
        items?: Array<Record<string, unknown>>;
      };
    };

    if (res.ok && json.success && Array.isArray(json.data?.items)) {
      for (const raw of json.data.items) {
        const rawId = String(
          raw["id"] || raw["infraction_id"] || raw["transaction_id"] || ""
        );
        const txId = String(raw["transaction_id"] || rawId);
        if (!rawId || seenIds.has(rawId) || seenIds.has(txId)) continue;
        seenIds.add(rawId);
        seenIds.add(txId);

        const rawStatus = String(raw["status"] || "awaiting_defense").toLowerCase();
        let mappedStatus: MedStatus = "awaiting_defense";
        if (rawStatus.includes("analysis") || rawStatus.includes("analise")) {
          mappedStatus = "legal_analysis";
        } else if (
          rawStatus.includes("return") ||
          rawStatus.includes("refund") ||
          rawStatus.includes("devolv")
        ) {
          mappedStatus = "returned";
        } else if (rawStatus.includes("won") || rawStatus.includes("ganh")) {
          mappedStatus = "won";
        } else if (rawStatus.includes("clos") || rawStatus.includes("encerr")) {
          mappedStatus = "closed";
        }

        const payerObj =
          raw["payer"] && typeof raw["payer"] === "object"
            ? (raw["payer"] as Record<string, unknown>)
            : null;

        bspayMeds.push({
          id: rawId,
          transactionId: txId,
          externalId: raw["external_id"] ? String(raw["external_id"]) : null,
          endToEndId: raw["end_to_end_id"] ? String(raw["end_to_end_id"]) : null,
          clientName: String(
            raw["client_name"] || raw["merchant_name"] || "mathvtr2"
          ),
          payerName: String(
            payerObj?.["name"] || raw["payer_name"] || "Pagador PIX"
          ),
          payerDocument: payerObj?.["document"]
            ? String(payerObj["document"])
            : undefined,
          amount: Math.abs(Number(raw["amount"] ?? 0)),
          reason: String(
            raw["reason"] ||
              raw["description"] ||
              "Contestação MED reportada pela adquirente BSPAY"
          ),
          status: mappedStatus,
          source: "bspay_api",
          createdAt: String(raw["created_at"] || new Date().toISOString()),
          updatedAt: raw["updated_at"] ? String(raw["updated_at"]) : null,
        });
      }
    }
  } catch {
    // Fallback to local MEDs if BSPAY infractions endpoint fails
  }

  // Also scan recent BSPAY transactions for any with refunded_at or status=refunded/med
  try {
    const txRes = await fetchBspayTransactions({
      page: 1,
      pageSize: 50,
      userId: targetUserId,
      userCreatedAt: options?.userCreatedAt,
      scope: isAdminScope ? "admin" : "user",
    });
    for (const tx of txRes.items) {
      const st = (tx.status || "").toLowerCase();
      if (tx.refunded_at || st === "refunded" || st === "med" || st === "infraction") {
        const txId = String(tx.transaction_id || tx.external_id || "");
        if (!txId || seenIds.has(txId)) continue;
        seenIds.add(txId);
        bspayMeds.push({
          id: `MED-${txId.slice(0, 8).toUpperCase()}`,
          transactionId: txId,
          externalId: tx.external_id || null,
          endToEndId: tx.end_to_end_id || null,
          clientName: tx.generated?.name || "mathvtr2",
          userId: targetUserId,
          payerName: tx.payer?.name || "Pagador PIX",
          payerDocument: tx.payer?.document || undefined,
          amount: Math.abs(Number(tx.amount ?? 0)),
          reason: "Reembolso / Devolução PIX (MED) detectado na conta BSPAY",
          status: "returned",
          source: "bspay_api",
          createdAt: tx.refunded_at || tx.created_at || new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore
  }

  const legacyOwnerUserId =
    !isAdminScope && targetUserId ? await resolvePrimaryLegacyUserId() : null;

  const combinedMeds = [...localMeds, ...bspayMeds];
  const allItems = isAdminScope
    ? combinedMeds
    : combinedMeds.filter((m) => {
        if (m.userId) {
          return m.userId === targetUserId;
        }
        return doesTxBelongToUser(
          {
            transaction_id: m.transactionId,
            external_id: m.externalId,
            created_at: m.createdAt,
          },
          targetUserId!,
          legacyOwnerUserId,
          options?.userCreatedAt
        );
      });

  const awaiting_defense = allItems.filter(
    (m) => m.status === "awaiting_defense"
  ).length;
  const legal_analysis = allItems.filter(
    (m) => m.status === "legal_analysis"
  ).length;
  const total_won = allItems.filter((m) => m.status === "won").length;
  const total_returned = allItems.filter((m) => m.status === "returned").length;
  const closed = allItems.filter(
    (m) => m.status === "closed" || m.status === "won" || m.status === "returned"
  ).length;
  const total_pending = allItems
    .filter(
      (m) => m.status === "awaiting_defense" || m.status === "legal_analysis"
    )
    .reduce((acc, m) => acc + m.amount, 0);

  const widgets: BspayMedWidgets = {
    total_meds: allItems.length,
    awaiting_defense,
    legal_analysis,
    closed,
    total_won,
    total_returned,
    total_pending,
    pending_infractions: awaiting_defense + legal_analysis,
  };

  return {
    widgets,
    items: allItems,
  };
}

// ==========================================
// 3. SISTEMA DE LINKS DE PAGAMENTO (POR USUÁRIO)
// ==========================================
export type PaymentLinkMethod = "pix" | "crypto";
export type PaymentLinkStatus =
  | "pending"
  | "active"
  | "paid"
  | "inactive"
  | "expired"
  | "completed";

export interface PaymentLinkRecord {
  id: string;
  slug: string;
  userId: string;
  title: string;
  description?: string | null | undefined;
  amount: number;
  currency: string;
  // Produto
  linkCatalogProduct: boolean;
  catalogProductId?: string | null | undefined;
  catalogProductName?: string | null | undefined;
  photoUrl?: string | null | undefined;
  // Configurações do checkout
  isLimited: boolean;
  maxPayments?: number | null | undefined;
  enableBannertime: boolean;
  bannertimeMinutes?: number | null | undefined;
  hasExpiration: boolean;
  expiresAt?: string | null | undefined;
  passFeeToCustomer: boolean;
  redirectAfterPayment: boolean;
  redirectUrl?: string | null | undefined;
  paymentMethods: PaymentLinkMethod[];
  // Aparência
  bannerUrl?: string | null | undefined;
  faviconUrl?: string | null | undefined;
  // Métricas e status
  status: PaymentLinkStatus;
  paymentsCount: number;
  totalReceived: number;
  paidTransactionIds?: string[] | undefined;
  createdAt: string;
  updatedAt: string;
}

const PAYMENT_LINKS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "payment-links.json"
);

let memoryPaymentLinks: PaymentLinkRecord[] | null = null;

function loadPaymentLinks(): PaymentLinkRecord[] {
  if (memoryPaymentLinks) return memoryPaymentLinks;
  try {
    if (fs.existsSync(PAYMENT_LINKS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(PAYMENT_LINKS_FILE, "utf-8")
      ) as unknown;
      if (Array.isArray(parsed)) {
        memoryPaymentLinks = parsed as PaymentLinkRecord[];
        return memoryPaymentLinks;
      }
    }
  } catch {
    // ignore read error
  }
  memoryPaymentLinks = [];
  return memoryPaymentLinks;
}

function savePaymentLinks(list: PaymentLinkRecord[]) {
  memoryPaymentLinks = list;
  try {
    const dir = path.dirname(PAYMENT_LINKS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PAYMENT_LINKS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch {
    // ignore write error
  }
}

function normalizePaymentLinkStatus(link: PaymentLinkRecord): PaymentLinkRecord {
  let effectiveStatus = link.status;
  if (
    (effectiveStatus === "active" || effectiveStatus === "pending") &&
    link.hasExpiration &&
    link.expiresAt &&
    new Date(link.expiresAt).getTime() < Date.now()
  ) {
    effectiveStatus = "expired";
  }
  if (
    (effectiveStatus === "active" || effectiveStatus === "pending" || effectiveStatus === "paid") &&
    link.isLimited &&
    link.maxPayments &&
    link.maxPayments > 0 &&
    link.paymentsCount >= link.maxPayments
  ) {
    effectiveStatus = "completed";
  }
  if (effectiveStatus !== "inactive" && effectiveStatus !== "expired" && effectiveStatus !== "completed") {
    if (link.paymentsCount > 0) {
      effectiveStatus = "paid";
    } else {
      effectiveStatus = "pending";
    }
  }
  if (effectiveStatus !== link.status) {
    return { ...link, status: effectiveStatus };
  }
  return link;
}

function makeSlugFromTitle(title: string, idSuffix: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${base || "pagamento"}-${idSuffix.toLowerCase()}`;
}

export function listPaymentLinksForUser(
  userId?: string | null
): PaymentLinkRecord[] {
  const all = loadPaymentLinks();
  if (!userId || userId === "guest") {
    return all.map(normalizePaymentLinkStatus);
  }
  return all
    .filter((l) => l.userId === userId || !l.userId || l.userId === "guest")
    .map(normalizePaymentLinkStatus);
}

export function getPaymentLinkBySlug(
  slugOrId: string
): PaymentLinkRecord | null {
  if (!slugOrId) return null;
  const all = loadPaymentLinks();
  const found = all.find(
    (l) => l.slug === slugOrId || l.id === slugOrId
  );
  return found ? normalizePaymentLinkStatus(found) : null;
}

export interface CreatePaymentLinkInput {
  userId: string;
  title: string;
  description?: string | null | undefined;
  amount: number;
  currency?: string | undefined;
  linkCatalogProduct?: boolean | undefined;
  catalogProductId?: string | null | undefined;
  catalogProductName?: string | null | undefined;
  photoUrl?: string | null | undefined;
  isLimited?: boolean | undefined;
  maxPayments?: number | null | undefined;
  enableBannertime?: boolean | undefined;
  bannertimeMinutes?: number | null | undefined;
  hasExpiration?: boolean | undefined;
  expiresAt?: string | null | undefined;
  passFeeToCustomer?: boolean | undefined;
  redirectAfterPayment?: boolean | undefined;
  redirectUrl?: string | null | undefined;
  paymentMethods?: PaymentLinkMethod[] | undefined;
  bannerUrl?: string | null | undefined;
  faviconUrl?: string | null | undefined;
}

export function createPaymentLink(
  input: CreatePaymentLinkInput
): PaymentLinkRecord {
  const effectiveUserId = (input.userId || "guest").trim();
  const title = (input.title || "").trim();
  if (!title) {
    throw new Error("O título do link de pagamento é obrigatório.");
  }
  const amount = Number(input.amount) || 0;
  if (amount <= 0) {
    throw new Error("Informe um valor maior que zero para o link de pagamento.");
  }

  const list = loadPaymentLinks();
  const shortCode = `${Date.now().toString(36).slice(-4)}${Math.floor(
    10 + Math.random() * 90
  )}`.toUpperCase();
  const id = `PL-${shortCode}`;
  const slug = makeSlugFromTitle(title, shortCode);
  const now = new Date().toISOString();

  const methods: PaymentLinkMethod[] =
    Array.isArray(input.paymentMethods) && input.paymentMethods.length > 0
      ? input.paymentMethods
      : ["pix", "crypto"];

  const record: PaymentLinkRecord = {
    id,
    slug,
    userId: effectiveUserId,
    title,
    description: input.description?.trim() || null,
    amount: Number(amount.toFixed(2)),
    currency: input.currency || "BRL",
    linkCatalogProduct: Boolean(input.linkCatalogProduct),
    catalogProductId: input.catalogProductId || null,
    catalogProductName: input.catalogProductName?.trim() || null,
    photoUrl: input.photoUrl || null,
    isLimited: Boolean(input.isLimited),
    maxPayments:
      input.isLimited && input.maxPayments && input.maxPayments > 0
        ? Math.floor(Number(input.maxPayments))
        : null,
    enableBannertime: Boolean(input.enableBannertime),
    bannertimeMinutes:
      input.enableBannertime
        ? Math.max(1, Math.floor(Number(input.bannertimeMinutes) || 15))
        : null,
    hasExpiration: Boolean(input.hasExpiration),
    expiresAt: input.hasExpiration && input.expiresAt ? input.expiresAt : null,
    passFeeToCustomer: Boolean(input.passFeeToCustomer),
    redirectAfterPayment: Boolean(input.redirectAfterPayment),
    redirectUrl:
      input.redirectAfterPayment && input.redirectUrl
        ? input.redirectUrl.trim()
        : null,
    paymentMethods: methods,
    bannerUrl: input.bannerUrl || null,
    faviconUrl: input.faviconUrl || null,
    status: "pending",
    paymentsCount: 0,
    totalReceived: 0,
    paidTransactionIds: [],
    createdAt: now,
    updatedAt: now,
  };

  savePaymentLinks([record, ...list]);
  return record;
}

export function updatePaymentLink(
  id: string,
  userId: string,
  patch: Partial<CreatePaymentLinkInput> & { status?: PaymentLinkStatus }
): PaymentLinkRecord {
  const list = loadPaymentLinks();
  const idx = list.findIndex(
    (l) => (l.id === id || l.slug === id) && l.userId === userId
  );
  if (idx === -1) {
    throw new Error("Link de pagamento não encontrado.");
  }

  const current = list[idx]!;
  const nextTitle =
    patch.title !== undefined ? patch.title.trim() || current.title : current.title;
  const nextAmount =
    patch.amount !== undefined
      ? Number(Number(patch.amount).toFixed(2))
      : current.amount;

  const updated: PaymentLinkRecord = {
    ...current,
    title: nextTitle,
    description:
      patch.description !== undefined
        ? patch.description?.trim() || null
        : current.description,
    amount: nextAmount > 0 ? nextAmount : current.amount,
    currency: patch.currency ?? current.currency,
    linkCatalogProduct:
      patch.linkCatalogProduct !== undefined
        ? Boolean(patch.linkCatalogProduct)
        : current.linkCatalogProduct,
    catalogProductId:
      patch.catalogProductId !== undefined
        ? patch.catalogProductId
        : current.catalogProductId,
    catalogProductName:
      patch.catalogProductName !== undefined
        ? patch.catalogProductName
        : current.catalogProductName,
    photoUrl: patch.photoUrl !== undefined ? patch.photoUrl : current.photoUrl,
    isLimited:
      patch.isLimited !== undefined ? Boolean(patch.isLimited) : current.isLimited,
    maxPayments:
      patch.maxPayments !== undefined ? patch.maxPayments : current.maxPayments,
    enableBannertime:
      patch.enableBannertime !== undefined
        ? Boolean(patch.enableBannertime)
        : current.enableBannertime,
    bannertimeMinutes:
      patch.bannertimeMinutes !== undefined
        ? patch.bannertimeMinutes
        : current.bannertimeMinutes,
    hasExpiration:
      patch.hasExpiration !== undefined
        ? Boolean(patch.hasExpiration)
        : current.hasExpiration,
    expiresAt:
      patch.expiresAt !== undefined ? patch.expiresAt : current.expiresAt,
    passFeeToCustomer:
      patch.passFeeToCustomer !== undefined
        ? Boolean(patch.passFeeToCustomer)
        : current.passFeeToCustomer,
    redirectAfterPayment:
      patch.redirectAfterPayment !== undefined
        ? Boolean(patch.redirectAfterPayment)
        : current.redirectAfterPayment,
    redirectUrl:
      patch.redirectUrl !== undefined ? patch.redirectUrl : current.redirectUrl,
    paymentMethods:
      patch.paymentMethods && patch.paymentMethods.length > 0
        ? patch.paymentMethods
        : current.paymentMethods,
    bannerUrl:
      patch.bannerUrl !== undefined ? patch.bannerUrl : current.bannerUrl,
    faviconUrl:
      patch.faviconUrl !== undefined ? patch.faviconUrl : current.faviconUrl,
    status: patch.status ?? current.status,
    updatedAt: new Date().toISOString(),
  };

  const next = [...list];
  next[idx] = updated;
  savePaymentLinks(next);
  return normalizePaymentLinkStatus(updated);
}

export function deletePaymentLink(id: string, userId: string): void {
  const list = loadPaymentLinks();
  savePaymentLinks(
    list.filter(
      (l) => !((l.id === id || l.slug === id) && l.userId === userId)
    )
  );
}

export function recordPaymentLinkPaid(
  slugOrId: string,
  transactionId: string,
  paidAmount: number
): PaymentLinkRecord | null {
  const list = loadPaymentLinks();
  const idx = list.findIndex((l) => l.slug === slugOrId || l.id === slugOrId);
  if (idx === -1) return null;

  const current = list[idx]!;
  const paidIds = new Set(current.paidTransactionIds ?? []);
  if (transactionId && paidIds.has(transactionId)) {
    return normalizePaymentLinkStatus(current);
  }
  if (transactionId) {
    paidIds.add(transactionId);
  }

  const nextCount = current.paymentsCount + 1;
  const nextTotal = Number(
    (current.totalReceived + (Number(paidAmount) || current.amount)).toFixed(2)
  );

  let nextStatus: PaymentLinkStatus = "paid";
  if (
    current.isLimited &&
    current.maxPayments &&
    current.maxPayments > 0 &&
    nextCount >= current.maxPayments
  ) {
    nextStatus = "completed";
  }

  const updated: PaymentLinkRecord = {
    ...current,
    paymentsCount: nextCount,
    totalReceived: nextTotal,
    paidTransactionIds: Array.from(paidIds),
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };

  if (current.userId && transactionId) {
    registerUserTransactionOwnership(current.userId, transactionId, null);
    void notifyUserPixPaidIfEligible(
      current.userId,
      transactionId,
      Number(paidAmount) || current.amount,
      current.title
    );
  }

  const next = [...list];
  next[idx] = updated;
  savePaymentLinks(next);
  return normalizePaymentLinkStatus(updated);
}

// ==========================================
// 4. SISTEMA DE NOTIFICAÇÕES PUSH (NTFY.SH) POR USUÁRIO
// ==========================================

export interface UserNtfySettings {
  userId: string;
  topic: string;
  notifyPixGenerated: boolean;
  notifyPixPaid: boolean;
  watchedTxIds: string[];
  notifiedPaidTxIds: string[];
  createdAt: string;
  updatedAt: string;
}

const NTFY_SETTINGS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "user-ntfy-settings.json"
);

let memoryNtfySettings: Record<string, UserNtfySettings> | null = null;

function loadAllNtfySettings(): Record<string, UserNtfySettings> {
  if (memoryNtfySettings) return memoryNtfySettings;
  try {
    if (fs.existsSync(NTFY_SETTINGS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(NTFY_SETTINGS_FILE, "utf-8")
      ) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        memoryNtfySettings = parsed as Record<string, UserNtfySettings>;
        return memoryNtfySettings;
      }
    }
  } catch {
    // ignore read error
  }
  memoryNtfySettings = {};
  return memoryNtfySettings;
}

function saveAllNtfySettings(map: Record<string, UserNtfySettings>) {
  memoryNtfySettings = map;
  try {
    const dir = path.dirname(NTFY_SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(NTFY_SETTINGS_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch {
    // ignore write error
  }
}

export function generateRandomNtfyTopic(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 12; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `bokashipay-${suffix}`;
}

export function getUserNtfySettings(userId: string): UserNtfySettings {
  const cleanId = (userId || "").trim() || "guest";
  const all = loadAllNtfySettings();
  const existing = all[cleanId];
  if (existing && existing.topic) {
    return {
      ...existing,
      watchedTxIds: Array.isArray(existing.watchedTxIds)
        ? existing.watchedTxIds
        : [],
      notifiedPaidTxIds: Array.isArray(existing.notifiedPaidTxIds)
        ? existing.notifiedPaidTxIds
        : [],
    };
  }

  const now = new Date().toISOString();
  const created: UserNtfySettings = {
    userId: cleanId,
    topic: generateRandomNtfyTopic(),
    notifyPixGenerated: true,
    notifyPixPaid: true,
    watchedTxIds: [],
    notifiedPaidTxIds: [],
    createdAt: now,
    updatedAt: now,
  };
  all[cleanId] = created;
  saveAllNtfySettings({ ...all });
  return created;
}

export function updateUserNtfySettings(
  userId: string,
  patch: {
    topic?: string | undefined;
    regenerateTopic?: boolean | undefined;
    notifyPixGenerated?: boolean | undefined;
    notifyPixPaid?: boolean | undefined;
  }
): UserNtfySettings {
  const cleanId = (userId || "").trim() || "guest";
  const current = getUserNtfySettings(cleanId);
  const all = loadAllNtfySettings();

  let nextTopic = current.topic;
  if (patch.regenerateTopic) {
    nextTopic = generateRandomNtfyTopic();
  } else if (typeof patch.topic === "string" && patch.topic.trim().length >= 4) {
    nextTopic = patch.topic.trim();
  }

  const updated: UserNtfySettings = {
    ...current,
    topic: nextTopic,
    notifyPixGenerated:
      patch.notifyPixGenerated !== undefined
        ? Boolean(patch.notifyPixGenerated)
        : current.notifyPixGenerated,
    notifyPixPaid:
      patch.notifyPixPaid !== undefined
        ? Boolean(patch.notifyPixPaid)
        : current.notifyPixPaid,
    updatedAt: new Date().toISOString(),
  };

  all[cleanId] = updated;
  saveAllNtfySettings({ ...all });
  return updated;
}

export async function sendNtfyPush(params: {
  topic: string;
  title: string;
  message: string;
  tags?: string[] | undefined;
  priority?: number | undefined;
}): Promise<{ sent: boolean; topic: string; error?: string | undefined }> {
  const cleanTopic = (params.topic || "").trim();
  if (!cleanTopic) {
    return { sent: false, topic: "", error: "Topic ntfy vazio." };
  }

  try {
    const res = await fetch("https://ntfy.sh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify({
        topic: cleanTopic,
        title: params.title,
        message: params.message,
        tags: params.tags ?? ["money_with_wings"],
        priority: params.priority ?? 4,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        sent: false,
        topic: cleanTopic,
        error: `Falha ao enviar para ntfy.sh (HTTP ${res.status}): ${txt.slice(0, 120)}`,
      };
    }

    return { sent: true, topic: cleanTopic };
  } catch (err) {
    return {
      sent: false,
      topic: cleanTopic,
      error:
        err instanceof Error ? err.message : "Erro de rede ao contatar ntfy.sh",
    };
  }
}

function formatBrlPlain(amount: number): string {
  return `R$ ${Number(amount || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function notifyUserPixGeneratedIfEligible(
  userId: string,
  transactionId: string,
  externalId: string,
  amount: number,
  description?: string | null
): Promise<void> {
  if (!userId) return;
  try {
    const settings = getUserNtfySettings(userId);
    const all = loadAllNtfySettings();
    const watched = new Set(settings.watchedTxIds ?? []);
    if (transactionId) watched.add(transactionId);
    if (externalId) watched.add(externalId);

    all[settings.userId] = {
      ...settings,
      watchedTxIds: Array.from(watched).slice(-300),
    };
    saveAllNtfySettings({ ...all });

    if (!settings.notifyPixGenerated || !settings.topic) return;

    const descSuffix = description?.trim() ? ` • ${description.trim()}` : "";
    await sendNtfyPush({
      topic: settings.topic,
      title: "BokashiPay: PIX gerado (venda iniciada)",
      message: `Cobrança PIX de ${formatBrlPlain(amount)} iniciada${descSuffix}. Aguardando pagamento.`,
      tags: ["qrcode", "hourglass_flowing_sand"],
      priority: 4,
    });
  } catch {
    // ignore push errors so transaction flow never breaks
  }
}

export async function notifyUserPixPaidIfEligible(
  userId: string,
  transactionId: string,
  amount: number,
  description?: string | null,
  externalId?: string | null
): Promise<void> {
  if (!userId) return;
  try {
    const settings = getUserNtfySettings(userId);
    const notified = new Set(settings.notifiedPaidTxIds ?? []);
    if (
      (transactionId && notified.has(transactionId)) ||
      (externalId && notified.has(externalId))
    ) {
      return;
    }

    if (transactionId) notified.add(transactionId);
    if (externalId) notified.add(externalId);

    const all = loadAllNtfySettings();
    all[settings.userId] = {
      ...settings,
      notifiedPaidTxIds: Array.from(notified).slice(-500),
    };
    saveAllNtfySettings({ ...all });

    if (!settings.notifyPixPaid || !settings.topic) return;

    const descSuffix = description?.trim() ? ` (${description.trim()})` : "";
    await sendNtfyPush({
      topic: settings.topic,
      title: "BokashiPay: PIX pago (venda confirmada)",
      message: `Venda confirmada! Você recebeu ${formatBrlPlain(amount)} via PIX${descSuffix}.`,
      tags: ["white_check_mark", "moneybag"],
      priority: 5,
    });
  } catch {
    // ignore push errors
  }
}

export type NotificationCategory = "info" | "success" | "warning" | "urgent";

export interface CustomUserNotification {
  id: string;
  targetUserId: string; // specific userId or "ALL"
  targetUserName: string;
  targetUserEmail?: string | null | undefined;
  targetTopic?: string | null | undefined;
  title: string;
  message: string;
  category: NotificationCategory;
  ntfyDelivered: boolean;
  readByUserIds: string[];
  createdAt: string;
}

export interface AdminUserNtfySummary {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  topic: string;
  notifyPixGenerated: boolean;
  notifyPixPaid: boolean;
  updatedAt: string;
}

const CUSTOM_NOTIFICATIONS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "user-notifications.json"
);

let memoryCustomNotifications: CustomUserNotification[] | null = null;

function loadCustomNotifications(): CustomUserNotification[] {
  if (memoryCustomNotifications) return memoryCustomNotifications;
  try {
    if (fs.existsSync(CUSTOM_NOTIFICATIONS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(CUSTOM_NOTIFICATIONS_FILE, "utf-8")
      ) as unknown;
      if (Array.isArray(parsed)) {
        memoryCustomNotifications = parsed as CustomUserNotification[];
        return memoryCustomNotifications;
      }
    }
  } catch {
    // ignore
  }
  memoryCustomNotifications = [];
  return memoryCustomNotifications;
}

function saveCustomNotifications(list: CustomUserNotification[]) {
  memoryCustomNotifications = list;
  try {
    const dir = path.dirname(CUSTOM_NOTIFICATIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      CUSTOM_NOTIFICATIONS_FILE,
      JSON.stringify(list, null, 2),
      "utf-8"
    );
  } catch {
    // ignore
  }
}

function getServerEnvVar(key: string): string | undefined {
  const env = typeof process !== "undefined" ? process.env : {};
  if (env?.[key]) return env[key];
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;
        const k = line.slice(0, eqIdx).trim();
        if (k === key) {
          return line
            .slice(eqIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

export interface SupabaseAuthUserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  refCode: string;
  referredByCode?: string | undefined;
  referredByEmail?: string | undefined;
  referredByUserId?: string | undefined;
}

const DEFAULT_SUPABASE_URL = "https://gnelpocqtzphzmmsouix.supabase.co";
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduZWxwb2NxdHpwaHptbXNvdWl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjAyNjU4NCwiZXhwIjoyMTA3NjAyNTg0fQ.nY3kDLY2sj1WVJHHtVtNafNSRFwnXbnQMg9bJpPWPkk";

export async function fetchAllSupabaseAuthUsers(): Promise<SupabaseAuthUserRecord[]> {
  const supabaseUrl = getServerEnvVar("VITE_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const serviceRoleKey =
    getServerEnvVar("SUPABASE_SERVICE_ROLE_KEY") || DEFAULT_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return [];

  try {
    const res = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/admin/users?page=1&per_page=500`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as {
      users?: Array<{
        id?: string;
        email?: string;
        created_at?: string;
        user_metadata?: {
          full_name?: string;
          name?: string;
          affiliate_ref_code?: string;
          referred_by_code?: string;
          referred_by_email?: string;
          referred_by_user_id?: string;
        };
      }>;
    };
    return (data.users ?? [])
      .filter((u): u is typeof u & { id: string } => Boolean(u.id))
      .map((u) => {
        const email = u.email || "cliente@bokashipay.com";
        const name =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          email.split("@")[0] ||
          "Cliente";
        return {
          id: u.id,
          email,
          name,
          createdAt: u.created_at || new Date().toISOString(),
          refCode:
            u.user_metadata?.affiliate_ref_code ||
            generateDeterministicRefCode(u.id),
          referredByCode: u.user_metadata?.referred_by_code,
          referredByEmail: u.user_metadata?.referred_by_email,
          referredByUserId: u.user_metadata?.referred_by_user_id,
        };
      });
  } catch (err) {
    console.error("Erro ao listar usuários do Supabase Auth:", err);
    return [];
  }
}

export async function updateSupabaseUserReferralMetadata(
  userId: string,
  refCode: string,
  referrerEmail?: string | null | undefined,
  referrerUserId?: string | null | undefined
) {
  const supabaseUrl = getServerEnvVar("VITE_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const serviceRoleKey =
    getServerEnvVar("SUPABASE_SERVICE_ROLE_KEY") || DEFAULT_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey || !userId) return;

  try {
    await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/admin/users/${userId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_metadata: {
            referred_by_code: refCode.trim().toUpperCase(),
            ...(referrerEmail ? { referred_by_email: referrerEmail.trim().toLowerCase() } : {}),
            ...(referrerUserId ? { referred_by_user_id: referrerUserId } : {}),
          },
        }),
      }
    );
  } catch (err) {
    console.error("Erro ao atualizar metadata no Supabase:", err);
  }
}

export async function listAdminUsersWithNtfy(): Promise<AdminUserNtfySummary[]> {
  const userMap = new Map<
    string,
    { userId: string; name: string; email: string; createdAt: string }
  >();

  // 1. Fetch real users from Supabase Auth Admin API
  try {
    const supabaseUsers = await fetchAllSupabaseAuthUsers();
    for (const u of supabaseUsers) {
      userMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
      });
    }
  } catch {
    // ignore
  }

  // 2. Also include any userIds from withdrawals, payment links, meds, and ntfy settings
  for (const w of loadWithdrawals()) {
    if (w.userId && !userMap.has(w.userId)) {
      userMap.set(w.userId, {
        userId: w.userId,
        name: w.clientName || "Cliente BokashiPay",
        email: w.clientEmail || "cliente@bokashipay.com",
        createdAt: w.createdAt,
      });
    }
  }

  for (const m of loadAdminMeds()) {
    if (m.userId && !userMap.has(m.userId)) {
      userMap.set(m.userId, {
        userId: m.userId,
        name: m.clientName || "Cliente BokashiPay",
        email: m.clientEmail || "cliente@bokashipay.com",
        createdAt: m.createdAt,
      });
    }
  }

  for (const pl of loadPaymentLinks()) {
    if (pl.userId && !userMap.has(pl.userId)) {
      userMap.set(pl.userId, {
        userId: pl.userId,
        name: `Vendedor (${pl.userId.slice(0, 8)})`,
        email: "vendedor@bokashipay.com",
        createdAt: pl.createdAt,
      });
    }
  }

  const allNtfy = loadAllNtfySettings();
  for (const uid of Object.keys(allNtfy)) {
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userId: uid,
        name: uid === "guest" ? "Visitante / Padrão" : `Usuário (${uid.slice(0, 8)})`,
        email: uid === "guest" ? "visitante@bokashipay.com" : "usuario@bokashipay.com",
        createdAt: allNtfy[uid]?.createdAt || new Date().toISOString(),
      });
    }
  }

  const summaries: AdminUserNtfySummary[] = [];
  for (const entry of userMap.values()) {
    const ntfy = getUserNtfySettings(entry.userId);
    summaries.push({
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      createdAt: entry.createdAt,
      topic: ntfy.topic,
      notifyPixGenerated: ntfy.notifyPixGenerated,
      notifyPixPaid: ntfy.notifyPixPaid,
      updatedAt: ntfy.updatedAt,
    });
  }

  return summaries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function sendAdminCustomNotification(input: {
  targetUserId: string; // specific userId or "ALL"
  targetUserName?: string | undefined;
  targetUserEmail?: string | undefined;
  customTopic?: string | undefined;
  title: string;
  message: string;
  category?: NotificationCategory | undefined;
}): Promise<CustomUserNotification> {
  const title = (input.title || "").trim();
  const message = (input.message || "").trim();
  if (!title || !message) {
    throw new Error("Título e mensagem da notificação são obrigatórios.");
  }

  const category: NotificationCategory = input.category || "info";
  const tagsByCategory: Record<NotificationCategory, string[]> = {
    info: ["bell", "information_source"],
    success: ["white_check_mark", "tada"],
    warning: ["warning", "loudspeaker"],
    urgent: ["rotating_light", "exclamation"],
  };
  const priorityByCategory: Record<NotificationCategory, number> = {
    info: 3,
    success: 4,
    warning: 4,
    urgent: 5,
  };

  let ntfyDelivered = false;
  let resolvedTopic = (input.customTopic || "").trim();

  if (input.targetUserId === "ALL") {
    const allUsers = await listAdminUsersWithNtfy();
    const uniqueTopics = Array.from(
      new Set(allUsers.map((u) => u.topic).filter(Boolean))
    );
    resolvedTopic =
      uniqueTopics.length > 0
        ? `Broadcast (${uniqueTopics.length} topics)`
        : "Todos os usuários";

    const results = await Promise.allSettled(
      uniqueTopics.map((topic) =>
        sendNtfyPush({
          topic,
          title,
          message,
          tags: tagsByCategory[category],
          priority: priorityByCategory[category],
        })
      )
    );
    ntfyDelivered = results.some(
      (r) => r.status === "fulfilled" && r.value.sent
    );
  } else {
    const userSettings = getUserNtfySettings(input.targetUserId);
    const topicToUse = resolvedTopic || userSettings.topic;
    resolvedTopic = topicToUse;
    if (topicToUse) {
      const pushRes = await sendNtfyPush({
        topic: topicToUse,
        title,
        message,
        tags: tagsByCategory[category],
        priority: priorityByCategory[category],
      });
      ntfyDelivered = pushRes.sent;
    }
  }

  const record: CustomUserNotification = {
    id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900
    )}`,
    targetUserId: input.targetUserId || "ALL",
    targetUserName:
      (input.targetUserName || "").trim() ||
      (input.targetUserId === "ALL" ? "Todos os Usuários" : input.targetUserId),
    targetUserEmail: input.targetUserEmail || null,
    targetTopic: resolvedTopic || null,
    title,
    message,
    category,
    ntfyDelivered,
    readByUserIds: [],
    createdAt: new Date().toISOString(),
  };

  const existing = loadCustomNotifications();
  saveCustomNotifications([record, ...existing]);
  return record;
}

export function listCustomNotifications(options?: {
  userId?: string | null | undefined;
  scope?: "user" | "admin" | undefined;
}): CustomUserNotification[] {
  const all = loadCustomNotifications();
  if (options?.scope === "admin") {
    return all;
  }
  const uid = (options?.userId || "").trim();
  if (!uid) {
    return all.filter((n) => n.targetUserId === "ALL");
  }
  return all.filter(
    (n) => n.targetUserId === "ALL" || n.targetUserId === uid
  );
}

export function markCustomNotificationRead(
  notificationId: string,
  userId: string
): void {
  if (!notificationId || !userId) return;
  const all = loadCustomNotifications();
  let changed = false;
  const next = all.map((n) => {
    if (n.id !== notificationId && notificationId !== "ALL") return n;
    const readSet = new Set(n.readByUserIds ?? []);
    if (!readSet.has(userId)) {
      readSet.add(userId);
      changed = true;
    }
    return {
      ...n,
      readByUserIds: Array.from(readSet),
    };
  });
  if (changed) {
    saveCustomNotifications(next);
  }
}

export function deleteCustomNotification(notificationId: string): void {
  const all = loadCustomNotifications();
  saveCustomNotifications(all.filter((n) => n.id !== notificationId));
}

// ==========================================
// 5. SISTEMA DE AFILIADOS ("INDIQUE E GANHE") - SEPARADO DO GATEWAY
// ==========================================

export interface AffiliateProfile {
  userId: string;
  name: string;
  email: string;
  refCode: string;
  commissionPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateReferral {
  id: string;
  affiliateUserId: string;
  refCode: string;
  referredUserId: string;
  referredName: string;
  referredEmail: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface AffiliateCommissionEntry {
  id: string;
  affiliateUserId: string;
  referredUserId?: string | null | undefined;
  referredName: string;
  sourceTxId?: string | null | undefined;
  platformProfitAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  description: string;
  createdAt: string;
}

export interface AffiliateWithdrawalRequest {
  id: string;
  affiliateUserId: string;
  affiliateName: string;
  affiliateEmail: string;
  refCode: string;
  amount: number;
  pixKeyType: "phone" | "cpf_cnpj" | "email" | "random";
  pixKey: string;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt?: string | null | undefined;
  bspayTransactionId?: string | null | undefined;
  adminNote?: string | null | undefined;
}

interface AffiliatesStoreData {
  profiles: Record<string, AffiliateProfile>;
  referrals: AffiliateReferral[];
  commissions: AffiliateCommissionEntry[];
  withdrawals: AffiliateWithdrawalRequest[];
}

const AFFILIATES_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "affiliates-store.json"
);

let memoryAffiliates: AffiliatesStoreData | null = null;

function loadAffiliatesStore(): AffiliatesStoreData {
  try {
    if (fs.existsSync(AFFILIATES_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(AFFILIATES_FILE, "utf-8")
      ) as Partial<AffiliatesStoreData>;
      memoryAffiliates = {
        profiles:
          parsed.profiles && typeof parsed.profiles === "object"
            ? parsed.profiles
            : {},
        referrals: Array.isArray(parsed.referrals) ? parsed.referrals : [],
        commissions: Array.isArray(parsed.commissions) ? parsed.commissions : [],
        withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
      };
      return memoryAffiliates;
    }
  } catch {
    if (memoryAffiliates) return memoryAffiliates;
  }
  memoryAffiliates = {
    profiles: {},
    referrals: [],
    commissions: [],
    withdrawals: [],
  };
  return memoryAffiliates;
}

function saveAffiliatesStore(store: AffiliatesStoreData) {
  memoryAffiliates = store;
  try {
    const dir = path.dirname(AFFILIATES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AFFILIATES_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // ignore write error
  }
}

export function generateDeterministicRefCode(userId: string): string {
  const clean = (userId || "guest").replace(/[^a-zA-Z0-9]/g, "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hexPart = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const prefix = clean.slice(0, 4).toUpperCase();
  return `${prefix}${hexPart}`.slice(0, 8);
}

function isGenericAffiliateName(name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  const v = name.trim();
  return (
    v === "Visitante" ||
    v === "Visitante / Padrão" ||
    v === "Afiliado BokashiPay" ||
    v === "Cliente BokashiPay" ||
    v.startsWith("Afiliado (") ||
    v.startsWith("Usuário (") ||
    v.startsWith("Vendedor (")
  );
}

function isGenericAffiliateEmail(email?: string | null): boolean {
  if (!email || !email.trim() || !email.includes("@")) return true;
  const v = email.trim().toLowerCase();
  return (
    v === "afiliado@bokashipay.com" ||
    v === "usuario@bokashipay.com" ||
    v === "visitante@bokashipay.com" ||
    v === "cliente@bokashipay.com" ||
    v === "vendedor@bokashipay.com"
  );
}

export function ensureAffiliateProfile(
  userId: string,
  name?: string | null,
  email?: string | null,
  customRefCode?: string | null
): AffiliateProfile {
  const store = loadAffiliatesStore();
  const uid = (userId || "guest").trim();
  const existing = store.profiles[uid];
  const now = new Date().toISOString();

  if (existing) {
    let changed = false;
    const next = { ...existing };
    const incomingName = (name || "").trim();
    const incomingEmail = (email || "").trim().toLowerCase();
    const incomingRefCode = (customRefCode || "").trim().toUpperCase();

    if (
      incomingName &&
      !isGenericAffiliateName(incomingName) &&
      (isGenericAffiliateName(next.name) ||
        next.name === next.email.split("@")[0] ||
        next.name !== incomingName)
    ) {
      next.name = incomingName;
      changed = true;
    }

    if (
      incomingEmail &&
      !isGenericAffiliateEmail(incomingEmail) &&
      (isGenericAffiliateEmail(next.email) || next.email !== incomingEmail)
    ) {
      next.email = incomingEmail;
      changed = true;
    }

    if (
      incomingRefCode &&
      next.refCode.toUpperCase() !== incomingRefCode &&
      !Object.values(store.profiles).some(
        (p) => p.userId !== uid && p.refCode.toUpperCase() === incomingRefCode
      )
    ) {
      next.refCode = incomingRefCode;
      changed = true;
    }

    if (changed) {
      next.updatedAt = now;
      store.profiles[uid] = next;
      // Sync updated affiliate name/email into existing withdrawal requests
      store.withdrawals = store.withdrawals.map((w) =>
        w.affiliateUserId === uid
          ? { ...w, affiliateName: next.name, affiliateEmail: next.email }
          : w
      );
      saveAffiliatesStore(store);
    }
    return next;
  }

  let refCode =
    (customRefCode || "").trim().toUpperCase() ||
    generateDeterministicRefCode(uid);
  const conflicting = Object.values(store.profiles).find(
    (p) => p.userId !== uid && p.refCode.toUpperCase() === refCode.toUpperCase()
  );
  if (conflicting) {
    refCode = `${refCode.slice(0, 5)}${Math.floor(100 + Math.random() * 900)}`;
  }

  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanName =
    (name || "").trim() ||
    (cleanEmail && !isGenericAffiliateEmail(cleanEmail)
      ? cleanEmail.split("@")[0]!
      : uid === "guest"
        ? "Visitante"
        : `Afiliado (${uid.slice(0, 6)})`);

  const profile: AffiliateProfile = {
    userId: uid,
    name: cleanName,
    email: cleanEmail || "afiliado@bokashipay.com",
    refCode,
    commissionPercent: 25,
    createdAt: now,
    updatedAt: now,
  };

  store.profiles[uid] = profile;
  saveAffiliatesStore(store);
  return profile;
}

export function getReferrerInfoByCode(refCode: string): {
  userId: string;
  name: string;
  email: string;
  refCode: string;
} | null {
  const cleanCode = (refCode || "").trim().toUpperCase();
  if (!cleanCode) return null;
  const store = loadAffiliatesStore();
  const profile = Object.values(store.profiles).find(
    (p) => p.refCode.toUpperCase() === cleanCode
  );
  if (!profile) return null;
  return {
    userId: profile.userId,
    name: profile.name,
    email: profile.email,
    refCode: profile.refCode,
  };
}

export async function registerAffiliateReferral(input: {
  refCode: string;
  referredUserId: string;
  referredName?: string | null | undefined;
  referredEmail?: string | null | undefined;
}): Promise<AffiliateReferral | null> {
  const cleanCode = (input.refCode || "").trim().toUpperCase();
  const referredUid = (input.referredUserId || "").trim();
  const cleanEmail = (input.referredEmail || "").trim().toLowerCase();
  const cleanName =
    (input.referredName || "").trim() ||
    (cleanEmail ? cleanEmail.split("@")[0]! : "Indicado");

  if (!cleanCode || !referredUid) return null;

  // Ensure the referred user also has their own affiliate profile initialized
  if (referredUid !== "guest") {
    ensureAffiliateProfile(referredUid, cleanName, cleanEmail);
  }

  let store = loadAffiliatesStore();
  let referrerProfile = Object.values(store.profiles).find(
    (p) => p.refCode.toUpperCase() === cleanCode
  );

  // If referrer not yet in memory store, try syncing from real Supabase Auth users
  if (!referrerProfile) {
    await syncRealUsersToAffiliateStore(true);
    store = loadAffiliatesStore();
    referrerProfile = Object.values(store.profiles).find(
      (p) => p.refCode.toUpperCase() === cleanCode
    );
  }

  if (!referrerProfile) return null;

  // Cannot refer yourself (unless referrer is guest placeholder being tested)
  if (
    referrerProfile.userId === referredUid ||
    (cleanEmail &&
      !isGenericAffiliateEmail(referrerProfile.email) &&
      referrerProfile.email.toLowerCase() === cleanEmail)
  ) {
    return null;
  }

  // Update Supabase user metadata permanently
  await updateSupabaseUserReferralMetadata(
    referredUid,
    referrerProfile.refCode,
    referrerProfile.email,
    referrerProfile.userId
  );

  // Check if this user was already referred (by userId or email)
  const existingIdx = store.referrals.findIndex(
    (r) =>
      r.referredUserId === referredUid ||
      (cleanEmail &&
        !isGenericAffiliateEmail(r.referredEmail) &&
        r.referredEmail.toLowerCase() === cleanEmail)
  );

  if (existingIdx !== -1) {
    const existingRef = store.referrals[existingIdx]!;
    const updatedRef: AffiliateReferral = {
      ...existingRef,
      affiliateUserId: referrerProfile.userId,
      refCode: referrerProfile.refCode,
      referredUserId: referredUid,
      referredName:
        cleanName && cleanName !== "Indicado"
          ? cleanName
          : existingRef.referredName,
      referredEmail: cleanEmail || existingRef.referredEmail,
    };
    store.referrals[existingIdx] = updatedRef;
    saveAffiliatesStore(store);
    return updatedRef;
  }

  const referral: AffiliateReferral = {
    id: `REF-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900
    )}`,
    affiliateUserId: referrerProfile.userId,
    refCode: referrerProfile.refCode,
    referredUserId: referredUid,
    referredName: cleanName,
    referredEmail: cleanEmail || "indicado@bokashipay.com",
    status: "active",
    createdAt: new Date().toISOString(),
  };

  store.referrals = [referral, ...store.referrals];
  saveAffiliatesStore(store);
  return referral;
}

export function getAffiliateSummaryForUser(
  userId: string,
  name?: string | null,
  email?: string | null
) {
  const profile = ensureAffiliateProfile(userId, name, email);
  const store = loadAffiliatesStore();

  const referrals = store.referrals.filter(
    (r) =>
      r.affiliateUserId === profile.userId ||
      (Boolean(profile.refCode) &&
        r.refCode.toUpperCase() === profile.refCode.toUpperCase())
  );
  const commissions = store.commissions.filter(
    (c) => c.affiliateUserId === profile.userId
  );
  const withdrawals = store.withdrawals.filter(
    (w) => w.affiliateUserId === profile.userId
  );

  const totalEarned = Number(
    commissions.reduce((acc, c) => acc + c.commissionAmount, 0).toFixed(2)
  );
  const pendingWithdrawals = Number(
    withdrawals
      .filter((w) => w.status === "PENDING_APPROVAL")
      .reduce((acc, w) => acc + w.amount, 0)
      .toFixed(2)
  );
  const approvedWithdrawals = Number(
    withdrawals
      .filter((w) => w.status === "APPROVED")
      .reduce((acc, w) => acc + w.amount, 0)
      .toFixed(2)
  );
  const availableBalance = Math.max(
    0,
    Number((totalEarned - pendingWithdrawals - approvedWithdrawals).toFixed(2))
  );

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const receivedToday = Number(
    commissions
      .filter((c) => new Date(c.createdAt).getTime() >= startOfToday)
      .reduce((acc, c) => acc + c.commissionAmount, 0)
      .toFixed(2)
  );

  const avgTicket =
    commissions.length > 0
      ? Number((totalEarned / commissions.length).toFixed(2))
      : 0;

  return {
    profile,
    stats: {
      activeReferrals: referrals.filter((r) => r.status === "active").length,
      totalReferrals: referrals.length,
      totalEarned,
      availableBalance,
      pendingWithdrawals,
      approvedWithdrawals,
      receivedToday,
      commissionPercent: profile.commissionPercent,
      avgTicket,
    },
    referrals,
    commissions,
    withdrawals,
  };
}

export function createAffiliateWithdrawalRequest(input: {
  userId: string;
  name?: string | null | undefined;
  email?: string | null | undefined;
  amount: number;
  pixKeyType: "phone" | "cpf_cnpj" | "email" | "random";
  pixKey: string;
}): AffiliateWithdrawalRequest {
  const summary = getAffiliateSummaryForUser(
    input.userId,
    input.name,
    input.email
  );
  const amount = Number(Number(input.amount || 0).toFixed(2));
  if (!amount || amount <= 0) {
    throw new Error("Informe um valor válido para o saque de comissão.");
  }
  if (amount > summary.stats.availableBalance) {
    throw new Error(
      `Saldo de comissão insuficiente. Disponível: R$ ${summary.stats.availableBalance
        .toFixed(2)
        .replace(".", ",")}`
    );
  }
  if (!input.pixKey || !input.pixKey.trim()) {
    throw new Error("Informe a chave PIX de destino para receber sua comissão.");
  }

  const store = loadAffiliatesStore();
  const req: AffiliateWithdrawalRequest = {
    id: `AFW-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900
    )}`,
    affiliateUserId: summary.profile.userId,
    affiliateName: summary.profile.name,
    affiliateEmail: summary.profile.email,
    refCode: summary.profile.refCode,
    amount,
    pixKeyType: input.pixKeyType || "cpf_cnpj",
    pixKey: input.pixKey.trim(),
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  };

  store.withdrawals = [req, ...store.withdrawals];
  saveAffiliatesStore(store);
  return req;
}

export async function decideAffiliateWithdrawalRequest(
  id: string,
  decision: "approve_bspay" | "approve_manual" | "reject",
  adminNote?: string
): Promise<{
  item: AffiliateWithdrawalRequest;
  bspayDispatched: boolean;
  bspayWarning?: string | undefined;
}> {
  const store = loadAffiliatesStore();
  const idx = store.withdrawals.findIndex((w) => w.id === id);
  if (idx === -1) {
    throw new Error("Solicitação de saque de afiliado não encontrada.");
  }

  const target = store.withdrawals[idx]!;
  const now = new Date().toISOString();

  if (decision === "reject") {
    const updated: AffiliateWithdrawalRequest = {
      ...target,
      status: "REJECTED",
      decidedAt: now,
      adminNote:
        adminNote?.trim() ||
        "Saque de comissão recusado pelo administrador. Saldo devolvido à carteira de afiliado.",
    };
    store.withdrawals[idx] = updated;
    saveAffiliatesStore(store);
    return { item: updated, bspayDispatched: false };
  }

  let bspayTxId: string | null = target.bspayTransactionId || null;
  let bspayDispatched = false;
  let bspayWarning: string | undefined;

  if (decision === "approve_bspay") {
    try {
      const bspayRes = await processBspayTransfer({
        mode: "external",
        currency: "BRL",
        amount: target.amount,
        pixKeyType: target.pixKeyType,
        pixKey: target.pixKey,
        description: `Comissão Afiliado BokashiPay (${target.refCode}) - ${target.affiliateName}`,
        externalId: target.id,
        executeImmediately: true,
      });
      bspayTxId = bspayRes.transactionId;
      bspayDispatched = true;
    } catch (err) {
      bspayWarning =
        err instanceof Error
          ? err.message
          : "Erro ao disparar PIX de comissão na BSPAY";
    }
  }

  const updated: AffiliateWithdrawalRequest = {
    ...target,
    status: "APPROVED",
    decidedAt: now,
    bspayTransactionId: bspayTxId || target.id,
    adminNote:
      adminNote?.trim() ||
      (bspayDispatched
        ? "Saque de afiliado aprovado e pago via PIX BSPAY."
        : bspayWarning
          ? `Aprovado manualmente (Aviso BSPAY: ${bspayWarning})`
          : "Saque de afiliado aprovado manualmente pelo Admin."),
  };

  store.withdrawals[idx] = updated;
  saveAffiliatesStore(store);
  return {
    item: updated,
    bspayDispatched,
    bspayWarning,
  };
}

export function adminAddAffiliateCommission(input: {
  affiliateUserId: string;
  referredName?: string | null | undefined;
  platformProfitAmount?: number | null | undefined;
  commissionAmount?: number | null | undefined;
  description?: string | null | undefined;
}): AffiliateCommissionEntry {
  const profile = ensureAffiliateProfile(input.affiliateUserId);
  const store = loadAffiliatesStore();

  const profit = Number(input.platformProfitAmount || 0);
  const explicitComm = Number(input.commissionAmount || 0);
  const finalCommission =
    explicitComm > 0
      ? Number(explicitComm.toFixed(2))
      : Number(((profit * profile.commissionPercent) / 100).toFixed(2));

  if (finalCommission <= 0) {
    throw new Error("O valor da comissão deve ser maior que zero.");
  }

  const entry: AffiliateCommissionEntry = {
    id: `COM-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900
    )}`,
    affiliateUserId: profile.userId,
    referredName: (input.referredName || "").trim() || "Indicação Direta",
    platformProfitAmount:
      profit > 0
        ? profit
        : Number(((finalCommission * 100) / profile.commissionPercent).toFixed(2)),
    commissionPercent: profile.commissionPercent,
    commissionAmount: finalCommission,
    description:
      (input.description || "").trim() ||
      `Comissão vitalícia (${profile.commissionPercent}% sobre lucro da plataforma)`,
    createdAt: new Date().toISOString(),
  };

  store.commissions = [entry, ...store.commissions];
  saveAffiliatesStore(store);
  return entry;
}

export function adminUpdateAffiliateProfile(input: {
  userId: string;
  name?: string | undefined;
  email?: string | undefined;
  refCode?: string | undefined;
  commissionPercent?: number | undefined;
}): AffiliateProfile {
  const profile = ensureAffiliateProfile(input.userId, input.name, input.email);
  const store = loadAffiliatesStore();

  const next: AffiliateProfile = {
    ...profile,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.refCode?.trim()
      ? { refCode: input.refCode.trim().toUpperCase() }
      : {}),
    ...(typeof input.commissionPercent === "number" &&
    !isNaN(input.commissionPercent)
      ? {
          commissionPercent: Math.max(
            0,
            Math.min(100, Number(input.commissionPercent))
          ),
        }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  store.profiles[profile.userId] = next;
  saveAffiliatesStore(store);
  return next;
}

interface LocalUserAccount {
  userId: string;
  name: string;
  email: string;
  password?: string | undefined;
  createdAt: string;
}

const LOCAL_USERS_FILE = path.resolve(
  process.cwd(),
  ".tanstack",
  "local-users.json"
);

let memoryLocalUsers: Record<string, LocalUserAccount> | null = null;

function loadLocalUsers(): Record<string, LocalUserAccount> {
  if (memoryLocalUsers) return memoryLocalUsers;
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(LOCAL_USERS_FILE, "utf-8")
      ) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        memoryLocalUsers = parsed as Record<string, LocalUserAccount>;
        return memoryLocalUsers;
      }
    }
  } catch {
    // ignore
  }
  memoryLocalUsers = {};
  return memoryLocalUsers;
}

function saveLocalUsers(users: Record<string, LocalUserAccount>) {
  memoryLocalUsers = users;
  try {
    const dir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

let lastAffiliateUserSyncAt = 0;

export async function syncRealUsersToAffiliateStore(force = false) {
  const now = Date.now();
  const store = loadAffiliatesStore();

  // Always sync local registered users immediately (0ms)
  const localUsers = loadLocalUsers();
  for (const u of Object.values(localUsers)) {
    if (u.userId && !isGenericAffiliateEmail(u.email)) {
      ensureAffiliateProfile(u.userId, u.name, u.email);
    }
  }

  // Poll external Supabase users list
  const shouldSyncSupabase =
    force ||
    now - lastAffiliateUserSyncAt > 10_000 ||
    Object.keys(store.profiles).length <= 1;

  if (shouldSyncSupabase) {
    lastAffiliateUserSyncAt = now;
    try {
      const supaUsers = await fetchAllSupabaseAuthUsers();
      // Map all ref codes to user profiles
      const userByCode = new Map<
        string,
        { id: string; name: string; email: string; refCode: string }
      >();

      for (const u of supaUsers) {
        if (
          u.id &&
          u.id !== "guest" &&
          u.id !== "admin-master" &&
          !isGenericAffiliateEmail(u.email)
        ) {
          const prof = ensureAffiliateProfile(u.id, u.name, u.email, u.refCode);
          store.profiles[u.id] = prof;
          userByCode.set(prof.refCode.toUpperCase(), {
            id: u.id,
            name: prof.name,
            email: prof.email,
            refCode: prof.refCode,
          });
          if (u.refCode && u.refCode.toUpperCase() !== prof.refCode.toUpperCase()) {
            userByCode.set(u.refCode.toUpperCase(), {
              id: u.id,
              name: prof.name,
              email: prof.email,
              refCode: prof.refCode,
            });
          }
        }
      }

      // Link any user that has referredByCode or referredByUserId
      for (const u of supaUsers) {
        const refCode = (u.referredByCode || "").trim().toUpperCase();
        const refUserId = (u.referredByUserId || "").trim();
        let referrer = refCode ? userByCode.get(refCode) : null;
        if (!referrer && refUserId) {
          const found = supaUsers.find((s) => s.id === refUserId);
          if (found) {
            referrer = {
              id: found.id,
              name: found.name,
              email: found.email,
              refCode: found.refCode,
            };
          }
        }

        if (referrer && referrer.id !== u.id) {
          const existing = store.referrals.find(
            (r) =>
              r.referredUserId === u.id ||
              (u.email &&
                !isGenericAffiliateEmail(u.email) &&
                r.referredEmail.toLowerCase() === u.email.toLowerCase())
          );
          if (!existing) {
            store.referrals.unshift({
              id: `REF-SUPA-${u.id.slice(0, 8).toUpperCase()}`,
              affiliateUserId: referrer.id,
              refCode: referrer.refCode,
              referredUserId: u.id,
              referredName: u.name,
              referredEmail: u.email,
              status: "active",
              createdAt: u.createdAt || new Date().toISOString(),
            });
          } else {
            existing.affiliateUserId = referrer.id;
            existing.refCode = referrer.refCode;
            existing.referredUserId = u.id;
            existing.referredName = u.name;
            existing.referredEmail = u.email;
          }
        }
      }
      saveAffiliatesStore(store);
    } catch {
      // ignore
    }
  }

  // Remove old placeholder profiles that have no referrals/commissions/withdrawals
  let removedAny = false;
  for (const [uid, prof] of Object.entries(store.profiles)) {
    const hasRefs = store.referrals.some(
      (r) =>
        r.affiliateUserId === uid ||
        (prof.refCode && r.refCode.toUpperCase() === prof.refCode.toUpperCase())
    );
    const hasComms = store.commissions.some((c) => c.affiliateUserId === uid);
    const hasWiths = store.withdrawals.some((w) => w.affiliateUserId === uid);
    if (
      !hasRefs &&
      !hasComms &&
      !hasWiths &&
      (uid === "guest" ||
        uid === "admin-master" ||
        (isGenericAffiliateName(prof.name) && isGenericAffiliateEmail(prof.email)))
    ) {
      delete store.profiles[uid];
      removedAny = true;
    }
  }
  if (removedAny) {
    saveAffiliatesStore(store);
  }
}

export async function registerUserAccountServer(input: {
  name: string;
  email: string;
  password?: string | undefined;
  userId?: string | undefined;
  refCode?: string | undefined;
}): Promise<{
  userId: string;
  name: string;
  email: string;
  profile: AffiliateProfile;
  referral: AffiliateReferral | null;
}> {
  const cleanName =
    (input.name || "").trim() || input.email.split("@")[0] || "Cliente";
  const cleanEmail = (input.email || "").trim().toLowerCase();
  let resolvedUserId = (input.userId || "").trim();

  // Check if we already have a local user or affiliate profile with this email
  const localUsers = loadLocalUsers();
  const existingLocal = localUsers[cleanEmail];
  if (!resolvedUserId && existingLocal?.userId) {
    resolvedUserId = existingLocal.userId;
  }

  if (!resolvedUserId) {
    const store = loadAffiliatesStore();
    const existingByEmail = Object.values(store.profiles).find(
      (p) =>
        !isGenericAffiliateEmail(p.email) &&
        p.email.toLowerCase() === cleanEmail
    );
    resolvedUserId = existingByEmail?.userId || `USR-${cleanEmail}`;
  }

  // Save in local users store so login works even if Supabase requires email confirmation or rate-limits
  localUsers[cleanEmail] = {
    userId: resolvedUserId,
    name: cleanName,
    email: cleanEmail,
    ...(input.password ? { password: input.password } : existingLocal?.password ? { password: existingLocal.password } : {}),
    createdAt: existingLocal?.createdAt || new Date().toISOString(),
  };
  saveLocalUsers(localUsers);

  // Every account automatically gets an AffiliateProfile with its real name and email
  const profile = ensureAffiliateProfile(resolvedUserId, cleanName, cleanEmail);

  // If this user registered using someone's affiliate link (?ref=CODE), link them immediately
  let referral: AffiliateReferral | null = null;
  if (input.refCode && input.refCode.trim()) {
    referral = await registerAffiliateReferral({
      refCode: input.refCode.trim().toUpperCase(),
      referredUserId: resolvedUserId,
      referredName: cleanName,
      referredEmail: cleanEmail,
    });
  }

  return {
    userId: resolvedUserId,
    name: cleanName,
    email: cleanEmail,
    profile,
    referral,
  };
}

export function authenticateLocalUserAccount(input: {
  email: string;
  password?: string | undefined;
}): {
  userId: string;
  name: string;
  email: string;
  profile: AffiliateProfile;
} | null {
  const cleanEmail = (input.email || "").trim().toLowerCase();
  if (!cleanEmail) return null;
  const localUsers = loadLocalUsers();
  const found = localUsers[cleanEmail];
  if (!found) return null;
  if (found.password && input.password && found.password !== input.password) {
    return null;
  }
  const profile = ensureAffiliateProfile(found.userId, found.name, found.email);
  return {
    userId: found.userId,
    name: found.name,
    email: found.email,
    profile,
  };
}

export async function listAdminAffiliatesOverview() {
  await syncRealUsersToAffiliateStore(true);
  const store = loadAffiliatesStore();

  const allProfiles = Object.values(store.profiles).filter(
    (p) => p.userId !== "guest" && p.userId !== "admin-master"
  );

  const allSummaries = allProfiles.map((p) => {
    const summary = getAffiliateSummaryForUser(p.userId, p.name, p.email);
    return {
      profile: summary.profile,
      stats: summary.stats,
      referralsCount: summary.referrals.length,
      referrals: summary.referrals,
    };
  });

  // CRITICAL: Only show in the Admin Panel affiliates whose link has been used by someone
  // (or who have commissions/withdrawals recorded)
  const affiliates = allSummaries
    .filter(
      (item) =>
        item.referralsCount > 0 ||
        item.stats.totalEarned > 0 ||
        item.stats.pendingWithdrawals > 0 ||
        item.stats.approvedWithdrawals > 0
    )
    .sort((a, b) => {
      const aLatest = a.referrals[0]?.createdAt || a.profile.updatedAt;
      const bLatest = b.referrals[0]?.createdAt || b.profile.updatedAt;
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });

  const totalAffiliates = affiliates.length;
  const totalActiveReferrals = store.referrals.filter(
    (r) => r.status === "active"
  ).length;
  const totalCommissionsGenerated = Number(
    store.commissions
      .reduce((acc, c) => acc + c.commissionAmount, 0)
      .toFixed(2)
  );
  const pendingWithdrawals = store.withdrawals.filter(
    (w) => w.status === "PENDING_APPROVAL"
  );
  const pendingWithdrawalsAmount = Number(
    pendingWithdrawals.reduce((acc, w) => acc + w.amount, 0).toFixed(2)
  );
  const approvedWithdrawalsAmount = Number(
    store.withdrawals
      .filter((w) => w.status === "APPROVED")
      .reduce((acc, w) => acc + w.amount, 0)
      .toFixed(2)
  );

  return {
    widgets: {
      totalAffiliates,
      totalActiveReferrals,
      totalCommissionsGenerated,
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsAmount,
      approvedWithdrawalsAmount,
    },
    affiliates,
    allAccounts: allSummaries.map((s) => s.profile),
    referrals: store.referrals,
    commissions: store.commissions,
    withdrawals: store.withdrawals,
  };
}








