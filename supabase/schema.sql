-- ==========================================
-- BOKASHIPAY - SCHEMA DO BANCO DE DADOS
-- Execute este script no SQL Editor do Supabase
-- https://supabase.com/dashboard/project/gnelpocqtzphzmmsouix/sql/new
-- ==========================================

-- 1. TABELA DE TRANSAÇÕES (ISOLADAS POR USUÁRIO)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT ('TX-' || FLOOR(RANDOM() * (9999 - 1000 + 1) + 1000)::TEXT),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Entrada', 'Saída')),
    date TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    value NUMERIC(14, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Concluído', 'Pendente', 'Em análise')) DEFAULT 'Concluído',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- 2. TABELA DE SALDOS POR MOEDA (OPCIONAL/DEMO)
CREATE TABLE IF NOT EXISTS public.currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    balance TEXT NOT NULL,
    share INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA DE MÉTRICAS FINANCEIRAS (OPCIONAL/DEMO)
CREATE TABLE IF NOT EXISTS public.financial_stats (
    key TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    value NUMERIC(14, 2) NOT NULL,
    "desc" TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('main', 'secondary')),
    formatted_value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY)
-- ==========================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_stats ENABLE ROW LEVEL SECURITY;

-- Transações: cada usuário só acessa e manipula seus próprios registros
DROP POLICY IF EXISTS "Permitir leitura anonima em transactions" ON public.transactions;
DROP POLICY IF EXISTS "Permitir insercao anonima em transactions" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem ver apenas suas transacoes" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem inserir suas proprias transacoes" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem atualizar suas transacoes" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem deletar suas transacoes" ON public.transactions;

CREATE POLICY "Usuarios podem ver apenas suas transacoes" 
ON public.transactions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem inserir suas proprias transacoes" 
ON public.transactions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios podem atualizar suas transacoes" 
ON public.transactions FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios podem deletar suas transacoes" 
ON public.transactions FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Permissões para moedas e métricas (leitura pública demonstrativa)
DROP POLICY IF EXISTS "Permitir leitura anonima em currencies" ON public.currencies;
CREATE POLICY "Permitir leitura anonima em currencies" 
ON public.currencies FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir leitura anonima em financial_stats" ON public.financial_stats;
CREATE POLICY "Permitir leitura anonima em financial_stats" 
ON public.financial_stats FOR SELECT 
TO anon, authenticated 
USING (true);
