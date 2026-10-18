import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Stats from './components/Stats';
import MovimentacaoSection from './components/MovimentacaoSection';
import NoKycSection from './components/NoKycSection';
import Features from './components/Features';
import PlatformSection from './components/PlatformSection';
import PorscheSection from './components/PorscheSection';
import PrazosSection from './components/PrazosSection';
import AwardsSection from './components/AwardsSection';
import HowItWorks from './components/HowItWorks';
import Security from './components/Security';
import Integration from './components/Integration';
import FAQ from './components/FAQ';
import CTASection from './components/CTASection';
import Footer from './components/Footer';

function App() {
  const handleLoginClick = () => {
    window.location.href = '/login';
  };

  const handleSignupClick = () => {
    window.location.href = '/cadastro';
  };

  const handleKnowMoreClick = () => {
    const element = document.getElementById('demonstracao');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar onLoginClick={handleLoginClick} onSignupClick={handleSignupClick} />
      <main>
        <Hero onSignupClick={handleSignupClick} onKnowMoreClick={handleKnowMoreClick} />
        <PorscheSection />
        <PrazosSection />
        <AwardsSection />
        <Stats />
        <MovimentacaoSection />
        <NoKycSection />
        <Features />
        <PlatformSection />
        <HowItWorks />
        <Security />
        <Integration />
        <FAQ />
        <CTASection onSignupClick={handleSignupClick} onKnowMoreClick={handleKnowMoreClick} />
      </main>
      <Footer />
    </div>
  );
}

export default App;
