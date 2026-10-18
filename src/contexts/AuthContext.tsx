import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  adminLoading: boolean;
  loading: boolean;
  isConfigured: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; isAdmin?: boolean }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    refCode?: string
  ) => Promise<{ error: Error | null; referralLinked?: boolean }>;
  signOut: () => Promise<void>;
  refreshAdminSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const refreshAdminSession = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/session", {
        method: "GET",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
      };
      const authenticated = Boolean(res.ok && data.authenticated);
      setIsAdmin(authenticated);
      return authenticated;
    } catch {
      setIsAdmin(false);
      return false;
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    void refreshAdminSession();

    const restoreLocalUser = (): User | null => {
      try {
        const raw = localStorage.getItem("bokashipay_local_user");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            id?: string;
            email?: string;
            name?: string;
          };
          if (parsed.id && parsed.email) {
            return {
              id: parsed.id,
              email: parsed.email,
              user_metadata: {
                full_name: parsed.name || parsed.email.split("@")[0],
                name: parsed.name || parsed.email.split("@")[0],
              },
              app_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            } as User;
          }
        }
      } catch {
        // ignore
      }
      return null;
    };

    try {
      localStorage.removeItem("bokashipay_tx_guest");
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlRef = params.get("ref");
        if (urlRef && urlRef.trim()) {
          localStorage.setItem(
            "bokashipay_ref_code",
            urlRef.trim().toUpperCase()
          );
        }
      }
    } catch {
      // ignore storage error
    }

    if (!isSupabaseConfigured) {
      const localU = restoreLocalUser();
      if (localU) setUser(localU);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
      } else {
        const localU = restoreLocalUser();
        if (localU) setUser(localU);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
      } else {
        const localU = restoreLocalUser();
        setUser(localU);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    const fullName =
      (user.user_metadata?.["full_name"] as string | undefined) ||
      (user.user_metadata?.["name"] as string | undefined) ||
      user.email?.split("@")[0] ||
      "Cliente";

    // 1. Always ensure this user's own AffiliateProfile is synced with their real name and email
    const query = new URLSearchParams({
      userId: user.id,
      name: fullName,
      ...(user.email ? { email: user.email } : {}),
    });
    void fetch(`/api/affiliates/me?${query.toString()}`).catch(() => {});

    // 2. If there is a pending referral code in localStorage, attempt to link it
    try {
      const refCode = localStorage.getItem("bokashipay_ref_code");
      if (refCode && refCode.trim()) {
        void fetch("/api/affiliates/register-referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refCode: refCode.trim().toUpperCase(),
            referredUserId: user.id,
            referredName: fullName,
            referredEmail: user.email,
          }),
        })
          .then((r) => r.json())
          .then((json: { data?: { referral?: unknown } }) => {
            if (json?.data?.referral) {
              localStorage.removeItem("bokashipay_ref_code");
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore storage error
    }
  }, [user]);

  const setAndPersistLocalUser = (id: string, email: string, name: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split("@")[0] || "Cliente";
    try {
      localStorage.setItem(
        "bokashipay_local_user",
        JSON.stringify({ id, email: cleanEmail, name: cleanName })
      );
    } catch {
      // ignore
    }
    setUser({
      id,
      email: cleanEmail,
      user_metadata: {
        full_name: cleanName,
        name: cleanName,
      },
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User);
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null; isAdmin?: boolean }> => {
    // 1. Check server-side cryptographic admin credentials first
    try {
      const adminRes = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (adminRes.ok) {
        const adminJson = (await adminRes.json().catch(() => ({}))) as {
          authenticated?: boolean;
        };
        if (adminJson.authenticated) {
          setIsAdmin(true);
          return { error: null, isAdmin: true };
        }
      }
    } catch {
      // Proceed to standard user login if admin check fails due to network
    }

    // 2. Standard Supabase user login
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error && data?.user) {
        const metaName =
          (data.user.user_metadata?.["full_name"] as string | undefined) ||
          data.user.email?.split("@")[0] ||
          "Cliente";
        setAndPersistLocalUser(data.user.id, data.user.email || email, metaName);
        return { error: null, isAdmin: false };
      }
    }

    // 3. Fallback to server-side registered account (/api/auth/login)
    try {
      const localRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (localRes.ok) {
        const localJson = (await localRes.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { userId?: string; name?: string; email?: string };
        };
        if (localJson.success && localJson.data?.userId) {
          setAndPersistLocalUser(
            localJson.data.userId,
            localJson.data.email || email,
            localJson.data.name || email.split("@")[0] || "Cliente"
          );
          return { error: null, isAdmin: false };
        }
      }
    } catch {
      // ignore
    }

    return {
      error: new Error("E-mail ou senha incorretos."),
      isAdmin: false,
    };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    refCode?: string
  ): Promise<{ error: Error | null; referralLinked?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || "").trim() || cleanEmail.split("@")[0] || "Cliente";
    let referralLinked = false;
    let resolvedUserId: string | undefined;

    // 1. Try client-side Supabase signUp first if configured
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
            },
          },
        });
        if (data?.user?.id) {
          resolvedUserId = data.user.id;
        }
      } catch {
        // fallback to server registration
      }
    }

    // 2. Register on our server (creates AffiliateProfile + links Referral immediately)
    try {
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resolvedUserId,
          name: cleanName,
          email: cleanEmail,
          password,
          refCode: refCode || undefined,
        }),
      });
      const regJson = (await regRes.json().catch(() => ({}))) as {
        success?: boolean;
        data?: {
          userId?: string;
          referral?: unknown;
        };
      };
      if (regJson?.data?.userId) {
        resolvedUserId = regJson.data.userId;
      }
      if (regJson?.data?.referral) {
        referralLinked = true;
      }
    } catch {
      // ignore
    }

    const finalId = resolvedUserId || `USR-${cleanEmail}`;
    setAndPersistLocalUser(finalId, cleanEmail, cleanName);

    return { error: null, referralLinked };
  };

  const signOut = async () => {
    try {
      localStorage.removeItem("bokashipay_local_user");
    } catch {
      // ignore
    }
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore network errors during logout
    }
    setIsAdmin(false);

    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        adminLoading,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        refreshAdminSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
