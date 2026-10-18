import { Globe, Code, Bell, Zap } from 'lucide-react';

export default function Integration() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Content */}
          <div>
            <h2 className="section-title">Uma plataforma preparada para integrar sua operação.</h2>
            <p className="section-subtitle">
              Conecte seus fluxos de pagamento aos sistemas da sua empresa por meio de integrações disponíveis e recursos de API.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-bg rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">Aplicações web</h4>
                  <p className="text-sm text-text-secondary">Integre com seus sistemas web existentes</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-bg rounded-xl flex items-center justify-center flex-shrink-0">
                  <Code size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">API REST</h4>
                  <p className="text-sm text-text-secondary">Endpoints documentados para suas integrações</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-bg rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">Notificações em tempo real</h4>
                  <p className="text-sm text-text-secondary">Webhooks para atualizar o status das transações</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary-bg rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bell size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-text-primary">Automação de fluxos</h4>
                  <p className="text-sm text-text-secondary">Notificações automáticas para seus clientes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Code Example */}
          <div>
            <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-gray-800 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-4 text-xs text-gray-400">exemplo-api.js</span>
              </div>
              <pre className="p-4 text-sm overflow-x-auto">
                <code className="text-gray-300">{`// Exemplo ilustrativo de criação de cobrança
const response = await fetch(
  'https://api.bokashipay.com/v1/cobranca',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <seu_token>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valor: 15000, // em centavos
      descricao: 'Serviço de consultoria',
      calendario: {
        expiracao: 3600
      }
    })
  }
);

const data = await response.json();
// returns: { txid, loc, status }`}</code>
              </pre>
              <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  * Exemplo meramente ilustrativo. Endpoints e parâmetros reais devem ser consultadas na documentação oficial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
