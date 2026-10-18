import { Lock, Shield, CheckCircle, FileText, Server, Key } from 'lucide-react';

const securityFeatures = [
  {
    icon: Lock,
    title: 'Autenticação e controle de acesso',
    description: 'Organize o acesso à plataforma com mecanismos de autenticação e permissões adequadas.',
  },
  {
    icon: Shield,
    title: 'Proteção de dados',
    description: 'Adote práticas de segurança para proteger informações armazenadas e transmitidas.',
  },
  {
    icon: CheckCircle,
    title: 'Validação de pagamentos',
    description: 'Utilize mecanismos de validação de eventos e notificações para verificar atualizações de transações.',
  },
  {
    icon: FileText,
    title: 'Rastreabilidade',
    description: 'Mantenha registros de eventos relevantes para facilitar o acompanhamento e a análise de operações.',
  },
  {
    icon: Server,
    title: 'Infraestrutura',
    description: 'Estruture a aplicação para monitoramento, recuperação de falhas e continuidade operacional.',
  },
];

const badges = [
  { icon: Key, label: 'Conexão segura' },
  { icon: Shield, label: 'Dados protegidos' },
  { icon: Lock, label: 'Privacidade' },
  { icon: CheckCircle, label: 'Controle de acesso' },
];

export default function Security() {
  return (
    <section id="seguranca" className="py-20 md:py-28 bg-primary-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="section-title">Segurança em cada etapa da sua operação.</h2>
          <p className="section-subtitle mx-auto">
            A proteção das informações e a integridade das transações são partes essenciais de uma plataforma de pagamentos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow duration-300"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <feature.icon size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Security Badges */}
        <div className="mt-12 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {badges.map((badge, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-bg rounded-full flex items-center justify-center">
                  <badge.icon size={18} className="text-primary" />
                </div>
                <span className="text-sm font-medium text-text-primary">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
