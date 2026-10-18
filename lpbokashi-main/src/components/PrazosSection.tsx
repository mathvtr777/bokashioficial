interface PrazosMethod {
  name: string;
  subtitle: string;
  prazo: string;
  description: string;
  highlight?: boolean;
}

const methods: PrazosMethod[] = [
  {
    name: 'PIX',
    subtitle: 'na hora',
    prazo: '0 dia',
    description: 'Pagou, caiu. Saldo liberado na hora (D+0), sem esperar nenhuma fila.',
    highlight: true,
  },
  {
    name: 'BOLETO',
    subtitle: 'Bancário',
    prazo: '1 dia',
    description: 'Compensou, caiu. Sem espera de semanas.',
  },
  {
    name: 'CARTÃO',
    subtitle: 'de Crédito',
    prazo: '2 dias',
    description: 'Antecipação disponível para liberar antes.',
  },
];

export default function PrazosSection() {
  return (
    <section
      id="prazos"
      className="relative w-full overflow-hidden bg-[#0a0f0a] py-16 md:py-24"
    >
      {/* Glow verde central sutil */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34, 197, 94, 0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
          Prazos de recebimento
        </h2>
        <p className="mt-4 text-sm md:text-base text-white/60 max-w-2xl mx-auto leading-relaxed">
          No Pix o dinheiro <span className="text-primary font-semibold">cai na hora</span> — D+0,
          sem esperar nenhum dia. Vencer é ficar com o dinheiro parado na plataforma não é saudável.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {methods.map((method) => (
            <div
              key={method.name}
              className="relative rounded-2xl bg-[#0d1410] border border-white/10 p-7 text-left overflow-hidden"
            >
              {/* Linha verde no topo para PIX (highlight) */}
              {method.highlight && (
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, #22c55e 50%, transparent 100%)',
                  }}
                />
              )}

              {/* Cabeçalho: nome + badge "na hora" para PIX */}
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-2xl font-extrabold text-white tracking-wide">
                  {method.name}
                </h3>
                {method.highlight && (
                  <span className="px-2.5 py-0.5 rounded-md bg-primary text-white text-[10px] font-bold tracking-widest uppercase">
                    na hora
                  </span>
                )}
              </div>
              <p className="text-white/50 text-xs tracking-widest uppercase -mt-4 mb-4">
                {method.subtitle}
              </p>

              {/* Label + valor */}
              <p className="text-[10px] tracking-widest text-white/40 uppercase mb-2">
                Prazo de recebimento
              </p>
              <p
                className="text-3xl md:text-4xl font-extrabold mb-5"
                style={{
                  color: '#22c55e',
                }}
              >
                {method.prazo}
              </p>

              {/* Descrição */}
              <p className="text-sm text-white/60 leading-relaxed">
                {method.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
