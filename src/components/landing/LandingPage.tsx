import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "./Navbar";
import Hero from "./Hero";
import PorscheSection from "./PorscheSection";
import PrazosSection from "./PrazosSection";
import AwardsSection from "./AwardsSection";
import Stats from "./Stats";
import MovimentacaoSection from "./MovimentacaoSection";
import NoKycSection from "./NoKycSection";
import Features from "./Features";
import PlatformSection from "./PlatformSection";
import HowItWorks from "./HowItWorks";
import Security from "./Security";
import Integration from "./Integration";
import FAQ from "./FAQ";
import CTASection from "./CTASection";
import Footer from "./Footer";

export function LandingPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const handleLogin = () => {
    navigate({ to: "/login" });
  };

  const handleSignup = () => {
    const savedRef =
      typeof window !== "undefined"
        ? localStorage.getItem("bokashipay_ref_code") || undefined
        : undefined;
    navigate({ to: "/cadastro", search: savedRef ? { ref: savedRef } : {} });
  };

  const handleDashboard = () => {
    if (isAdmin) {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  const handleKnowMoreClick = () => {
    const element =
      document.getElementById("demonstracao") ||
      document.getElementById("recursos");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="landing-theme min-h-screen bg-white text-text-primary">
      <Navbar
        onLoginClick={handleLogin}
        onSignupClick={handleSignup}
        isAuthenticated={Boolean(user || isAdmin)}
        onDashboardClick={handleDashboard}
      />
      <main>
        <Hero
          onSignupClick={handleSignup}
          onKnowMoreClick={handleKnowMoreClick}
        />
        <PorscheSection />
        <PrazosSection />
        <AwardsSection />
        <Stats />
        <MovimentacaoSection />
        <NoKycSection onSignupClick={handleSignup} />
        <Features />
        <PlatformSection />
        <HowItWorks />
        <Security />
        <Integration />
        <FAQ />
        <CTASection
          onSignupClick={handleSignup}
          onKnowMoreClick={handleKnowMoreClick}
        />
      </main>
      <Footer />
    </div>
  );
}

