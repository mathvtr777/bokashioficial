import { useEffect, useState, useRef } from 'react';
import { TrendingUp, Zap, Shield, Wallet } from 'lucide-react';

interface CounterProps {
  end: number;
  suffix?: string | undefined;
  prefix?: string | undefined;
  duration?: number | undefined;
  decimals?: number | undefined;
}

function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000, decimals = 0 }: CounterProps) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else setValue(end);
    };
    requestAnimationFrame(tick);
  }, [hasStarted, end, duration]);

  const display = value.toFixed(decimals);
  // Formatação brasileira: pontos para milhar, vírgula para decimal
  const formatted = decimals > 0
    ? display.replace('.', ',')
    : display.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return (
    <div ref={ref}>
      {prefix}{formatted}{suffix}
    </div>
  );
}

interface MetricCard {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

const metrics: MetricCard[] = [
  {
    value: 10,
    suffix: 'M+',
    prefix: 'R$ ',
    label: 'movimentados',
    sublabel: 'em pagamentos processados',
    icon: <Wallet size={20} />,
    highlight: true,
  },
  {
    value: 50,
    suffix: 'K+',
    label: 'transações/dia',
    sublabel: 'pico de operações simultâneas',
    icon: <TrendingUp size={20} />,
  },
  {
    value: 0.3,
    decimals: 1,
    suffix: 's',
    label: 'tempo médio',
    sublabel: 'do clique ao Pix na conta',
    icon: <Zap size={20} />,
  },
  {
    value: 99.9,
    decimals: 1,
    suffix: '%',
    label: 'uptime',
    sublabel: 'disponibilidade da plataforma',
    icon: <Shield size={20} />,
  },
];

export default function MovimentacaoSection() {
  return (
    <section
      id="movimentacao"
      className="relative w-full overflow-hidden bg-[#0a0f0a] py-16 md:py-24"
    >
      {/* Glow verde de fundo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(34, 197, 94, 0.10) 0%, transparent 65%)',
        }}
      />
      {/* Vinheta lateral verde */}
      <div
        aria-hidden
        className="absolute -left-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.20) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute -right-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-4">
        {/* Cabeçalho */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full mb-4 border border-primary/20 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Em produção agora
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
            Mais de <span className="text-primary">R$ 10 milhões</span> já processados
          </h2>
          <p className="mt-4 text-sm md:text-base text-white/60 max-w-2xl mx-auto leading-relaxed">
            Números reais de uma plataforma que roda 24/7 processando pagamentos de verdade.
          </p>
        </div>

        {/* Grid de métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {metrics.map((m, i) => (
            <div
              key={i}
              className={`
                relative rounded-2xl p-6 overflow-hidden transition-all duration-300
                ${m.highlight
                  ? 'bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30'
                  : 'bg-[#0d1410] border border-white/10'
                }
              `}
            >
              {m.highlight && (
                <div
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, #22c55e 50%, transparent 100%)',
                  }}
                />
              )}

              <div
                className={`
                  w-10 h-10 rounded-xl flex items-center justify-center mb-4
                  ${m.highlight ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/60'}
                `}
              >
                {m.icon}
              </div>

              <div
                className={`
                  text-3xl md:text-4xl font-extrabold tracking-tight mb-2
                  ${m.highlight ? 'text-primary' : 'text-white'}
                `}
              >
                <AnimatedCounter
                  end={m.value}
                  prefix={m.prefix}
                  suffix={m.suffix}
                  decimals={m.decimals ?? 0}
                />
              </div>

              <p className="text-sm font-semibold text-white">{m.label}</p>
              <p className="text-xs text-white/50 mt-1">{m.sublabel}</p>
            </div>
          ))}
        </div>

        {/* Faixa inferior com "ao vivo" */}
        <div className="mt-10 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span>Última atualização: agora</span>
          </div>
          <span className="hidden sm:inline">·</span>
          <span>Dados consolidados em tempo real</span>
        </div>
      </div>
    </section>
  );
}
