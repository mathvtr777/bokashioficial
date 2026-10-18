import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (
    search: Record<string, unknown>
  ): { redirect?: string | undefined; ref?: string | undefined } => ({
    redirect:
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    ref: typeof search["ref"] === "string" ? search["ref"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criar Conta — BokashiPay" },
      { name: "description", content: "Crie sua conta gratuita na plataforma BokashiPay." },
    ],
  }),
  component: CadastroRoute,
});

function CadastroRoute() {
  const search = Route.useSearch();
  return <AuthPage initialTab="register" searchParams={search} />;
}

