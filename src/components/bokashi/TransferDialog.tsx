import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Phone,
  Mail,
  FileText,
  KeyRound,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  Send,
  X,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCurrencies } from "@/services/balances";
import { fetchStats } from "@/services/stats";
import {
  calculateTransferFee,
  executeTransfer,
  type PixKeyType,
  type TransferMode,
} from "@/services/transfers";
import { brl } from "@/data/mock";
import { cn } from "@/lib/utils";

function BrazilFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 shrink-0 rounded-full", className)}
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

function TransferHeaderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-foreground"
      fill="none"
       aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="13" rx="3" fill="currentColor" />
      <circle cx="12" cy="10.5" r="2.5" fill="#0d0f0e" />
      <path
        d="M8 20h8M10 17v3M14 17v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TabCoinIcon({ active, isInternal }: { active: boolean; isInternal?: boolean }) {
  return (
    <span
      className={cn(
        " relative grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold transition-colors",
        active
          ? "bg-[#00e676] text-[#082415]"
          : "bg-[#6c7570] text-[#131614]"
      )}
    >
      $
      {!isInternal && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 text-[8px] leading-none font-bold",
            active ? "text-[#00e676]" : "text-[#6c7570]"
          )}
        >
          ↗
        </span>
      )}
    </span>
  );
}

const PIX_KEY_TYPES: {
  id: PixKeyType;
  label: string;
  placeholder: string;
  icon: typeof Phone;
}[] = [
  {
    id: "phone",
    label: "Celular",
    placeholder: "Digitar chave PIX...",
    icon: Phone,
  },
  {
    id: "cpf_cnpj",
    label: "CPF / CNPJ",
    placeholder: "Digite o CPF ou CNPJ...",
    icon: FileText,
  },
  {
    id: "email",
    label: "E-mail",
    placeholder: "Digite o e-mail da chave PIX...",
    icon: Mail,
  },
  {
    id: "random",
    label: "Chave aleatória",
    placeholder: "Cole ou digite a chave EVP...",
    icon: KeyRound,
  },
];

const QUICK_AMOUNTS = [10, 20, 50, 100];

export interface TransferDialogProps {
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  trigger?: React.ReactNode | undefined;
  initialPixKey?: string | undefined;
}

export function TransferDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  initialPixKey,
}: TransferDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [mode, setMode] = useState<TransferMode>("external");
  const [selectedCurrency, setSelectedCurrency] = useState("BRL");
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  // Amount in cents so typing works smoothly like banking apps
  const [amountCents, setAmountCents] = useState(0);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("phone");
  const [keyTypeMenuOpen, setKeyTypeMenuOpen] = useState(false);
  const [pixKey, setPixKey] = useState(initialPixKey || "");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");

  const amountInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const defaultClientName = user
    ? String(user.user_metadata?.["full_name"] || user.email?.split("@")[0] || "Cliente")
    : "Cliente";
  const [clientName, setClientName] = useState(defaultClientName);

  useEffect(() => {
    setClientName(defaultClientName);
  }, [defaultClientName]);

  const { data: currenciesList = [] } = useQuery({
    queryKey: ["currencies", user?.id],
    queryFn: () => fetchCurrencies(user?.id),
    refetchInterval: 5000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["financial_stats", user?.id],
    queryFn: () => fetchStats(user?.id),
    refetchInterval: 5000,
  });

  const rawAvailable = statsData?.main?.find((s) => s.key === "available")?.value;
  const availableBrl =
    typeof rawAvailable === "number" ? Math.max(0, rawAvailable) : 0;

  const currentCurrencyObj = currenciesList.find((c) => c.code === selectedCurrency) ?? {
    code: "BRL",
    name: "Real brasileiro",
    symbol: "R$",
    balance: brl(availableBrl),
    share: 100,
  };

  const amount = amountCents / 100;
  const fee = calculateTransferFee(amount, mode);
  const totalDebited = Number((amount + fee).toFixed(2));

  useEffect(() => {
    if (open && initialPixKey !== undefined && initialPixKey.trim()) {
      const trimmed = initialPixKey.trim();
      setPixKey(trimmed);
      if (trimmed.includes("@")) {
        setPixKeyType("email");
      } else if (/^[0-9a-fA-F-]{32,36}$/.test(trimmed)) {
        setPixKeyType("random");
      }
    }
    if (!open) {
      setStep("form");
      setCurrencyMenuOpen(false);
      setKeyTypeMenuOpen(false);
    }
  }, [open, initialPixKey]);

  const mutation = useMutation({
    mutationFn: () =>
      executeTransfer(
        {
          mode,
          currency: selectedCurrency,
          amount,
          pixKeyType,
          pixKey: pixKey.trim(),
          description: description.trim(),
          clientName: clientName.trim() || defaultClientName,
          clientEmail: user?.email || "cliente@bokashipay.com",
        },
        user?.id
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_stats"] });
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      queryClient.invalidateQueries({ queryKey: ["admin_withdrawals"] });
      if (res.queuedForApproval) {
        toast.success("Saque enviado para aprovação!", {
          description: `Valor: ${brl(res.netAmount)} • Aguardando liberação do administrador (${res.acquirerReference}).`,
        });
      } else {
        toast.success("Transferência realizada com sucesso!", {
          description: `Valor: ${brl(res.netAmount)} • Taxa: ${brl(res.fee)} • Ref: ${res.acquirerReference}`,
        });
      }
      setAmountCents(0);
      setPixKey("");
      setDescription("");
      setStep("form");
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Não foi possível concluir a transferência", {
        description:
          err instanceof Error ? err.message : "Tente novamente em instantes.",
      });
    },
  });

  const handleAddQuickAmount = (valueToAdd: number) => {
    setAmountCents((prev) => prev + Math.round(valueToAdd * 100));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setAmountCents(0);
      return;
    }
    const nextCents = parseInt(digits.slice(0, 11), 10);
    setAmountCents(isNaN(nextCents) ? 0 : nextCents);
  };

  const handlePastePixKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmed = text.trim();
        setPixKey(trimmed);
        // Auto-detect key type when pasting
        if (trimmed.includes("@")) {
          setPixKeyType("email");
        } else if (/^[0-9a-fA-F-]{32,36}$/.test(trimmed)) {
          setPixKeyType("random");
        }
        toast.success("Chave colada da área de transferência");
      } else {
        toast.info("A área de transferência está vazia");
      }
    } catch {
      toast.error("Permissão negada para ler a área de transferência");
    }
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error("Informe um valor maior que R$ 0,00 para transferir");
      amountInputRef.current?.focus();
      return;
    }
    if (!pixKey.trim()) {
      toast.error(
        mode === "internal"
          ? "Informe o destinatário da transferência interna"
          : "Informe a chave PIX de destino"
      );
      return;
    }
    setStep("confirm");
  };

  const activeKeyType =
    PIX_KEY_TYPES.find((k) => k.id === pixKeyType) ?? PIX_KEY_TYPES[0]!;
  const ActiveKeyIcon = activeKeyType.icon;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : null}

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-1.5rem)] max-w-[445px] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border border-[#222724] bg-[#0d0f0e] p-0 text-foreground shadow-2xl duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header with dashed divider */}
          <div className="relative flex items-center justify-between border-b border-dashed border-[#2b302d] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <TransferHeaderIcon />
              <DialogPrimitive.Title className="font-display text-[17px] font-bold tracking-tight text-white">
                Realizar transferência
              </DialogPrimitive.Title>
            </div>

            <DialogPrimitive.Close
              aria-label="Fechar"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-[#171a18] text-muted-foreground transition-colors hover:bg-[#222624] hover:text-white focus:outline-none"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {step === "form" ? (
            <form onSubmit={handleContinue} className="space-y-5 p-5">
              {/* Segmented Tabs: Transferir / Transferência interna */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#1d221f] bg-[#131614] p-1.5">
                <button
                  type="button"
                  onClick={() => setMode("external")}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-bold transition-all",
                    mode === "external"
                      ? "border border-[#1a4930] bg-[#103020] text-[#00e676] shadow-sm"
                      : "border border-transparent text-white/80 hover:text-white"
                  )}
                >
                  <TabCoinIcon active={mode === "external"} />
                  <span>Transferir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("internal")}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-bold transition-all",
                    mode === "internal"
                      ? "border border-[#1a4930] bg-[#103020] text-[#00e676] shadow-sm"
                      : "border border-transparent text-white/80 hover:text-white"
                  )}
                >
                  <TabCoinIcon active={mode === "internal"} isInternal />
                  <span>Transferência interna</span>
                </button>
              </div>

              {/* Selecione a moeda */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white/90">
                  Selecione a moeda
                </label>

                <div className="relative rounded-xl border border-[#222724] bg-[#131614]">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => setCurrencyMenuOpen((v) => !v)}
                      className="flex flex-1 cursor-pointer items-center gap-2.5 text-left focus:outline-none"
                    >
                      {selectedCurrency === "BRL" ? (
                        <BrazilFlagIcon />
                      ) : (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1e2421] text-[11px] font-bold text-[#00e676]">
                          {currentCurrencyObj.symbol}
                        </span>
                      )}
                      <span className="text-xs font-bold text-white tabular">
                        {currentCurrencyObj.code}:{" "}
                        {hideBalance ? "R$ ••••" : currentCurrencyObj.balance}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHideBalance((h) => !h)}
                        title={hideBalance ? "Mostrar saldo" : "Ocultar saldo"}
                        className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-white"
                      >
                        {hideBalance ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrencyMenuOpen((v) => !v)}
                        aria-label="Selecionar moeda"
                        className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-white"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            currencyMenuOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown list of currencies */}
                  {currencyMenuOpen && (
                    <div className="border-t border-[#222724] bg-[#111412] py-1">
                      {(currenciesList.length > 0
                        ? currenciesList
                        : [currentCurrencyObj]
                      ).map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setSelectedCurrency(c.code);
                            setCurrencyMenuOpen(false);
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-xs transition-colors hover:bg-[#1a1f1c]",
                            c.code === selectedCurrency
                              ? "font-bold text-[#00e676]"
                              : "text-white/80"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {c.code === "BRL" ? (
                              <BrazilFlagIcon className="h-4 w-4" />
                            ) : (
                              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#1e2421] text-[10px] font-bold">
                                {c.symbol}
                              </span>
                            )}
                            {c.name} ({c.code})
                          </span>
                          <span className="tabular">
                            {hideBalance ? "••••" : c.balance}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Fee info footer */}
                  <div className="flex items-center justify-between rounded-b-xl border-t border-[#1e2320] bg-[#171a18] px-3.5 py-2 text-[11px] text-[#8a948e]">
                    <span>
                      *Taxa de transferência: {mode === "internal" ? "0%" : "2%"}
                    </span>
                    <span>
                      *Taxa mínima: {mode === "internal" ? "R$ 0,00" : "R$ 0,90"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Big Amount Display & Quick Amount Pills */}
              <div className="space-y-4 pt-1 text-center">
                <div
                  onClick={() => amountInputRef.current?.focus()}
                  className="relative mx-auto inline-flex cursor-text items-center justify-center"
                >
                  <input
                    ref={amountInputRef}
                    type="text"
                    inputMode="numeric"
                    value={brl(amount)}
                    onChange={handleAmountChange}
                    aria-label="Valor da transferência"
                    className="w-full max-w-[260px] bg-transparent text-center font-display text-3xl font-extrabold tracking-tight text-white tabular focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleAddQuickAmount(val)}
                      className="cursor-pointer rounded-full border border-[#242926] bg-[#171a18] px-3.5 py-2 text-xs font-bold text-white transition-all hover:border-[#333a36] hover:bg-[#202422] active:scale-95"
                    >
                      + {brl(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chave PIX / Destinatário */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/90">
                    {mode === "internal"
                      ? "Conta de destino (E-mail ou ID) *"
                      : "Chave PIX *"}
                  </label>
                  <button
                    type="button"
                    onClick={handlePastePixKey}
                    className="cursor-pointer text-xs font-bold text-[#00e676] transition-opacity hover:opacity-80"
                  >
                    Colar
                  </button>
                </div>

                <div className="relative flex items-center rounded-xl border border-[#222724] bg-[#131614] transition-colors focus-within:border-[#00e676]/60">
                  {mode === "external" ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setKeyTypeMenuOpen((o) => !o)}
                        title={`Tipo de chave: ${activeKeyType.label}`}
                        className="flex h-full cursor-pointer items-center gap-1.5 border-r border-[#222724] px-3 py-3 text-[#8a948e] transition-colors hover:text-white"
                      >
                        <ActiveKeyIcon className="h-3.5 w-3.5" />
                        <ChevronDown className="h-3 w-3" />
                      </button>

                      {keyTypeMenuOpen && (
                        <div className="absolute left-0 bottom-full z-20 mb-1.5 w-44 rounded-xl border border-[#242926] bg-[#141816] py-1 shadow-xl">
                          {PIX_KEY_TYPES.map((k) => {
                            const Icon = k.icon;
                            return (
                              <button
                                key={k.id}
                                type="button"
                                onClick={() => {
                                  setPixKeyType(k.id);
                                  setKeyTypeMenuOpen(false);
                                }}
                                className={cn(
                                  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[#1e2421]",
                                  pixKeyType === k.id
                                    ? "font-bold text-[#00e676]"
                                    : "text-white/80"
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{k.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center border-r border-[#222724] px-3 py-3 text-[#8a948e]">
                      <UserCheck className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <input
                    type="text"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      mode === "internal"
                        ? "Digite o e-mail ou ID BokashiPay..."
                        : activeKeyType.placeholder
                    }
                    className="w-full flex-1 bg-transparent px-3.5 py-3 text-xs text-white placeholder:text-[#6c7570] focus:outline-none"
                  />
                </div>
              </div>

              {/* Nome do cliente / titular */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/90">
                  Nome do cliente / titular
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nome completo ou usuário da conta"
                  className="w-full rounded-xl border border-[#222724] bg-[#131614] px-3.5 py-3 text-xs text-white placeholder:text-[#6c7570] transition-colors focus:border-[#00e676]/60 focus:outline-none"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/90">
                  Descrição
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Do que se trata?"
                  className="w-full rounded-xl border border-[#222724] bg-[#131614] px-3.5 py-3 text-xs text-white placeholder:text-[#6c7570] transition-colors focus:border-[#00e676]/60 focus:outline-none"
                />
              </div>

              {/* Botão Continuar */}
              <button
                type="submit"
                className="w-full cursor-pointer rounded-xl bg-[#0d3b25] py-3.5 text-sm font-bold text-[#00d66f] transition-all hover:bg-[#124d31] hover:text-[#00e676] active:scale-[0.99]"
              >
                Continuar
              </button>
            </form>
          ) : (
            /* Passo de revisão e confirmação da transferência */
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-[#222724] bg-[#131614] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1e2320] pb-3">
                  <span className="text-xs text-[#8a948e]">Valor do envio</span>
                  <span className="font-display text-lg font-extrabold text-white tabular">
                    {brl(amount)}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8a948e]">Modalidade</span>
                    <span className="font-semibold text-white">
                      {mode === "internal"
                        ? "Transferência interna"
                        : `PIX (${activeKeyType.label})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8a948e]">Destino</span>
                    <span className="max-w-[220px] truncate font-semibold text-white">
                      {pixKey}
                    </span>
                  </div>
                  {description.trim() && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8a948e]">Descrição</span>
                      <span className="max-w-[220px] truncate text-white/90">
                        {description}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[#8a948e]">Taxa de transferência</span>
                    <span className="tabular text-white/90">{brl(fee)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#1e2320] pt-2.5 text-sm">
                    <span className="font-semibold text-white">Total a debitar</span>
                    <span className="font-bold text-[#00e676] tabular">
                      {brl(totalDebited)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  disabled={mutation.isPending}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#222724] bg-[#131614] px-4 py-3.5 text-xs font-bold text-white transition-colors hover:bg-[#1b201d]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#00e676] py-3.5 text-sm font-extrabold text-[#062112] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {mutation.isPending ? "Processando..." : "Confirmar transferência"}
                </button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function TransferTriggerButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      <Send className="h-4 w-4" /> Realizar transferência
    </button>
  );
}
