import { ShieldOff, CheckCircle2, Clock, FileCheck } from 'lucide-react';

const benefits = [
  {
    icon: <Clock size={18} />,
    title: 'Cadastro em minutos',
    text: 'Crie sua conta e comece a vender no mesmo dia, sem fila de aprovação.',
  },
  {
    icon: <FileCheck size={18} />,
    title: 'Documento simples',
    text: 'Só o básico: CPF/CNPJ e uma conta bancária. Nada de selfie 3D.',
  },
  {
    icon: <ShieldOff size={18} />,
    title: 'Sem análise demorar',
    text: 'Sem aguardar análise de crédito, sem travas burocráticas.',
  },
];

export default function NoKycSection({ onSignupClick }: { onSignupClick?: () => void }) {
  return (
    <section
      id="sem-kyc"
      className="relative w-full overflow-hidden bg-[#0a0f0a] py-16 md:py-24"
    >
      {/* Glow verde central */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34, 197, 94, 0.10) 0%, transparent 65%)',
        }}
      />
      <div
        aria-hidden
        className="absolute -left-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.18) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute -right-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.13) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Lado esquerdo: copy */}
          <div>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full mb-5 border border-primary/20 tracking-widest uppercase">
              <CheckCircle2 size={14} />
              Zero burocracia
            </span>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Você <span className="text-primary">não precisa</span> de KYC para começar.
            </h2>

            <p className="mt-5 text-base md:text-lg text-white/65 leading-relaxed max-w-xl">
              Na BokashiPay a entrada é simples. Sem análise demorada, sem upload de documentos
              infinitos, sem esperar aprovação pra começar a vender. Cadastra, integra e recebe.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              {onSignupClick ? (
                <button
                  type="button"
                  onClick={onSignupClick}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-full transition-all duration-200 hover:bg-primary-dark hover:shadow-2xl hover:-translate-y-0.5"
                >
                  Criar conta agora
                </button>
              ) : (
                <a
                  href="/cadastro"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary text-white font-semibold rounded-full transition-all duration-200 hover:bg-primary-dark hover:shadow-2xl hover:-translate-y-0.5"
                >
                  Criar conta agora
                </a>
              )}
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/5 text-white font-medium rounded-full border border-white/15 transition-all duration-200 hover:bg-white/10"
              >
                Ver como funciona
              </a>
            </div>
          </div>

          {/* Lado direito: cards de benefícios */}
          <div className="space-y-4">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="group flex items-start gap-4 p-5 rounded-2xl bg-[#0d1410] border border-white/10 transition-all duration-300 hover:border-primary/40 hover:bg-[#0f1812]"
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  {b.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{b.title}</h3>
                  <p className="text-sm text-white/55 leading-relaxed">{b.text}</p>
                </div>
              </div>
            ))}

            {/* Faixa de comparação */}
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-primary flex-shrink-0" />
              <p className="text-sm text-white/80">
                <span className="text-primary font-semibold">100% conforme</span> com regulação do Banco Central.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
