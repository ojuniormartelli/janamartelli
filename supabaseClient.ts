import { createClient } from '@supabase/supabase-js';

// Função auxiliar para obter variáveis de ambiente de forma segura
const getEnv = (key: string) => {
  try {
    // Tenta import.meta.env (Vite standard)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch (e) {
    // Ignora erros de acesso
  }

  try {
    // Fallback para process.env
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignora erros
  }

  return '';
};

// Define URLs de fallback válidas para evitar crash no createClient
const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

const SUPABASE_URL = envUrl && envUrl.length > 0 ? envUrl : 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = envKey && envKey.length > 0 ? envKey : 'placeholder';

// Inicializa o cliente com valores garantidos
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);