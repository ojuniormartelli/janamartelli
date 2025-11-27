import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO MANUAL / FALLBACK ---
// Adicionado para garantir conexão com os dados fornecidos em teste.tsx
const FALLBACK_URL = "https://meoqbvplyiovevozwjcl.supabase.co";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lb3FidnBseWlvdmV2b3p3amNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMDc0MTYsImV4cCI6MjA3OTc4MzQxNn0.tjdi2k161d5vLP2dpVSlQVnR7rQ7FNLxNF4s5e7JBEU";

// Função para obter URL explicitamente (Vite requer acesso estático)
const getUrl = () => {
    // 1. Tenta VITE_ (Padrão Vite) - Com verificação de segurança
    try {
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env.VITE_SUPABASE_URL) {
            return meta.env.VITE_SUPABASE_URL;
        }
    } catch (e) {}
    
    // 2. Tenta NEXT_PUBLIC_ (Padrão Vercel/Next)
    try {
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env.NEXT_PUBLIC_SUPABASE_URL) {
            return meta.env.NEXT_PUBLIC_SUPABASE_URL;
        }
    } catch (e) {}

    // 3. Fallback para process.env (Node/Vercel Runtime)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
            // @ts-ignore
            if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
        }
    } catch(e) {}

    return FALLBACK_URL;
};

// Função para obter Key explicitamente
const getKey = () => {
    // 1. Tenta VITE_ - Com verificação de segurança
    try {
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env.VITE_SUPABASE_ANON_KEY) {
            return meta.env.VITE_SUPABASE_ANON_KEY;
        }
    } catch (e) {}
    
    // 2. Tenta NEXT_PUBLIC_
    try {
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            return meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        }
    } catch (e) {}

    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY;
            // @ts-ignore
            if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        }
    } catch(e) {}

    return FALLBACK_KEY;
};

const envUrl = getUrl();
const envKey = getKey();

// 2. Tenta buscar do LocalStorage (Configuração Manual Local - Fallback)
const storedUrl = localStorage.getItem('custom_supabase_url');
const storedKey = localStorage.getItem('custom_supabase_key');

// Flag global para saber se estamos em modo Gerenciado (Vercel) ou Manual
// Se estiver usando o FALLBACK, consideramos como "Using Env" para facilitar
export const isUsingEnv = !!(envUrl && envKey);

// Log para Debug (Verifique o console do navegador se der erro)
console.log('[PijamaManager Config]', {
    isUsingEnv,
    urlSource: envUrl ? (envUrl === FALLBACK_URL ? 'FALLBACK' : 'ENV') : (storedUrl ? 'MANUAL' : 'NONE')
});

const SUPABASE_URL = storedUrl || envUrl;
const SUPABASE_ANON_KEY = storedKey || envKey;

// Verifica se o banco está configurado e não é o placeholder
export const isDbConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'https://placeholder.supabase.co');

// Inicializa o cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Funções de Configuração Manual
export const configureDatabase = (url: string, key: string) => {
    // Permite override manual mesmo se houver env/fallback
    localStorage.setItem('custom_supabase_url', url);
    localStorage.setItem('custom_supabase_key', key);
    window.location.reload(); 
};

export const resetDatabaseConfig = () => {
    localStorage.removeItem('custom_supabase_url');
    localStorage.removeItem('custom_supabase_key');
    window.location.reload();
};