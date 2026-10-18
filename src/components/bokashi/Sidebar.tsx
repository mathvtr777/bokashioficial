import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, HelpCircle, LogIn, LogOut, Settings, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { groups, mainNav, otherNav, type NavLeaf } from "./nav";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

function Item({ leaf, active, onNav }: { leaf: NavLeaf; active: boolean; onNav?: (() => void) | undefined }) {
  const Icon = leaf.icon;
  if (leaf.slug) {
    return (
      <Link
        to="/$section"
        params={{ section: leaf.slug }}
        onClick={onNav}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-surface-2 hover:text-foreground",
        )}
      >
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.75} />}
        <span className="truncate">{leaf.title}</span>
      </Link>
    );
  }

  return (
    <Link
      to="/dashboard"
      onClick={onNav}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.75} />}
      <span className="truncate">{leaf.title}</span>
    </Link>
  );
}

export function Sidebar({ onNav }: { onNav?: (() => void) | undefined }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (slug: string) => (slug ? path === `/${slug}` : path === "/dashboard");
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.title, g.title === "Financeiro" || g.children.some((c) => isActive(c.slug))])),
  );

  const { user, isAdmin, signOut } = useAuth();

  const getInitials = () => {
    if (isAdmin) return "AD";
    if (!user) return "BP";
    const name = String(user.user_metadata?.["full_name"] || user.email || "");
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = isAdmin
    ? "Admin BokashiPay"
    : user
    ? String(user.user_metadata?.["full_name"] || user.email?.split("@")[0] || "Usuário")
    : "Visitante";

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="px-5 pt-5 pb-4">
        <Link to="/" onClick={onNav} className="inline-flex items-center focus:outline-none">
          <Logo />
        </Link>
      </div>

      <div className="mx-4 mb-4 rounded-lg border border-sidebar-border bg-surface p-2.5">
        {user || isAdmin ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary-soft font-display text-xs font-bold text-primary">
                {getInitials()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {isAdmin ? "Acesso Master" : user?.email}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                title="Encerrar sessão"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={onNav}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary/15 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Área Admin
              </Link>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary-soft font-display text-xs font-bold text-primary">MV</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">mathvtr2</p>
              <p className="truncate text-xs text-muted-foreground">Conta verificada</p>
            </div>
            <Link
              to="/auth"
              onClick={onNav}
              className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <LogIn className="h-3 w-3" /> Entrar
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {mainNav.map((l) => <Item key={l.title} leaf={l} active={isActive(l.slug)} onNav={onNav} />)}

        {groups.map((g) => {
          const o = open[g.title];
          const hasActive = g.children.some((c) => isActive(c.slug));
          return (
            <div key={g.title}>
              <button
                onClick={() => setOpen((s) => ({ ...s, [g.title]: !s[g.title] }))}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2",
                  hasActive ? "text-foreground" : "text-sidebar-foreground/80")}
              >
                <g.icon className={cn("h-4 w-4", hasActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} />
                <span className="flex-1 text-left">{g.title}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", o && "rotate-180")} />
              </button>
              <div className={cn("grid transition-all duration-200", o ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                    {g.children.map((c) => (
                      <Link
                        key={c.slug}
                        to="/$section"
                        params={{ section: c.slug }}
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            if (c.slug === "enviar") {
                              window.dispatchEvent(new CustomEvent("bokashi:open-transfer"));
                            } else if (c.slug === "receber") {
                              window.dispatchEvent(new CustomEvent("bokashi:open-receive"));
                            }
                          }
                          onNav?.();
                        }}
                        className={cn("relative block rounded-md px-2 py-1.5 text-[13px] transition-colors",
                          isActive(c.slug) ? "bg-sidebar-accent text-foreground before:absolute before:-left-[13px] before:top-1 before:bottom-1 before:w-0.5 before:rounded before:bg-primary"
                            : "text-muted-foreground hover:text-foreground")}>
                        {c.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="my-3 h-px bg-sidebar-border" />
        {otherNav.map((l) => <Item key={l.title} leaf={l} active={isActive(l.slug)} onNav={onNav} />)}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        <Item leaf={{ title: "Notificações", slug: "notificacoes", icon: Bell }} active={isActive("notificacoes")} onNav={onNav} />
        <Item leaf={{ title: "Central de ajuda", slug: "ajuda", icon: HelpCircle }} active={isActive("ajuda")} onNav={onNav} />
        <Item leaf={{ title: "Configurações", slug: "configuracoes", icon: Settings }} active={isActive("configuracoes")} onNav={onNav} />
      </div>
    </div>
  );
}

