import { useEffect, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Construction, Search } from "lucide-react";
import { AppShell } from "@/components/bokashi/AppShell";
import { allLeaves } from "@/components/bokashi/nav";
import { StatCard } from "@/components/bokashi/StatCard";
import { TxTable } from "@/components/bokashi/Transactions";
import { TransferDialog, TransferTriggerButton } from "@/components/bokashi/TransferDialog";
import { ReceiveDialog, ReceiveTriggerButton } from "@/components/bokashi/ReceiveDialog";
import { MedAlertBanner } from "@/components/bokashi/MedAlertBanner";
import { PaymentLinksManager } from "@/components/bokashi/PaymentLinksManager";
import { NtfyNotificationSettings } from "@/components/bokashi/NtfyNotificationSettings";
import { IndiqueEGanheView } from "@/components/bokashi/AffiliateSystem";
import {
  AprovacoesView,
  ComissoesView,
  ConversoesView,
  ExtratoView,
  InfracoesView,
  MetricasView,
} from "@/components/bokashi/ReportsViews";

import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/services/stats";

const tablePages = ["enviar", "receber"];

const sectionSubtitles: Record<string, string> = {
  extrato: "Visualize todas as suas transações",
  comissoes: "Visualize e gerencie suas comissões",
  aprovacoes: "Revise e aprove ou recuse transações pendentes",
  metricas: "Acompanhe métricas e indicadores do seu negócio",
  infracoes: "Visualize e gerencie suas infrações",
  conversoes: "Visualize e gerencie suas conversões",
  converter: "Visualize e gerencie suas conversões",
  indique:
    "25% do lucro gerado pelo seu indicado para a plataforma, de forma vitalícia.",
  "link-de-pagamento": "Crie e gerencie links para receber pagamentos",
  notificacoes:
    "Receba alertas de PIX gerado e vendas confirmadas no seu celular via ntfy",
  configuracoes:
    "Receba alertas de PIX gerado e vendas confirmadas no seu celular via ntfy",
};

export const Route = createFileRoute("/$section")({
  loader: ({ params }) => {
    const leaf = allLeaves.find((l) => l.slug === params.section && l.slug);
    if (!leaf) throw notFound();
    return { title: leaf.title };
  },
  head: ({ loaderData }) => {
    const t = `${loaderData?.title ?? "Seção"} — BokashiPay`;
    const d = `${loaderData?.title ?? "Seção"} no painel BokashiPay.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Section,
});

function Section() {
  const { title } = Route.useLoaderData();
  const { section } = Route.useParams();
  const isTable = tablePages.includes(section);
  const { user } = useAuth();
  const [transferOpen, setTransferOpen] = useState(section === "enviar");
  const [receiveOpen, setReceiveOpen] = useState(section === "receber");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setTransferOpen(section === "enviar");
    setReceiveOpen(section === "receber");
    setSearchQuery("");
  }, [section]);

  useEffect(() => {
    const handleOpenTransfer = () => setTransferOpen(true);
    const handleOpenReceive = () => setReceiveOpen(true);
    window.addEventListener("bokashi:open-transfer", handleOpenTransfer);
    window.addEventListener("bokashi:open-receive", handleOpenReceive);
    return () => {
      window.removeEventListener("bokashi:open-transfer", handleOpenTransfer);
      window.removeEventListener("bokashi:open-receive", handleOpenReceive);
    };
  }, []);

  const { data: statsData } = useQuery({
    queryKey: ["financial_stats", user?.id],
    queryFn: () => fetchStats(user?.id),
    refetchInterval: 5000,
  });

  const secStats = statsData?.secondary ?? [
    {
      key: "pending",
      title: "Saldo a receber",
      value: "R$ 0,00",
      desc: "Valores pendentes de liberação",
      icon: "clock",
    },
    {
      key: "ticket",
      title: "Ticket médio",
      value: "R$ 0,00",
      desc: "Valor médio por transação",
      icon: "receipt",
    },
    {
      key: "daily",
      title: "Média diária",
      value: "R$ 0,00",
      desc: "Média diária de entradas",
      icon: "trend",
    },
    {
      key: "count",
      title: "Qtd. de transações",
      value: "0",
      desc: "Total de transações no período",
      icon: "swap",
    },
  ];

  const filterType =
    section === "receber"
      ? "Entrada"
      : section === "enviar"
        ? "Saída"
        : undefined;

  const subtitle =
    sectionSubtitles[section] ?? "Sincronizado em tempo real com a BSPAY";

  return (
    <AppShell title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {section !== "infracoes" && <MedAlertBanner />}
        {section === "extrato" ? (
          <ExtratoView />
        ) : section === "comissoes" ? (
          <ComissoesView />
        ) : section === "aprovacoes" ? (
          <AprovacoesView />
        ) : section === "metricas" ? (
          <MetricasView />
        ) : section === "infracoes" ? (
          <InfracoesView />
        ) : section === "conversoes" || section === "converter" ? (
          <ConversoesView />
        ) : section === "indique" ? (
          <IndiqueEGanheView />
        ) : section === "link-de-pagamento" ? (
          <PaymentLinksManager />
        ) : section === "notificacoes" || section === "configuracoes" ? (
          <NtfyNotificationSettings />
        ) : (
          <>
            {isTable && (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {secStats.map((s) => (
                  <StatCard
                    key={s.key}
                    compact
                    title={s.title}
                    value={String(s.value)}
                    desc={s.desc}
                    icon={s.icon}
                  />
                ))}
              </div>
            )}
            <div className="panel p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Buscar em ${title.toLowerCase()}...`}
                    className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
                {section === "enviar" ? (
                  <TransferDialog
                    open={transferOpen}
                    onOpenChange={setTransferOpen}
                    trigger={<TransferTriggerButton />}
                  />
                ) : section === "receber" ? (
                  <ReceiveDialog
                    open={receiveOpen}
                    onOpenChange={setReceiveOpen}
                    trigger={<ReceiveTriggerButton />}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <ReceiveDialog trigger={<ReceiveTriggerButton />} />
                    <TransferDialog trigger={<TransferTriggerButton />} />
                  </div>
                )}
              </div>
              {isTable ? (
                <div className="mt-4">
                  <TxTable searchQuery={searchQuery} filterType={filterType} />
                </div>
              ) : (
                <div className="grid place-items-center py-16 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Construction className="h-5 w-5" />
                  </div>
                  <p className="mt-4 font-display font-semibold">{title}</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Esta seção estará disponível em breve. A estrutura visual já
                    está pronta para receber os dados reais.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
