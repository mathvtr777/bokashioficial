import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BokashiPay - Pagamentos Rápidos, Seguros e Sem Complicação" },
      {
        name: "description",
        content:
          "BokashiPay: Receba, envie e gerencie seus pagamentos em segundos com taxas transparentes e sem burocracia.",
      },
      { property: "og:title", content: "BokashiPay - Pagamentos Rápidos e Seguros" },
      {
        property: "og:description",
        content:
          "Receba, envie e gerencie seus pagamentos em segundos com taxas transparentes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
