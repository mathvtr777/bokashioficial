import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  RefreshCw,
  LogOut,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Activity,
  Server,
  Lock,
  Wallet,
  TrendingUp,
  Layers,
  Copy,
  Trash2,
  ExternalLink,
  QrCode,
  Send,
  UserCheck,
  XCircle,
  ShieldAlert,
  Plus,
  Scale,
  Check,
  X,
  Bell,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/bokashi/Logo";
import { brl } from "@/data/mock";
import {
  fetchAllAdminTransactions,
  updateTransactionStatus,
  deleteTransaction,
  type Tx,
} from "@/services/transactions";
import { fetchAdminMasterCurrencies } from "@/services/balances";
import { FlowChart } from "@/components/bokashi/FlowChart";
import { ReceiveDialog } from "@/components/bokashi/ReceiveDialog";
import { TransferDialog } from "@/components/bokashi/TransferDialog";
import { NewTransactionDialog } from "@/components/bokashi/NewTransactionDialog";
import { getMedStatusBadge } from "@/components/bokashi/MedAlertBanner";
import { AdminNotificationsControlPanel } from "@/components/bokashi/NtfyNotificationSettings";
import {
  AdminAffiliatesControlPanel,
  type AdminAffiliatesOverviewResponse,
} from "@/components/bokashi/AffiliateSystem";
import type {
  BspayMedRecord,
  BspayMedWidgets,
  MedStatus,
  WithdrawalRequest,
} from "@/integrations/bspay/server";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/admin/session", {
          method: "GET",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          authenticated?: boolean;
        };
        if (!res.ok || !data.authenticated) {
          throw redirect({
            to: "/auth",
            search: { redirect: "/admin" },
            replace: true,
          });
        }
      } catch (err) {
        if (err && typeof err === "object" && "to" in err) {
          throw err;
        }
        throw redirect({
          to: "/auth",
          search: { redirect: "/admin" },
          replace: true,
        });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Painel Administrativo — BokashiPay" },
      {
        name: "description",
        content: "Área restrita de administração da BokashiPay.",
      },
    ],
  }),
  component: AdminDashboardPage,
});

type AdminTab =
  | "overview"
  | "withdrawals"
  | "affiliates"
  | "meds"
  | "notifications"
  | "transactions"
  | "acquirer"
  | "security";

function AdminDashboardPage() {
  const { isAdmin, adminLoading, signOut, refreshAdminSession, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Withdrawal approval filters
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<
    "ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  >("ALL");
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<
    string | null
  >(null);

  // MED filters & new MED form state
  const [medSearch, setMedSearch] = useState("");
  const [medStatusFilter, setMedStatusFilter] = useState<"ALL" | MedStatus>("ALL");
  const [showNewMedForm, setShowNewMedForm] = useState(false);
  const [medClientName, setMedClientName] = useState("mathvtr2");
  const [medPayerName, setMedPayerName] = useState("");
  const [medTxId, setMedTxId] = useState("");
  const [medAmount, setMedAmount] = useState("");
  const [medReason, setMedReason] = useState(
    "Solicitação de reembolso via MED aberta pelo pagador no banco de origem."
  );
  const [medInitialStatus, setMedInitialStatus] =
    useState<MedStatus>("awaiting_defense");
  const [creatingMed, setCreatingMed] = useState(false);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [testingAcquirer, setTestingAcquirer] = useState(false);

  useEffect(() => {
    void refreshAdminSession().then((valid) => {
      if (!valid) {
        navigate({
          to: "/auth",
          search: { redirect: "/admin" },
          replace: true,
        });
      }
    });
  }, [navigate, refreshAdminSession]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate({
        to: "/auth",
        search: { redirect: "/admin" },
        replace: true,
      });
    }
  }, [adminLoading, isAdmin, navigate]);

  const {
    data: transactions = [],
    isFetching: txFetching,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ["admin_transactions"],
    queryFn: () => fetchAllAdminTransactions(),
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const {
    data: currencies = [],
    isFetching: currFetching,
    refetch: refetchCurrencies,
  } = useQuery({
    queryKey: ["admin_currencies"],
    queryFn: () => fetchAdminMasterCurrencies(),
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const {
    data: withdrawalsData = [],
    isFetching: withdrawalsFetching,
    refetch: refetchWithdrawals,
  } = useQuery({
    queryKey: ["admin_withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/bspay/withdrawals", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: WithdrawalRequest[] };
      };
      return json.data?.items ?? [];
    },
    enabled: isAdmin,
    refetchInterval: 4000,
  });

  const {
    data: medsData,
    isFetching: medsFetching,
    refetch: refetchMeds,
  } = useQuery({
    queryKey: ["admin_bspay_meds"],
    queryFn: async () => {
      const res = await fetch("/api/bspay/meds?scope=admin", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { widgets: BspayMedWidgets; items: BspayMedRecord[] };
      };
      return json.data;
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const {
    data: adminOverview,
    isFetching: overviewFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["admin_overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/overview", {
        credentials: "include",
      });
      if (res.status === 401) {
        navigate({
          to: "/auth",
          search: { redirect: "/admin" },
          replace: true,
        });
        throw new Error("Sessão administrativa expirada.");
      }
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          bspayOnline: boolean;
          balances: Array<{ currency: string; available: string; allocation?: string }>;
          syncedAt: string;
        };
      };
      return json.data;
    },
    enabled: isAdmin,
    refetchInterval: 8000,
  });

  const { data: affiliatesOverview, refetch: refetchAffiliates } = useQuery({
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
    enabled: isAdmin,
    refetchInterval: 4000,
  });

  const pendingAffiliateWithdrawalsCount =
    affiliatesOverview?.widgets?.pendingWithdrawalsCount ?? 0;

  const pendingWithdrawalsCount = useMemo(
    () =>
      withdrawalsData.filter((w) => w.status === "PENDING_APPROVAL").length,
    [withdrawalsData]
  );

  const medItems = medsData?.items ?? [];
  const medWidgets = medsData?.widgets ?? {
    total_meds: 0,
    awaiting_defense: 0,
    legal_analysis: 0,
    closed: 0,
    total_won: 0,
    total_returned: 0,
    total_pending: 0,
    pending_infractions: 0,
  };

  const metrics = useMemo(() => {
    const completed = transactions.filter((t) => t.status === "Concluído");
    const pending = transactions.filter((t) => t.status === "Pendente");
    const analysis = transactions.filter((t) => t.status === "Em análise");

    const entriesCompleted = completed
      .filter((t) => t.type === "Entrada" || t.value > 0)
      .reduce((acc, t) => acc + Math.abs(t.value), 0);

    const outflowsCompleted = completed
      .filter((t) => t.type === "Saída" || t.value < 0)
      .reduce((acc, t) => acc + Math.abs(t.value), 0);

    const pendingVolume = pending.reduce((acc, t) => acc + Math.abs(t.value), 0);
    const analysisVolume = analysis.reduce((acc, t) => acc + Math.abs(t.value), 0);
    const totalVolume = entriesCompleted + outflowsCompleted;

    const brlFromOverview = adminOverview?.balances?.find(
      (b) => b.currency === "BRL"
    );
    const availableBrl = brlFromOverview
      ? Number(brlFromOverview.available) || 0
      : Math.max(0, entriesCompleted - outflowsCompleted);

    const approvalRate =
      transactions.length > 0
        ? Math.round((completed.length / transactions.length) * 100)
        : 100;

    const avgTicket =
      completed.length > 0 ? totalVolume / completed.length : 0;

    return {
      availableBrl,
      entriesCompleted,
      outflowsCompleted,
      pendingVolume,
      analysisVolume,
      totalVolume,
      completedCount: completed.length,
      pendingCount: pending.length,
      analysisCount: analysis.length,
      totalCount: transactions.length,
      approvalRate,
      avgTicket,
    };
  }, [transactions, adminOverview]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = t.id.toLowerCase().includes(q);
        const matchName = t.name.toLowerCase().includes(q);
        const matchVal = String(t.value).includes(q);
        if (!matchId && !matchName && !matchVal) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, typeFilter, searchQuery]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawalsData.filter((w) => {
      if (
        withdrawalStatusFilter !== "ALL" &&
        w.status !== withdrawalStatusFilter
      ) {
        return false;
      }
      if (withdrawalSearch.trim()) {
        const q = withdrawalSearch.toLowerCase();
        const matchClient = w.clientName.toLowerCase().includes(q);
        const matchEmail = w.clientEmail.toLowerCase().includes(q);
        const matchKey = w.pixKey.toLowerCase().includes(q);
        const matchId = w.id.toLowerCase().includes(q);
        if (!matchClient && !matchEmail && !matchKey && !matchId) return false;
      }
      return true;
    });
  }, [withdrawalsData, withdrawalStatusFilter, withdrawalSearch]);

  const filteredMeds = useMemo(() => {
    return medItems.filter((m) => {
      if (medStatusFilter !== "ALL" && m.status !== medStatusFilter) {
        return false;
      }
      if (medSearch.trim()) {
        const q = medSearch.toLowerCase();
        const matchClient = m.clientName.toLowerCase().includes(q);
        const matchPayer = m.payerName.toLowerCase().includes(q);
        const matchTx = m.transactionId.toLowerCase().includes(q);
        const matchId = m.id.toLowerCase().includes(q);
        const matchE2E = (m.endToEndId || "").toLowerCase().includes(q);
        if (!matchClient && !matchPayer && !matchTx && !matchId && !matchE2E) {
          return false;
        }
      }
      return true;
    });
  }, [medItems, medStatusFilter, medSearch]);

  const invalidateAllFinancials = async () => {
    await Promise.all([
      refetchTx(),
      refetchCurrencies(),
      refetchOverview(),
      refetchWithdrawals(),
      refetchMeds(),
      refetchAffiliates(),
      queryClient.invalidateQueries({ queryKey: ["financial_stats"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["currencies"] }),
      queryClient.invalidateQueries({ queryKey: ["bspay_meds"] }),
      queryClient.invalidateQueries({ queryKey: ["admin_affiliates"] }),
      queryClient.invalidateQueries({ queryKey: ["affiliate_me"] }),
    ]);
  };

  const handleRefreshAll = async () => {
    await invalidateAllFinancials();
    toast.success("Dados sincronizados com a BSPAY e BokashiPay!");
  };

  const handleDecideWithdrawal = async (
    w: WithdrawalRequest,
    decision: "approve" | "reject"
  ) => {
    setProcessingWithdrawalId(w.id);
    try {
      const res = await fetch("/api/admin/withdrawals/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: w.id, decision }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          item: WithdrawalRequest;
          bspayDispatched: boolean;
          bspayWarning?: string;
        };
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Falha ao processar saque");
      }

      await updateTransactionStatus(
        w.id,
        decision === "approve" ? "Concluído" : "Cancelado",
        user?.id,
        w.externalId
      );

      await invalidateAllFinancials();

      if (decision === "approve") {
        if (json.data?.bspayDispatched) {
          toast.success(`Saque de ${w.clientName} aprovado e enviado via BSPAY!`, {
            description: `Valor: ${brl(w.amount)} • Chave PIX: ${w.pixKey}`,
          });
        } else {
          toast.success(`Saque de ${w.clientName} aprovado no painel!`, {
            description: json.data?.bspayWarning
              ? `Status atualizado para Concluído (${json.data.bspayWarning})`
              : `Valor: ${brl(w.amount)} liberado.`,
          });
        }
      } else {
        toast.info(`Saque de ${w.clientName} recusado`, {
          description: `O valor de ${brl(w.amount)} foi estornado para o saldo do cliente.`,
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao processar decisão de saque"
      );
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleCreateMed = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(medAmount.replace(",", "."));
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Informe um valor válido para o MED");
      return;
    }

    setCreatingMed(true);
    try {
      const res = await fetch("/api/admin/meds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "create",
          clientName: medClientName.trim() || "mathvtr2",
          payerName: medPayerName.trim() || "Pagador Contestante (Banco Origem)",
          transactionId: medTxId.trim() || undefined,
          amount: numericAmount,
          reason: medReason.trim(),
          status: medInitialStatus,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Erro ao registrar MED");
      }

      await invalidateAllFinancials();
      toast.success("MED registrado e sincronizado!", {
        description:
          "O alerta já está visível na Dashboard do cliente e o saldo foi atualizado.",
      });
      setShowNewMedForm(false);
      setMedPayerName("");
      setMedTxId("");
      setMedAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar MED");
    } finally {
      setCreatingMed(false);
    }
  };

  const handleOpenMedFromTx = async (tx: Tx) => {
    try {
      const res = await fetch("/api/admin/meds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "create",
          transactionId: tx.id,
          externalId: tx.externalId,
          clientName: "mathvtr2",
          payerName: tx.payerName || tx.name.replace(/^PIX recebido — /, ""),
          amount: Math.abs(tx.value),
          reason:
            "Contestação PIX (MED): Pagador solicitou reembolso diretamente no banco de origem.",
          status: "awaiting_defense",
        }),
      });
      if (res.ok) {
        await invalidateAllFinancials();
        toast.warning(`MED aberto para a transação ${tx.id}`, {
          description:
            "O cliente já recebeu o aviso na Dashboard e o valor entrou em bloqueio cautelar.",
        });
        setActiveTab("meds");
      }
    } catch {
      toast.error("Erro ao abrir MED para esta transação");
    }
  };

  const handleUpdateMedStatus = async (med: BspayMedRecord, status: MedStatus) => {
    try {
      const res = await fetch("/api/admin/meds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "status",
          id: med.id,
          status,
        }),
      });
      if (res.ok) {
        await invalidateAllFinancials();
        toast.success(`Status do MED ${med.id} atualizado!`);
      }
    } catch {
      toast.error("Não foi possível atualizar o status do MED");
    }
  };

  const handleDeleteMed = async (med: BspayMedRecord) => {
    try {
      await fetch("/api/admin/meds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "delete", id: med.id }),
      });
      await invalidateAllFinancials();
      toast.success(`Registro MED ${med.id} removido`);
    } catch {
      toast.error("Erro ao remover MED");
    }
  };

  const handleStatusChange = async (tx: Tx, newStatus: Tx["status"]) => {
    try {
      queryClient.setQueryData<Tx[]>(["admin_transactions"], (old) =>
        old
          ? old.map((item) =>
              item.id === tx.id ? { ...item, status: newStatus } : item
            )
          : []
      );
      await updateTransactionStatus(
        tx.id,
        newStatus,
        user?.id,
        tx.externalId
      );
      await invalidateAllFinancials();
      toast.success(`Transação ${tx.id} atualizada para "${newStatus}"`);
    } catch {
      toast.error("Não foi possível atualizar o status da transação");
    }
  };

  const handleDeleteTx = async (tx: Tx) => {
    try {
      queryClient.setQueryData<Tx[]>(["admin_transactions"], (old) =>
        old ? old.filter((item) => item.id !== tx.id) : []
      );
      await deleteTransaction(tx.id, user?.id, tx.externalId);
      await invalidateAllFinancials();
      toast.success(`Transação ${tx.id} apagada com sucesso`);
    } catch {
      toast.error("Erro ao remover transação");
    }
  };

  const handleTestAcquirer = async () => {
    setTestingAcquirer(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/admin/overview", { credentials: "include" });
      const latency = Math.round(performance.now() - start);
      const json = (await res.json()) as {
        success?: boolean;
        data?: { bspayOnline?: boolean };
      };
      if (res.ok && json.success && json.data?.bspayOnline) {
        toast.success("Conexão com a BSPAY operacional!", {
          description: `OAuth2, MED Infractions e Ledger respondendo em ${latency}ms.`,
        });
      } else {
        toast.warning("Adquirente respondeu parcialmente", {
          description: `Tempo de resposta: ${latency}ms.`,
        });
      }
    } catch {
      toast.error("Falha ao testar comunicação com a adquirente");
    } finally {
      setTestingAcquirer(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut();
    toast.info("Sessão administrativa encerrada");
    navigate({ to: "/auth", search: { redirect: "/admin" }, replace: true });
  };

  if (adminLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo variant="icon" size="lg" />
          <p className="text-xs font-medium text-muted-foreground">
            Verificando credenciais de administrador...
          </p>
        </div>
      </div>
    );
  }

  const isSyncing =
    txFetching ||
    currFetching ||
    overviewFetching ||
    withdrawalsFetching ||
    medsFetching;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex items-center gap-2.5">
              <Logo variant="horizontal" size="md" />
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Master
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-muted-foreground md:inline-flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  adminOverview?.bspayOnline !== false
                    ? "bg-primary animate-pulse"
                    : "bg-warning"
                }`}
              />
              BSPAY API v2 + MED Sincronizado
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setReceiveOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <QrCode className="h-3.5 w-3.5" /> Gerar PIX
            </button>
            <button
              onClick={() => setTransferOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-90"
            >
              <Send className="h-3.5 w-3.5" /> Enviar PIX
            </button>
            <button
              onClick={handleRefreshAll}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
              />
              Sincronizar
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Visão Cliente
            </Link>
            <button
              onClick={handleAdminLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair do Admin
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 sm:px-6">
          {(
            [
              {
                id: "overview",
                label: "Visão Geral & Liquidez",
                icon: Activity,
                badge: undefined,
              },
              {
                id: "withdrawals",
                label: "Aprovar Saques (Gateway)",
                icon: UserCheck,
                badge:
                  pendingWithdrawalsCount > 0
                    ? String(pendingWithdrawalsCount)
                    : undefined,
                badgeColor: "bg-warning text-black",
              },
              {
                id: "affiliates",
                label: "Afiliados (Indique e Ganhe)",
                icon: Gift,
                badge:
                  pendingAffiliateWithdrawalsCount > 0
                    ? String(pendingAffiliateWithdrawalsCount)
                    : undefined,
                badgeColor: "bg-emerald-400 text-black",
              },
              {
                id: "meds",
                label: "Controle de MED & Infrações",
                icon: ShieldAlert,
                badge:
                  medWidgets.total_meds > 0
                    ? String(medWidgets.total_meds)
                    : undefined,
                badgeColor: "bg-destructive text-destructive-foreground",
              },
              {
                id: "notifications",
                label: "Notificações & Avisos",
                icon: Bell,
                badge: undefined,
              },
              {
                id: "transactions",
                label: `Auditoria de Transações (${metrics.totalCount})`,
                icon: Layers,
                badge: undefined,
              },
              {
                id: "acquirer",
                label: "Adquirente BSPAY & API",
                icon: Server,
                badge: undefined,
              },
              {
                id: "security",
                label: "Segurança & Acesso",
                icon: Lock,
                badge: undefined,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Liquidez Disponível (BSPAY)
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {brl(metrics.availableBrl)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Saldo líquido sincronizado com a BSPAY
            </p>
          </div>

          <div
            onClick={() => setActiveTab("withdrawals")}
            className="panel cursor-pointer p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Saques Aguardando Aprovação
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-warning/15 text-warning">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-warning">
              {pendingWithdrawalsCount} pedido(s)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clique para aprovar ou recusar saques →
            </p>
          </div>

          <div
            onClick={() => setActiveTab("meds")}
            className="panel cursor-pointer p-5 transition-colors hover:border-destructive/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                MEDs / Contestações PIX
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/15 text-destructive">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-destructive">
              {medWidgets.total_meds} ({brl(medWidgets.total_pending)} retido)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {medWidgets.awaiting_defense} aguardando defesa ·{" "}
              {medWidgets.total_returned} devolvidos
            </p>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Volume Total Liquidado
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {brl(metrics.totalVolume)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Entradas: {brl(metrics.entriesCompleted)} · Saídas:{" "}
              {brl(metrics.outflowsCompleted)}
            </p>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <FlowChart />

              {/* Multi-currency Custody Panel */}
              <div className="panel flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Custódia Multimoedas</h3>
                      <p className="text-xs text-muted-foreground">
                        Saldos sincronizados com a adquirente
                      </p>
                    </div>
                    <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                      Tempo Real
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {currencies.map((c) => (
                      <div
                        key={c.code}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-surface p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-soft font-display text-xs font-bold text-primary">
                            {c.symbol}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.code}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold">{c.balance}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {c.share}% da carteira
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Saídas Liquidadas (Cash-Out):</span>
                  <span className="font-semibold text-foreground">
                    {brl(metrics.outflowsCompleted)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Recent Transactions Preview in Overview */}
            <div className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    Últimas Movimentações do Gateway
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Monitoramento em tempo real de QR Codes PIX, Saques e MEDs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <NewTransactionDialog />
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
                  >
                    Ver Auditoria Completa →
                  </button>
                </div>
              </div>

              <AdminTransactionsTable
                transactions={transactions.slice(0, 8)}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTx}
                onOpenMed={handleOpenMedFromTx}
              />
            </div>
          </div>
        )}

        {/* TAB 2: MANUAL WITHDRAWAL APPROVAL ("Aprovar Saques") */}
        {activeTab === "withdrawals" && (
          <div className="panel p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  Aprovação Manual de Saques (PIX Cash-Out)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Todos os saques solicitados pelos clientes ficam retidos aqui para sua aprovação manual antes de disparar o PIX automático na BSPAY.
                </p>
              </div>
              <button
                onClick={() => setTransferOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Saque / Transferência
              </button>
            </div>

            {/* Search by Client Name & Status Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={withdrawalSearch}
                  onChange={(e) => setWithdrawalSearch(e.target.value)}
                  placeholder="Pesquisar saque por nome do cliente, e-mail, chave PIX ou ID..."
                  className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: "Todos" },
                    { id: "PENDING_APPROVAL", label: "Pendentes de Aprovação" },
                    { id: "APPROVED", label: "Aprovados" },
                    { id: "REJECTED", label: "Recusados" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setWithdrawalStatusFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      withdrawalStatusFilter === f.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-surface py-12 text-center">
                <UserCheck className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-semibold">
                  Nenhuma solicitação de saque encontrada
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quando um cliente solicitar uma transferência/saque no menu Financeiro → Enviar, o pedido aparecerá aqui com o nome do cliente para você aprovar ou recusar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Cliente Solicitante</th>
                      <th className="px-4 py-3">ID / Data</th>
                      <th className="px-4 py-3">Chave PIX Destino</th>
                      <th className="px-4 py-3">Valor do Saque</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Decisão (Aprovar ou Não)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredWithdrawals.map((w) => {
                      const isPending = w.status === "PENDING_APPROVAL";
                      const isApproved = w.status === "APPROVED";
                      const isProcessing = processingWithdrawalId === w.id;

                      return (
                        <tr key={w.id} className="hover:bg-surface/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xs font-bold text-primary">
                                {w.clientName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {w.clientName}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {w.clientEmail}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            <div className="text-foreground">{w.id}</div>
                            <div className="text-muted-foreground">
                              {new Date(w.createdAt).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <span>{w.pixKey}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(w.pixKey);
                                  toast.success("Chave PIX copiada!");
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copiar chave PIX"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Tipo: {w.pixKeyType.toUpperCase()}
                              {w.description ? ` • ${w.description}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-display text-sm font-bold text-foreground">
                            {brl(w.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                isApproved
                                  ? "bg-primary/15 text-primary"
                                  : isPending
                                  ? "bg-warning/15 text-warning"
                                  : "bg-destructive/15 text-destructive"
                              }`}
                            >
                              {isApproved && <CheckCircle2 className="h-3 w-3" />}
                              {isPending && <Clock className="h-3 w-3" />}
                              {w.status === "REJECTED" && (
                                <XCircle className="h-3 w-3" />
                              )}
                              {isApproved
                                ? "Aprovado"
                                : isPending
                                ? "Aguardando Aprovação"
                                : "Recusado"}
                            </span>
                            {w.bspayNote && (
                              <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-muted-foreground">
                                {w.bspayNote}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              {w.status !== "APPROVED" && (
                                <button
                                  onClick={() =>
                                    handleDecideWithdrawal(w, "approve")
                                  }
                                  disabled={isProcessing}
                                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  {isProcessing ? "Aprovando..." : "Aprovar"}
                                </button>
                              )}
                              {w.status !== "REJECTED" && (
                                <button
                                  onClick={() =>
                                    handleDecideWithdrawal(w, "reject")
                                  }
                                  disabled={isProcessing}
                                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/25 disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Não Aprovar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MED & INFRACTIONS CONTROL ("Controle de MED & Infrações") */}
        {activeTab === "meds" && (
          <div className="space-y-5">
            {/* 8 BSPAY MED Widgets */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">Total de MEDs</span>
                <p className="mt-1 font-display text-2xl font-bold">
                  {medWidgets.total_meds}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Contestações registradas
                </span>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">
                  Aguardando Defesa
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-warning">
                  {medWidgets.awaiting_defense}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Bloqueio cautelar ativo
                </span>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">
                  Em Análise (BACEN)
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-amber-400">
                  {medWidgets.legal_analysis}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Avaliação de infração PIX
                </span>
              </div>
              <div className="panel p-4">
                <span className="text-xs text-muted-foreground">
                  Volume Retido em MED
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-destructive">
                  {brl(medWidgets.total_pending)}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {medWidgets.total_returned} devolvido(s) ·{" "}
                  {medWidgets.total_won} ganho(s)
                </span>
              </div>
            </div>

            <div className="panel p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Controle Central de MED (Mecanismo Especial de Devolução)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sincronizado com <code>/v2/account/infractions</code> da BSPAY. Quando um MED está ativo ou reembolsado, a Dashboard do cliente exibe o alerta imediatamente e o saldo é ajustado.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewMedForm(!showNewMedForm)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showNewMedForm
                    ? "Fechar Formulário"
                    : "Registrar MED em Conta"}
                </button>
              </div>

              {/* Form to register/simulate a MED on a user account */}
              {showNewMedForm && (
                <form
                  onSubmit={handleCreateMed}
                  className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-destructive">
                      Registrar / Notificar Novo MED (Contestação de Banco)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">
                        Cliente BokashiPay (Conta)
                      </label>
                      <input
                        type="text"
                        value={medClientName}
                        onChange={(e) => setMedClientName(e.target.value)}
                        placeholder="Ex: mathvtr2"
                        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold">
                        Nome do Pagador (Quem pediu reembolso)
                      </label>
                      <input
                        type="text"
                        value={medPayerName}
                        onChange={(e) => setMedPayerName(e.target.value)}
                        placeholder="Ex: MARIA VILANI SOUZA"
                        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold">
                        Valor Contestando (R$)
                      </label>
                      <input
                        type="text"
                        value={medAmount}
                        onChange={(e) => setMedAmount(e.target.value)}
                        placeholder="Ex: 50,00"
                        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold">
                        ID da Transação (Opcional)
                      </label>
                      <input
                        type="text"
                        value={medTxId}
                        onChange={(e) => setMedTxId(e.target.value)}
                        placeholder="Ex: 5bc19d18..."
                        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold">
                        Motivo do MED / Contestação Bancária
                      </label>
                      <input
                        type="text"
                        value={medReason}
                        onChange={(e) => setMedReason(e.target.value)}
                        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Status Inicial</label>
                      <select
                        value={medInitialStatus}
                        onChange={(e) =>
                          setMedInitialStatus(e.target.value as MedStatus)
                        }
                        className="w-full rounded-lg border border-input bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      >
                        <option value="awaiting_defense">
                          Bloqueio Cautelar (Aguardando Defesa)
                        </option>
                        <option value="legal_analysis">
                          Em Análise Jurídica / BACEN
                        </option>
                        <option value="returned">
                          Reembolsado ao Banco do Pagador
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewMedForm(false)}
                      className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creatingMed}
                      className="rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {creatingMed
                        ? "Registrando..."
                        : "Confirmar e Notificar Dashboard do Cliente"}
                    </button>
                  </div>
                </form>
              )}

              {/* Search and Filter MEDs */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    placeholder="Buscar MED por nome do cliente, pagador, ID da transação ou EndToEnd..."
                    className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: "ALL", label: "Todos" },
                      { id: "awaiting_defense", label: "Aguardando Defesa" },
                      { id: "legal_analysis", label: "Em Análise" },
                      { id: "returned", label: "Reembolsados" },
                      { id: "won", label: "Defesa Aceita" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setMedStatusFilter(st.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        medStatusFilter === st.id
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredMeds.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-surface py-12 text-center">
                  <Scale className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-semibold">
                    Nenhum MED ativo encontrado para este filtro
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você pode registrar um MED manualmente acima ou clicar em "Abrir MED" em qualquer transação na aba Auditoria de Transações.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Cliente (Usuário)</th>
                        <th className="px-4 py-3">Pagador / Banco</th>
                        <th className="px-4 py-3">ID MED / Transação</th>
                        <th className="px-4 py-3">Motivo</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Controle Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMeds.map((med) => {
                        const badge = getMedStatusBadge(med.status);
                        const BadgeIcon = badge.icon;
                        return (
                          <tr key={med.id} className="hover:bg-surface/60">
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {med.clientName}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">
                                {med.payerName}
                              </div>
                              {med.payerDocument && (
                                <div className="text-[11px] text-muted-foreground">
                                  Doc: {med.payerDocument}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px]">
                              <div className="text-foreground">{med.id}</div>
                              <div className="text-muted-foreground">
                                TX: {med.transactionId}
                              </div>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-muted-foreground">
                              {med.reason}
                            </td>
                            <td className="px-4 py-3 font-display font-bold text-destructive">
                              -{brl(med.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                              >
                                <BadgeIcon className="h-3 w-3" />
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                {med.status !== "returned" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateMedStatus(med, "returned")
                                    }
                                    className="rounded-md bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25"
                                    title="Confirmar devolução do valor ao banco do pagador"
                                  >
                                    Reembolsar (MED)
                                  </button>
                                )}
                                {med.status !== "legal_analysis" &&
                                  med.status !== "returned" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateMedStatus(
                                          med,
                                          "legal_analysis"
                                        )
                                      }
                                      className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                                    >
                                      Em Análise
                                    </button>
                                  )}
                                {med.status !== "won" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateMedStatus(med, "won")
                                    }
                                    className="rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25"
                                    title="Encerrar disputa a favor do cliente e liberar saldo"
                                  >
                                    Liberar Saldo
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteMed(med)}
                                  title="Remover registro MED"
                                  className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: FULL TRANSACTIONS AUDIT */}
        {activeTab === "transactions" && (
          <div className="panel p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  Auditoria e Controle de Transações
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gerencie todas as transações da BSPAY e registros do sistema, aprove pagamentos pendentes, abra MEDs ou apague registros
                </p>
              </div>
              <div className="flex items-center gap-2">
                <NewTransactionDialog />
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por ID, nome do cliente/pagador ou valor..."
                  className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(["ALL", "Concluído", "Pendente", "Em análise"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        statusFilter === st
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {st === "ALL" ? "Todos os Status" : st}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {(["ALL", "Entrada", "Saída"] as const).map((tp) => (
                  <button
                    key={tp}
                    onClick={() => setTypeFilter(tp)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      typeFilter === tp
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tp === "ALL" ? "Entrada & Saída" : tp}
                  </button>
                ))}
              </div>
            </div>

            <AdminTransactionsTable
              transactions={filteredTransactions}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTx}
              onOpenMed={handleOpenMedFromTx}
            />
          </div>
        )}

        {/* TAB 5: ACQUIRER BSPAY & API */}
        {activeTab === "acquirer" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">
                      Integração Adquirente BSPAY v2
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Status dos serviços PIX Cash-In, PIX Cash-Out, MED e Ledger
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                </span>
              </div>

              <div className="space-y-2.5 pt-2">
                {[
                  {
                    name: "Autenticação OAuth2 (/v2/oauth/token)",
                    desc: "Renovação automática de Bearer Token em cache no servidor",
                    status: "Operacional",
                  },
                  {
                    name: "PIX Cash-In QR Code (/v2/pix/qrcode)",
                    desc: "Geração dinâmica de QR Code Copia e Cola e polling automático",
                    status: "Operacional",
                  },
                  {
                    name: "Fila de Saques com Aprovação Manual (/v2/pix/payment)",
                    desc: "Retém solicitações dos clientes para aprovação do Admin antes do disparo na BSPAY",
                    status: "Ativo (Manual)",
                  },
                  {
                    name: "Monitoramento de MED & Infrações (/v2/account/infractions)",
                    desc: "Sincronização de contestações PIX e bloqueios cautelares com aviso na Dashboard",
                    status: "Operacional",
                  },
                ].map((srv) => (
                  <div
                    key={srv.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-3.5"
                  >
                    <div>
                      <p className="text-xs font-semibold">{srv.name}</p>
                      <p className="text-[11px] text-muted-foreground">{srv.desc}</p>
                    </div>
                    <span className="rounded-md bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {srv.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Última sincronização:{" "}
                  {adminOverview?.syncedAt
                    ? new Date(adminOverview.syncedAt).toLocaleTimeString("pt-BR")
                    : "Agora"}
                </span>
                <button
                  onClick={handleTestAcquirer}
                  disabled={testingAcquirer}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${testingAcquirer ? "animate-spin" : ""}`}
                  />
                  {testingAcquirer ? "Testando..." : "Testar Latência da Adquirente"}
                </button>
              </div>
            </div>

            <div className="panel p-6 space-y-4">
              <h3 className="text-base font-semibold">
                Operações Diretas de Tesouraria
              </h3>
              <p className="text-xs text-muted-foreground">
                Execute operações reais na conta master da BokashiPay diretamente pelo painel administrativo.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                <button
                  onClick={() => setReceiveOpen(true)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Gerar QR Code PIX</p>
                    <p className="text-xs text-muted-foreground">
                      Emitir cobrança imediata na conta BokashiPay via BSPAY
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setTransferOpen(true)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/50 hover:bg-surface-2"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Realizar Transferência PIX</p>
                    <p className="text-xs text-muted-foreground">
                      Enviar saldo para chave PIX externa ou carteira interna
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: AFFILIATES & REFERRALS (INDIQUE E GANHE — SEPARADO DO GATEWAY) */}
        {activeTab === "affiliates" && <AdminAffiliatesControlPanel />}

        {/* TAB: NOTIFICATIONS & NTFY CONTROL */}
        {activeTab === "notifications" && <AdminNotificationsControlPanel />}

        {/* TAB 6: SECURITY & ACCESS */}
        {activeTab === "security" && (
          <div className="panel p-6 space-y-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  Blindagem Criptográfica do Painel Admin
                </h3>
                <p className="text-xs text-muted-foreground">
                  Política de exposição zero para credenciais administrativas
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="font-semibold text-foreground">
                  1. Credenciais Ocultas via Hash Irreversível (PBKDF2-SHA256)
                </p>
                <p className="mt-1 text-muted-foreground">
                  O e-mail e a senha do administrador não estão salvos em texto puro em nenhum arquivo, pasta ou variável de ambiente. A validação ocorre exclusivamente no servidor utilizando derivação criptográfica PBKDF2 com 100.000 iterações e comparação em tempo constante (<code>timingSafeEqual</code>).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="font-semibold text-foreground">
                  2. Sessão Assinada com HMAC-SHA256 e Cookie HttpOnly
                </p>
                <p className="mt-1 text-muted-foreground">
                  O acesso à rota <code>/admin</code> é protegido tanto no servidor (redirecionamento imediato 302 para a aba de login e senha) quanto no cliente. Apenas o portador do token assinado pode visualizar dados administrativos.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleAdminLogout}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90"
              >
                <LogOut className="h-4 w-4" /> Revogar Sessão Atual e Sair
              </button>
            </div>
          </div>
        )}
      </main>

      <ReceiveDialog open={receiveOpen} onOpenChange={setReceiveOpen} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

function AdminTransactionsTable({
  transactions,
  onStatusChange,
  onDelete,
  onOpenMed,
}: {
  transactions: Tx[];
  onStatusChange: (tx: Tx, status: Tx["status"]) => void;
  onDelete: (tx: Tx) => void;
  onOpenMed?: (tx: Tx) => void;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-surface py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Nenhuma transação encontrada para os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Descrição / Cliente / Origem</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Ações Admin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((tx) => {
            const isEntry = tx.type === "Entrada" || tx.value >= 0;
            return (
              <tr
                key={tx.id}
                className="transition-colors hover:bg-surface/60"
              >
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>{tx.id}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tx.id);
                        toast.success("ID copiado!");
                      }}
                      title="Copiar ID"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {tx.name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      isEntry
                        ? "bg-primary-soft text-primary"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {isEntry ? (
                      <ArrowDownLeft className="h-3 w-3" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" />
                    )}
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tx.date}</td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    isEntry ? "text-primary" : "text-foreground"
                  }`}
                >
                  {isEntry ? "+" : "-"}
                  {brl(Math.abs(tx.value))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      tx.status === "Concluído"
                        ? "bg-primary/15 text-primary"
                        : tx.status === "Pendente"
                        ? "bg-warning/15 text-warning"
                        : tx.status === "Cancelado"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tx.status === "Concluído" && (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {tx.status === "Pendente" && <Clock className="h-3 w-3" />}
                    {tx.status === "Em análise" && (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {tx.status === "Cancelado" && (
                      <XCircle className="h-3 w-3" />
                    )}
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {tx.status !== "Concluído" && (
                      <button
                        onClick={() => onStatusChange(tx, "Concluído")}
                        className="rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25"
                      >
                        Aprovar
                      </button>
                    )}
                    {tx.status !== "Pendente" && (
                      <button
                        onClick={() => onStatusChange(tx, "Pendente")}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Pendente
                      </button>
                    )}
                    {isEntry && onOpenMed && (
                      <button
                        onClick={() => onOpenMed(tx)}
                        title="Registrar contestação MED para esta transação"
                        className="rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25"
                      >
                        Abrir MED
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(tx)}
                      title="Apagar transação"
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
