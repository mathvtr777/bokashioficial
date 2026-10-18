import { useState, useEffect } from 'react';
import { Menu, X, ArrowRight } from 'lucide-react';

interface NavbarProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
}

export default function Navbar({ onLoginClick, onSignupClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <>
      {/* Desktop: Pill-style floating navbar */}
      <div className="fixed top-4 md:top-6 left-0 right-0 z-50 px-4 hidden md:flex justify-center pointer-events-none">
        <nav
          className={`pointer-events-auto flex items-center justify-between gap-8 px-4 py-2 rounded-full transition-all duration-300 ${
            isScrolled
              ? 'bg-white/95 backdrop-blur-md border border-border shadow-2xl'
              : 'bg-white/80 backdrop-blur-md border border-border shadow-xl'
          }`}
        >
          {/* Logo */}
          <a href="#" className="flex items-center pl-2">
            <img
              src="/logo-bokashipay.png"
              alt="BokashiPay"
              className="h-16 w-auto"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="flex items-center gap-7">
            <button onClick={() => scrollToSection('inicio')} className="text-text-secondary hover:text-primary transition-colors text-sm font-medium">
              Início
            </button>
            <button onClick={() => scrollToSection('recursos')} className="text-text-secondary hover:text-primary transition-colors text-sm font-medium">
              Recursos
            </button>
            <button onClick={() => scrollToSection('como-funciona')} className="text-text-secondary hover:text-primary transition-colors text-sm font-medium">
              Como funciona
            </button>
            <button onClick={() => scrollToSection('seguranca')} className="text-text-secondary hover:text-primary transition-colors text-sm font-medium">
              Segurança
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-text-secondary hover:text-primary transition-colors text-sm font-medium">
              FAQ
            </button>
          </div>

          {/* Desktop Buttons */}
          <div className="flex items-center gap-3 pr-1">
            <button onClick={onLoginClick} className="text-text-secondary hover:text-primary transition-colors font-medium text-sm px-3">
              Entrar
            </button>
            <button
              onClick={onSignupClick}
              className="group relative inline-flex items-center gap-2 pl-3 pr-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-full overflow-hidden transition-all duration-300 hover:bg-primary-dark hover:-translate-y-0.5"
            >
              <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={14} className="text-white" />
              </span>
              <span>Criar conta</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile: simple navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#" className="flex items-center">
              <img
                src="/logo-bokashipay.png"
                alt="BokashiPay"
                className="h-9 w-auto"
              />
            </a>

            {/* Mobile Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onLoginClick}
                className="text-text-secondary hover:text-primary transition-colors font-medium text-sm px-3 py-1.5"
              >
                Entrar
              </button>
              <button
                onClick={onSignupClick}
                className="inline-flex items-center gap-1.5 pl-2 pr-3 py-1.5 bg-primary text-white font-semibold text-sm rounded-full"
              >
                <span className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full">
                  <ArrowRight size={12} className="text-white" />
                </span>
                Criar conta
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 text-text-secondary hover:text-primary transition-colors"
                aria-label="Menu"
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="bg-white border-t border-border">
            <div className="px-4 py-4 space-y-2">
              <button onClick={() => scrollToSection('inicio')} className="block w-full text-left px-4 py-2.5 text-text-secondary hover:text-primary hover:bg-secondary rounded-lg transition-colors">Início</button>
              <button onClick={() => scrollToSection('recursos')} className="block w-full text-left px-4 py-2.5 text-text-secondary hover:text-primary hover:bg-secondary rounded-lg transition-colors">Recursos</button>
              <button onClick={() => scrollToSection('como-funciona')} className="block w-full text-left px-4 py-2.5 text-text-secondary hover:text-primary hover:bg-secondary rounded-lg transition-colors">Como funciona</button>
              <button onClick={() => scrollToSection('seguranca')} className="block w-full text-left px-4 py-2.5 text-text-secondary hover:text-primary hover:bg-secondary rounded-lg transition-colors">Segurança</button>
              <button onClick={() => scrollToSection('faq')} className="block w-full text-left px-4 py-2.5 text-text-secondary hover:text-primary hover:bg-secondary rounded-lg transition-colors">FAQ</button>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
