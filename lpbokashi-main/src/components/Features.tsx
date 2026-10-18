import { CreditCard, Link, ShoppingCart, BarChart3, History, PanelsTopLeft, Code2, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: CreditCard,
    title: 'Pix rápido',
    description: 'Gere cobranças Pix informando o valor desejado e acompanhe o status do pagamento diretamente na plataforma.',
  },
  {
    icon: Link,
    title: 'Links de pagamento',
    description: 'Crie links de cobrança para compartilhar com seus clientes de maneira simples e organizada.',
  },
  {
    icon: ShoppingCart,
    title: 'Checkout',
    description: 'Disponibilize uma experiência de pagamento organizada para seus produtos e serviços.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard financeira',
    description: 'Visualize indicadores, valores recebidos e movimentações para acompanhar sua operação.',
  },
  {
    icon: History,
    title: 'Histórico completo',
    description: 'Consulte suas transações, valores, datas e informações disponíveis sobre cada movimentação.',
  },
  {
    icon: PanelsTopLeft,
    title: 'Painel administrativo',
    description: 'Centralize os recursos administrativos e acompanhe a operação de acordo com suas permissões de acesso.',
  },
  {
    icon: Code2,
    title: 'API e integrações',
    description: 'Prepare sua operação para integrar sistemas externos por meio de uma API documentada, conforme os recursos disponíveis.',
  },
  {
    icon: ShieldCheck,
    title: 'Segurança',
    description: 'Utilize controles de acesso, validação de pagamentos e registros de eventos para proteger a operação.',
  },
];

export default function Features() {
  return (
    <section id="recursos" className="py-20 md:py-28 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="section-title">Tudo que você precisa para gerenciar seus pagamentos.</h2>
          <p className="section-subtitle mx-auto">
            Ferramentas para organizar cobranças, acompanhar vendas e controlar sua operação financeira em uma única plataforma.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl p-6 border border-border hover:shadow-lg hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-primary-bg rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <feature.icon size={24} className="text-primary group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
