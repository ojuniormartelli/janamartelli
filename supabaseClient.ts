
import { createClient } from '@supabase/supabase-js';

// Busca credenciais armazenadas no navegador (Configuração Dinâmica)
const storedUrl = localStorage.getItem('custom_supabase_url');
const storedKey = localStorage.getItem('custom_supabase_key');

// Verifica se o banco está configurado
export const isDbConfigured = !!(storedUrl && storedKey);

// Inicializa o cliente. Se não houver configuração, usa valores placeholder.
// A interface irá detectar !isDbConfigured e mostrar a tela de setup.
const SUPABASE_URL = storedUrl || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = storedKey || 'placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função auxiliar para salvar novas credenciais e recarregar
export const configureDatabase = (url: string, key: string) => {
    localStorage.setItem('custom_supabase_url', url);
    localStorage.setItem('custom_supabase_key', key);
    // Flag para abrir o modal SQL automaticamente após o reload
    localStorage.setItem('show_sql_on_load', 'true');
    window.location.reload(); 
};

export const resetDatabaseConfig = () => {
    localStorage.removeItem('custom_supabase_url');
    localStorage.removeItem('custom_supabase_key');
    window.location.reload();
};
