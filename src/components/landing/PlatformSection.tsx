import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import PlatformDemo from './PlatformDemo';

export default function PlatformSection() {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <section id="demonstracao" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="section-title">Controle total da sua operação financeira.</h2>
          <p className="section-subtitle mx-auto">
            Tenha uma visão organizada das cobranças, dos pagamentos e do desempenho da sua operação sem precisar alternar entre diferentes ferramentas.
          </p>
        </div>

        {/* Demo Preview */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-border cursor-pointer group"
          onClick={() => setIsDemoOpen(true)}
        >
          <div className="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-md">Demonstração interativa</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold">B</span>
                    </div>
                    <span className="font-semibold text-text-primary">BokashiPay</span>
                  </div>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <span>Clique para explorar</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
                <div className="grid md:grid-cols-4 gap-4 mb-6">
                  {['Dashboard', 'Cobranças', 'Pagamentos', 'Transações'].map((item, i) => (
                    <div key={i} className="bg-secondary rounded-lg p-3 text-center text-sm text-text-secondary">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-primary-bg rounded-lg p-4">
                    <span className="text-xs text-primary">Saldo</span>
                    <div className="text-2xl font-bold text-primary">R$ 12.458</div>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <span className="text-xs text-text-secondary">Recebido</span>
                    <div className="text-2xl font-bold text-text-primary">R$ 48.290</div>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <span className="text-xs text-text-secondary">Transações</span>
                    <div className="text-2xl font-bold text-text-primary">1.284</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-text-secondary text-sm">
            Explore a demonstração interativa e conheça a interface da plataforma.
          </p>
        </div>
      </div>

      <PlatformDemo isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />
    </section>
  );
}
