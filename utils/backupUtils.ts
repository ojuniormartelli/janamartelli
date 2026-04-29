
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export const handleFullExport = async (setLoading?: (l: boolean) => void) => {
    if (setLoading) setLoading(true);
    try {
        const tables = [
            'profiles', 'store_settings', 'product_sizes', 'payment_methods', 
            'bank_accounts', 'clients', 'products', 'estoque_tamanhos', 
            'vendas', 'venda_itens', 'transactions', 'venda_pagamentos'
        ];
        
        const wb = XLSX.utils.book_new();

        for (const table of tables) {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .order(table === 'store_settings' ? 'id' : 'created_at', { ascending: true });
                
            if (!error && data && data.length > 0) {
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31));
            }
        }

        XLSX.writeFile(wb, `pijamamanager_backup_${new Date().toISOString().slice(0,10)}.xlsx`);

        // Atualizar data do último backup no banco
        const { data: settings } = await supabase.from('store_settings').select('id').maybeSingle();
        if (settings) {
            await supabase.from('store_settings').update({ last_backup_at: new Date().toISOString() }).eq('id', settings.id);
        }

        return true;
    } catch (e: any) {
        console.error("Erro ao gerar backup:", e);
        alert("Erro ao gerar backup: " + e.message);
        return false;
    } finally {
        if (setLoading) setLoading(false);
    }
};
