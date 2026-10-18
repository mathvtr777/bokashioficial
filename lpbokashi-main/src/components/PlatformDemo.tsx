import { useState } from 'react';
import { X, QrCode } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface DemoProps {
  isOpen: boolean;
  onClose: () => void;
}

const chartData = [
  { name: 'Seg', value: 4200 },
  { name: 'Ter', value: 3800 },
  { name: 'Qua', value: 5100 },
  { name: 'Qui', value: 4600 },
  { name: 'Sex', value: 6200 },
  { name: 'Sáb', value: 7800 },
  { name: 'Dom', value: 5400 },
];

const transactions = [
  { id: 'PIX #1287', amount: 320.00, status: 'completed', date: 'Hoje, 14:32' },
  { id: 'PIX #1286', amount: 89.90, status: 'pending', date: 'Hoje, 11:15' },
  { id: 'PIX #1285', amount: 156.50, status: 'completed', date: 'Ontem, 18:45' },
  { id: 'PIX #1284', amount: 234.00, status: 'completed', date: 'Ontem, 16:20' },
  { id: 'PIX #1283', amount: 450.00, status: 'completed', date: '02/01, 10:30' },
];

export default function PlatformDemo({ isOpen, onClose }: DemoProps) {
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixValue, setPixValue] = useState('');

  if (!isOpen) return null;

  const handleGeneratePix = () => {
    setShowPixModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">Demonstração da Plataforma</h3>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-73px)]">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="bg-gray-900 rounded-xl p-4 text-white">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold">B</span>
                </div>
                <span className="font-medium">BokashiPay</span>
              </div>
              <nav className="space-y-1">
                {['Dashboard', 'Cobranças', 'Pagamentos', 'Transações', 'Relatórios'].map((item, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      i === 0 ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {item}
                  </div>
                ))}
                <div className="pt-4 border-t border-gray-700 mt-4">
                  <div className="px-3 py-2 text-sm text-gray-400 hover:text-white cursor-pointer">Configurações</div>
                  <div className="px-3 py-2 text-sm text-gray-400 hover:text-white cursor-pointer">Sair</div>
                </div>
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-secondary rounded-xl p-4">
                  <span className="text-xs text-text-secondary">Saldo</span>
                  <div className="text-xl font-bold text-text-primary">R$ 12.458</div>
                </div>
                <div className="bg-secondary rounded-xl p-4">
                  <span className="text-xs text-text-secondary">Recebido (30d)</span>
                  <div className="text-xl font-bold text-primary">R$ 48.290</div>
                </div>
                <div className="bg-secondary rounded-xl p-4">
                  <span className="text-xs text-text-secondary">Transações</span>
                  <div className="text-xl font-bold text-text-primary">1.284</div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-secondary rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-text-primary">Vendas — últimos 7 dias</span>
                  <span className="text-sm font-semibold text-primary">+12,5%</span>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValueDemo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis hide />
                      <Area type="monotone" dataKey="value" stroke="#16A34A" strokeWidth={2} fill="url(#colorValueDemo)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transactions */}
              <div className="bg-secondary rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-text-primary">Transações recentes</span>
                  <button className="text-sm text-primary hover:underline">Ver todas</button>
                </div>
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.status === 'completed' ? 'bg-primary-bg' : 'bg-yellow-100'
                        }`}>
                          <QrCode size={14} className={tx.status === 'completed' ? 'text-primary' : 'text-yellow-600'} />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-text-primary">{tx.id}</span>
                          <span className="text-xs text-text-secondary ml-2">{tx.date}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-text-primary">
                        R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Pix Button */}
              <button onClick={handleGeneratePix} className="btn-primary w-full">
                <QrCode size={18} />
                Gerar Pix
              </button>
            </div>
          </div>
        </div>

        {/* Pix Modal */}
        {showPixModal && (
          <div className="absolute inset-0 bg-white flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-48 h-48 bg-gray-200 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <QrCode size={80} className="text-gray-400" />
              </div>
              <h4 className="text-xl font-semibold text-text-primary mb-2">Cobrança Pix gerada!</h4>
              <p className="text-text-secondary mb-4">
                Valor: <span className="font-semibold text-text-primary">R$ {pixValue || '100,00'}</span>
              </p>
              <div className="bg-primary-bg rounded-xl p-4 mb-6 text-sm text-primary">
                Esta é uma demonstração. Nenhuma cobrança real foi gerada.
              </div>
              <button
                onClick={() => {
                  setShowPixModal(false);
                  setPixValue('');
                }}
                className="btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
