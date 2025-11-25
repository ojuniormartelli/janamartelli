import { createClient } from '@supabase/supabase-js';

// Configuração via variáveis de ambiente para segurança
// Adiciona verificação de segurança para import.meta.env
const env = (import.meta as any).env || {};

// Valores de fallback para evitar crash na inicialização se as env vars não existirem
// Isso permite que a UI carregue para que você possa ver o modal de SQL, mesmo sem conexão
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);