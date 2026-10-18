import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Lock,
  Copy,
  Check,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertTriangle,
  ExternalLink,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/bokashi/Logo";
import { brl } from "@/data/mock";
import { cn } from "@/lib/utils";
import {
  fetchPaymentLinkBySlug,
  notifyPaymentLinkPaid,
  calculateCustomerTotalWithPassedFee,
  type PaymentLinkMethod,
  type PaymentLinkRecord,
} from "@/services/payment-links";
import {
  executeReceive,
  checkReceiveStatus,
  type ReceiveResult,
} from "@/services/receives";

export const Route = createFileRoute("/pay/$slug")({
  head: () => ({
    meta: [
      { title: "Checkout Seguro — BokashiPay" },
      {
        name: "description",
        content: "Realize seu pagamento com segurança via BokashiPay.",
      },
    ],
  }),
  component: PublicPaymentLinkCheckoutPage,
});

function PublicPaymentLinkCheckoutPage() {
  const { slug } = Route.useParams();
  const [link, setLink] = useState<PaymentLinkRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentLinkMethod>("pix");
  const [payerName, setPayerName] = useState("");
  const [payerDocument, setPayerDocument] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generatedPayment, setGeneratedPayment] =
    useState<ReceiveResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchPaymentLinkBySlug(slug)
      .then((item) => {
        if (!mounted) return;
        setLink(item);
        if (item) {
          document.title = `${item.title} — Checkout BokashiPay`;
          if (item.paymentMethods.length > 0) {
            setSelectedMethod(item.paymentMethods[0]!);
          }
          if (item.enableBannertime && item.bannertimeMinutes) {
            setSecondsLeft(item.bannertimeMinutes * 60);
          }
          if (item.faviconUrl) {
            let faviconEl =
              document.querySelector<HTMLLinkElement>("link[rel='icon']");
            if (!faviconEl) {
              faviconEl = document.createElement("link");
              faviconEl.rel = "icon";
              document.head.appendChild(faviconEl);
            }
            faviconEl.href = item.faviconUrl;
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Countdown timer for Bannertime
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const verifyPayment = useCallback(
    async (manual = false) => {
      if (
        !generatedPayment ||
        generatedPayment.status === "confirmed" ||
        !link
      ) {
        return;
      }
      if (manual) setCheckingStatus(true);
      try {
        const res = await checkReceiveStatus(
          generatedPayment.transactionId,
          generatedPayment.externalId
        );
        if (res.confirmed) {
          setGeneratedPayment((prev) =>
            prev ? { ...prev, status: "confirmed" } : null
          );
          await notifyPaymentLinkPaid(
            link.slug,
            generatedPayment.transactionId,
            link.amount
          );
          toast.success("Pagamento confirmado com sucesso!");

          if (link.redirectAfterPayment && link.redirectUrl) {
            setTimeout(() => {
              window.location.href = link.redirectUrl!;
            }, 2500);
          }
        } else if (manual) {
          toast.info("Aguardando confirmação do pagamento pelo banco...");
        }
      } catch {
        // ignore transient network errors
      } finally {
        if (manual) setCheckingStatus(false);
      }
    },
    [generatedPayment, link]
  );

  useEffect(() => {
    if (!generatedPayment || generatedPayment.status === "confirmed") return;
    const interval = setInterval(() => {
      void verifyPayment(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [generatedPayment, verifyPayment]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b0a] px-4 text-foreground">
        <Logo variant="horizontal" size="md" />
        <p className="mt-4 text-xs text-muted-foreground">
          Carregando checkout seguro...
        </p>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#090b0a] px-4 text-center text-foreground">
        <Logo variant="horizontal" size="md" />
        <div className="mt-6 max-w-md rounded-2xl border border-border bg-[#111413] p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-lg font-bold">
            Link de pagamento não encontrado
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Verifique se o endereço foi digitado corretamente ou solicite um
            novo link ao vendedor.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  const isUnavailable = link.status !== "active" || secondsLeft === 0;
  const feeCalc = calculateCustomerTotalWithPassedFee(link.amount);
  const finalAmountToCharge = link.passFeeToCustomer
    ? feeCalc.customerTotal
    : link.amount;

  const handleGeneratePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUnavailable) return;

    setGenerating(true);
    try {
      const targetCurrency =
        selectedMethod === "crypto"
          ? link.currency === "BRL"
            ? "USDT"
            : link.currency
          : "BRL";

      const result = await executeReceive(
        {
          mode: "charge",
          currency: targetCurrency,
          amount: finalAmountToCharge,
          description: `Link: ${link.title}${
            payerName.trim() ? ` - ${payerName.trim()}` : ""
          }`,
        },
        link.userId
      );
      setGeneratedPayment(result);
      toast.success(
        selectedMethod === "pix"
          ? "QR Code PIX gerado com sucesso!"
          : "Endereço Cripto gerado com sucesso!"
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar a cobrança. Tente novamente."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedPayment?.qrcode) return;
    try {
      await navigator.clipboard.writeText(generatedPayment.qrcode);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar código.");
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#080a09] px-4 py-8 text-foreground sm:py-12">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Top Brand Bar */}
        <div className="flex items-center justify-between px-1">
          <Logo variant="horizontal" size="sm" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <Lock className="h-3 w-3" /> Checkout 100% Seguro
          </span>
        </div>

        {/* Bannertime Countdown */}
        {link.enableBannertime && secondsLeft !== null && (
          <div className="flex items-center justify-between rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-xs">
            <span className="flex items-center gap-2 font-semibold text-warning">
              <Clock className="h-4 w-4" />
              Oferta por tempo limitado! Finalize seu pagamento em:
            </span>
            <span className="rounded-lg bg-warning px-2.5 py-0.5 font-mono text-xs font-bold text-black">
              {formatCountdown(secondsLeft)}
            </span>
          </div>
        )}

        {/* Main Checkout Card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-[#101312] shadow-2xl">
          {/* Custom Checkout Banner */}
          {link.bannerUrl && (
            <div className="h-40 w-full overflow-hidden border-b border-border bg-[#0c0e0d]">
              <img
                src={link.bannerUrl}
                alt={link.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Product / Link Header */}
            <div className="flex items-start gap-4">
              {link.photoUrl ? (
                <img
                  src={link.photoUrl}
                  alt={link.title}
                  className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary-soft text-primary">
                  <QrCode className="h-6 w-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {link.linkCatalogProduct && link.catalogProductName && (
                  <span className="mb-1 inline-block rounded bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {link.catalogProductName}
                  </span>
                )}
                <h1 className="text-lg font-bold text-foreground">
                  {link.title}
                </h1>
                {link.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {link.description}
                  </p>
                )}
              </div>
            </div>

            {/* Price Summary Box */}
            <div className="rounded-xl border border-border bg-[#151918] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  Valor total a pagar
                </span>
                <span className="font-display text-2xl font-bold text-primary">
                  {link.currency === "BRL"
                    ? brl(finalAmountToCharge)
                    : `${finalAmountToCharge.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })} ${link.currency}`}
                </span>
              </div>
              {link.passFeeToCustomer && (
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <span>
                    Valor do item: {brl(link.amount)} + Taxa de processamento:{" "}
                    {brl(feeCalc.fee)}
                  </span>
                  <span className="text-primary">Liberação imediata</span>
                </div>
              )}
            </div>

            {isUnavailable ? (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-5 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
                <p className="mt-2 text-sm font-bold text-foreground">
                  Este link de pagamento não está mais disponível
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {link.status === "completed"
                    ? "O limite máximo de pagamentos para este link foi atingido."
                    : link.status === "expired" || secondsLeft === 0
                    ? "O prazo de validade deste link expirou."
                    : "Este link foi temporariamente desativado pelo vendedor."}
                </p>
              </div>
            ) : generatedPayment ? (
              <div className="space-y-5">
                {generatedPayment.status === "confirmed" ? (
                  <div className="rounded-xl border border-primary/40 bg-primary/10 p-6 text-center space-y-3">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">
                      Pagamento aprovado!
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Recebemos a confirmação do seu pagamento de{" "}
                      <strong>{brl(finalAmountToCharge)}</strong>.
                    </p>
                    {link.redirectAfterPayment && link.redirectUrl && (
                      <a
                        href={link.redirectUrl}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                      >
                        Continuar para a página de acesso{" "}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center rounded-xl border border-border bg-white p-5">
                      {generatedPayment.qrcode ? (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                            generatedPayment.qrcode
                          )}`}
                          alt="QR Code de Pagamento"
                          className="h-48 w-48 object-contain"
                        />
                      ) : null}
                      <p className="mt-2 text-[11px] font-medium text-neutral-600">
                        Escaneie o QR Code no aplicativo do seu banco
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-muted-foreground">
                        {selectedMethod === "pix"
                          ? "PIX Copia e Cola"
                          : "Endereço / Código de Pagamento"}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedPayment.qrcode}
                          className="w-full rounded-lg border border-border bg-[#151918] px-3 py-2.5 font-mono text-xs text-foreground"
                        />
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                        >
                          {copied ? (
                            <>
                              <Check className="h-4 w-4" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setGeneratedPayment(null)}
                        className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        ← Alterar dados
                      </button>

                      <button
                        type="button"
                        disabled={checkingStatus}
                        onClick={() => void verifyPayment(true)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/25"
                      >
                        <RefreshCw
                          className={cn(
                            "h-3.5 w-3.5",
                            checkingStatus && "animate-spin"
                          )}
                        />
                        Já realizei o pagamento
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleGeneratePayment} className="space-y-4">
                {/* Payment Method Selector */}
                {link.paymentMethods.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      Método de pagamento
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {link.paymentMethods.includes("pix") && (
                        <button
                          type="button"
                          onClick={() => setSelectedMethod("pix")}
                          className={cn(
                            "flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all",
                            selectedMethod === "pix"
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-[#151918] text-muted-foreground hover:text-foreground"
                          )}
                        >
                          PIX Instantâneo
                        </button>
                      )}
                      {link.paymentMethods.includes("crypto") && (
                        <button
                          type="button"
                          onClick={() => setSelectedMethod("crypto")}
                          className={cn(
                            "flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all",
                            selectedMethod === "crypto"
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-[#151918] text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Cripto (USDT)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      Seu nome
                    </label>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full rounded-lg border border-border bg-[#151918] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-foreground">
                      CPF / CNPJ (opcional)
                    </label>
                    <input
                      type="text"
                      value={payerDocument}
                      onChange={(e) => setPayerDocument(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full rounded-lg border border-border bg-[#151918] px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="w-full cursor-pointer rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {generating
                    ? "Gerando QR Code na BSPAY..."
                    : selectedMethod === "pix"
                    ? `Gerar PIX de ${brl(finalAmountToCharge)}`
                    : "Gerar Pagamento Cripto"}
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-border bg-[#0c0e0d] px-6 py-3 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Processado com segurança por <strong>BokashiPay</strong> &amp;{" "}
            <strong>BSPAY</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
