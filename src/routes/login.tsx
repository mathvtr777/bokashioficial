import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/login")({
  validateSearch: (
    search: Record<string, unknown>
  ): { redirect?: string | undefined; ref?: string | undefined } => ({
    redirect:
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    ref: typeof search["ref"] === "string" ? search["ref"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — BokashiPay" },
      { name: "description", content: "Acesse sua conta na plataforma BokashiPay." },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const search = Route.useSearch();
  return <AuthPage initialTab="login" searchParams={search} />;
}

