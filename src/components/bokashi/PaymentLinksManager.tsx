import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Link2,
  Plus,
  Filter,
  Search,
  ArrowUpDown,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Pencil,
  Power,
  X,
  ImagePlus,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { brl } from "@/data/mock";
import { cn } from "@/lib/utils";
import {
  createUserPaymentLink,
  updateUserPaymentLink,
  toggleUserPaymentLinkStatus,
  deleteUserPaymentLink,
  fetchUserPaymentLinks,
  calculateCustomerTotalWithPassedFee,
  type PaymentLinkMethod,
  type PaymentLinkRecord,
} from "@/services/payment-links";

function BrazilFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 shrink-0 rounded-full", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#009B3A" />
      <polygon points="12,4.2 20.8,12 12,19.8 3.2,12" fill="#FEDF00" />
      <circle cx="12" cy="12" r="4.3" fill="#002776" />
      <path
        d="M8.1 11.2c2.4-.9 5.3-.7 7.8.6"
        stroke="#FFFFFF"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ActiveLinksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H4V5Zm0 4h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Zm5 3a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Z" />
    </svg>
  );
}

function PaymentsDoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <circle cx="9.5" cy="14.5" r="5.5" />
      <path d="M14.5 4a5.5 5.5 0 0 1 3.53 9.72 7.5 7.5 0 0 0-7.75-7.75A5.48 5.48 0 0 1 14.5 4Z" />
    </svg>
  );
}

function TotalReceivedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-8-8ZM7.5 9A1.5 1.5 0 1 1 9 7.5 1.5 1.5 0 0 1 7.5 9Z" />
    </svg>
  );
}

function PixSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 shrink-0", className)}
      fill="currentColor"
    >
      <path d="M11.999 2.2 6.6 7.6a2.6 2.6 0 0 0 3.677 0l1.722-1.723 1.723 1.723a2.6 2.6 0 0 0 3.677 0L11.999 2.2Zm0 19.6 5.4-5.4a2.6 2.6 0 0 0-3.677 0l-1.723 1.723-1.722-1.723a2.6 2.6 0 0 0-3.677 0l5.399 5.4ZM2.2 12l5.4 5.4a2.6 2.6 0 0 0 0-3.677L5.877 12 7.6 10.277a2.6 2.6 0 0 0 0-3.677L2.2 12Zm19.6 0-5.4-5.4a2.6 2.6 0 0 0 0 3.677L18.123 12 16.4 13.723a2.6 2.6 0 0 0 0 3.677L21.8 12Z" />
    </svg>
  );
}

function CryptoSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 shrink-0", className)}
      fill="currentColor"
    >
      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1.35 14.87v1.38h-1.25v-1.35c-.34 0-.69-.01-1.05-.02v1.37H9.8v-1.38H8v-1.36h.95V8.47H8V7.11h1.8V5.75h1.25v1.34c.36-.01.71-.01 1.05-.01V5.75h1.25v1.36c1.68.16 2.75.87 2.75 2.24 0 .97-.52 1.61-1.36 1.91 1.07.27 1.71.97 1.71 2.15 0 1.56-1.21 2.31-3.1 2.46Zm-2.3-8.46v2.39h1.18c.95 0 1.52-.39 1.52-1.2 0-.79-.57-1.19-1.52-1.19Zm0 3.63v2.66h1.35c1.08 0 1.7-.43 1.7-1.33 0-.91-.62-1.33-1.7-1.33Z" />
    </svg>
  );
}

function EmptyFolderIllustration() {
  return (
    <svg
      viewBox="0 0 220 170"
      className="h-36 w-44 select-none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="folderBack" x1="40" y1="55" x2="155" y2="145" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="folderFront" x1="45" y1="75" x2="160" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="plusCircle" x1="130" y1="110" x2="178" y2="158" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
      </defs>

      {/* Dashed trail from folder */}
      <path
        d="M84 56 C 88 30, 128 24, 152 38"
        stroke="#d1fae5"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="5 6"
        opacity="0.85"
      />

      {/* Little fly / bee at the top right */}
      <g transform="translate(148, 12)">
        <ellipse cx="14" cy="8" rx="7" ry="4" transform="rotate(-28 14 8)" fill="#e2e8f0" opacity="0.9" />
        <ellipse cx="24" cy="14" rx="7" ry="4" transform="rotate(25 24 14)" fill="#cbd5e1" opacity="0.85" />
        <ellipse cx="18" cy="14" rx="6" ry="4.5" fill="#475569" />
        <circle cx="14" cy="13" r="1.2" fill="#f8fafc" />
      </g>

      {/* Floating circle */}
      <circle cx="145" cy="48" r="5" fill="#dcfce7" opacity="0.85" />

      {/* Sparkle left */}
      <path
        d="M44 62 V76 M37 69 H51"
        stroke="#f0fdf4"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M54 57 V65 M50 61 H58"
        stroke="#86efac"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Folder Back */}
      <path
        d="M48 64 C48 58.5 52.5 54 58 54 H92 L102 64 H142 C147.5 64 152 68.5 152 74 V138 C152 143.5 147.5 148 142 148 H58 C52.5 148 48 143.5 48 138 V64 Z"
        fill="url(#folderBack)"
      />

      {/* Inner card peeking out */}
      <rect
        x="58"
        y="68"
        width="82"
        height="55"
        rx="6"
        fill="#059669"
        opacity="0.45"
      />

      {/* Folder Front */}
      <path
        d="M48 86 C48 80.5 52.5 76 58 76 H112 L120 84 H152 C156.4 84 159.8 87.8 159 92.2 L151 140 C150.2 144.6 146.2 148 141.5 148 H58 C52.5 148 48 143.5 48 138 V86 Z"
        fill="url(#folderFront)"
      />

      {/* Sad face on folder */}
      <circle cx="96" cy="108" r="3" fill="#dcfce7" />
      <circle cx="118" cy="108" r="3" fill="#dcfce7" />
      <path
        d="M96 126 C100 118, 114 118, 118 126"
        stroke="#dcfce7"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Plus Badge */}
      <circle cx="152" cy="134" r="22" fill="url(#plusCircle)" />
      <path
        d="M152 124 V144 M142 134 H162"
        stroke="#f8fafc"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
        checked
          ? "border-primary/50 bg-primary"
          : "border-border bg-[#222625]"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full transition-transform",
          checked
            ? "translate-x-5 bg-primary-foreground"
            : "translate-x-1 bg-muted-foreground"
        )}
      />
    </button>
  );
}

type DrawerTab = "produto" | "pagamento" | "configuracoes" | "aparencia";

const CURRENCY_OPTIONS = [
  { code: "BRL", label: "BRL" },
  { code: "USDT", label: "USDT" },
  { code: "BTC", label: "BTC" },
  { code: "ETH", label: "ETH" },
  { code: "BNB", label: "BNB" },
];

export function PaymentLinksManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "active" | "inactive" | "expired"
  >("ALL");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortField, setSortField] = useState<
    "createdAt" | "amount" | "paymentsCount"
  >("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<PaymentLinkRecord | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<DrawerTab>("produto");
  const [submitting, setSubmitting] = useState(false);

  // Tab 1: Produto
  const [linkCatalogProduct, setLinkCatalogProduct] = useState(false);
  const [catalogProductName, setCatalogProductName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Pagamento
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [currency, setCurrency] = useState("BRL");
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  // Tab 3: Configurações do checkout
  const [isLimited, setIsLimited] = useState(false);
  const [maxPayments, setMaxPayments] = useState("10");
  const [enableBannertime, setEnableBannertime] = useState(false);
  const [bannertimeMinutes, setBannertimeMinutes] = useState("15");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [passFeeToCustomer, setPassFeeToCustomer] = useState(false);
  const [redirectAfterPayment, setRedirectAfterPayment] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentLinkMethod[]>([
    "pix",
    "crypto",
  ]);

  // Tab 4: Aparência
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const { data: links = [] } = useQuery({
    queryKey: ["payment_links", user?.id],
    queryFn: () => fetchUserPaymentLinks(user?.id),
    refetchInterval: 5000,
  });

  const kpis = useMemo(() => {
    const totalLinks = links.length;
    const activeLinks = links.filter((l) => l.status === "active").length;
    const totalPayments = links.reduce((acc, l) => acc + l.paymentsCount, 0);
    const totalReceived = links.reduce((acc, l) => acc + l.totalReceived, 0);
    return {
      totalLinks,
      activeLinks,
      totalPayments,
      totalReceived,
    };
  }, [links]);

  const filteredLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = links.filter((l) => {
      if (statusFilter === "active" && l.status !== "active") return false;
      if (statusFilter === "inactive" && l.status !== "inactive") return false;
      if (
        statusFilter === "expired" &&
        l.status !== "expired" &&
        l.status !== "completed"
      ) {
        return false;
      }
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q) ||
        (l.description || "").toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "amount") {
        cmp = a.amount - b.amount;
      } else if (sortField === "paymentsCount") {
        cmp = a.paymentsCount - b.paymentsCount;
      } else {
        cmp =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [links, searchQuery, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: "amount" | "paymentsCount") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const resetForm = () => {
    setEditingLink(null);
    setActiveTab("produto");
    setLinkCatalogProduct(false);
    setCatalogProductName("");
    setPhotoUrl(null);
    setTitle("");
    setDescription("");
    setAmountCents(0);
    setCurrency("BRL");
    setIsLimited(false);
    setMaxPayments("10");
    setEnableBannertime(false);
    setBannertimeMinutes("15");
    setHasExpiration(false);
    setExpiresAt("");
    setPassFeeToCustomer(false);
    setRedirectAfterPayment(false);
    setRedirectUrl("");
    setPaymentMethods(["pix", "crypto"]);
    setBannerUrl(null);
    setFaviconUrl(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const handleOpenEdit = (link: PaymentLinkRecord) => {
    setEditingLink(link);
    setActiveTab("pagamento");
    setLinkCatalogProduct(link.linkCatalogProduct);
    setCatalogProductName(link.catalogProductName || "");
    setPhotoUrl(link.photoUrl || null);
    setTitle(link.title);
    setDescription(link.description || "");
    setAmountCents(Math.round(link.amount * 100));
    setCurrency(link.currency || "BRL");
    setIsLimited(link.isLimited);
    setMaxPayments(String(link.maxPayments || 10));
    setEnableBannertime(link.enableBannertime);
    setBannertimeMinutes(String(link.bannertimeMinutes || 15));
    setHasExpiration(link.hasExpiration);
    setExpiresAt(link.expiresAt || "");
    setPassFeeToCustomer(link.passFeeToCustomer);
    setRedirectAfterPayment(link.redirectAfterPayment);
    setRedirectUrl(link.redirectUrl || "");
    setPaymentMethods(
      link.paymentMethods.length > 0 ? link.paymentMethods : ["pix", "crypto"]
    );
    setBannerUrl(link.bannerUrl || null);
    setFaviconUrl(link.faviconUrl || null);
    setDrawerOpen(true);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (dataUrl: string | null) => void,
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
        toast.success(`${label} carregado com sucesso!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setAmountCents(0);
      return;
    }
    const parsed = parseInt(digits.slice(0, 11), 10);
    setAmountCents(isNaN(parsed) ? 0 : parsed);
  };

  const formattedAmountInput = (amountCents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const toggleMethod = (method: PaymentLinkMethod) => {
    setPaymentMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length === 1) {
          toast.info("Selecione ao menos uma forma de pagamento.");
          return prev;
        }
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

  const handleSaveLink = async () => {
    if (!user?.id) {
      toast.error("Faça login na sua conta para criar um link de pagamento.");
      return;
    }

    const effectiveTitle =
      title.trim() ||
      (linkCatalogProduct && catalogProductName.trim()
        ? catalogProductName.trim()
        : "");

    if (!effectiveTitle) {
      setActiveTab("pagamento");
      toast.error("Preencha o Título do link na aba Pagamento.");
      return;
    }

    const numericAmount = amountCents / 100;
    if (numericAmount <= 0) {
      setActiveTab("pagamento");
      toast.error("Informe um valor maior que R$ 0,00 na aba Pagamento.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        userId: user.id,
        title: effectiveTitle,
        description: description.trim() || null,
        amount: numericAmount,
        currency,
        linkCatalogProduct,
        catalogProductName: linkCatalogProduct
          ? catalogProductName.trim() || effectiveTitle
          : null,
        photoUrl,
        isLimited,
        maxPayments: isLimited ? Math.max(1, Number(maxPayments) || 1) : null,
        enableBannertime,
        bannertimeMinutes: enableBannertime
          ? Math.max(1, Number(bannertimeMinutes) || 15)
          : null,
        hasExpiration,
        expiresAt: hasExpiration && expiresAt ? expiresAt : null,
        passFeeToCustomer,
        redirectAfterPayment,
        redirectUrl:
          redirectAfterPayment && redirectUrl.trim()
            ? redirectUrl.trim()
            : null,
        paymentMethods,
        bannerUrl,
        faviconUrl,
      };

      if (editingLink) {
        await updateUserPaymentLink(editingLink.id, user.id, payload);
        toast.success("Link de pagamento atualizado com sucesso!");
      } else {
        const created = await createUserPaymentLink(payload);
        const fullUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/pay/${created.slug}`
            : `/pay/${created.slug}`;
        try {
          await navigator.clipboard.writeText(fullUrl);
          toast.success("Link de pagamento criado e copiado!", {
            description: fullUrl,
          });
        } catch {
          toast.success("Link de pagamento criado com sucesso!");
        }
      }

      await queryClient.invalidateQueries({
        queryKey: ["payment_links", user.id],
      });
      setDrawerOpen(false);
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o link de pagamento."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async (link: PaymentLinkRecord) => {
    const fullUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/pay/${link.slug}`
        : `/pay/${link.slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(link.id);
      toast.success("Link copiado para a área de transferência!", {
        description: fullUrl,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleToggleStatus = async (link: PaymentLinkRecord) => {
    if (!user?.id) return;
    const nextStatus = link.status === "active" ? "inactive" : "active";
    try {
      await toggleUserPaymentLinkStatus(link.id, user.id, nextStatus);
      await queryClient.invalidateQueries({
        queryKey: ["payment_links", user.id],
      });
      toast.success(
        nextStatus === "active"
          ? `Link "${link.title}" ativado!`
          : `Link "${link.title}" pausado!`
      );
    } catch {
      toast.error("Erro ao alterar status do link.");
    }
  };

  const handleDelete = async (link: PaymentLinkRecord) => {
    if (!user?.id) return;
    try {
      await deleteUserPaymentLink(link.id, user.id);
      await queryClient.invalidateQueries({
        queryKey: ["payment_links", user.id],
      });
      toast.success(`Link "${link.title}" removido.`);
    } catch {
      toast.error("Erro ao excluir link de pagamento.");
    }
  };

  const numericAmount = amountCents / 100;
  const passedFeePreview = calculateCustomerTotalWithPassedFee(numericAmount);

  return (
    <div className="space-y-4">
      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel flex items-center gap-3.5 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total de links</p>
            <p className="mt-0.5 font-display text-lg font-bold text-foreground">
              {kpis.totalLinks}
            </p>
          </div>
        </div>

        <div className="panel flex items-center gap-3.5 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
            <ActiveLinksIcon />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Links ativos</p>
            <p className="mt-0.5 font-display text-lg font-bold text-foreground">
              {kpis.activeLinks}
            </p>
          </div>
        </div>

        <div className="panel flex items-center gap-3.5 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
            <PaymentsDoneIcon />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Pagamentos realizados
            </p>
            <p className="mt-0.5 font-display text-lg font-bold text-foreground">
              {kpis.totalPayments}
            </p>
          </div>
        </div>

        <div className="panel flex items-center gap-3.5 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
            <TotalReceivedIcon />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total recebido</p>
            <p className="mt-0.5 font-display text-lg font-bold text-foreground group-data-[hidden=true]/main:blur-sm">
              {brl(kpis.totalReceived)}
            </p>
          </div>
        </div>
      </div>

      {/* Main "Seus links" Panel */}
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary-soft text-primary">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Seus links</h2>
              <p className="text-xs text-muted-foreground">
                Crie, edite e compartilhe links.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar link de pagamento
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterMenuOpen((o) => !o)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span>
                  {statusFilter === "ALL"
                    ? "Filtros"
                    : statusFilter === "active"
                    ? "Ativos"
                    : statusFilter === "inactive"
                    ? "Inativos"
                    : "Expirados"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {filterMenuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-border bg-[#121514] p-1 shadow-xl">
                  {(
                    [
                      { key: "ALL", label: "Todos os links" },
                      { key: "active", label: "Apenas ativos" },
                      { key: "inactive", label: "Pausados / Inativos" },
                      { key: "expired", label: "Expirados / Concluídos" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(opt.key);
                        setFilterMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors",
                        statusFilter === opt.key
                          ? "bg-primary/15 font-semibold text-primary"
                          : "text-foreground hover:bg-surface-2"
                      )}
                    >
                      <span>{opt.label}</span>
                      {statusFilter === opt.key && (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table Header & Content */}
        <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-[#0d0f0e]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-xs">
              <thead>
                <tr className="border-b border-border/70 bg-[#131615] text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      Valor <ArrowUpDown className="h-3 w-3 opacity-70" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Link</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("paymentsCount")}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      Pagamentos <ArrowUpDown className="h-3 w-3 opacity-70" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>

              {filteredLinks.length > 0 ? (
                <tbody className="divide-y divide-border/60">
                  {filteredLinks.map((link) => {
                    const isCopied = copiedId === link.id;
                    return (
                      <tr
                        key={link.id}
                        className="transition-colors hover:bg-surface/60"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {link.photoUrl ? (
                              <img
                                src={link.photoUrl}
                                alt={link.title}
                                className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
                              />
                            ) : (
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                                <Link2 className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {link.title}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {link.description ||
                                  (link.linkCatalogProduct &&
                                  link.catalogProductName
                                    ? `Produto: ${link.catalogProductName}`
                                    : `Moeda: ${link.currency}`)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-display font-semibold text-foreground">
                          <div>
                            {link.currency === "BRL"
                              ? brl(link.amount)
                              : `${link.amount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })} ${link.currency}`}
                          </div>
                          {link.passFeeToCustomer && (
                            <span className="text-[10px] font-normal text-primary">
                              Taxa repassada ao cliente
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-[11px]">
                            <span className="max-w-[160px] truncate text-muted-foreground">
                              /pay/{link.slug}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(link)}
                              title="Copiar link de pagamento"
                              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-primary"
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <Link
                              to="/pay/$slug"
                              params={{ slug: link.slug }}
                              target="_blank"
                              title="Abrir checkout do link"
                              className="rounded p-0.5 text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                              link.status === "active" &&
                                "border-primary/30 bg-primary/15 text-primary",
                              link.status === "inactive" &&
                                "border-border bg-surface-2 text-muted-foreground",
                              (link.status === "expired" ||
                                link.status === "completed") &&
                                "border-warning/30 bg-warning/15 text-warning"
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {link.status === "active"
                              ? "Ativo"
                              : link.status === "inactive"
                              ? "Inativo"
                              : link.status === "completed"
                              ? "Limite atingido"
                              : "Expirado"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 tabular font-semibold text-foreground">
                          {link.paymentsCount}
                          {link.isLimited && link.maxPayments
                            ? ` / ${link.maxPayments}`
                            : ""}
                        </td>

                        <td className="px-4 py-3.5 tabular text-muted-foreground">
                          {new Date(link.createdAt).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(link)}
                              title="Copiar link"
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-primary"
                            >
                              {isCopied ? (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(link)}
                              title="Editar link"
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(link)}
                              title={
                                link.status === "active"
                                  ? "Desativar link"
                                  : "Ativar link"
                              }
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-primary"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(link)}
                              title="Excluir link"
                              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ) : null}
            </table>
          </div>

          {filteredLinks.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <EmptyFolderIllustration />
              <h3 className="mt-3 text-base font-bold text-foreground">
                Nenhum link de pagamento criado
              </h3>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Crie seu primeiro link de pagamento para começar a receber
                pagamentos de forma rápida e segura.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right-Side Drawer Modal: Criar / Editar link de pagamento */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="relative z-10 flex h-full w-full max-w-[540px] flex-col border-l border-border bg-[#0c0e0d] text-foreground shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary-soft text-primary">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editingLink
                      ? "Editar link de pagamento"
                      : "Criar link de pagamento"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Preencha os dados para criar um novo link de pagamento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 4 Horizontal Tabs */}
            <div className="flex items-center gap-6 border-b border-border px-6">
              {(
                [
                  { key: "produto", label: "Produto" },
                  { key: "pagamento", label: "Pagamento" },
                  {
                    key: "configuracoes",
                    label: "Configurações do checkout",
                  },
                  { key: "aparencia", label: "Aparência" },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "relative cursor-pointer py-3 text-xs font-semibold transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* TAB 1: PRODUTO */}
              {activeTab === "produto" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Vincular produto do catálogo
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Ligado: produto do catálogo. Desligado: link simples,
                        com foto opcional.
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={linkCatalogProduct}
                      onChange={setLinkCatalogProduct}
                    />
                  </div>

                  {linkCatalogProduct ? (
                    <div className="space-y-2 rounded-xl border border-border bg-[#121514] p-4">
                      <label className="block text-xs font-semibold text-foreground">
                        Nome do produto do catálogo
                      </label>
                      <input
                        type="text"
                        value={catalogProductName}
                        onChange={(e) => {
                          setCatalogProductName(e.target.value);
                          if (!title) setTitle(e.target.value);
                        }}
                        placeholder="Ex: Mentoria Bokashi VIP"
                        className="w-full rounded-lg border border-border bg-[#171a19] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        O produto será exibido automaticamente no topo do
                        checkout deste link.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Foto do link (opcional)
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Imagem principal do checkout quando não há produto do
                          catálogo vinculado.
                        </p>
                      </div>

                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleFileUpload(e, setPhotoUrl, "Foto do link")
                        }
                      />

                      {photoUrl ? (
                        <div className="relative flex h-44 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-primary/40 bg-[#121514]">
                          <img
                            src={photoUrl}
                            alt="Foto do link"
                            className="h-full w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoUrl(null)}
                            className="absolute right-3 top-3 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black"
                          >
                            Remover foto
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border/80 bg-[#121514] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          <ImagePlus className="h-6 w-6 opacity-80" />
                          <span className="text-xs font-medium">
                            Adicionar foto
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PAGAMENTO */}
              {activeTab === "pagamento" && (
                <div className="space-y-4">
                  <div className="space-y-4 rounded-xl border border-border bg-[#121514] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      IDENTIFICAÇÃO
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-foreground">
                        Título *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Pagamento de Serviço"
                        className="w-full rounded-lg border border-border bg-[#161918] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-foreground">
                        Descrição (opcional)
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descreva o propósito deste link de pagamento"
                        className="w-full resize-y rounded-lg border border-border bg-[#161918] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border bg-[#121514] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      VALOR
                    </p>

                    <div className="grid grid-cols-[1fr_115px] gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          Valor *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formattedAmountInput}
                          onChange={handleAmountChange}
                          placeholder="0,00"
                          className="w-full rounded-lg border border-border bg-[#161918] px-3 py-2.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div className="relative space-y-1.5">
                        <label className="block text-xs font-bold text-foreground">
                          Moeda *
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrencyDropdownOpen((prev) => !prev)
                          }
                          className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-[#161918] px-3 py-2.5 text-xs font-semibold text-foreground hover:border-primary/40"
                        >
                          <span className="flex items-center gap-2">
                            {currency === "BRL" ? (
                              <BrazilFlagIcon />
                            ) : (
                              <span className="grid h-4 w-4 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                {currency[0]}
                              </span>
                            )}
                            {currency}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>

                        {currencyDropdownOpen && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-full rounded-xl border border-border bg-[#161918] p-1 shadow-xl">
                            {CURRENCY_OPTIONS.map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setCurrency(c.code);
                                  setCurrencyDropdownOpen(false);
                                }}
                                className={cn(
                                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs",
                                  currency === c.code
                                    ? "bg-primary/15 font-semibold text-primary"
                                    : "text-foreground hover:bg-surface-2"
                                )}
                              >
                                {c.code === "BRL" ? (
                                  <BrazilFlagIcon />
                                ) : (
                                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                    {c.code[0]}
                                  </span>
                                )}
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CONFIGURAÇÕES DO CHECKOUT */}
              {activeTab === "configuracoes" && (
                <div className="space-y-3">
                  {/* 1. Link limitado */}
                  <div className="rounded-xl border border-border bg-[#121514] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Link limitado
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Limitar quantas vezes o link pode ser pago
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={isLimited}
                        onChange={setIsLimited}
                      />
                    </div>
                    {isLimited && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <label className="block text-[11px] font-semibold text-muted-foreground">
                          Quantidade máxima de pagamentos
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={maxPayments}
                          onChange={(e) => setMaxPayments(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-border bg-[#161918] px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* 2. Ativar Bannertime */}
                  <div className="rounded-xl border border-border bg-[#121514] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Ativar Bannertime
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Exibir contador no checkout
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={enableBannertime}
                        onChange={setEnableBannertime}
                      />
                    </div>
                    {enableBannertime && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <label className="block text-[11px] font-semibold text-muted-foreground">
                          Tempo do contador regressivo (em minutos)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={bannertimeMinutes}
                          onChange={(e) =>
                            setBannertimeMinutes(e.target.value)
                          }
                          className="mt-1.5 w-full rounded-lg border border-border bg-[#161918] px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. Data de expiração */}
                  <div className="rounded-xl border border-border bg-[#121514] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Data de expiração
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Definir uma data para o link expirar
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={hasExpiration}
                        onChange={setHasExpiration}
                      />
                    </div>
                    {hasExpiration && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <label className="block text-[11px] font-semibold text-muted-foreground">
                          Expira em
                        </label>
                        <input
                          type="datetime-local"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-border bg-[#161918] px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* 4. Repassar taxa */}
                  <div className="rounded-xl border border-border bg-[#121514] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Repassar taxa
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          O cliente paga a taxa; você recebe o valor integral,
                          sem desconto de taxas no seu recebimento.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={passFeeToCustomer}
                        onChange={setPassFeeToCustomer}
                      />
                    </div>
                    {passFeeToCustomer && numericAmount > 0 && (
                      <div className="mt-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] text-primary">
                        Cliente pagará{" "}
                        <strong>{brl(passedFeePreview.customerTotal)}</strong>{" "}
                        • Você receberá líquido{" "}
                        <strong>{brl(passedFeePreview.merchantNet)}</strong>
                      </div>
                    )}
                  </div>

                  {/* 5. Redirecionar após pagamento */}
                  <div className="rounded-xl border border-border bg-[#121514] px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          Redirecionar após pagamento
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Envia o cliente para uma URL personalizada (página de
                          obrigado)
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={redirectAfterPayment}
                        onChange={setRedirectAfterPayment}
                      />
                    </div>
                    {redirectAfterPayment && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <label className="block text-[11px] font-semibold text-muted-foreground">
                          URL de redirecionamento
                        </label>
                        <input
                          type="url"
                          value={redirectUrl}
                          onChange={(e) => setRedirectUrl(e.target.value)}
                          placeholder="https://seusite.com.br/obrigado"
                          className="mt-1.5 w-full rounded-lg border border-border bg-[#161918] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Formas de pagamento */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-foreground">
                      Formas de pagamento
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Selecione quais métodos o cliente poderá usar no checkout
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleMethod("pix")}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all",
                          paymentMethods.includes("pix")
                            ? "border-primary/40 bg-[#0d281a] text-foreground"
                            : "border-border bg-[#121514] text-muted-foreground opacity-60 hover:opacity-100"
                        )}
                      >
                        <PixSmallIcon className="text-primary" />
                        <span>PIX</span>
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            paymentMethods.includes("pix")
                              ? "bg-primary shadow-[0_0_8px_#22c55e]"
                              : "bg-muted-foreground/40"
                          )}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMethod("crypto")}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all",
                          paymentMethods.includes("crypto")
                            ? "border-primary/40 bg-[#0d281a] text-foreground"
                            : "border-border bg-[#121514] text-muted-foreground opacity-60 hover:opacity-100"
                        )}
                      >
                        <CryptoSmallIcon className="text-primary" />
                        <span>Cripto</span>
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            paymentMethods.includes("crypto")
                              ? "bg-primary shadow-[0_0_8px_#22c55e]"
                              : "bg-muted-foreground/40"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: APARÊNCIA */}
              {activeTab === "aparencia" && (
                <div className="space-y-4">
                  {/* Banner do Checkout */}
                  <div className="space-y-3 rounded-xl border border-border bg-[#121514] p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        BANNER DO CHECKOUT
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Imagem exibida na parte de cima da tela de pagamento
                      </p>
                    </div>

                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, setBannerUrl, "Banner do checkout")
                      }
                    />

                    {bannerUrl ? (
                      <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-primary/40 bg-[#0d0f0e]">
                        <img
                          src={bannerUrl}
                          alt="Banner do checkout"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setBannerUrl(null)}
                          className="absolute right-2.5 top-2.5 rounded-lg bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="flex h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-[#0e1110] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        <LayoutGrid className="h-5 w-5 opacity-80" />
                        <span className="text-xs font-medium">
                          Adicionar banner
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Favicon */}
                  <div className="space-y-3 rounded-xl border border-border bg-[#121514] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      FAVICON
                    </p>

                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, setFaviconUrl, "Favicon")
                      }
                    />

                    <div className="flex items-center gap-3.5">
                      {faviconUrl ? (
                        <button
                          type="button"
                          onClick={() => faviconInputRef.current?.click()}
                          className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-primary/40 bg-[#0e1110]"
                        >
                          <img
                            src={faviconUrl}
                            alt="Favicon"
                            className="h-8 w-8 object-contain"
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => faviconInputRef.current?.click()}
                          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-[#0e1110] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          <ImagePlus className="h-4 w-4" />
                        </button>
                      )}

                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => faviconInputRef.current?.click()}
                          className="cursor-pointer text-left text-xs font-bold text-foreground hover:text-primary"
                        >
                          Adicionar favicon
                        </button>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Imagem exibida na aba do site
                        </p>
                      </div>

                      {faviconUrl && (
                        <button
                          type="button"
                          onClick={() => setFaviconUrl(null)}
                          className="text-[11px] font-semibold text-destructive hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-border bg-[#0c0e0d] px-6 py-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="cursor-pointer rounded-lg border border-border bg-[#141716] px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveLink}
                className="cursor-pointer rounded-lg border border-primary/40 bg-[#0f3822] px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-[#154d2f] disabled:opacity-50"
              >
                {submitting
                  ? "Salvando..."
                  : editingLink
                  ? "Salvar alterações"
                  : "Criar link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

