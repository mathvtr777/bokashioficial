import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  Gift,
  Link2,
  MessageCircle,
  Percent,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/data/mock";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type {
  AffiliateCommissionEntry,
  AffiliateProfile,
  AffiliateReferral,
  AffiliateWithdrawalRequest,
} from "@/integrations/bspay/server";

export interface AffiliateUserSummaryResponse {
  profile: AffiliateProfile;
  stats: {
    activeReferrals: number;
    totalReferrals: number;
    totalEarned: number;
    availableBalance: number;
    pendingWithdrawals: number;
    approvedWithdrawals: number;
    receivedToday: number;
    commissionPercent: number;
    avgTicket: number;
  };
  referrals: AffiliateReferral[];
  commissions: AffiliateCommissionEntry[];
  withdrawals: AffiliateWithdrawalRequest[];
}

export async function fetchMyAffiliateData(
  userId?: string | null,
  name?: string | null,
  email?: string | null
): Promise<AffiliateUserSummaryResponse | null> {
  const query = new URLSearchParams({
    userId: userId || "guest",
  });
  if (name) query.set("name", name);
  if (email) query.set("email", email);

  const res = await fetch(`/api/affiliates/me?${query.toString()}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: AffiliateUserSummaryResponse;
  };
  if (!res.ok || !json.success || !json.data) return null;
  return json.data;
}

type MessagePresetKey = "direto" | "vendedores" | "curto";

export function IndiqueEGanheView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const userName =
    (user?.user_metadata?.["full_name"] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Afiliado BokashiPay";

  const { data, isLoading } = useQuery({
    queryKey: ["affiliate_me", user?.id],
    queryFn: () => fetchMyAffiliateData(user?.id, userName, user?.email),
    refetchInterval: 5000,
  });

  const refCode = data?.profile.refCode || "DA598EC0";
  const commissionPercent = data?.stats.commissionPercent ?? 25;
  const activeReferrals = data?.stats.activeReferrals ?? 0;
  const totalEarned = data?.stats.totalEarned ?? 0;
  const availableBalance = data?.stats.availableBalance ?? 0;
  const pendingWithdrawals = data?.stats.pendingWithdrawals ?? 0;

  const referralLink = `https://bokashipay.com/cadastro?ref=${refCode}`;

  const [preset, setPreset] = useState<MessagePresetKey>("direto");
  const [customMessage, setCustomMessage] = useState("");

  // Withdrawal modal state
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<
    "cpf_cnpj" | "email" | "phone" | "random"
  >("cpf_cnpj");
  const [pixKey, setPixKey] = useState("");
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);

  const presetTemplates: Record<MessagePresetKey, string> = useMemo(
    () => ({
      direto: `🍊 Tô usando a BokashiPay para receber meus PIX e posso escolher a nominal com que quero vender.\nCrie sua conta pelo meu link:\n\n${referralLink}`,
      vendedores: `🚀 Quer receber pagamentos PIX com liquidação imediata, links de pagamento e sem bloqueios injustos? Comece a vender pela BokashiPay usando meu link:\n\n${referralLink}`,
      curto: `⚡ Crie sua conta na BokashiPay e receba seus PIX na hora:\n\n${referralLink}`,
    }),
    [referralLink]
  );

  useEffect(() => {
    setCustomMessage(presetTemplates[preset]);
  }, [preset, presetTemplates]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Link de indicação copiado!");
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(customMessage);
    toast.success("Mensagem copiada para a área de transferência!");
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(customMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareTelegram = () => {
    const textOnly = customMessage.replace(referralLink, "").trim();
    const url = `https://t.me/share/url?url=${encodeURIComponent(
      referralLink
    )}&text=${encodeURIComponent(textOnly)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      customMessage
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareMore = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "BokashiPay — Indique e Ganhe",
          text: customMessage,
          url: referralLink,
        });
        return;
      } catch {
        // user cancelled or share failed
      }
    }
    handleCopyMessage();
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(withdrawAmount.replace(",", "."));
    if (!numeric || numeric <= 0) {
      toast.error("Informe um valor válido para saque.");
      return;
    }
    if (numeric > availableBalance) {
      toast.error("O valor solicitado excede seu saldo disponível de comissões.");
      return;
    }
    if (!pixKey.trim()) {
      toast.error("Informe sua chave PIX para recebimento.");
      return;
    }

    try {
      setRequestingWithdrawal(true);
      const res = await fetch("/api/affiliates/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id || "guest",
          name: userName,
          email: user?.email,
          amount: numeric,
          pixKeyType,
          pixKey: pixKey.trim(),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Erro ao solicitar saque");
      }
      toast.success("Saque de comissão solicitado com sucesso!", {
        description:
          "Sua solicitação foi enviada para aprovação na aba de Afiliados do Admin.",
      });
      setWithdrawAmount("");
      setPixKey("");
      setWithdrawModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["affiliate_me"] });
      queryClient.invalidateQueries({ queryKey: ["admin_affiliates"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao solicitar saque"
      );
    } finally {
      setRequestingWithdrawal(false);
    }
  };

  const withdrawals = data?.withdrawals ?? [];
  const referrals = data?.referrals ?? [];
  const commissions = data?.commissions ?? [];

  return (
    <div className="space-y-6">
      {/* Top 3 KPI Cards matching the screenshot layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Indicados ativos */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Indicados ativos</span>
          </div>
          <p className="tabular mt-2.5 font-display text-3xl font-bold text-foreground">
            {isLoading ? "0" : activeReferrals}
          </p>
        </div>

        {/* Card 2: Total ganho (Highlighted card) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/45 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Gift className="h-3.5 w-3.5" />
              <span>Total ganho</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setWithdrawAmount(
                  availableBalance > 0 ? availableBalance.toFixed(2) : ""
                );
                setWithdrawModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
            >
              <Wallet className="h-3 w-3" />
              Sacar comissão
            </button>
          </div>
          <p className="tabular mt-2.5 font-display text-3xl font-bold text-primary group-data-[hidden=true]/main:blur-sm">
            {brl(totalEarned)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              Disponível:{" "}
              <strong className="text-foreground">{brl(availableBalance)}</strong>
            </span>
            {pendingWithdrawals > 0 && (
              <span className="text-warning">
                Em aprovação: <strong>{brl(pendingWithdrawals)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Comissão */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Comissão</span>
          </div>
          <p className="tabular mt-2.5 font-display text-3xl font-bold text-foreground">
            {commissionPercent}%
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            do lucro gerado pelo indicado para a plataforma, de forma vitalícia
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
        {/* Left Column: Link, Mensagens Prontas & Compartilhar (Exact match to screenshot) */}
        <div className="space-y-5">
          {/* 1. Seu link de indicação */}
          <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Link2 className="h-4 w-4 text-primary" />
                <span>Seu link de indicação</span>
              </div>
              <span className="rounded-md border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                {refCode}
              </span>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/80 p-2 pl-3.5">
              <span className="truncate font-mono text-xs text-foreground/90">
                {referralLink}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
          </div>

          {/* 2. Mensagens prontas */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Mensagens prontas</span>
            </div>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {(
                [
                  ["direto", "Direto"],
                  ["vendedores", "Para vendedores"],
                  ["curto", "Curto e grosso"],
                ] as const
              ).map(([key, label]) => {
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className={cn(
                      "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-2 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3.5">
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full resize-none rounded-xl border border-border bg-background/80 p-3.5 text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Edite à vontade. O link já vem incluído.
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
          </div>

          {/* 3. Compartilhar */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Share2 className="h-4 w-4 text-primary" />
              <span>Compartilhar</span>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/80 py-3.5 text-xs font-semibold text-foreground transition-colors hover:border-emerald-500/40 hover:bg-surface-2"
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleShareTelegram}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/80 py-3.5 text-xs font-semibold text-foreground transition-colors hover:border-sky-500/40 hover:bg-surface-2"
              >
                <Send className="h-4 w-4 text-sky-400" />
                <span>Telegram</span>
              </button>

              <button
                type="button"
                onClick={handleShareTwitter}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/80 py-3.5 text-xs font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-surface-2"
              >
                <span className="font-display text-sm font-bold leading-none">
                  𝕏
                </span>
                <span>X / Twitter</span>
              </button>

              <button
                type="button"
                onClick={handleShareMore}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 py-3.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                <Share2 className="h-4 w-4 text-primary" />
                <span>Mais opções</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Saques de Afiliado & Histórico de Indicações (Separado do Gateway) */}
        <div className="space-y-5">
          {/* Saques de Comissão */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Meus Saques de Comissão (Afiliado)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Carteira exclusiva de afiliados, separada das transações do gateway.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWithdrawAmount(
                    availableBalance > 0 ? availableBalance.toFixed(2) : ""
                  );
                  setWithdrawModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
              >
                <Wallet className="h-3.5 w-3.5" />
                Solicitar Saque
              </button>
            </div>

            {withdrawals.length === 0 ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-surface/50 py-8 text-center text-xs text-muted-foreground">
                Nenhum saque de comissão solicitado ainda.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface/60 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">ID</th>
                      <th className="px-3 py-2.5">Valor</th>
                      <th className="px-3 py-2.5">Chave PIX</th>
                      <th className="px-3 py-2.5">Data</th>
                      <th className="px-3 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-surface/40">
                        <td className="px-3 py-2.5 font-mono text-[11px] font-semibold">
                          {w.id}
                        </td>
                        <td className="tabular px-3 py-2.5 font-bold text-foreground">
                          {brl(w.amount)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">
                          {w.pixKey}
                        </td>
                        <td className="tabular px-3 py-2.5 text-muted-foreground">
                          {new Date(w.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {w.status === "APPROVED" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                              <Check className="h-3 w-3" /> Aprovado
                            </span>
                          ) : w.status === "REJECTED" ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
                              <XCircle className="h-3 w-3" /> Recusado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                              <Clock className="h-3 w-3" /> Em aprovação
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Indicados & Comissões Recebidas */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground">
              Últimas Comissões & Indicados ({referrals.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Ganhos vitalícios gerados pelos usuários cadastrados pelo seu link.
            </p>

            {commissions.length === 0 && referrals.length === 0 ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-surface/50 py-8 text-center text-xs text-muted-foreground">
                Compartilhe seu link acima para começar a receber comissões vitalícias!
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {commissions.slice(0, 8).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/60 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {c.referredName}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.description}
                      </p>
                    </div>
                    <span className="tabular shrink-0 font-display text-sm font-bold text-primary">
                      +{brl(c.commissionAmount)}
                    </span>
                  </div>
                ))}

                {referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 px-3.5 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium text-foreground">
                        {r.referredName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({r.referredEmail})
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Indicado em{" "}
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Solicitar Saque de Comissão */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Solicitar Saque de Comissão
            </DialogTitle>
            <DialogDescription>
              Saque exclusivo do seu saldo de afiliado ({brl(availableBalance)}{" "}
              disponível).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestWithdrawal} className="space-y-4 text-xs">
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex items-center justify-between">
              <span className="text-muted-foreground">
                Saldo disponível de comissão:
              </span>
              <span className="font-display text-base font-bold text-primary">
                {brl(availableBalance)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Valor do Saque (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={availableBalance > 0 ? availableBalance : undefined}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Ex: 50.00"
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">
                  Tipo de Chave PIX
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) =>
                    setPixKeyType(
                      e.target.value as "cpf_cnpj" | "email" | "phone" | "random"
                    )
                  }
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="cpf_cnpj">CPF / CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">
                  Chave PIX Destino
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Digite sua chave PIX..."
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWithdrawModalOpen(false)}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={requestingWithdrawal || availableBalance <= 0}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {requestingWithdrawal
                  ? "Enviando..."
                  : "Enviar para Aprovação"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// ADMIN AFFILIATES CONTROL PANEL (DEDICATED TAB IN /ADMIN)
// ============================================================================

export interface AdminAffiliatesOverviewResponse {
  widgets: {
    totalAffiliates: number;
    totalActiveReferrals: number;
    totalCommissionsGenerated: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsAmount: number;
    approvedWithdrawalsAmount: number;
  };
  affiliates: Array<{
    profile: AffiliateProfile;
    stats: {
      activeReferrals: number;
      totalReferrals: number;
      totalEarned: number;
      availableBalance: number;
      pendingWithdrawals: number;
      approvedWithdrawals: number;
      receivedToday: number;
      commissionPercent: number;
      avgTicket: number;
    };
    referralsCount: number;
    referrals?: AffiliateReferral[];
  }>;
  allAccounts?: AffiliateProfile[];
  referrals: AffiliateReferral[];
  commissions: AffiliateCommissionEntry[];
  withdrawals: AffiliateWithdrawalRequest[];
}

export function AdminAffiliatesControlPanel() {
  const queryClient = useQueryClient();
  const [withdrawalFilter, setWithdrawalFilter] = useState<
    "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  >("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Add commission modal state
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState("");
  const [referredName, setReferredName] = useState("");
  const [commissionValue, setCommissionValue] = useState("");
  const [commissionDesc, setCommissionDesc] = useState("");
  const [submittingCredit, setSubmittingCredit] = useState(false);

  // Edit affiliate profile modal state
  const [editingProfile, setEditingProfile] = useState<AffiliateProfile | null>(
    null
  );
  const [editPercent, setEditPercent] = useState("25");
  const [editRefCode, setEditRefCode] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Add referral modal state
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [refModalCode, setRefModalCode] = useState("");
  const [refModalUserName, setRefModalUserName] = useState("");
  const [refModalUserEmail, setRefModalUserEmail] = useState("");
  const [submittingReferral, setSubmittingReferral] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin_affiliates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/affiliates", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: AdminAffiliatesOverviewResponse;
      };
      return json.data ?? null;
    },
    refetchInterval: 4000,
  });

  const widgets = data?.widgets ?? {
    totalAffiliates: 0,
    totalActiveReferrals: 0,
    totalCommissionsGenerated: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsAmount: 0,
    approvedWithdrawalsAmount: 0,
  };

  const affiliates = data?.affiliates ?? [];
  const allAccounts = data?.allAccounts ?? affiliates.map((a) => a.profile);
  const withdrawals = data?.withdrawals ?? [];

  const filteredWithdrawals = useMemo(
    () =>
      withdrawals.filter((w) =>
        withdrawalFilter === "ALL" ? true : w.status === withdrawalFilter
      ),
    [withdrawals, withdrawalFilter]
  );

  const handleDecideAffiliateWithdrawal = async (
    w: AffiliateWithdrawalRequest,
    decision: "approve_bspay" | "approve_manual" | "reject"
  ) => {
    try {
      setProcessingId(w.id);
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "decide_withdrawal",
          id: w.id,
          decision,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          item: AffiliateWithdrawalRequest;
          bspayDispatched: boolean;
          bspayWarning?: string;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Erro ao decidir saque de afiliado");
      }

      if (decision === "reject") {
        toast.info(`Saque de afiliado (${w.affiliateName}) recusado`, {
          description: `O valor de ${brl(w.amount)} retornou para o saldo de comissões do afiliado.`,
        });
      } else if (json.data?.bspayDispatched) {
        toast.success(
          `Comissão de ${w.affiliateName} aprovada e enviada via PIX BSPAY!`,
          {
            description: `${brl(w.amount)} enviado para ${w.pixKey}`,
          }
        );
      } else {
        toast.success(`Saque de comissão de ${w.affiliateName} aprovado!`);
      }

      queryClient.invalidateQueries({ queryKey: ["admin_affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate_me"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar saque de afiliado"
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(commissionValue.replace(",", "."));
    if (!selectedAffiliateId || !numeric || numeric <= 0) {
      toast.error("Selecione o afiliado e informe um valor válido.");
      return;
    }

    try {
      setSubmittingCredit(true);
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "add_commission",
          affiliateUserId: selectedAffiliateId,
          referredName: referredName.trim() || "Indicado Ativo",
          commissionAmount: numeric,
          description:
            commissionDesc.trim() || "Comissão creditada pela administração",
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Erro ao creditar comissão");
      }
      toast.success(`Comissão de ${brl(numeric)} creditada com sucesso!`);
      setCommissionValue("");
      setReferredName("");
      setCommissionDesc("");
      setCreditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin_affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate_me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao creditar comissão");
    } finally {
      setSubmittingCredit(false);
    }
  };

  const handleSaveAffiliateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    try {
      setSavingProfile(true);
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update_profile",
          userId: editingProfile.userId,
          refCode: editRefCode.trim().toUpperCase(),
          commissionPercent: Number(editPercent),
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Erro ao atualizar afiliado");
      }
      toast.success("Configurações do afiliado atualizadas!");
      setEditingProfile(null);
      queryClient.invalidateQueries({ queryKey: ["admin_affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate_me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar afiliado");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRegisterManualReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refModalCode.trim() || !refModalUserName.trim()) {
      toast.error("Preencha o código do afiliado e o nome do indicado.");
      return;
    }
    try {
      setSubmittingReferral(true);
      const syntheticUserId = `IND-${Date.now().toString(36).toUpperCase()}`;
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "register_referral",
          refCode: refModalCode.trim().toUpperCase(),
          referredUserId: syntheticUserId,
          referredName: refModalUserName.trim(),
          referredEmail:
            refModalUserEmail.trim() ||
            `${refModalUserName.trim().toLowerCase().replace(/\s+/g, ".")}@cliente.com`,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Erro ao vincular indicado");
      }
      toast.success("Indicado vinculado ao afiliado com sucesso!");
      setRefModalUserName("");
      setRefModalUserEmail("");
      setReferralModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin_affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate_me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao vincular indicado");
    } finally {
      setSubmittingReferral(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Affiliate KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel stat-accent p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Indicados Ativos / Afiliados
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold">
            {widgets.totalActiveReferrals}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({widgets.totalAffiliates} afiliados)
            </span>
          </p>
        </div>

        <div className="panel stat-accent p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Total de Comissões Geradas
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <Gift className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-primary">
            {brl(widgets.totalCommissionsGenerated)}
          </p>
        </div>

        <div className="panel stat-accent p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Saques de Afiliados Pendentes
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-warning/20 text-warning">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-warning">
            {widgets.pendingWithdrawalsCount}{" "}
            <span className="text-sm font-semibold">
              ({brl(widgets.pendingWithdrawalsAmount)})
            </span>
          </p>
        </div>

        <div className="panel stat-accent p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Comissões Pagas (Aprovadas)
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {brl(widgets.approvedWithdrawalsAmount)}
          </p>
        </div>
      </div>

      {/* SECTION 1: FILA DE APROVAÇÃO DE SAQUES DE AFILIADOS (SEPARADO DO GATEWAY) */}
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                Aprovação de Saques de Afiliados (Indique e Ganhe)
              </h2>
              <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                Separado do Gateway
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aprove ou recuse solicitações de saque de comissões de afiliados sem misturar com as transações comerciais do gateway.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["ALL", "Todos"],
                ["PENDING_APPROVAL", "Pendentes"],
                ["APPROVED", "Aprovados"],
                ["REJECTED", "Recusados"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWithdrawalFilter(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  withdrawalFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-2"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
              />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID Saque</th>
                <th className="px-4 py-3">Afiliado / Código</th>
                <th className="px-4 py-3">Valor da Comissão</th>
                <th className="px-4 py-3">Chave PIX Destino</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações do Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredWithdrawals.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-muted-foreground"
                  >
                    Nenhuma solicitação de saque de afiliado encontrada neste filtro.
                  </td>
                </tr>
              ) : (
                filteredWithdrawals.map((w) => {
                  const isPending = w.status === "PENDING_APPROVAL";
                  return (
                    <tr key={w.id} className="hover:bg-surface/60">
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">
                        {w.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {w.affiliateName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{w.affiliateEmail}</span>
                          <span>•</span>
                          <span className="rounded bg-surface-2 px-1.5 py-0.2 font-mono text-[10px] text-primary">
                            Ref: {w.refCode}
                          </span>
                        </div>
                      </td>
                      <td className="tabular px-4 py-3 font-display text-sm font-bold text-primary">
                        {brl(w.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground mr-1.5">
                          {w.pixKeyType}
                        </span>
                        <span className="font-mono text-foreground">{w.pixKey}</span>
                      </td>
                      <td className="tabular px-4 py-3 text-muted-foreground">
                        {new Date(w.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {w.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Aprovado
                          </span>
                        ) : w.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400">
                            <XCircle className="h-3 w-3" /> Recusado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
                            <Clock className="h-3 w-3" /> Aguardando Aprovação
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() =>
                                handleDecideAffiliateWithdrawal(w, "approve_bspay")
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" /> Aprovar + PIX BSPAY
                            </button>
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() =>
                                handleDecideAffiliateWithdrawal(w, "approve_manual")
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary-soft px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:opacity-90 disabled:opacity-50"
                            >
                              Aprovar Manual
                            </button>
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() =>
                                handleDecideAffiliateWithdrawal(w, "reject")
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 px-2.5 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Recusar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {w.adminNote || "Processado"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: CONTROLE DE AFILIADOS, % DE COMISSÃO E SALDO */}
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Afiliados com Link Utilizado (Indique e Ganhe)
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Todas as contas BokashiPay já vêm com o sistema de afiliados ativo. Assim que um convidado se cadastra pelo link de um afiliado, o nome e e-mail do afiliado sobem automaticamente para cá.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (allAccounts[0]) {
                  setRefModalCode(allAccounts[0].refCode);
                }
                setReferralModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2"
            >
              <UserPlus className="h-3.5 w-3.5 text-primary" />
              Vincular Indicado
            </button>

            <button
              type="button"
              onClick={() => {
                if (allAccounts[0]) {
                  setSelectedAffiliateId(allAccounts[0].userId);
                }
                setCreditModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Creditar Comissão a Afiliado
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Afiliado (Nome & E-mail)</th>
                <th className="px-4 py-3">Código Ref</th>
                <th className="px-4 py-3">% Comissão</th>
                <th className="px-4 py-3">Indicados Cadastrados pelo Link</th>
                <th className="px-4 py-3">Total Ganho</th>
                <th className="px-4 py-3">Disponível p/ Saque</th>
                <th className="px-4 py-3 text-right">Controle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {affiliates.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-xs text-muted-foreground"
                  >
                    Nenhum link de afiliado foi utilizado ainda. Assim que alguém se cadastrar pelo link de convite de uma conta, o nome e e-mail do afiliado aparecerão automaticamente aqui.
                  </td>
                </tr>
              ) : (
                affiliates.map(({ profile, stats, referrals: affReferrals }) => (
                  <tr key={profile.userId} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">
                        {profile.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {profile.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {profile.refCode}
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 font-bold text-foreground">
                      {profile.commissionPercent}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="tabular font-semibold text-foreground">
                          {stats.activeReferrals} indicado(s) ativo(s)
                        </span>
                        {affReferrals && affReferrals.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {affReferrals.slice(0, 4).map((r) => (
                              <span
                                key={r.id}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                title={r.referredEmail}
                              >
                                <strong className="text-foreground">
                                  {r.referredName}
                                </strong>
                                <span>({r.referredEmail})</span>
                              </span>
                            ))}
                            {affReferrals.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{affReferrals.length - 4} mais
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="tabular px-4 py-3 font-bold text-primary">
                      {brl(stats.totalEarned)}
                    </td>
                    <td className="tabular px-4 py-3 font-semibold text-foreground">
                      {brl(stats.availableBalance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAffiliateId(profile.userId);
                            setCreditModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary hover:opacity-90"
                        >
                          <DollarSign className="h-3 w-3" /> Creditar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfile(profile);
                            setEditPercent(String(profile.commissionPercent));
                            setEditRefCode(profile.refCode);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-2"
                        >
                          <Edit3 className="h-3 w-3" /> Editar %
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Creditar Comissão */}
      <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Creditar Comissão a Afiliado
            </DialogTitle>
            <DialogDescription>
              Adicione saldo de comissão diretamente na carteira de afiliado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCommission} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Selecionar Afiliado
              </label>
              <select
                value={selectedAffiliateId}
                onChange={(e) => setSelectedAffiliateId(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                required
              >
                <option value="">Selecione...</option>
                {allAccounts.map((profile) => (
                  <option key={profile.userId} value={profile.userId}>
                    {profile.name} ({profile.refCode}) — {profile.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">
                  Valor da Comissão (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  placeholder="Ex: 25.00"
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">
                  Nome do Indicado (Origem)
                </label>
                <input
                  type="text"
                  value={referredName}
                  onChange={(e) => setReferredName(e.target.value)}
                  placeholder="Ex: Loja Alpha"
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Descrição
              </label>
              <input
                type="text"
                value={commissionDesc}
                onChange={(e) => setCommissionDesc(e.target.value)}
                placeholder="Ex: 25% sobre lucro gerado pelo indicado"
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreditModalOpen(false)}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingCredit}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submittingCredit ? "Creditando..." : "Confirmar Crédito"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar % e Código do Afiliado */}
      <Dialog
        open={Boolean(editingProfile)}
        onOpenChange={(o) => !o && setEditingProfile(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Configurar Afiliado: {editingProfile?.name}
            </DialogTitle>
            <DialogDescription>
              Altere a porcentagem vitalícia de comissão ou o código de indicação.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAffiliateProfile} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Porcentagem de Comissão Vitalícia (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={editPercent}
                onChange={(e) => setEditPercent(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Código de Indicação (Ref)
              </label>
              <input
                type="text"
                value={editRefCode}
                onChange={(e) => setEditRefCode(e.target.value.toUpperCase())}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {savingProfile ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Vincular Indicado */}
      <Dialog open={referralModalOpen} onOpenChange={setReferralModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Vincular Novo Indicado a um Afiliado
            </DialogTitle>
            <DialogDescription>
              Adicione manualmente um vendedor/indicado à carteira de um afiliado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterManualReferral} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Conta do Afiliado (Código Ref)
              </label>
              <select
                value={refModalCode}
                onChange={(e) => setRefModalCode(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                required
              >
                <option value="">Selecione a conta do afiliado...</option>
                {allAccounts.map((profile) => (
                  <option key={profile.userId} value={profile.refCode}>
                    {profile.name} ({profile.email}) — Código: {profile.refCode}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Nome do Indicado
              </label>
              <input
                type="text"
                value={refModalUserName}
                onChange={(e) => setRefModalUserName(e.target.value)}
                placeholder="Ex: Carlos Mendes"
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                E-mail do Indicado
              </label>
              <input
                type="email"
                value={refModalUserEmail}
                onChange={(e) => setRefModalUserEmail(e.target.value)}
                placeholder="carlos@empresa.com"
                className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReferralModalOpen(false)}
                className="rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingReferral}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submittingReferral ? "Vinculando..." : "Vincular Indicado"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

