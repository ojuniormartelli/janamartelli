
import { supabase } from '../supabaseClient';

export const logActivity = async (action: string, details?: string) => {
    try {
        const userStr = localStorage.getItem('pijama_user');
        if (!userStr) return;
        
        const user = JSON.parse(userStr);
        
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            username: user.username,
            action: action,
            details: details || ''
        });
    } catch (e) {
        console.error("Erro ao registrar log:", e);
    }
};
