import { UserPlus, QrCode, CheckCircle } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Crie sua conta',
    description: 'Cadastre seus dados e configure seu acesso à plataforma seguindo as etapas de registro e verificação aplicáveis.',
  },
  {
    number: '02',
    icon: QrCode,
    title: 'Gere sua cobrança',
    description: 'Informe o valor, gere sua cobrança Pix e disponibilize as informações de pagamento ao seu cliente.',
  },
  {
    number: '03',
    icon: CheckCircle,
    title: 'Acompanhe o pagamento',
    description: 'Consulte o status da transação e acompanhe as movimentações diretamente na dashboard.',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20 md:py-28 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="section-title">Comece a receber com mais organização.</h2>
          <p className="section-subtitle mx-auto">
            Um fluxo simples para gerar cobranças e acompanhar seus pagamentos.
          </p>
        </div>

        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden md:block absolute top-24 left-1/2 -translate-x-1/2 w-2/3 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20"></div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-border hover:shadow-lg transition-shadow duration-300">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {step.number}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="mt-6 mb-6">
                    <div className="w-20 h-20 bg-primary-bg rounded-2xl mx-auto flex items-center justify-center">
                      <step.icon size={36} className="text-primary" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-text-primary mb-3">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
