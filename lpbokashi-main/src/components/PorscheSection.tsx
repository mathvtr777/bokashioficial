const PorscheSection = () => {
  return (
    <section
      id="velocidade"
      className="relative w-full overflow-hidden bg-[#0a0f0a] text-white"
    >
      {/* Faixa de gradiente SUTIL no topo: branco (Hero) esmaecendo para #0a0f0a */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-24 md:h-32 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, #ffffff 0%, #ffffff 40%, rgba(10,15,10,0) 100%)',
        }}
      />

      {/* Glow verde central sutil */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% 30%, rgba(34, 197, 94, 0.10) 0%, transparent 60%)',
        }}
      />
      {/* Vinheta nas laterais em verde */}
      <div
        aria-hidden
        className="absolute -left-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.18) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute -right-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-4 pt-24 md:pt-32 pb-20 md:pb-28 text-center">
        {/* Logo / badge superior */}
        <div className="inline-flex items-center gap-2 mb-6">
          <img
            src="/logo-bokashipay.png"
            alt="BokashiPay"
            className="h-10 md:h-12 w-auto"
          />
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
          Saque tão rápido quanto{' '}
          <span className="text-primary">uma porshe</span>.
        </h2>

        {/* Subcopy */}
        <p className="mt-5 text-base md:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
          Na BokashiPay, seu dinheiro chega na velocidade que sua operação merece.
          <br className="hidden sm:block" />
          Saque rápido, liquidez real e sem burocracia.
        </p>

        {/* Grid de imagens de Porsche (placeholders) */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {/* Imagem 1 - Pista */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group">
            <img
              src="/porsche-track.jpg"
              alt="Porsche BokashiPay na pista"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)',
              }}
            />
          </div>

          {/* Imagem 2 - Estúdio */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group">
            <img
              src="/porsche-studio.jpg"
              alt="Porsche BokashiPay no estúdio"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PorscheSection;
