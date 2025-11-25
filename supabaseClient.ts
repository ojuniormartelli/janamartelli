import { createClient } from '@supabase/supabase-js';

// Função auxiliar para obter variáveis de ambiente de forma segura em diferentes ambientes (Vite, Webpack, etc)
const getEnv = (key: string) => {
  try {
    // Tenta import.meta.env (Vite standard)
    // Fix: Cast import.meta to any to avoid "Property 'env' does not exist on type 'ImportMeta'"
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch (e) {
    // Ignora erros de acesso ao import.meta
  }

  try {
    // Fallback para process.env (caso o ambiente suporte)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignora erros
  }

  return '';
};

// Valores de fallback seguros
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'placeholder';

// Cria o cliente. Se as URLs forem placeholders, chamadas de rede falharão, 
// mas o AuthContext agora tratará isso sem travar a tela branca.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);