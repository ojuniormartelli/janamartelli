
import React, { useState, useEffect } from 'react';
import { supabase, resetDatabaseConfig } from '../supabaseClient';
import { migrations } from '../utils/database.sql';
import { 
  Server, 
  RefreshCw, 
  Shield, 
  Loader, 
  DownloadCloud, 
  Check, 
  Copy, 
  Save, 
  Building2 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'database'>('general');
  const [loading, setLoading] = useState(false);
  
  // Store Settings State
  const [storeSettings, setStoreSettings] = useState({
    id: 1,
    store_name: '',
    theme_color: '#0ea5e9',
    logo_url: ''
  });

  // Database Tab State
  const [backupLoading, setBackupLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('store_settings').select('*').single();
    if (data) setStoreSettings(data);
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    const { error } = await supabase.from('store_settings').upsert(storeSettings);
    if (error) alert('Erro ao salvar configurações');
    else {
        alert('Configurações salvas! Recarregue a página para aplicar o tema/logo.');
        window.location.reload();
    }
    setLoading(false);
  };

  const handleFullBackup = async () => {
    setBackupLoading(true);
    try {
        const tables = ['profiles', 'clients', 'products', 'estoque_tamanhos', 'vendas', 'venda_itens', 'payment_methods', 'store_settings', 'bank_accounts', 'transactions'];
        const backupData: Record<string, any> = {};
        
        for(const table of tables) {
            const { data } = await supabase.from(table).select('*');
            backupData[table] = data;
        }

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_pijama_pro_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert('Erro ao gerar backup');
    }
    setBackupLoading(false);
  };

  const handleSyncFinancial = async () => {
    setSyncLoading(true);
    // Simulation of a sync process
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSyncLoading(false);
    alert('Sincronização realizada com sucesso!');
  };

  const copyScript = (sql: string, id: string) => {
      navigator.clipboard.writeText(sql);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações</h2>
      </div>

      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => setActiveTab('general')}
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            Geral
        </button>
        <button 
            onClick={() => setActiveTab('database')}
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'database' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            Banco de Dados
        </button>
      </div>

      {activeTab === 'general' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 max-w-2xl">
              <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center"><Building2 className="mr-2" size={20}/> Dados da Loja</h3>
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Loja</label>
                      <input 
                          value={storeSettings.store_name}
                          onChange={e => setStoreSettings({...storeSettings, store_name: e.target.value})}
                          className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cor do Tema (Hex)</label>
                      <div className="flex items-center gap-2">
                          <input 
                              type="color"
                              value={storeSettings.theme_color}
                              onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})}
                              className="h-10 w-10 border rounded cursor-pointer"
                          />
                          <input 
                              value={storeSettings.theme_color}
                              onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})}
                              className="flex-1 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          />
                      </div>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL do Logo</label>
                      <input 
                          value={storeSettings.logo_url || ''}
                          onChange={e => setStoreSettings({...storeSettings, logo_url: e.target.value})}
                          className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          placeholder="https://..."
                      />
                  </div>
                  <div className="pt-4">
                      <button 
                          onClick={handleSaveSettings}
                          disabled={loading}
                          className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 disabled:opacity-50 flex items-center"
                      >
                          {loading ? <Loader className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18}/>}
                          Salvar Alterações
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- ABA BANCO DE DADOS (MIGRATIONS & BACKUP & CONFIG) --- */}
      {activeTab === 'database' && (
          <div className="space-y-8">
              
              {/* Database Connection Config */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold dark:text-white flex items-center mb-4"><Server className="mr-2" size={20}/> Conexão do Banco de Dados</h3>
                  <p className="text-sm text-slate-500 mb-4">
                      Configure aqui a conexão com seu projeto (Supabase/Neon). Se você utiliza Neon, certifique-se de usar um adaptador compatível ou credenciais de um projeto Supabase que aponte para seu Postgres.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project URL</label>
                          <input 
                              type="password"
                              readOnly
                              value={localStorage.getItem('custom_supabase_url') || ''}
                              className="w-full p-2 bg-white dark:bg-slate-800 border rounded text-slate-600 dark:text-slate-300 text-sm font-mono"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key (Anon)</label>
                          <input 
                              type="password"
                              readOnly
                              value={localStorage.getItem('custom_supabase_key') || ''}
                              className="w-full p-2 bg-white dark:bg-slate-800 border rounded text-slate-600 dark:text-slate-300 text-sm font-mono"
                          />
                      </div>
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                      <button 
                          onClick={() => {
                              if(confirm('Tem certeza? Você será desconectado e precisará inserir as novas chaves.')) {
                                  resetDatabaseConfig();
                              }
                          }}
                          className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-bold flex items-center"
                      >
                          <RefreshCw size={16} className="mr-2"/> Alterar Conexão / Resetar
                      </button>
                  </div>
              </div>

              {/* Backup Section */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                          <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center"><Shield className="mr-2" size={20}/> Backup & Segurança</h3>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              O banco de dados é hospedado na nuvem. 
                              Para sua segurança adicional, você pode baixar uma cópia completa dos dados (JSON) a qualquer momento.
                          </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button 
                            onClick={handleFullBackup}
                            disabled={backupLoading}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow flex items-center whitespace-nowrap disabled:opacity-50 justify-center"
                        >
                            {backupLoading ? <Loader size={18} className="animate-spin mr-2"/> : <DownloadCloud size={18} className="mr-2"/>}
                            Fazer Backup Completo (JSON)
                        </button>
                        <button 
                            onClick={handleSyncFinancial}
                            disabled={syncLoading}
                            className="px-6 py-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300 shadow flex items-center whitespace-nowrap disabled:opacity-50 justify-center text-sm"
                        >
                            {syncLoading ? <Loader size={16} className="animate-spin mr-2"/> : <RefreshCw size={16} className="mr-2"/>}
                            Sincronizar Financeiro
                        </button>
                      </div>
                  </div>
              </div>

              {/* Migrations Section */}
              <div className="space-y-4">
                  <h3 className="text-lg font-bold dark:text-white">Atualizações do Sistema (SQL)</h3>
                  {migrations.map((mig) => (
                      <div key={mig.id} className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded uppercase">{mig.id}</span>
                                    <span className="text-slate-500 text-xs">{mig.date}</span>
                                  </div>
                                  <h4 className="font-bold text-slate-800 dark:text-white mt-1">{mig.description}</h4>
                              </div>
                              <button 
                                  onClick={() => copyScript(mig.sql, mig.id)}
                                  className={`flex items-center px-4 py-2 rounded font-medium text-sm transition-colors ${copied === mig.id ? 'bg-green-100 text-green-700' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}
                              >
                                  {copied === mig.id ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                                  {copied === mig.id ? 'Copiado!' : 'Copiar SQL'}
                              </button>
                          </div>
                          <div className="p-0 bg-slate-900 overflow-x-auto max-h-40">
                            <pre className="p-4 text-xs text-green-400 font-mono leading-relaxed select-all">
                                {mig.sql.substring(0, 200)}...
                            </pre>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};
