import { createClient } from '@supabase/supabase-js';

// Chaves fornecidas pelo usuário para conexão direta
// Isso resolve o problema de tela branca causado por variáveis de ambiente ausentes no Vercel
const PROVIDED_URL = 'https://dftltnokaujncsgppoap.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmdGx0bm9rYXVqbmNzZ3Bwb2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNzkzNDYsImV4cCI6MjA3OTY1NTM0Nn0.3I02tG3splo_kiZv9WBIJkqgW77VhuLcDH-7uWvD_qI';

const getEnv = (key: string) => {
  try {
    // Tenta obter via import.meta.env (Vite)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        return (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`] || (import.meta as any).env[`NEXT_PUBLIC_${key}`];
    }
  } catch (e) {
    // Ignora erros
  }
  return null;
};

// Ordem de prioridade: Variável de Ambiente > Chave Fornecida (Hardcoded) > Placeholder
const SUPABASE_URL = getEnv('SUPABASE_URL') || PROVIDED_URL;
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY') || PROVIDED_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);