import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { transactions as mockTransactions, type TxStatus } from "@/data/mock";
import type { BspayTransactionRecord } from "@/integrations/bspay/server";

export interface TransactionItem {
  id: string;
  externalId?: string | null | undefined;
  name: string;
  description?: string | null | undefined;
  source?: string | null | undefined;
  direction?: string | null | undefined;
  currency?: string | null | undefined;
  oldBalance?: number | null | undefined;
  newBalance?: number | null | undefined;
  type: "Entrada" | "Saída";
  date: string;
  fullDate?: string | undefined;
  rawDate?: string | null | undefined;
  value: number;
  fee?: number | undefined;
  status: TxStatus;
  payerName?: string | null | undefined;
  payerDocument?: string | null | undefined;
  receiverName?: string | null | undefined;
  endToEndId?: string | null | undefined;
  conversion?: {
    fromCurrency?: string | null | undefined;
    fromAmount?: number | null | undefined;
    toCurrency?: string | null | undefined;
    toAmount?: number | null | undefined;
  } | null | undefined;
  userId?: string | null | undefined;
}

const getStorageKey = (userId: string) => `bokashipay_tx_${userId}`;

export function getLocalTransactions(userId: string): TransactionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTransaction(userId: string, tx: TransactionItem) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocalTransactions(userId);
    const updated = [tx, ...current.filter((t) => t.id !== tx.id)];
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
  } catch (e) {
    console.error("Erro ao salvar transação local:", e);
  }
}

function mapBspayStatus(record: BspayTransactionRecord): TxStatus {
  const raw = (record.status || "").toLowerCase();
  if (
    raw === "confirmed" ||
    raw === "paid" ||
    raw === "completed" ||
    raw === "success" ||
    Boolean(record.confirmed_at)
  ) {
    return "Concluído";
  }
  if (raw === "expired") {
    return "Expirado";
  }
  if (raw === "cancelled" || raw === "canceled" || raw === "failed" || raw === "refunded") {
    return "Cancelado";
  }
  if (raw === "analyzing" || raw === "review") {
    return "Em análise";
  }
  return "Pendente";
}

function formatBspayDate(dateStr?: string | null): string {
  if (!dateStr) {
    return new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) {
    return dateStr;
  }
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDateTime(dateStr?: string | null): string {
  const d = dateStr
    ? new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T"))
    : new Date();
  if (isNaN(d.getTime())) {
    return dateStr || "";
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function mapBspayRecordToTransaction(record: BspayTransactionRecord): TransactionItem {
  const isDebit =
    record.direction === "debit" ||
    record.source === "cashout";
  const type: "Entrada" | "Saída" = isDebit ? "Saída" : "Entrada";

  const rawAmount = Number(
    record.amount ??
      record.conversion?.to?.amount ??
      record.conversion?.from?.amount ??
      0
  );
  const value = type === "Saída" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const rawFee = Number(record.fee_amount ?? 0);
  const currency = record.currency || "BRL";
  const fee =
    rawFee > 0
      ? rawFee
      : type === "Entrada" && currency === "BRL" && rawAmount > 0
      ? Number(Math.max(0.9, rawAmount * 0.025).toFixed(2))
      : 0;
  const payerName = record.payer?.name?.trim() || null;
  const payerDocument = record.payer?.document?.trim() || null;
  const receiverName = record.receiver?.name?.trim() || null;
  const rawDesc = record.description?.trim() || null;
  const customDesc =
    rawDesc && rawDesc.toLowerCase() !== "deposit" ? rawDesc : null;

  let name = "";
  if (record.source === "conversion" || record.direction === "swap") {
    const fromCurr = record.conversion?.from?.currency || "BRL";
    const toCurr = record.conversion?.to?.currency || "USDT";
    name = `Conversão ${fromCurr} → ${toCurr}`;
  } else if (record.source === "internal_transfer") {
    const party = isDebit ? receiverName : payerName;
    name = `Transferência interna${party ? ` — ${party}` : customDesc ? ` — ${customDesc}` : ""}`;
  } else if (isDebit) {
    const target = customDesc || receiverName || "PIX";
    name = `Transferência enviada — ${target}`;
  } else {
    const baseLabel = currency === "BRL" ? "PIX recebido" : `Depósito ${currency}`;
    if (payerName) {
      name = `${baseLabel} — ${payerName}`;
    } else if (customDesc) {
      name = `${baseLabel} — ${customDesc}`;
    } else {
      name = currency === "BRL" ? "Cobrança PIX" : `Depósito ${currency}`;
    }
  }

  const status = mapBspayStatus(record);
  const relevantDate = record.confirmed_at || record.created_at;
  const parsedOldBalance =
    record.old_balance !== null &&
    record.old_balance !== undefined &&
    record.old_balance !== ""
      ? Number(record.old_balance)
      : null;
  const parsedNewBalance =
    record.new_balance !== null &&
    record.new_balance !== undefined &&
    record.new_balance !== ""
      ? Number(record.new_balance)
      : null;

  return {
    id: record.transaction_id || record.external_id || `BSPAY-${Math.random()}`,
    externalId: record.external_id,
    name,
    description: rawDesc || (isDebit ? "Withdrawal" : "Deposit"),
    source: record.source || (isDebit ? "cashout" : "cashin"),
    direction: record.direction || (isDebit ? "debit" : "credit"),
    currency,
    oldBalance: parsedOldBalance,
    newBalance: parsedNewBalance,
    type,
    date: formatBspayDate(relevantDate),
    fullDate: formatFullDateTime(relevantDate),
    rawDate: relevantDate,
    value,
    fee,
    status,
    payerName,
    payerDocument,
    receiverName,
    endToEndId: record.end_to_end_id,
    conversion: record.conversion
      ? {
          fromCurrency: record.conversion.from?.currency ?? "BRL",
          fromAmount: Number(record.conversion.from?.amount ?? 0),
          toCurrency: record.conversion.to?.currency ?? "USDT",
          toAmount: Number(record.conversion.to?.amount ?? 0),
        }
      : null,
  };
}

function cleanupStaleLocalDeposits(userId: string, bspayItems: TransactionItem[]) {
  if (typeof window === "undefined" || bspayItems.length === 0) return;
  try {
    const local = getLocalTransactions(userId);
    if (local.length === 0) return;
    const bspayIds = new Set(bspayItems.map((i) => i.id));
    const bspayExtIds = new Set(
      bspayItems.map((i) => i.externalId).filter(Boolean)
    );
    const cleaned = local.filter((l) => {
      if (bspayIds.has(l.id) || (l.externalId && bspayExtIds.has(l.externalId))) {
        return false;
      }
      // Remove stale local pending PIX deposits that are now tracked directly by BSPAY
      if (
        l.status === "Pendente" &&
        (l.name.startsWith("Depósito PIX") || l.name.startsWith("Transferência"))
      ) {
        return false;
      }
      return true;
    });
    if (cleaned.length !== local.length) {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(cleaned));
    }
  } catch {
    // ignore storage errors
  }
}

const DELETED_TX_KEY = "bokashipay_deleted_tx_ids";
const STATUS_OVERRIDE_KEY = "bokashipay_tx_status_overrides";

function getDeletedTxSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_TX_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function addDeletedTxId(id: string, externalId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const set = getDeletedTxSet();
    if (id) set.add(id);
    if (externalId) set.add(externalId);
    localStorage.setItem(DELETED_TX_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage error
  }
}

function getStatusOverridesMap(): Record<string, TxStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STATUS_OVERRIDE_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object"
      ? (obj as Record<string, TxStatus>)
      : {};
  } catch {
    return {};
  }
}

function setStatusOverride(
  id: string,
  status: TxStatus,
  externalId?: string | null
) {
  if (typeof window === "undefined") return;
  try {
    const map = getStatusOverridesMap();
    if (id) map[id] = status;
    if (externalId) map[externalId] = status;
    localStorage.setItem(STATUS_OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage error
  }
}

function applyClientTxOverrides(items: TransactionItem[]): TransactionItem[] {
  const deletedSet = getDeletedTxSet();
  const statusMap = getStatusOverridesMap();

  const filtered = items
    .filter((item) => {
      if (deletedSet.has(item.id)) return false;
      if (item.externalId && deletedSet.has(item.externalId)) return false;
      return true;
    })
    .map((item) => {
      const overridden =
        statusMap[item.id] ||
        (item.externalId ? statusMap[item.externalId] : undefined);
      if (overridden) {
        return { ...item, status: overridden };
      }
      return item;
    });

  // Compute chronological running balance (oldest -> newest) for any items missing oldBalance/newBalance
  let runningBalance = 0;
  const chronological = [...filtered].reverse().map((item) => {
    const oldBal =
      item.oldBalance !== null && item.oldBalance !== undefined
        ? item.oldBalance
        : runningBalance;
    let newBal: number | null =
      item.newBalance !== null && item.newBalance !== undefined
        ? item.newBalance
        : null;

    if (item.status === "Concluído") {
      if (newBal === null) {
        const fee = item.fee ?? 0;
        const delta =
          item.type === "Entrada"
            ? Math.max(0, Math.abs(item.value) - fee)
            : -(Math.abs(item.value) + fee);
        newBal = Math.max(0, Number((oldBal + delta).toFixed(2)));
      }
      runningBalance = newBal;
    } else {
      newBal = null;
    }

    return {
      ...item,
      oldBalance: oldBal,
      newBalance: newBal,
      fullDate: item.fullDate || formatFullDateTime(item.rawDate),
      description:
        item.description || (item.type === "Saída" ? "Withdrawal" : "Deposit"),
    };
  });

  return chronological.reverse();
}

export async function fetchAllAdminTransactions(): Promise<TransactionItem[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch(
      "/api/bspay/transactions?page=1&pageSize=100&scope=admin",
      {
        credentials: "include",
      }
    );
    const json = (await res.json()) as {
      success?: boolean;
      data?: { items?: BspayTransactionRecord[] };
    };
    if (res.ok && json.success && Array.isArray(json.data?.items)) {
      const bspayTransactions = json.data.items.map(mapBspayRecordToTransaction);
      return applyClientTxOverrides(bspayTransactions);
    }
  } catch {
    // ignore error
  }
  return [];
}

export async function fetchTransactions(userId?: string | null): Promise<TransactionItem[]> {
  // Nunca vazar dados entre contas ou exibir dados globais para sessões sem userId
  if (!userId) {
    return [];
  }

  let bspayTransactions: TransactionItem[] = [];

  if (typeof window !== "undefined") {
    try {
      let userCreatedAt: string | undefined;
      if (isSupabaseConfigured) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user?.id === userId) {
            userCreatedAt = sessionData.session.user.created_at;
          }
        } catch {
          // ignore session lookup error
        }
      }

      const query = new URLSearchParams({
        page: "1",
        pageSize: "50",
        userId,
        scope: "user",
      });
      if (userCreatedAt) {
        query.set("userCreatedAt", userCreatedAt);
      }

      const res = await fetch(`/api/bspay/transactions?${query.toString()}`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: BspayTransactionRecord[] };
      };
      if (res.ok && json.success && Array.isArray(json.data?.items)) {
        bspayTransactions = json.data.items.map((item) => ({
          ...mapBspayRecordToTransaction(item),
          userId,
        }));
        cleanupStaleLocalDeposits(userId, bspayTransactions);
      }
    } catch {
      // Fallback caso offline
    }
  }

  const local = getLocalTransactions(userId).filter(
    (l) => !l.userId || l.userId === userId
  );

  if (bspayTransactions.length > 0) {
    const existingIds = new Set(bspayTransactions.map((t) => t.id));
    const existingExtIds = new Set(
      bspayTransactions.map((t) => t.externalId).filter(Boolean)
    );

    const manualExtras = local.filter(
      (l) =>
        !existingIds.has(l.id) &&
        (!l.externalId || !existingExtIds.has(l.externalId)) &&
        !l.name.startsWith("Depósito PIX")
    );

    return applyClientTxOverrides([...bspayTransactions, ...manualExtras]);
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const mapped: TransactionItem[] = data.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type as "Entrada" | "Saída",
          date:
            t.date ||
            new Date(t.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }),
          value: Number(t.value),
          status: t.status as TxStatus,
          userId,
        }));

        const all = [...mapped];
        for (const l of local) {
          if (!all.some((t) => t.id === l.id)) {
            all.unshift(l);
          }
        }
        return applyClientTxOverrides(all);
      }

      return applyClientTxOverrides(local);
    } catch {
      return applyClientTxOverrides(local);
    }
  }

  return applyClientTxOverrides(local);
}

export async function createTransaction(
  transaction: {
    id?: string | undefined;
    externalId?: string | undefined;
    name: string;
    type: "Entrada" | "Saída";
    value: number;
    status?: TxStatus | undefined;
  },
  userId?: string | null
): Promise<TransactionItem> {
  const formattedDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const txId = transaction.id || `TX-${Math.floor(1000 + Math.random() * 9000)}`;
  const status = transaction.status ?? "Concluído";
  const numericValue =
    transaction.type === "Saída"
      ? -Math.abs(transaction.value)
      : Math.abs(transaction.value);

  const newTx: TransactionItem = {
    id: txId,
    externalId: transaction.externalId,
    name: transaction.name,
    type: transaction.type,
    date: formattedDate,
    rawDate: new Date().toISOString(),
    value: numericValue,
    status,
    userId: userId ?? undefined,
  };

  const storageUser = userId || "guest";
  saveLocalTransaction(storageUser, newTx);

  if (userId && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .insert([
          {
            id: txId,
            name: transaction.name,
            type: transaction.type,
            date: formattedDate,
            value: numericValue,
            status,
            user_id: userId,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          type: data.type as "Entrada" | "Saída",
          date: data.date,
          value: Number(data.value),
          status: data.status as TxStatus,
        };
      }
    } catch (e) {
      console.warn(
        "Tentativa de salvar no Supabase falhou, usando armazenamento local:",
        e
      );
    }
  }

  return newTx;
}

export type Tx = TransactionItem;

export async function updateTransactionStatus(
  id: string,
  status: TxStatus,
  userId?: string | null,
  externalId?: string | null
): Promise<void> {
  const storageUser = userId || "guest";
  setStatusOverride(id, status, externalId);

  if (typeof window !== "undefined") {
    try {
      for (const key of [storageUser, "guest"]) {
        const current = getLocalTransactions(key);
        if (current.length > 0) {
          const updated = current.map((t) =>
            t.id === id || (externalId && t.externalId === externalId)
              ? { ...t, status }
              : t
          );
          localStorage.setItem(getStorageKey(key), JSON.stringify(updated));
        }
      }
    } catch {
      // Ignore storage error
    }

    try {
      await fetch("/api/admin/transactions/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "status", id, externalId, status }),
      });
    } catch {
      // Ignore network error
    }
  }

  if (userId && isSupabaseConfigured) {
    try {
      await supabase
        .from("transactions")
        .update({ status })
        .eq("id", id)
        .eq("user_id", userId);
    } catch {
      // Ignore Supabase error
    }
  }
}

export async function deleteTransaction(
  id: string,
  userId?: string | null,
  externalId?: string | null
): Promise<void> {
  const storageUser = userId || "guest";
  addDeletedTxId(id, externalId);

  if (typeof window !== "undefined") {
    try {
      for (const key of [storageUser, "guest"]) {
        const current = getLocalTransactions(key);
        if (current.length > 0) {
          const updated = current.filter(
            (t) =>
              t.id !== id &&
              t.externalId !== id &&
              (!externalId || t.externalId !== externalId)
          );
          localStorage.setItem(getStorageKey(key), JSON.stringify(updated));
        }
      }
    } catch {
      // Ignore storage error
    }

    try {
      await fetch("/api/admin/transactions/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "delete", id, externalId }),
      });
    } catch {
      // Ignore network error
    }
  }

  if (userId && isSupabaseConfigured) {
    try {
      await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
    } catch {
      // Ignore Supabase error
    }
  }
}


