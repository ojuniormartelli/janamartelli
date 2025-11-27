
import { createClient } from '@supabase/supabase-js';

// Utilitário para ler variáveis de ambiente de forma segura no Vite
// Suporta tanto VITE_ quanto NEXT_PUBLIC_ para facilitar deploy na Vercel
const getUrl = () => {
    // Verifica import.meta.env (Vite Standard)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        if (import.meta.env.VITE_SUPABASE_URL) return import.meta.env.VITE_SUPABASE_URL;
        // @ts-ignore
        if (import.meta.env.NEXT_PUBLIC_SUPABASE_URL) return import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    // Verifica process.env (Fallback / Compatibilidade)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
        // @ts-ignore
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
    return '';
};

// Função para obter Key explicitamente
const getKey = () => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        if (import.meta.env.VITE_SUPABASE_ANON_KEY) return import.meta.env.VITE_SUPABASE_ANON_KEY;
        // @ts-ignore
        if (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
        // @ts-ignore
        if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY;
        // @ts-ignore
        if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    return '';
};

const envUrl = getUrl();
const envKey = getKey();

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
