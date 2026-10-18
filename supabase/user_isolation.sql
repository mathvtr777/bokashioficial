-- ====================================================================
-- BOKASHIPAY - ISOLAMENTO DE DADOS POR USUÁRIO (MULTI-TENANT / AUTH)
-- Execute no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gnelpocqtzphzmmsouix/sql/new
-- ====================================================================

-- 1. Adicionar coluna user_id na tabela transactions vinculada ao auth.users
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Limpar dados antigos de seed compartilhados para que novas contas comecem limpas
DELETE FROM public.transactions WHERE user_id IS NULL;

-- 3. Configurar índice para consultas rápidas por usuário
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- 4. Atualizar políticas de Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura anonima em transactions" ON public.transactions;
DROP POLICY IF EXISTS "Permitir insercao anonima em transactions" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem ver apenas suas transacoes" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem inserir suas proprias transacoes" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem atualizar suas transacoes" ON public.transactions;
DROP POLICY IF EXISTS "Usuarios podem deletar suas transacoes" ON public.transactions;

-- Usuários autenticados só visualizam suas próprias transações
CREATE POLICY "Usuarios podem ver apenas suas transacoes"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Usuários autenticados só podem inserir transações para si mesmos
CREATE POLICY "Usuarios podem inserir suas proprias transacoes"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Usuários autenticados podem atualizar suas próprias transações
CREATE POLICY "Usuarios podem atualizar suas transacoes"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Usuários autenticados podem deletar suas próprias transações
CREATE POLICY "Usuarios podem deletar suas transacoes"
ON public.transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

