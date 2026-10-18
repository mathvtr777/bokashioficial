import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  onSignupClick: () => void;
  onKnowMoreClick: () => void;
}

const rotatingWords = ['Hot', 'Black', 'White', 'Mentorias', 'SaaS', 'Infoprodutos', 'Cursos'];

export default function Hero({ onSignupClick, onKnowMoreClick }: HeroProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % rotatingWords.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="inicio" className="relative pt-24 md:pt-28 bg-white overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        {/* Hero Content - Centered */}
        <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-6 border border-primary/20">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            PLATAFORMA DE PAGAMENTOS PIX
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black leading-tight">
            Tudo o que você precisa para vender!
            <span className="inline-block ml-2 md:ml-3 relative align-baseline">
              <span
                key={wordIndex}
                className={`relative inline-block px-3 md:px-4 py-1 md:py-1.5 bg-primary text-white font-extrabold tracking-wide rounded-lg transition-all duration-300 ${
                  isAnimating ? 'opacity-0 -translate-y-3 scale-95' : 'opacity-100 translate-y-0 scale-100'
                }`}
              >
                {rotatingWords[wordIndex]}
              </span>
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Centralize cobranças, gere pagamentos Pix e acompanhe suas transações em uma única plataforma.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onSignupClick} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-semibold rounded-lg transition-all duration-200 hover:bg-primary-dark hover:shadow-2xl hover:-translate-y-0.5">
              Criar minha conta
              <ArrowRight size={18} />
            </button>
            <button onClick={onKnowMoreClick} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-text-primary font-medium rounded-lg border border-border transition-all duration-200 hover:bg-secondary">
              Conhecer a plataforma
            </button>
          </div>
        </div>

        {/* Dashboard Mockup */}
        <div className="relative max-w-5xl mx-auto">
          <div className="rounded-2xl shadow-2xl overflow-hidden border border-border bg-white">
            <img
              src="/dashboard-preview.png"
              alt="Dashboard BokashiPay - Visão Geral com Volume de Vendas, Transações Aprovadas, Volume Diário, Taxa de Conversão e Transações Recentes"
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* Trust indicators below */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 text-text-secondary text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Configuração simplificada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Gestão centralizada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Acompanhamento em tempo real</span>
          </div>
        </div>
      </div>
    </section>
  );
}
