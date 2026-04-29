
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { StoreSettings } from '../types';
import { Download, X, AlertCircle, Loader } from 'lucide-react';
import { handleFullExport } from '../utils/backupUtils';

export const BackupReminder: React.FC = () => {
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkBackupStatus();
    }, []);

    const checkBackupStatus = async () => {
        const { data } = await supabase.from('store_settings').select('*').maybeSingle();
        if (!data) return;
        
        const config = data as StoreSettings;
        setSettings(config);

        if (config.backup_frequency === 'never') return;

        const lastBackup = config.last_backup_at ? new Date(config.last_backup_at).getTime() : 0;
        const now = new Date().getTime();
        const diffInMs = now - lastBackup;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        let shouldShow = false;
        if (config.backup_frequency === 'daily' && diffInDays >= 1) shouldShow = true;
        if (config.backup_frequency === 'weekly' && diffInDays >= 7) shouldShow = true;
        if (config.backup_frequency === 'monthly' && diffInDays >= 30) shouldShow = true;

        // Se nunca fez backup, mostra o aviso após o primeiro uso
        if (!config.last_backup_at && config.backup_frequency !== 'never') shouldShow = true;

        if (shouldShow) {
            // Pequeno delay para não assustar o usuário assim que abre o app
            setTimeout(() => setIsVisible(true), 3000);
        }
    };

    const onBackupClick = async () => {
        const success = await handleFullExport(setLoading);
        if (success) {
            setIsVisible(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-10 duration-500">
            <div className="bg-white dark:bg-slate-800 border-2 border-amber-400 dark:border-amber-500 rounded-2xl shadow-2xl p-5 max-w-sm w-full relative">
                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute -top-2 -right-2 p-1 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-300 transition-colors border border-white dark:border-slate-800"
                >
                    <X size={16} />
                </button>
                
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Backup Recomendado</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                            Você não faz uma cópia de segurança dos seus dados há algum tempo. Vamos garantir que tudo esteja seguro?
                        </p>
                        
                        <button 
                            onClick={onBackupClick}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-500/20"
                        >
                            {loading ? (
                                <Loader className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <Download size={18} />
                                    Baixar Backup Agora
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
