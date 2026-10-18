import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ShieldAlert,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/bokashi/Logo";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    redirect?: string | undefined;
    ref?: string | undefined;
    tab?: "login" | "register" | undefined;
  } => ({
    redirect:
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    ref: typeof search["ref"] === "string" ? search["ref"] : undefined,
    tab:
      search["tab"] === "register" || search["tab"] === "login"
        ? search["tab"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar ou Criar Conta — BokashiPay" },
      { name: "description", content: "Acesse ou crie sua conta na plataforma BokashiPay." },
    ],
  }),
  component: () => <AuthPage />,
});

export function AuthPage({
  initialTab,
  searchParams,
}: {
  initialTab?: "login" | "register";
  searchParams?: { redirect?: string | undefined; ref?: string | undefined; tab?: "login" | "register" | undefined };
} = {}) {
  const { user, isAdmin, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();

  // Safely read search params from window if rendered outside /auth route
  const rawSearch =
    searchParams ??
    (typeof window !== "undefined"
      ? (() => {
          const sp = new URLSearchParams(window.location.search);
          const t = sp.get("tab");
          return {
            redirect: sp.get("redirect") || undefined,
            ref: sp.get("ref") || undefined,
            tab: t === "register" || t === "login" ? t : undefined,
          };
        })()
      : {});

  const redirect = rawSearch.redirect;
  const ref = rawSearch.ref;
  const tab = rawSearch.tab;
  const isAdminRedirect = redirect === "/admin" || (redirect?.startsWith("/admin") ?? false);

  const [activeTab, setActiveTab] = useState<string>(
    initialTab ?? tab ?? (ref ? "register" : "login")
  );
  const [savedRefCode, setSavedRefCode] = useState<string>(ref || "");
  const [referrerInfo, setReferrerInfo] = useState<{
    name: string;
    email: string;
    refCode: string;
  } | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (tab) {
      setActiveTab(tab);
    }
  }, [initialTab, tab]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (ref && ref.trim()) {
        const cleanRef = ref.trim().toUpperCase();
        localStorage.setItem("bokashipay_ref_code", cleanRef);
        setSavedRefCode(cleanRef);
        if (!isAdminRedirect && initialTab !== "login") {
          setActiveTab("register");
        }
      } else {
        const stored = localStorage.getItem("bokashipay_ref_code");
        if (stored) setSavedRefCode(stored);
      }
    }
  }, [ref, isAdminRedirect, initialTab]);

  useEffect(() => {
    if (!savedRefCode) {
      setReferrerInfo(null);
      return;
    }
    fetch(`/api/affiliates/referrer?ref=${encodeURIComponent(savedRefCode)}`)
      .then((r) => r.json())
      .then(
        (json: {
          success?: boolean;
          data?: {
            referrer?: { name: string; email: string; refCode: string } | null;
          };
        }) => {
          if (json?.data?.referrer) {
            setReferrerInfo(json.data.referrer);
          }
        }
      )
      .catch(() => {});
  }, [savedRefCode]);

  useEffect(() => {
    if (isAdminRedirect) {
      setActiveTab("login");
    }
  }, [isAdminRedirect]);

  useEffect(() => {
    if (isAdmin && isAdminRedirect) {
      navigate({ to: "/admin", replace: true });
    }
  }, [isAdmin, isAdminRedirect, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoginLoading(true);
    const { error, isAdmin: loggedInAsAdmin } = await signIn(loginEmail, loginPassword);
    setLoginLoading(false);

    if (loggedInAsAdmin) {
      toast.success("Acesso Administrativo liberado!", {
        description: "Bem-vindo ao Painel de Administração BokashiPay.",
      });
      navigate({ to: "/admin" });
      return;
    }

    if (isAdminRedirect) {
      toast.error("Acesso restrito ao Administrador", {
        description: "Apenas as credenciais de administrador da BokashiPay têm permissão para acessar /admin.",
      });
      return;
    }

    if (error) {
      toast.error("Falha no login", {
        description: error.message.includes("Invalid login credentials")
          ? "E-mail ou senha incorretos."
          : error.message,
      });
      return;
    }

    toast.success("Bem-vindo de volta!", {
      description: "Login efetuado com sucesso.",
    });
    navigate({ to: "/dashboard" });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword || !registerConfirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (registerPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    const effectiveRef = (ref || savedRefCode || "").trim().toUpperCase();

    setRegisterLoading(true);
    const { error, referralLinked } = await signUp(
      registerEmail.trim(),
      registerPassword,
      registerName.trim(),
      effectiveRef || undefined
    );
    setRegisterLoading(false);

    if (error) {
      toast.error("Erro ao criar conta", {
        description: error.message,
      });
      return;
    }

    if (effectiveRef) {
      try {
        localStorage.removeItem("bokashipay_ref_code");
      } catch {
        // ignore
      }
    }

    if (referralLinked || effectiveRef) {
      toast.success("Conta criada com sucesso pelo link de indicação!", {
        description: referrerInfo
          ? `Sua conta foi vinculada ao convite de ${referrerInfo.name}.`
          : `Indicação (${effectiveRef}) registrada com sucesso.`,
      });
    } else {
      toast.success("Conta criada com sucesso!", {
        description: "Seu painel e seu sistema de afiliados já estão ativos.",
      });
    }
    navigate({ to: "/dashboard" });
  };

  // Se já estiver logado e NÃO estiver abrindo um link de convite (?ref=...)
  if ((user || isAdmin) && !(isAdminRedirect && !isAdmin) && !ref) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
        <div className="mb-6">
          <Logo variant="stacked" size="lg" />
        </div>
        <div className="panel w-full max-w-md p-8 text-center shadow-lg">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold">Você já está conectado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? (
              <span className="font-semibold text-primary">Administrador BokashiPay</span>
            ) : (
              <>
                Autenticado como <span className="font-semibold text-foreground">{user?.email}</span>
              </>
            )}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {isAdmin && (
              <button
                onClick={() => navigate({ to: "/admin" })}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Ir para Área Admin <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="flex items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary-soft py-2.5 text-sm font-semibold text-primary hover:opacity-90"
            >
              Ir para o Painel Financeiro <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              Encerrar Sessão
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Logo variant="stacked" size="lg" />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {isAdminRedirect ? "Acesso Administrativo" : "Portal BokashiPay"}
        </h2>
        <p className="mt-1 text-center text-xs text-muted-foreground sm:text-sm">
          {isAdminRedirect
            ? "Insira o login e a senha de administrador para acessar a área restrita"
            : "Acesse sua conta ou crie uma nova para gerenciar seus pagamentos"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="panel p-6 shadow-xl sm:p-8">
          {isAdminRedirect && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs text-primary">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                Área restrita da <strong>BokashiPay</strong>. Autentique-se com suas credenciais de administrador.
              </span>
            </div>
          )}

          {!isAdminRedirect && savedRefCode && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3.5 py-2.5 text-xs text-primary">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 shrink-0" />
                <div>
                  <span className="block">
                    Convite de indicação aplicado:{" "}
                    <strong>{savedRefCode}</strong>
                  </span>
                  {referrerInfo && (
                    <span className="block text-[11px] text-muted-foreground">
                      Convidado por{" "}
                      <strong className="text-foreground">
                        {referrerInfo.name}
                      </strong>{" "}
                      ({referrerInfo.email})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="text-xs sm:text-sm font-semibold">
                Entrar
              </TabsTrigger>
              <TabsTrigger
                value="register"
                disabled={isAdminRedirect}
                className="text-xs sm:text-sm font-semibold"
              >
                Criar Conta
              </TabsTrigger>
            </TabsList>

            {/* ABA DE LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Senha</label>
                    {!isAdminRedirect && (
                      <button
                        type="button"
                        onClick={() =>
                          toast.info("Recuperação de senha", {
                            description: "Funcionalidade de redefinição disponível pelo painel Supabase.",
                          })
                        }
                        className="text-[11px] text-primary hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-surface pl-9 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loginLoading
                    ? "Verificando..."
                    : isAdminRedirect
                    ? "Acessar Painel Admin"
                    : "Acessar Plataforma"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </TabsContent>

            {/* ABA DE CADASTRO */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Ex: Matheus Vieira"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-surface pl-9 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Repita sua senha"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-input bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={registerLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {registerLoading ? "Criando Conta..." : "Criar Conta Gratuitamente"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground border-t border-border/60 pt-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>
              {isAdminRedirect
                ? "Verificação criptográfica exclusiva de Administrador"
                : "Autenticação segura BokashiPay"}
            </span>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
