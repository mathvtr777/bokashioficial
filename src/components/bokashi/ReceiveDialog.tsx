import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Download,
  X,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCurrencies } from "@/services/balances";
import { fetchStats } from "@/services/stats";
import {
  calculateReceiveFee,
  checkReceiveStatus,
  executeReceive,
  type ReceiveMode,
  type ReceiveResult,
} from "@/services/receives";
import { createUserPaymentLink } from "@/services/payment-links";
import { saveLocalTransaction } from "@/services/transactions";
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

function ReceiveHeaderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-foreground"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.5v7m0 0-2.5-2.5M12 9.5l2.5-2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="3" y="11" width="18" height="10" rx="3" fill="currentColor" />
      <circle cx="12" cy="16" r="2.2" fill="#0d0f0e" />
    </svg>
  );
}

const QUICK_AMOUNTS = [10, 20, 50, 100];

export interface ReceiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ReceiveDialog({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: ReceiveDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [mode, setMode] = useState<ReceiveMode>("charge");
  const [selectedCurrency, setSelectedCurrency] = useState("BRL");
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  const [amountCents, setAmountCents] = useState(0);
  const [description, setDescription] = useState("");
  const [generatedPayment, setGeneratedPayment] =
    useState<ReceiveResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const rawAvailable = statsData?.main?.find(
    (s) => s.key === "available"
  )?.value;
  const availableBrl =
    typeof rawAvailable === "number" ? Math.max(0, rawAvailable) : 0;

  const currentCurrencyObj = currenciesList.find(
    (c) => c.code === selectedCurrency
  ) ?? {
    code: "BRL",
    name: "Real brasileiro",
    symbol: "R$",
    balance: brl(availableBrl),
    share: 100,
  };

  const amount = amountCents / 100;
  const fee = calculateReceiveFee(amount);

  useEffect(() => {
    if (!open) {
      setCurrencyMenuOpen(false);
      setCopied(false);
    }
  }, [open]);

  const verifyPayment = useCallback(
    async (manual = false) => {
      if (!generatedPayment || generatedPayment.status === "confirmed") return;
      if (manual) setCheckingStatus(true);
      try {
        const res = await checkReceiveStatus(
          generatedPayment.transactionId,
          generatedPayment.externalId
        );
        if (res.confirmed) {
          const actualFee = res.fee ?? generatedPayment.fee;
          const actualAmount = res.amount ?? generatedPayment.amount;
          setGeneratedPayment((prev) =>
            prev
              ? {
                  ...prev,
                  status: "confirmed",
                  payerName: res.payerName,
                  fee: actualFee,
                  amount: actualAmount,
                  netAmount: Math.max(
                    0,
                    Number((actualAmount - actualFee).toFixed(2))
                  ),
                }
              : null
          );
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["financial_stats"] });
          queryClient.invalidateQueries({ queryKey: ["currencies"] });
          queryClient.invalidateQueries({ queryKey: ["payment_links"] });
          toast.success("Pagamento PIX confirmado!", {
            description: `Valor creditado: ${brl(
              Math.max(0, actualAmount - actualFee)
            )}${res.payerName ? ` • Pagador: ${res.payerName}` : ""}`,
          });
        } else if (manual) {
          toast.info("Pagamento ainda aguardando confirmação do banco.");
        }
      } catch {
        // ignore transient network error during poll
      } finally {
        if (manual) setCheckingStatus(false);
      }
    },
    [generatedPayment, queryClient]
  );

  // Automatic real-time polling every 3s while QR Code is displayed
  useEffect(() => {
    if (
      !open ||
      !generatedPayment ||
      mode !== "charge" ||
      generatedPayment.status === "confirmed"
    ) {
      return;
    }
    const timer = setInterval(() => {
      void verifyPayment(false);
    }, 3000);
    return () => clearInterval(timer);
  }, [open, generatedPayment, mode, verifyPayment]);

  const mutation = useMutation({
    mutationFn: () =>
      executeReceive(
        {
          mode,
          currency: selectedCurrency,
          amount,
          description: description.trim(),
        },
        user?.id
      ),
    onSuccess: (res) => {
      setGeneratedPayment(res);
      const effectiveUserId = user?.id || "guest";

      const now = new Date();
      saveLocalTransaction(effectiveUserId, {
        id: res.transactionId || res.externalId,
        externalId: res.externalId,
        name: description.trim() || `Cobrança PIX — ${brl(amount)}`,
        type: "Entrada",
        value: amount,
        status: "Pendente",
        date: now.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        rawDate: now.toISOString(),
        userId: user?.id ?? undefined,
      });

      void createUserPaymentLink({
        userId: effectiveUserId,
        title: description.trim() || `Cobrança PIX ${brl(amount)}`,
        amount,
        currency: selectedCurrency,
        passFeeToCustomer: false,
        paymentMethods: ["pix"],
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["payment_links"] });
        })
        .catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_stats"] });
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      queryClient.invalidateQueries({ queryKey: ["payment_links"] });
      toast.success(
        mode === "static_qr"
          ? "QR Code fixo gerado com sucesso na BSPAY!"
          : "Cobrança PIX gerada com sucesso na BSPAY!"
      );
    },
    onError: (err) => {
      toast.error("Não foi possível gerar o pagamento", {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "charge" && amount < 1) {
      toast.error("Informe um valor mínimo de R$ 1,00 para gerar a cobrança");
      amountInputRef.current?.focus();
      return;
    }
    mutation.mutate();
  };

  const handleCopyCode = async () => {
    const textToCopy =
      generatedPayment?.qrcode ||
      generatedPayment?.address ||
      generatedPayment?.pixKey ||
      "";
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Código copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar o código automaticamente.");
    }
  };

  const handleReset = () => {
    setGeneratedPayment(null);
    setCopied(false);
    setAmountCents(0);
    setDescription("");
  };

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
              <ReceiveHeaderIcon />
              <DialogPrimitive.Title className="font-display text-[17px] font-bold tracking-tight text-white">
                Adicionar saldo
              </DialogPrimitive.Title>
            </div>

            <DialogPrimitive.Close
              aria-label="Fechar"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-[#171a18] text-muted-foreground transition-colors hover:bg-[#222624] hover:text-white focus:outline-none"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {!generatedPayment ? (
            <form onSubmit={handleSubmit} className="space-y-5 p-5">
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
                      <span className="text-xs font-bold text-[#00e676] tabular">
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
                    <span>*Taxa de transferência: 3%</span>
                    <span>*Taxa mínima: R$ 0,90</span>
                  </div>
                </div>
              </div>

              {/* Tipo de recebimento */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-white/90">
                  Tipo de recebimento
                </label>

                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#1d221f] bg-[#131614] p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode("charge")}
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-lg py-2.5 px-3 text-xs font-bold transition-all",
                      mode === "charge"
                        ? "border border-[#1a4930] bg-[#103020] text-[#00e676] shadow-sm"
                        : "border border-transparent text-white/80 hover:text-white"
                    )}
                  >
                    Cobrança
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("static_qr")}
                    className={cn(
                      "flex cursor-pointer items-center justify-center rounded-lg py-2.5 px-3 text-xs font-bold transition-all",
                      mode === "static_qr"
                        ? "border border-[#1a4930] bg-[#103020] text-[#00e676] shadow-sm"
                        : "border border-transparent text-white/80 hover:text-white"
                    )}
                  >
                    QR Code fixo
                  </button>
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
                    aria-label="Valor do recebimento"
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

              {/* Botão Gerar pagamento */}
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0d3b25] py-3.5 text-sm font-bold text-[#00d66f] transition-all hover:bg-[#124d31] hover:text-[#00e676] active:scale-[0.99] disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Gerando na BSPAY...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    <span>Gerar pagamento</span>
                  </>
                )}
              </button>
            </form>
          ) : generatedPayment.status === "confirmed" ? (
            /* Tela de Pagamento Confirmado em Tempo Real */
            <div className="space-y-4 p-5">
              <div className="flex flex-col items-center rounded-xl border border-[#1a4930] bg-[#103020]/50 p-5 text-center">
                <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#00e676]/20 text-[#00e676]">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="font-display text-lg font-bold text-[#00e676]">
                  Pagamento confirmado!
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold text-white tabular">
                  + {brl(generatedPayment.amount)}
                </p>
                {generatedPayment.payerName && (
                  <p className="mt-1 text-xs text-white/80">
                    Pagador: <span className="font-semibold text-white">{generatedPayment.payerName}</span>
                  </p>
                )}

                <div className="mt-4 w-full space-y-1.5 border-t border-[#1a4930] pt-3 text-xs">
                  <div className="flex items-center justify-between text-[#8a948e]">
                    <span>Taxa processada</span>
                    <span className="tabular">{brl(generatedPayment.fee)}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>Creditado no saldo</span>
                    <span className="tabular text-[#00e676]">
                      + {brl(generatedPayment.netAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#222724] bg-[#131614] py-3.5 text-xs font-bold text-white transition-colors hover:bg-[#1b201d]"
                >
                  Gerar novo pagamento
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#00e676] py-3.5 text-xs font-extrabold text-[#062112] transition-opacity hover:opacity-90"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            /* Tela do QR Code / Copia e Cola aguardando pagamento */
            <div className="space-y-4 p-5">
              <div className="flex flex-col items-center rounded-xl border border-[#222724] bg-[#131614] p-4 text-center">
                {generatedPayment.qrcode ? (
                  <div className="mb-3 rounded-xl bg-white p-2.5 shadow-md">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(
                        generatedPayment.qrcode
                      )}`}
                      alt="QR Code de Pagamento BSPAY"
                      className="h-44 w-44 object-contain"
                    />
                  </div>
                ) : (
                  <div className="mb-3 grid h-36 w-36 place-items-center rounded-xl border border-dashed border-[#2b302d] bg-[#0d0f0e] text-[#00e676]">
                    <QrCode className="h-14 w-14" />
                  </div>
                )}

                {generatedPayment.amount > 0 && (
                  <p className="font-display text-2xl font-extrabold text-white tabular">
                    {brl(generatedPayment.amount)}
                  </p>
                )}

                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[#1a4930] bg-[#103020] px-2.5 py-0.5 text-[11px] font-semibold text-[#00e676]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e676]" />
                  {mode === "static_qr"
                    ? `Carteira fixa ativa (${generatedPayment.currency})`
                    : "Aguardando pagamento (atualiza automaticamente)"}
                </div>

                {generatedPayment.amount > 0 && (
                  <div className="mt-3 flex w-full items-center justify-between border-t border-[#1e2320] pt-2.5 text-[11px] text-[#8a948e]">
                    <span>Taxa estimada: {brl(fee)}</span>
                    <span className="font-semibold text-[#00e676]">
                      Líquido: {brl(Math.max(0, generatedPayment.amount - fee))}
                    </span>
                  </div>
                )}
              </div>

              {/* Código Copia e Cola / Endereço */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/90">
                  {generatedPayment.currency === "BRL"
                    ? "PIX Copia e Cola"
                    : `Endereço de depósito (${generatedPayment.chain || generatedPayment.currency})`}
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-[#222724] bg-[#131614] p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={
                      generatedPayment.qrcode ||
                      generatedPayment.address ||
                      generatedPayment.pixKey ||
                      ""
                    }
                    className="w-full flex-1 truncate bg-transparent text-xs font-mono text-white/90 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#103020] border border-[#1a4930] px-3 py-1.5 text-xs font-bold text-[#00e676] transition-colors hover:bg-[#153f2a]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#222724] bg-[#131614] px-3.5 py-3.5 text-xs font-bold text-white transition-colors hover:bg-[#1b201d]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
                {mode === "charge" ? (
                  <button
                    type="button"
                    onClick={() => void verifyPayment(true)}
                    disabled={checkingStatus}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#00e676] py-3.5 text-xs font-extrabold text-[#062112] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        checkingStatus && "animate-spin"
                      )}
                    />
                    {checkingStatus ? "Verificando..." : "Já paguei / Verificar"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#00e676] py-3.5 text-xs font-extrabold text-[#062112] transition-opacity hover:opacity-90"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar código
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ReceiveTriggerButton({
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
      <Download className="h-4 w-4" /> Adicionar saldo
    </button>
  );
}
