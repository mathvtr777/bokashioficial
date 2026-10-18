import { ArrowRight, Check } from 'lucide-react';

interface CTASectionProps {
  onSignupClick: () => void;
  onKnowMoreClick: () => void;
}

const benefits = [
  'Gestão de cobranças',
  'Acompanhamento de transações',
  'Dashboard financeira',
  'Links de pagamento',
  'Recursos de integração, quando disponíveis',
  'Interface acessível em diferentes dispositivos',
];

export default function CTASection({ onSignupClick, onKnowMoreClick }: CTASectionProps) {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-primary to-primary-dark text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
          Pronto para simplificar sua operação financeira?
        </h2>
        <p className="mt-6 text-lg text-white/90 max-w-2xl mx-auto">
          Centralize suas cobranças, acompanhe seus pagamentos Pix e tenha mais controle sobre sua operação com o BokashiPay.
        </p>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4 max-w-xl mx-auto text-left">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2">
              <Check size={18} className="text-primary-light flex-shrink-0" />
              <span className="text-sm text-white/90">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={onSignupClick} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary font-semibold rounded-lg transition-all duration-200 hover:bg-gray-100 hover:shadow-xl hover:-translate-y-0.5">
            Criar minha conta
            <ArrowRight size={18} />
          </button>
          <button onClick={onKnowMoreClick} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white font-medium rounded-lg border border-white/30 transition-all duration-200 hover:bg-white/20">
            Conhecer a plataforma
          </button>
        </div>

        <p className="mt-8 text-sm text-white/60">
          Consulte as condições de utilização e as tarifas aplicáveis.
        </p>
      </div>
    </section>
  );
}
