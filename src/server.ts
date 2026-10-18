import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  adminAddAffiliateCommission,
  adminUpdateAffiliateProfile,
  authenticateLocalUserAccount,
  createAffiliateWithdrawalRequest,
  createMedRecord,
  createPaymentLink,
  createWithdrawalRequest,
  decideAffiliateWithdrawalRequest,
  decideWithdrawalRequest,
  deleteCustomNotification,
  deleteMedRecord,
  deletePaymentLink,
  fetchBspayBalance,
  fetchBspayMedInfractions,
  fetchBspayTransactions,
  getAffiliateSummaryForUser,
  getPaymentLinkBySlug,
  getReferrerInfoByCode,
  getUserNtfySettings,
  listAdminAffiliatesOverview,
  listAdminUsersWithNtfy,
  listCustomNotifications,
  listPaymentLinksForUser,
  listWithdrawalRequests,
  markCustomNotificationRead,
  processBspayReceive,
  processBspayTransfer,
  recordAdminTxDelete,
  recordAdminTxStatus,
  recordPaymentLinkPaid,
  registerAffiliateReferral,
  registerUserAccountServer,
  sendAdminCustomNotification,
  sendNtfyPush,
  syncRealUsersToAffiliateStore,
  updateMedRecordStatus,
  updatePaymentLink,
  updateUserNtfySettings,
  type BspayReceiveInput,
  type BspayTransactionsFilter,
  type BspayTransferInput,
  type CreatePaymentLinkInput,
  type MedStatus,
  type NotificationCategory,
  type PaymentLinkStatus,
} from "./integrations/bspay/server";
import {
  buildAdminSessionCookie,
  buildClearAdminSessionCookie,
  createAdminSessionToken,
  fetchAdminOverview,
  verifyAdminCredentials,
  verifyAdminRequest,
} from "./integrations/admin/server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    if (url.pathname === "/api/bspay/transfer" && request.method === "POST") {
      try {
        const body = (await request.json()) as BspayTransferInput;
        if (body.executeImmediately && verifyAdminRequest(request)) {
          const result = await processBspayTransfer(body);
          return new Response(JSON.stringify({ success: true, data: result }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        // Queue withdrawal for manual Admin approval before firing automatic BSPAY cashout
        const queued = createWithdrawalRequest(body);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              transactionId: queued.id,
              status: "pending_approval",
              queuedForApproval: true,
              raw: queued,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao processar solicitação de saque";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/bspay/receive" && request.method === "POST") {
      try {
        const body = (await request.json()) as BspayReceiveInput;
        const result = await processBspayReceive(body);
        return new Response(JSON.stringify({ success: true, data: result }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao gerar pagamento na BSPAY";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/bspay/balance" && request.method === "GET") {
      try {
        const data = await fetchBspayBalance();
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao consultar saldo BSPAY";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      url.pathname === "/api/bspay/transactions" &&
      (request.method === "GET" || request.method === "POST")
    ) {
      try {
        let filter: BspayTransactionsFilter = {};
        if (request.method === "POST") {
          filter = (await request.json().catch(() => ({}))) as BspayTransactionsFilter;
        } else {
          const txId = url.searchParams.get("transactionId") || undefined;
          const extId = url.searchParams.get("externalId") || undefined;
          const status = url.searchParams.get("status") || undefined;
          const userId = url.searchParams.get("userId") || undefined;
          const userCreatedAt = url.searchParams.get("userCreatedAt") || undefined;
          const rawScope = url.searchParams.get("scope");
          const scope =
            rawScope === "admin" && verifyAdminRequest(request)
              ? "admin"
              : "user";
          const page = url.searchParams.get("page")
            ? Number(url.searchParams.get("page"))
            : undefined;
          const pageSize = url.searchParams.get("pageSize")
            ? Number(url.searchParams.get("pageSize"))
            : undefined;
          filter = {
            transactionId: txId,
            externalId: extId,
            status,
            userId,
            userCreatedAt,
            scope,
            page,
            pageSize,
          };
        }
        const data = await fetchBspayTransactions(filter);
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao consultar transações na BSPAY";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }



    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          password?: string;
        };
        const isValid = verifyAdminCredentials(
          body.email ?? "",
          body.password ?? ""
        );
        if (!isValid) {
          return new Response(
            JSON.stringify({
              success: false,
              authenticated: false,
              error: { message: "Credenciais administrativas inválidas." },
            }),
            {
              status: 401,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        const token = createAdminSessionToken();
        return new Response(
          JSON.stringify({
            success: true,
            authenticated: true,
            token,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "set-cookie": buildAdminSessionCookie(token),
            },
          }
        );
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            authenticated: false,
            error: { message: "Falha ao autenticar administrador." },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/admin/session" && request.method === "GET") {
      const authenticated = verifyAdminRequest(request);
      return new Response(
        JSON.stringify({ success: true, authenticated }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    }

    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      return new Response(
        JSON.stringify({ success: true, authenticated: false }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "set-cookie": buildClearAdminSessionCookie(),
          },
        }
      );
    }

    if (url.pathname === "/api/admin/overview" && request.method === "GET") {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso restrito ao administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const data = await fetchAdminOverview();
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar visão geral administrativa";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      url.pathname === "/api/admin/transactions/override" &&
      request.method === "POST"
    ) {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso restrito ao administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?: "delete" | "status";
          id?: string;
          externalId?: string | null;
          status?: string;
        };
        if (body.action === "delete" && body.id) {
          recordAdminTxDelete(body.id, body.externalId);
        } else if (body.action === "status" && body.id && body.status) {
          recordAdminTxStatus(body.id, body.status, body.externalId);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Falha ao salvar alteração administrativa." },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/bspay/withdrawals" && request.method === "GET") {
      const userId = url.searchParams.get("userId") || undefined;
      const items = listWithdrawalRequests(userId);
      return new Response(
        JSON.stringify({ success: true, data: { items } }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    }

    if (url.pathname === "/api/bspay/withdrawals" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          decision?: "approve" | "force_approve" | "reject";
          note?: string;
        };
        if (!body.id || !body.decision) {
          throw new Error("ID da transação e decisão são obrigatórios.");
        }
        const result = await decideWithdrawalRequest(
          body.id,
          body.decision,
          body.note
        );
        return new Response(JSON.stringify({ success: true, data: result }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar decisão da transação";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      url.pathname === "/api/admin/withdrawals/decide" &&
      request.method === "POST"
    ) {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso restrito ao administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          decision?: "approve" | "force_approve" | "reject";
          note?: string;
        };
        if (!body.id || !body.decision) {
          throw new Error("ID do saque e decisão são obrigatórios.");
        }
        const result = await decideWithdrawalRequest(
          body.id,
          body.decision,
          body.note
        );
        return new Response(JSON.stringify({ success: true, data: result }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar decisão do saque";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/bspay/meds" && request.method === "GET") {
      try {
        const userId = url.searchParams.get("userId") || undefined;
        const userCreatedAt = url.searchParams.get("userCreatedAt") || undefined;
        const rawScope = url.searchParams.get("scope");
        const scope =
          (rawScope === "admin" || !userId) && verifyAdminRequest(request)
            ? "admin"
            : "user";
        const data = await fetchBspayMedInfractions({
          userId,
          userCreatedAt,
          scope,
        });
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao consultar infrações / MED na BSPAY";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/bspay/meds" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          defenseNotes?: string;
        };
        if (!body.id || !body.defenseNotes?.trim()) {
          throw new Error("ID da infração e justificativa de defesa são obrigatórios.");
        }
        const item = updateMedRecordStatus(
          body.id,
          "legal_analysis",
          body.defenseNotes.trim()
        );
        return new Response(JSON.stringify({ success: true, data: item }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao enviar defesa de infração";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/admin/meds" && request.method === "POST") {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso restrito ao administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?: "create" | "status" | "delete";
          id?: string;
          transactionId?: string;
          externalId?: string | null;
          endToEndId?: string | null;
          clientName?: string;
          clientEmail?: string | null;
          userId?: string | null;
          payerName?: string;
          payerDocument?: string;
          amount?: number;
          reason?: string;
          status?: MedStatus;
          defenseNotes?: string;
        };

        if (body.action === "create") {
          const item = createMedRecord({
            transactionId: body.transactionId,
            externalId: body.externalId,
            endToEndId: body.endToEndId,
            clientName: body.clientName || "mathvtr2",
            clientEmail: body.clientEmail,
            userId: body.userId,
            payerName: body.payerName,
            payerDocument: body.payerDocument,
            amount: Number(body.amount) || 0,
            reason: body.reason,
            status: body.status || "awaiting_defense",
          });
          return new Response(JSON.stringify({ success: true, data: item }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        if (body.action === "status" && body.id && body.status) {
          const item = updateMedRecordStatus(
            body.id,
            body.status,
            body.defenseNotes
          );
          return new Response(JSON.stringify({ success: true, data: item }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        if (body.action === "delete" && body.id) {
          deleteMedRecord(body.id);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        throw new Error("Ação inválida para controle de MED.");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao processar registro MED";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/payment-links" && request.method === "GET") {
      try {
        const slug = url.searchParams.get("slug");
        if (slug) {
          const item = getPaymentLinkBySlug(slug);
          if (!item) {
            return new Response(
              JSON.stringify({
                success: false,
                error: { message: "Link de pagamento não encontrado." },
              }),
              {
                status: 404,
                headers: { "content-type": "application/json; charset=utf-8" },
              }
            );
          }
          return new Response(
            JSON.stringify({ success: true, data: { item } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        const userId = url.searchParams.get("userId");
        const items = listPaymentLinksForUser(userId);
        return new Response(
          JSON.stringify({ success: true, data: { items } }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao consultar links de pagamento";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/payment-links" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as Partial<CreatePaymentLinkInput> & {
          action?: "create" | "update" | "toggle_status" | "delete" | "record_payment";
          id?: string;
          slug?: string;
          status?: PaymentLinkStatus;
          transactionId?: string;
          paidAmount?: number;
        };

        if (body.action === "create") {
          const item = createPaymentLink({
            userId: body.userId || "",
            title: body.title || "",
            description: body.description,
            amount: Number(body.amount) || 0,
            currency: body.currency,
            linkCatalogProduct: body.linkCatalogProduct,
            catalogProductId: body.catalogProductId,
            catalogProductName: body.catalogProductName,
            photoUrl: body.photoUrl,
            isLimited: body.isLimited,
            maxPayments: body.maxPayments,
            enableBannertime: body.enableBannertime,
            bannertimeMinutes: body.bannertimeMinutes,
            hasExpiration: body.hasExpiration,
            expiresAt: body.expiresAt,
            passFeeToCustomer: body.passFeeToCustomer,
            redirectAfterPayment: body.redirectAfterPayment,
            redirectUrl: body.redirectUrl,
            paymentMethods: body.paymentMethods,
            bannerUrl: body.bannerUrl,
            faviconUrl: body.faviconUrl,
          });
          return new Response(
            JSON.stringify({ success: true, data: { item } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "update" && body.id && body.userId) {
          const item = updatePaymentLink(body.id, body.userId, body);
          return new Response(
            JSON.stringify({ success: true, data: { item } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "toggle_status" && body.id && body.userId && body.status) {
          const item = updatePaymentLink(body.id, body.userId, {
            status: body.status,
          });
          return new Response(
            JSON.stringify({ success: true, data: { item } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "delete" && body.id && body.userId) {
          deletePaymentLink(body.id, body.userId);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        if (body.action === "record_payment" && (body.slug || body.id)) {
          const item = recordPaymentLinkPaid(
            body.slug || body.id!,
            body.transactionId || "",
            Number(body.paidAmount) || 0
          );
          return new Response(
            JSON.stringify({ success: true, data: { item } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        throw new Error("Ação inválida para link de pagamento.");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar link de pagamento";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/ntfy/settings" && request.method === "GET") {
      try {
        const userId = url.searchParams.get("userId") || "guest";
        const settings = getUserNtfySettings(userId);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              userId: settings.userId,
              topic: settings.topic,
              notifyPixGenerated: settings.notifyPixGenerated,
              notifyPixPaid: settings.notifyPixPaid,
              updatedAt: settings.updatedAt,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar configuração de notificações";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/ntfy/settings" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          userId?: string;
          topic?: string;
          regenerateTopic?: boolean;
          notifyPixGenerated?: boolean;
          notifyPixPaid?: boolean;
        };
        const settings = updateUserNtfySettings(body.userId || "guest", {
          topic: body.topic,
          regenerateTopic: body.regenerateTopic,
          notifyPixGenerated: body.notifyPixGenerated,
          notifyPixPaid: body.notifyPixPaid,
        });
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              userId: settings.userId,
              topic: settings.topic,
              notifyPixGenerated: settings.notifyPixGenerated,
              notifyPixPaid: settings.notifyPixPaid,
              updatedAt: settings.updatedAt,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao salvar configuração de notificações";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/ntfy/test" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          userId?: string;
          topic?: string;
        };
        const settings = getUserNtfySettings(body.userId || "guest");
        const targetTopic = (body.topic || settings.topic || "").trim();
        const result = await sendNtfyPush({
          topic: targetTopic,
          title: "BokashiPay — Notificações Ativas!",
          message:
            "Teste concluído com sucesso! Você receberá alertas em tempo real de PIX gerado e PIX pago neste dispositivo.",
          tags: ["white_check_mark", "bell"],
          priority: 4,
        });

        if (!result.sent) {
          throw new Error(
            result.error || "Não foi possível enviar a notificação para ntfy.sh"
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: { sent: true, topic: result.topic },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao enviar notificação de teste";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/ntfy/inbox" && request.method === "GET") {
      try {
        const userId = url.searchParams.get("userId") || "guest";
        const items = listCustomNotifications({ userId, scope: "user" });
        return new Response(
          JSON.stringify({
            success: true,
            data: { items },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar notificações do usuário";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/ntfy/inbox" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?: "mark_read";
          id?: string;
          userId?: string;
        };
        if (body.id && body.userId) {
          markCustomNotificationRead(body.id, body.userId);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao atualizar notificação";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/admin/notifications" && request.method === "GET") {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso negado. Exclusivo para administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const users = await listAdminUsersWithNtfy();
        const notifications = listCustomNotifications({ scope: "admin" });
        return new Response(
          JSON.stringify({
            success: true,
            data: { users, notifications },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao consultar notificações no painel Admin";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/admin/notifications" && request.method === "POST") {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso negado. Exclusivo para administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?: "send" | "update_user_ntfy" | "delete";
          userId?: string;
          targetUserId?: string;
          targetUserName?: string;
          targetUserEmail?: string;
          customTopic?: string;
          title?: string;
          message?: string;
          category?: NotificationCategory;
          topic?: string;
          regenerateTopic?: boolean;
          notifyPixGenerated?: boolean;
          notifyPixPaid?: boolean;
          id?: string;
        };

        if (body.action === "send") {
          const item = await sendAdminCustomNotification({
            targetUserId: body.targetUserId || "ALL",
            targetUserName: body.targetUserName,
            targetUserEmail: body.targetUserEmail,
            customTopic: body.customTopic,
            title: body.title || "",
            message: body.message || "",
            category: body.category || "info",
          });
          return new Response(
            JSON.stringify({ success: true, data: { item } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "update_user_ntfy" && body.userId) {
          const updated = updateUserNtfySettings(body.userId, {
            topic: body.topic,
            regenerateTopic: body.regenerateTopic,
            notifyPixGenerated: body.notifyPixGenerated,
            notifyPixPaid: body.notifyPixPaid,
          });
          return new Response(
            JSON.stringify({ success: true, data: { settings: updated } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "delete" && body.id) {
          deleteCustomNotification(body.id);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        throw new Error("Ação inválida em /api/admin/notifications.");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar ação de notificação administrativa";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/affiliates/me" && request.method === "GET") {
      try {
        await syncRealUsersToAffiliateStore();
        const userId = url.searchParams.get("userId") || "guest";
        const name = url.searchParams.get("name") || undefined;
        const email = url.searchParams.get("email") || undefined;
        const data = getAffiliateSummaryForUser(userId, name, email);
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar dados de afiliado";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      url.pathname === "/api/affiliates/referrer" &&
      request.method === "GET"
    ) {
      try {
        await syncRealUsersToAffiliateStore();
        const refCode = url.searchParams.get("ref") || "";
        const referrer = getReferrerInfoByCode(refCode);
        return new Response(
          JSON.stringify({ success: true, data: { referrer } }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao consultar indicador";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          name?: string;
          email?: string;
          password?: string;
          userId?: string;
          refCode?: string;
        };
        const result = await registerUserAccountServer({
          name: body.name || "",
          email: body.email || "",
          password: body.password,
          userId: body.userId,
          refCode: body.refCode,
        });
        return new Response(JSON.stringify({ success: true, data: result }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao registrar conta";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          password?: string;
        };
        const account = authenticateLocalUserAccount({
          email: body.email || "",
          password: body.password,
        });
        if (!account) {
          return new Response(
            JSON.stringify({
              success: false,
              error: { message: "Credenciais não encontradas." },
            }),
            {
              status: 401,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }
        return new Response(JSON.stringify({ success: true, data: account }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao autenticar conta";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      url.pathname === "/api/affiliates/register-referral" &&
      request.method === "POST"
    ) {
      try {
        await syncRealUsersToAffiliateStore();
        const body = (await request.json().catch(() => ({}))) as {
          refCode?: string;
          referredUserId?: string;
          referredName?: string;
          referredEmail?: string;
        };
        const referral = registerAffiliateReferral({
          refCode: body.refCode || "",
          referredUserId: body.referredUserId || "",
          referredName: body.referredName,
          referredEmail: body.referredEmail,
        });
        return new Response(
          JSON.stringify({ success: true, data: { referral } }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao registrar indicação";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      url.pathname === "/api/affiliates/withdrawals" &&
      request.method === "POST"
    ) {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          userId?: string;
          name?: string;
          email?: string;
          amount?: number;
          pixKeyType?: "phone" | "cpf_cnpj" | "email" | "random";
          pixKey?: string;
        };
        const item = createAffiliateWithdrawalRequest({
          userId: body.userId || "guest",
          name: body.name,
          email: body.email,
          amount: Number(body.amount) || 0,
          pixKeyType: body.pixKeyType || "cpf_cnpj",
          pixKey: body.pixKey || "",
        });
        return new Response(JSON.stringify({ success: true, data: { item } }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao solicitar saque de comissão";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/admin/affiliates" && request.method === "GET") {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso restrito ao administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const data = await listAdminAffiliatesOverview();
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar visão de afiliados";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/api/admin/affiliates" && request.method === "POST") {
      if (!verifyAdminRequest(request)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Acesso restrito ao administrador." },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      try {
        const body = (await request.json().catch(() => ({}))) as {
          action?:
            | "decide_withdrawal"
            | "add_commission"
            | "update_profile"
            | "register_referral";
          id?: string;
          decision?: "approve_bspay" | "approve_manual" | "reject";
          adminNote?: string;
          affiliateUserId?: string;
          referredUserId?: string;
          referredName?: string;
          referredEmail?: string;
          platformProfitAmount?: number;
          commissionAmount?: number;
          description?: string;
          userId?: string;
          name?: string;
          email?: string;
          refCode?: string;
          commissionPercent?: number;
        };

        if (body.action === "decide_withdrawal" && body.id && body.decision) {
          const result = await decideAffiliateWithdrawalRequest(
            body.id,
            body.decision,
            body.adminNote
          );
          return new Response(
            JSON.stringify({ success: true, data: result }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "add_commission" && body.affiliateUserId) {
          const entry = adminAddAffiliateCommission({
            affiliateUserId: body.affiliateUserId,
            referredName: body.referredName,
            platformProfitAmount: body.platformProfitAmount,
            commissionAmount: body.commissionAmount,
            description: body.description,
          });
          return new Response(
            JSON.stringify({ success: true, data: { entry } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (body.action === "update_profile" && body.userId) {
          const profile = adminUpdateAffiliateProfile({
            userId: body.userId,
            name: body.name,
            email: body.email,
            refCode: body.refCode,
            commissionPercent: body.commissionPercent,
          });
          return new Response(
            JSON.stringify({ success: true, data: { profile } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        if (
          body.action === "register_referral" &&
          body.refCode &&
          body.referredUserId
        ) {
          const referral = registerAffiliateReferral({
            refCode: body.refCode,
            referredUserId: body.referredUserId,
            referredName: body.referredName,
            referredEmail: body.referredEmail,
          });
          return new Response(
            JSON.stringify({ success: true, data: { referral } }),
            {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            }
          );
        }

        throw new Error("Ação inválida em /api/admin/affiliates.");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar ação administrativa de afiliados";
        return new Response(
          JSON.stringify({ success: false, error: { message } }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (
      (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) &&
      request.method === "GET" &&
      (request.headers.get("accept") || "").includes("text/html")
    ) {
      if (!verifyAdminRequest(request)) {
        const loginUrl = new URL("/auth?redirect=/admin", url.origin);
        return Response.redirect(loginUrl.toString(), 302);
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
