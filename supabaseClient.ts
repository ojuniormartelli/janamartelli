import { createClient } from '@supabase/supabase-js';

// Função para obter URL explicitamente
const getUrl = () => {
    // 1. Padrão VITE (Recomendado)
    // @ts-ignore
    if (import.meta.env && import.meta.env.VITE_SUPABASE_URL) return import.meta.env.VITE_SUPABASE_URL;
    
    // 2. Tentativa de ler NEXT_PUBLIC no import.meta (caso envPrefix esteja alterado)
    // @ts-ignore
    if (import.meta.env && import.meta.env.NEXT_PUBLIC_SUPABASE_URL) return import.meta.env.NEXT_PUBLIC_SUPABASE_URL;

    // 3. Fallback para process.env (Vercel injeta isso as vezes no build)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
            // @ts-ignore
            if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
        }
    } catch(e) {}

    return '';
};

// Função para obter Key explicitamente
const getKey = () => {
    // @ts-ignore
    if (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) return import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // @ts-ignore
    if (import.meta.env && import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY;
            // @ts-ignore
            if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        }
    } catch(e) {}

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