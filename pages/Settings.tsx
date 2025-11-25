import React, { useState } from 'react';
import { dbSetupScript } from '../utils/database.sql';
import { Copy, Bell, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dbSetupScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotificationToggle = () => {
    // Mock implementation for push notifications
    if (!notificationsEnabled) {
        if ("Notification" in window) {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    setNotificationsEnabled(true);
                    new Notification("PijamaManager Pro", { body: "Notificações ativadas!" });
                }
            });
        }
    } else {
        setNotificationsEnabled(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Configurações</h2>
        <p className="text-slate-500 dark:text-slate-400">Gerencie o sistema e banco de dados.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold dark:text-white flex items-center">
                <Bell className="mr-2" size={20} /> Notificações
            </h3>
        </div>
        <div className="p-6 flex items-center justify-between">
            <div>
                <p className="font-medium dark:text-white">Alertas do Sistema</p>
                <p className="text-sm text-slate-500">Receba avisos sobre estoque baixo e vendas condicionais pendentes.</p>
            </div>
            <button 
                onClick={handleNotificationToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-lg font-bold dark:text-white">Banco de Dados (SQL de Instalação)</h3>
            <button 
                onClick={copyToClipboard}
                className="flex items-center text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
                {copied ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
                {copied ? 'Copiado!' : 'Copiar Script'}
            </button>
        </div>
        <div className="p-0 bg-slate-900 overflow-x-auto">
            <pre className="p-4 text-xs text-green-400 font-mono leading-relaxed">
                {dbSetupScript}
            </pre>
        </div>
      </div>
    </div>
  );
};
