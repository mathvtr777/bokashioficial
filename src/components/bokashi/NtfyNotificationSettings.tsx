import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  Smartphone,
  Copy,
  Check,
  Send,
  RefreshCw,
  Bell,
  Search,
  Users,
  UserCheck,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  AdminUserNtfySummary,
  CustomUserNotification,
  NotificationCategory,
} from "@/integrations/bspay/server";

export interface NtfySettingsData {
  userId: string;
  topic: string;
  notifyPixGenerated: boolean;
  notifyPixPaid: boolean;
  updatedAt?: string;
}

const LOCAL_STORAGE_PREFIX = "bokashi_ntfy_settings_v1_";

function generateLocalTopic(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 12; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `bokashipay-${suffix}`;
}

export function NtfyNotificationSettings({
  overrideUserId,
  overrideUserLabel,
}: {
  overrideUserId?: string;
  overrideUserLabel?: string;
} = {}) {
  const { user } = useAuth();
  const userId = overrideUserId || user?.id || "guest";

  const [topic, setTopic] = useState<string>("");
  const [notifyPixGenerated, setNotifyPixGenerated] = useState<boolean>(true);
  const [notifyPixPaid, setNotifyPixPaid] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const { data: inboxItems = [], refetch: refetchInbox } = useQuery({
    queryKey: ["user_ntfy_inbox", userId],
    queryFn: async () => {
      const res = await fetch(
        `/api/ntfy/inbox?userId=${encodeURIComponent(userId)}`
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { items?: CustomUserNotification[] };
      };
      return json.data?.items ?? [];
    },
    refetchInterval: 6000,
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ntfy/settings?userId=${encodeURIComponent(userId)}`
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: NtfySettingsData;
      };
      if (res.ok && json.success && json.data) {
        setTopic(json.data.topic);
        setNotifyPixGenerated(json.data.notifyPixGenerated);
        setNotifyPixPaid(json.data.notifyPixPaid);
        try {
          localStorage.setItem(
            `${LOCAL_STORAGE_PREFIX}${userId}`,
            JSON.stringify(json.data)
          );
        } catch {
          // ignore storage quota errors
        }
        setLoading(false);
        return;
      }
    } catch {
      // fallback to localStorage if offline
    }

    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NtfySettingsData>;
        if (parsed.topic) {
          setTopic(parsed.topic);
          setNotifyPixGenerated(parsed.notifyPixGenerated ?? true);
          setNotifyPixPaid(parsed.notifyPixPaid ?? true);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    const fallbackTopic = generateLocalTopic();
    setTopic(fallbackTopic);
    setNotifyPixGenerated(true);
    setNotifyPixPaid(true);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const persistSettings = async (patch: {
    regenerateTopic?: boolean;
    notifyPixGenerated?: boolean;
    notifyPixPaid?: boolean;
  }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/ntfy/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          ...patch,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: NtfySettingsData;
      };
      if (res.ok && json.success && json.data) {
        setTopic(json.data.topic);
        setNotifyPixGenerated(json.data.notifyPixGenerated);
        setNotifyPixPaid(json.data.notifyPixPaid);
        try {
          localStorage.setItem(
            `${LOCAL_STORAGE_PREFIX}${userId}`,
            JSON.stringify(json.data)
          );
        } catch {
          // ignore
        }
        void queryClient.invalidateQueries({ queryKey: ["admin_notifications_data"] });
      } else if (patch.regenerateTopic) {
        const nextTopic = generateLocalTopic();
        setTopic(nextTopic);
      }
    } catch {
      if (patch.regenerateTopic) {
        const nextTopic = generateLocalTopic();
        setTopic(nextTopic);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopyTopic = async () => {
    if (!topic) return;
    try {
      await navigator.clipboard.writeText(topic);
      setCopied(true);
      toast.success("Topic copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o topic automaticamente.");
    }
  };

  const handleGenerateNewTopic = async () => {
    await persistSettings({ regenerateTopic: true });
    toast.success("Novo topic secreto gerado e salvo automaticamente!");
  };

  const handleTogglePixGenerated = async (checked: boolean) => {
    setNotifyPixGenerated(checked);
    await persistSettings({ notifyPixGenerated: checked });
  };

  const handleTogglePixPaid = async (checked: boolean) => {
    setNotifyPixPaid(checked);
    await persistSettings({ notifyPixPaid: checked });
  };

  const handleTestNotification = async () => {
    if (!topic) return;
    setTesting(true);
    try {
      const res = await fetch("/api/ntfy/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, topic }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };

      if (res.ok && json.success) {
        toast.success(
          `Notificação de teste enviada para o topic "${topic}"! Confira seu app ntfy.`
        );
        return;
      }

      // Fallback direto do navegador caso o servidor esteja em rede restrita
      const directRes = await fetch("https://ntfy.sh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          title: "BokashiPay — Notificações Ativas!",
          message:
            "Teste concluído com sucesso! Você receberá alertas em tempo real de PIX gerado e PIX pago neste dispositivo.",
          tags: ["white_check_mark", "bell"],
          priority: 4,
        }),
      });

      if (directRes.ok) {
        toast.success(
          `Notificação de teste enviada para "${topic}"! Confira seu celular.`
        );
      } else {
        throw new Error(
          json.error?.message || "Não foi possível enviar a notificação de teste."
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao disparar notificação de teste."
      );
    } finally {
      setTesting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/ntfy/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id, userId }),
      });
      await refetchInbox();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {overrideUserLabel && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs">
          <span className="font-medium text-foreground">
            Configurando topic ntfy para:{" "}
            <strong className="text-primary">{overrideUserLabel}</strong>
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            ID: {userId.slice(0, 12)}
          </span>
        </div>
      )}

      {/* Avisos enviados pela Administração BokashiPay para este usuário */}
      {!overrideUserId && inboxItems.length > 0 && (
        <div className="space-y-2.5 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Bell className="h-4 w-4 text-primary" />
              Comunicados & Notificações da BokashiPay ({inboxItems.length})
            </h3>
            {inboxItems.some((n) => !n.readByUserIds?.includes(userId)) && (
              <button
                type="button"
                onClick={() => handleMarkRead("ALL")}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {inboxItems.map((notif) => {
              const isRead = notif.readByUserIds?.includes(userId);
              const badgeStyles =
                notif.category === "urgent"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : notif.category === "warning"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : notif.category === "success"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-surface-2 text-foreground";
              return (
                <div
                  key={notif.id}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-xs transition-colors ${badgeStyles} ${
                    isRead ? "opacity-75" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">
                        {notif.title}
                      </span>
                      {!isRead && (
                        <span className="rounded-full bg-primary px-2 py-0.2 text-[10px] font-bold text-primary-foreground">
                          Nova
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(notif.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {notif.message}
                    </p>
                  </div>
                  {!isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(notif.id)}
                      className="shrink-0 rounded-md border border-border bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-background"
                    >
                      OK, lido
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Card 1: Como configurar (2 minutos) */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-muted-foreground">
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <h3 className="text-sm font-bold text-foreground">
              Como configurar (2 minutos)
            </h3>
            <ol className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground/90">1.</span> Instale
                o app <span className="font-semibold text-foreground">ntfy</span>{" "}
                no celular:{" "}
                <a
                  href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  Android (Play Store)
                </a>{" "}
                ·{" "}
                <a
                  href="https://apps.apple.com/us/app/ntfy/id1625396347"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  iOS (App Store)
                </a>
              </li>
              <li>
                <span className="font-medium text-foreground/90">2.</span> Copie o{" "}
                <span className="font-semibold text-foreground">
                  topic gerado automaticamente
                </span>{" "}
                abaixo (botão &quot;Copiar&quot;).
              </li>
              <li>
                <span className="font-medium text-foreground/90">3.</span> Abra o
                app ntfy, toque no botão{" "}
                <span className="font-semibold text-foreground">+</span> no canto
                superior direito e cole o topic.
              </li>
              <li>
                <span className="font-medium text-foreground/90">4.</span> Volte
                aqui e toque em{" "}
                <span className="font-semibold text-foreground">
                  Testar notificação
                </span>{" "}
                para confirmar. A configuração fica salva automaticamente.
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Card 2: Topic e Eventos */}
      <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
        <div>
          <label className="block text-xs font-bold text-foreground">
            Seu topic (gerado automaticamente)
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-[220px] flex-1 items-center rounded-lg border border-border bg-background/60 px-3.5 font-mono text-xs text-foreground select-all">
              {loading ? "Gerando topic..." : topic}
            </div>
            <button
              type="button"
              onClick={handleGenerateNewTopic}
              disabled={loading || saving}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2/80 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              Gerar novo
            </button>
            <button
              type="button"
              onClick={handleCopyTopic}
              disabled={loading || !topic}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2/80 disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Esse código é seu segredo — não compartilhe. Quem tiver acesso pode
            ver suas notificações.
          </p>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-bold text-foreground">
            Eventos para notificar
          </p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={notifyPixGenerated}
                onChange={(e) => handleTogglePixGenerated(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-primary accent-primary focus:ring-primary"
              />
              <span>PIX gerado (venda iniciada)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={notifyPixPaid}
                onChange={(e) => handleTogglePixPaid(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-background text-primary accent-primary focus:ring-primary"
              />
              <span>PIX pago (venda confirmada)</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleTestNotification}
            disabled={loading || testing || !topic}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2/80 disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {testing ? "Enviando..." : "Testar notificação"}
          </button>
          <span className="text-xs text-muted-foreground">
            {saving ? "Salvando..." : "✓ Salvo automaticamente"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function NtfyNotificationDialog({ trigger }: { trigger: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || "guest";

  const { data: inboxItems = [] } = useQuery({
    queryKey: ["user_ntfy_inbox", userId],
    queryFn: async () => {
      const res = await fetch(
        `/api/ntfy/inbox?userId=${encodeURIComponent(userId)}`
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { items?: CustomUserNotification[] };
      };
      return json.data?.items ?? [];
    },
    refetchInterval: 6000,
  });

  const unreadCount = inboxItems.filter(
    (n) => !n.readByUserIds?.includes(userId)
  ).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="relative inline-flex">
          {trigger}
          {unreadCount > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-border bg-background p-6 sm:rounded-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 font-display text-base font-bold">
            <Bell className="h-4 w-4 text-primary" />
            Notificações de Vendas no Celular (ntfy)
          </DialogTitle>
        </DialogHeader>
        <NtfyNotificationSettings />
      </DialogContent>
    </Dialog>
  );
}

// ==========================================================
// PAINEL ADMINISTRATIVO DE CONTROLE DE NOTIFICAÇÕES POR USUÁRIO
// ==========================================================
export function AdminNotificationsControlPanel() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("ALL");
  const [customTopicOverride, setCustomTopicOverride] = useState<string>("");
  const [notifCategory, setNotifCategory] =
    useState<NotificationCategory>("info");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [sending, setSending] = useState(false);

  // User whose ntfy card is currently inspected in the 2-minute config box
  const [inspectedUser, setInspectedUser] = useState<{
    id: string;
    label: string;
  }>({
    id: "admin-master",
    label: "Admin Master (Seu Celular)",
  });

  const {
    data: adminNotifData,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin_notifications_data"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications", {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          users: AdminUserNtfySummary[];
          notifications: CustomUserNotification[];
        };
      };
      return (
        json.data ?? {
          users: [],
          notifications: [],
        }
      );
    },
    refetchInterval: 5000,
  });

  const users = adminNotifData?.users ?? [];
  const sentNotifications = adminNotifData?.notifications ?? [];

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.topic.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const selectedUserObj = useMemo(
    () => users.find((u) => u.userId === selectedUserId) || null,
    [users, selectedUserId]
  );

  const handleSelectUserForComposer = (u: AdminUserNtfySummary) => {
    setSelectedUserId(u.userId);
    setCustomTopicOverride(u.topic);
    setInspectedUser({
      id: u.userId,
      label: `${u.name} (${u.email})`,
    });
    toast.info(`Destinatário selecionado: ${u.name}`);
  };

  const handleApplyTemplate = (template: {
    title: string;
    message: string;
    category: NotificationCategory;
  }) => {
    setNotifTitle(template.title);
    setNotifMessage(template.message);
    setNotifCategory(template.category);
  };

  const handleSendCustomNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error("Preencha o título e a mensagem da notificação.");
      return;
    }

    setSending(true);
    try {
      const targetName =
        selectedUserId === "ALL"
          ? "Todos os Usuários"
          : selectedUserObj
          ? `${selectedUserObj.name} (${selectedUserObj.email})`
          : selectedUserId;

      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "send",
          targetUserId: selectedUserId,
          targetUserName: targetName,
          targetUserEmail: selectedUserObj?.email,
          customTopic: customTopicOverride.trim() || undefined,
          title: notifTitle.trim(),
          message: notifMessage.trim(),
          category: notifCategory,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { item?: CustomUserNotification };
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || "Erro ao enviar notificação personalizada."
        );
      }

      // Se o servidor não conseguiu alcançar ntfy.sh diretamente e há um topic específico, dispara também do cliente como garantia
      const targetTopic =
        customTopicOverride.trim() || selectedUserObj?.topic || "";
      if (
        !json.data?.item?.ntfyDelivered &&
        selectedUserId !== "ALL" &&
        targetTopic
      ) {
        try {
          await fetch("https://ntfy.sh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: targetTopic,
              title: notifTitle.trim(),
              message: notifMessage.trim(),
              tags: ["bell", "bokashipay"],
              priority: notifCategory === "urgent" ? 5 : 4,
            }),
          });
        } catch {
          // ignore
        }
      }

      toast.success(`Notificação enviada para ${targetName}!`, {
        description:
          "Entregue no painel do cliente e disparada via push para o app ntfy.",
      });
      setNotifTitle("");
      setNotifMessage("");
      await refetch();
      void queryClient.invalidateQueries({ queryKey: ["user_ntfy_inbox"] });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar notificação."
      );
    } finally {
      setSending(false);
    }
  };

  const handleToggleUserEvent = async (
    u: AdminUserNtfySummary,
    field: "notifyPixGenerated" | "notifyPixPaid",
    value: boolean
  ) => {
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update_user_ntfy",
          userId: u.userId,
          [field]: value,
        }),
      });
      if (res.ok) {
        toast.success(`Preferência de ${u.name} atualizada!`);
        await refetch();
      }
    } catch {
      toast.error("Erro ao atualizar preferência do usuário.");
    }
  };

  const handleRegenerateUserTopic = async (u: AdminUserNtfySummary) => {
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update_user_ntfy",
          userId: u.userId,
          regenerateTopic: true,
        }),
      });
      if (res.ok) {
        toast.success(`Novo topic gerado para ${u.name}!`);
        await refetch();
      }
    } catch {
      toast.error("Erro ao regenerar topic do usuário.");
    }
  };

  const handleDeleteSentNotification = async (id: string) => {
    try {
      await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "delete", id }),
      });
      toast.success("Notificação removida do histórico e do painel do usuário.");
      await refetch();
    } catch {
      toast.error("Erro ao excluir notificação.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Grid: Left = Send Custom Notification to any user | Right = ntfy 2-Minute Setup & Topic Inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Coluna 1: Disparador de Notificação Personalizada para Qualquer Usuário */}
        <div className="panel space-y-5 p-6 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Disparar Notificação Personalizada para Usuário
                </h3>
                <p className="text-xs text-muted-foreground">
                  Envie qualquer mensagem ou alerta para um usuário específico ou
                  para todos (Push Celular ntfy + Painel BokashiPay)
                </p>
              </div>
            </div>
          </div>

          {/* Modelos rápidos */}
          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Modelos Rápidos
              (1 clique)
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleApplyTemplate({
                    title: "BokashiPay: Saque Aprovado e Enviado!",
                    message:
                      "Seu saque PIX foi aprovado manualmente pela administração e já foi transferido para sua chave PIX.",
                    category: "success",
                  })
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-2"
              >
                ✅ Saque Aprovado
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyTemplate({
                    title: "BokashiPay: Venda PIX Confirmada!",
                    message:
                      "Um novo pagamento PIX acabou de ser compensado e o saldo já está disponível na sua conta BokashiPay.",
                    category: "success",
                  })
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-2"
              >
                💰 Venda Confirmada
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyTemplate({
                    title: "Alerta de MED / Contestação Bancária",
                    message:
                      "Identificamos uma contestação MED em uma transação da sua conta. Acesse a aba Infrações no seu painel para enviar sua defesa.",
                    category: "urgent",
                  })
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-2"
              >
                🚨 Alerta de MED
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyTemplate({
                    title: "Comunicado Oficial BokashiPay",
                    message:
                      "Sua conta está verificada e operando com liquidez imediata 24/7 via BSPAY.",
                    category: "info",
                  })
                }
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-2"
              >
                📢 Comunicado Geral
              </button>
            </div>
          </div>

          <form onSubmit={handleSendCustomNotification} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Selecionar Usuário Destinatário
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedUserId(val);
                    const found = users.find((u) => u.userId === val);
                    if (found) {
                      setCustomTopicOverride(found.topic);
                      setInspectedUser({
                        id: found.userId,
                        label: `${found.name} (${found.email})`,
                      });
                    } else {
                      setCustomTopicOverride("");
                    }
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-surface px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="ALL">
                    📢 Todos os Usuários ({users.length} contas cadastradas)
                  </option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      👤 {u.name} — {u.email} ({u.topic})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-foreground">
                  Tipo / Prioridade do Alerta
                </label>
                <select
                  value={notifCategory}
                  onChange={(e) =>
                    setNotifCategory(e.target.value as NotificationCategory)
                  }
                  className="h-10 w-full rounded-lg border border-input bg-surface px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="info">ℹ️ Informativo (Padrão)</option>
                  <option value="success">✅ Sucesso / Confirmação</option>
                  <option value="warning">⚠️ Aviso Importante</option>
                  <option value="urgent">🚨 Urgente / Prioridade Máxima</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-foreground">
                Topic ntfy do Destinatário (opcional — preenchido automaticamente
                ao escolher o usuário)
              </label>
              <input
                type="text"
                value={customTopicOverride}
                onChange={(e) => setCustomTopicOverride(e.target.value)}
                placeholder={
                  selectedUserId === "ALL"
                    ? "Disparo em massa para todos os topics cadastrados"
                    : "Ex: bokashipay-kjfzaym1bxyb"
                }
                className="h-10 w-full rounded-lg border border-input bg-surface px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-foreground">
                Título da Notificação
              </label>
              <input
                type="text"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Ex: BokashiPay — Seu saque foi aprovado!"
                className="h-10 w-full rounded-lg border border-input bg-surface px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-foreground">
                Mensagem Personalizada
              </label>
              <textarea
                rows={3}
                required
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder="Digite a mensagem que aparecerá no celular (ntfy) e no painel deste usuário..."
                className="w-full rounded-lg border border-input bg-surface p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground">
                A notificação será enviada simultaneamente para o app{" "}
                <strong>ntfy</strong> e para o sino de notificações do cliente.
              </p>
              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {sending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending
                  ? "Enviando Notificação..."
                  : "Enviar Notificação Agora"}
              </button>
            </div>
          </form>
        </div>

        {/* Coluna 2: O card exato de Configuração ntfy (2 minutos) inspecionando o Admin ou o Usuário selecionado */}
        <div className="space-y-3 xl:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Configuração ntfy ativa ({inspectedUser.label})
            </span>
            {inspectedUser.id !== "admin-master" && (
              <button
                type="button"
                onClick={() =>
                  setInspectedUser({
                    id: "admin-master",
                    label: "Admin Master (Seu Celular)",
                  })
                }
                className="text-xs font-semibold text-primary hover:underline"
              >
                Voltar para o meu topic Admin
              </button>
            )}
          </div>
          <NtfyNotificationSettings
            overrideUserId={inspectedUser.id}
            overrideUserLabel={inspectedUser.label}
          />
        </div>
      </div>

      {/* Tabela de Controle de Notificações por Usuário */}
      <div className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Controle de Topics & Eventos por Usuário ({filteredUsers.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Visualize o código ntfy de cada cliente, ative/desative eventos
                automáticos ou clique em &quot;Enviar Notificação&quot; para um
                usuário específico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-surface px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuário, e-mail ou topic..."
                className="w-56 bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold hover:bg-surface-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cliente / Conta</th>
                <th className="px-4 py-3">Topic Secreto (ntfy.sh)</th>
                <th className="px-4 py-3">PIX Gerado</th>
                <th className="px-4 py-3">PIX Pago</th>
                <th className="px-4 py-3 text-right">Ações do Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Nenhum usuário encontrado para o filtro informado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.userId}
                    className="transition-colors hover:bg-surface/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {u.email} •{" "}
                        <span className="font-mono">
                          {u.userId.slice(0, 10)}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="rounded border border-border bg-background/70 px-2.5 py-1 font-mono text-xs text-foreground">
                          {u.topic}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(u.topic);
                            toast.success(`Topic de ${u.name} copiado!`);
                          }}
                          title="Copiar topic deste usuário"
                          className="rounded-md border border-border bg-surface-2 p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerateUserTopic(u)}
                          title="Gerar novo topic para este usuário"
                          className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface"
                        >
                          Gerar novo
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={u.notifyPixGenerated}
                          onChange={(e) =>
                            handleToggleUserEvent(
                              u,
                              "notifyPixGenerated",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {u.notifyPixGenerated ? "Ativo" : "Inativo"}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={u.notifyPixPaid}
                          onChange={(e) =>
                            handleToggleUserEvent(
                              u,
                              "notifyPixPaid",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {u.notifyPixPaid ? "Ativo" : "Inativo"}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setInspectedUser({
                              id: u.userId,
                              label: `${u.name} (${u.email})`,
                            })
                          }
                          className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface"
                        >
                          Gerenciar Topic
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectUserForComposer(u)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:opacity-90"
                        >
                          <Send className="h-3 w-3" /> Notificar Usuário
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

      {/* Histórico de Notificações Personalizadas Enviadas */}
      <div className="panel space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Histórico de Notificações Enviadas pelo Admin (
              {sentNotifications.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Todas as notificações personalizadas disparadas para usuários
              individuais ou em massa
            </p>
          </div>
        </div>

        {sentNotifications.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-surface py-10 text-center text-xs text-muted-foreground">
            Nenhuma notificação personalizada enviada ainda. Use o formulário
            acima para enviar um alerta para qualquer usuário.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3">Topic ntfy</th>
                  <th className="px-4 py-3">Título & Mensagem</th>
                  <th className="px-4 py-3">Status Push / Leitura</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sentNotifications.map((n) => (
                  <tr
                    key={n.id}
                    className="transition-colors hover:bg-surface/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                        {n.targetUserName}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {n.targetTopic || "—"}
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        {n.category === "urgent" && (
                          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                        )}
                        {n.category === "warning" && (
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        )}
                        {n.category === "success" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        )}
                        {n.category === "info" && (
                          <Info className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span>{n.title}</span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">{n.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            n.ntfyDelivered
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {n.ntfyDelivered
                            ? "✓ Push ntfy enviado"
                            : "Salvo no Painel"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {n.readByUserIds?.length > 0
                            ? `Lido por ${n.readByUserIds.length} usuário(s)`
                            : "Aguardando leitura no painel"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSentNotification(n.id)}
                        title="Remover notificação"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
