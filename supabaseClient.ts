
import { createClient } from '@supabase/supabase-js';

// Utilitário para ler variáveis de ambiente de forma segura no Vite
// Suporta tanto VITE_ quanto NEXT_PUBLIC_ para facilitar deploy na Vercel
const getEnvVar = (key: string) => {
    try {
        // @ts-ignore
        return import.meta.env?.[key] || import.meta.env?.[`NEXT_PUBLIC_${key.replace('VITE_', '')}`];
    } catch {
        return undefined;
    }
};

// 1. Tenta buscar das Variáveis de Ambiente (Configuração Global do Servidor/Vercel)
// Aceita VITE_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL
const envUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const envKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// 2. Tenta buscar do LocalStorage (Configuração Manual Local - Fallback)
const storedUrl = localStorage.getItem('custom_supabase_url');
const storedKey = localStorage.getItem('custom_supabase_key');

// Flag global para saber se estamos em modo Gerenciado (Vercel) ou Manual
export const isUsingEnv = !!(envUrl && envKey);

const SUPABASE_URL = isUsingEnv ? envUrl : (storedUrl || 'https://placeholder.supabase.co');
const SUPABASE_ANON_KEY = isUsingEnv ? envKey : (storedKey || 'placeholder');

// Verifica se o banco está configurado (seja por Env ou Local)
export const isDbConfigured = !!((isUsingEnv) || (storedUrl && storedKey));

// Inicializa o cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuração Manual (Só funciona se NÃO estiver usando Env Vars)
export const configureDatabase = (url: string, key: string) => {
    if (isUsingEnv) return; 
    localStorage.setItem('custom_supabase_url', url);
    localStorage.setItem('custom_supabase_key', key);
    window.location.reload(); 
};

// Reset Manual
export const resetDatabaseConfig = () => {
    if (isUsingEnv) return;
    localStorage.removeItem('custom_supabase_url');
    localStorage.removeItem('custom_supabase_key');
    window.location.reload();
};
