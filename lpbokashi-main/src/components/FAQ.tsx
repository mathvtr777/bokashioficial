import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Como funciona o BokashiPay?',
    answer: 'O BokashiPay é uma plataforma para centralizar a gestão de cobranças, pagamentos Pix e informações financeiras em uma única interface. Os recursos disponíveis dependem da configuração da conta e das integrações habilitadas.',
  },
  {
    question: 'Preciso passar por análise de crédito?',
    answer: 'A utilização da plataforma e o acesso aos recursos podem depender de procedimentos de cadastro, validação de identidade e requisitos do provedor de pagamentos. Consulte as condições aplicáveis ao seu perfil.',
  },
  {
    question: 'Quanto tempo leva para receber o Pix?',
    answer: 'O tempo de confirmação e disponibilidade dos valores depende do fluxo de processamento, do provedor de pagamentos e das condições aplicáveis à transação.',
  },
  {
    question: 'Quais são as taxas cobradas?',
    answer: 'As tarifas aplicáveis devem ser consultadas na tabela comercial vigente ou nas condições apresentadas durante o cadastro.',
  },
  {
    question: 'Posso criar links de pagamento personalizados?',
    answer: 'Os links de pagamento permitem compartilhar cobranças com clientes quando esse recurso estiver habilitado na sua conta.',
  },
  {
    question: 'Como funciona o painel administrativo?',
    answer: 'O painel administrativo centraliza as funções de gestão disponíveis para cada perfil autorizado.',
  },
  {
    question: 'Meus dados estão seguros?',
    answer: 'A plataforma deve aplicar medidas técnicas e organizacionais adequadas para proteger os dados e controlar o acesso às informações.',
  },
  {
    question: 'Posso integrar via API?',
    answer: 'A integração via API depende da disponibilidade, documentação e permissões dos recursos de integração habilitados.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28 bg-secondary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title">Perguntas frequentes.</h2>
          <p className="section-subtitle mx-auto">
            Encontre respostas para as principais dúvidas sobre o BokashiPay.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-border overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                aria-expanded={openIndex === index}
              >
                <span className="font-medium text-text-primary pr-4">{faq.question}</span>
                <ChevronDown
                  size={20}
                  className={`text-text-secondary flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <p className="px-5 pb-5 text-text-secondary text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
