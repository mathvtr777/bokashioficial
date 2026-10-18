import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, Eye, EyeOff, Languages, LogIn, Menu, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sidebar } from "./Sidebar";
import { Logo } from "./Logo";
import { NtfyNotificationDialog } from "./NtfyNotificationSettings";
import { BrazilFlagIcon } from "./ReportsViews";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStats } from "@/services/stats";
import { brl } from "@/data/mock";

function IconBtn({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button aria-label={label} onClick={onClick}
          className="relative grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { user } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: ["financial_stats", user?.id],
    queryFn: () => fetchStats(user?.id),
    refetchInterval: 5000,
  });

  const rawTotal = statsData?.main?.find((s) => s.key === "total")?.value;
  const rawAvailable = statsData?.main?.find((s) => s.key === "available")?.value;
  const totalRevenueValue =
    typeof rawTotal === "number" && rawTotal > 0
      ? rawTotal
      : typeof rawAvailable === "number"
        ? rawAvailable
        : 0;
  const goal = 100000;
  const progressPct = Math.min(100, Math.max(0, Math.round((Math.max(0, totalRevenueValue) / goal) * 100)));
  const formattedProgress = totalRevenueValue >= 1000
    ? `R$ ${(totalRevenueValue / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`
    : brl(totalRevenueValue);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 border-r border-sidebar-border lg:block">
          <Sidebar />
        </aside>
        <Sheet open={mobile} onOpenChange={setMobile}>
          <SheetContent side="left" className="w-[270px] border-sidebar-border p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Sidebar onNav={() => setMobile(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-5 pb-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button aria-label="Abrir menu" onClick={() => setMobile(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden">
                <Menu className="h-4 w-4" />
              </button>
              <Link to="/" className="shrink-0 lg:hidden">
                <Logo variant="icon" size="sm" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-sm">
              <div className="hidden items-center rounded-xl border border-border/80 bg-background/60 px-2 py-1 sm:flex">
                <button
                  type="button"
                  className="flex items-center gap-1.5 pr-2 text-xs font-semibold text-foreground hover:opacity-80"
                >
                  <BrazilFlagIcon className="h-4 w-4" />
                  <span>BRL</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
                <span className="h-3.5 w-px bg-border" />
                <button
                  type="button"
                  className="flex items-center gap-1 pl-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Idioma (Português)"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <IconBtn label={hidden ? "Mostrar saldo" : "Ocultar saldo"} onClick={() => setHidden(!hidden)}>
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </IconBtn>
              <NtfyNotificationDialog
                trigger={
                  <button
                    aria-label="Notificações"
                    title="Configurar notificações no celular (ntfy)"
                    className="relative grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                }
              />
              {user ? (
                <Link
                  to="/auth"
                  title={`Conectado como ${user.email} — Ver conta`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-foreground transition-colors hover:bg-surface-2"
                >
                  <User className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <LogIn className="h-3.5 w-3.5" /> Entrar
                </Link>
              )}
              <div className="hidden pl-1.5 pr-1 text-right md:block">
                <p className="tabular text-xs font-bold text-foreground">
                  {hidden ? "••••" : formattedProgress}{" "}
                  <span className="text-foreground">/ R$100K</span>
                </p>
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </header>
          <main data-hidden={hidden} className="group/main flex-1 px-4 pb-8 sm:px-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
