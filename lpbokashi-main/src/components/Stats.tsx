const stats = [
  { value: 'Pix', label: 'Pagamentos instantâneos' },
  { value: '100%', label: 'Controle centralizado' },
  { value: '24/7', label: 'Acesso disponível' },
  { value: '∞', label: 'Histórico de transações' },
];

export default function Stats() {
  return (
    <section className="py-12 md:py-16 bg-white border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</span>
              </div>
              <p className="text-sm text-text-secondary">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
