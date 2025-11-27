
import React, { useState, useEffect } from 'react';
import { supabase, resetDatabaseConfig, isUsingEnv } from '../supabaseClient';
import { migrations } from '../utils/database.sql';
import { Profile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Server, 
  RefreshCw, 
  Shield, 
  Loader, 
  DownloadCloud, 
  Check, 
  Copy, 
  Save, 
  Building2,
  Users,
  Plus,
  Trash2,
  Edit2,
  X,
  Eye,
  EyeOff,
  Eraser,
  Upload,
  Image as ImageIcon,
  Globe,
  AlertOctagon
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  // Se for bootstrap, força aba database
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'database'>(user?.isBootstrap ? 'database' : 'general');
  const [loading, setLoading] = useState(false);
  
  // Store Settings State
  const [storeSettings, setStoreSettings] = useState({
    id: 1,
    store_name: '',
    theme_color: '#0ea5e9',
    logo_url: ''
  });

  // Users Tab State
  const [users, setUsers] = useState<Profile[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'employee' });

  // Database Tab State
  const [backupLoading, setBackupLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Connection State
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');
  const [showDbKey, setShowDbKey] = useState(false);

  useEffect(() => {
    if (!user?.isBootstrap) {
        fetchSettings();
        if (activeTab === 'users') fetchUsers();
    }
    if (activeTab === 'database') loadConnectionInfo();
  }, [activeTab]);

  const loadConnectionInfo = () => {
      const localUrl = localStorage.getItem('custom_supabase_url');
      const localKey = localStorage.getItem('custom_supabase_key');
      
      if (!isUsingEnv && localUrl && localKey) {
          setDbUrl(localUrl);
          setDbKey(localKey);
      }
  };

  const fetchSettings = async () => {
    if(user?.isBootstrap) return;
    setLoading(true);
    const { data } = await supabase.from('store_settings').select('*').single();
    if (data) setStoreSettings(data);
    setLoading(false);
  };

  const fetchUsers = async () => {
      if(user?.isBootstrap) return;
      const { data } = await supabase.from('profiles').select('*').order('username');
      if(data) setUsers(data as any);
  };

  const handleSaveSettings = async () => {
    if(user?.isBootstrap) return;
    setLoading(true);
    const { error } = await supabase.from('store_settings').upsert(storeSettings);
    if (error) alert('Erro ao salvar configurações');
    else {
        alert('Configurações salvas! Recarregue a página para aplicar o tema/logo.');
        window.location.reload();
    }
    setLoading(false);
  };

  const handleUploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
      if(user?.isBootstrap) return;
      const file = event.target.files?.[0];
      if (!file) return;

      setLoading(true);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `logo_${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
              .from('store-assets')
              .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('store-assets').getPublicUrl(filePath);
          
          setStoreSettings(prev => ({ ...prev, logo_url: data.publicUrl }));
          alert("Logo enviado com sucesso! Clique em 'Salvar Alterações' para confirmar.");
      } catch (error: any) {
          alert('Erro ao enviar imagem. Verifique se rodou o script SQL de permissões. Detalhes: ' + error.message);
      }
      setLoading(false);
  };

  // --- USER ACTIONS ---
  const handleOpenUserModal = (user?: Profile) => {
      if (user) {
          setEditingUser(user);
          setUserForm({ username: user.username, password: user.password || '', role: user.role });
      } else {
          setEditingUser(null);
          setUserForm({ username: '', password: '', role: 'employee' });
      }
      setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
      if(!userForm.username || !userForm.password) return alert("Usuário e Senha obrigatórios");

      if (editingUser) {
          await supabase.from('profiles').update(userForm).eq('id', editingUser.id);
      } else {
          const { error } = await supabase.from('profiles').insert(userForm);
          if(error) return alert("Erro ao criar usuário (nome já existe?)");
      }
      setIsUserModalOpen(false);
      fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
      if(!confirm("Excluir usuário?")) return;
      await supabase.from('profiles').delete().eq('id', id);
      fetchUsers();
  };

  // --- DB ACTIONS ---
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
    const { data: sales } = await supabase.from('vendas').select('*').in('status_label', ['Venda', 'Baixa']);
    
    if (sales) {
        const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
        const accId = defaultAccount?.id;

        if (accId) {
            let count = 0;
            for (const sale of sales) {
                const { data: existing } = await supabase.from('transactions').select('id').ilike('description', `%${sale.code}%`).single();
                if (!existing) {
                    const isLoss = sale.status_label === 'Baixa';
                    await supabase.from('transactions').insert({
                        description: `${isLoss ? 'Baixa Estoque' : 'Venda'} ${sale.code}`,
                        amount: sale.total_value,
                        type: isLoss ? 'expense' : 'income',
                        account_id: accId,
                        category: isLoss ? 'Perdas' : 'Vendas',
                        date: sale.created_at.split('T')[0] 
                    });
                    count++;
                }
            }
            if(count > 0) alert(`${count} registros sincronizados!`);
            else alert("Tudo já está sincronizado.");
        } else {
            alert("Crie uma conta bancária padrão primeiro.");
        }
    }
    setSyncLoading(false);
  };

  const copyScript = (sql: string, id: string) => {
      navigator.clipboard.writeText(sql);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveConnection = () => {
      if (!dbUrl || !dbKey) return alert("URL e Key são obrigatórios.");
      
      localStorage.setItem('custom_supabase_url', dbUrl);
      localStorage.setItem('custom_supabase_key', dbKey);
      alert("Conexão atualizada! O sistema será recarregado. Faça login com admin/Gs020185*.");
      window.location.reload();
  };

  const handleClearConnectionFields = () => {
      setDbUrl('');
      setDbKey('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {user?.isBootstrap ? 'Instalação / Configuração' : 'Configurações'}
        </h2>
      </div>

      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700">
        {!user?.isBootstrap && (
            <>
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Geral
                </button>
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Usuários
                </button>
            </>
        )}
        <button 
            onClick={() => setActiveTab('database')}
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'database' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            Banco de Dados
        </button>
      </div>

      {/* --- ABA GERAL --- */}
      {activeTab === 'general' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 max-w-2xl">
              <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center"><Building2 className="mr-2" size={20}/> Dados da Loja</h3>
              <div className="space-y-6">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Loja</label>
                      <input 
                          value={storeSettings.store_name}
                          onChange={e => setStoreSettings({...storeSettings, store_name: e.target.value})}
                          className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cor do Tema</label>
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
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logotipo da Loja</label>
                      <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          {storeSettings.logo_url ? (
                              <div className="relative group">
                                  <img src={storeSettings.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded bg-white p-1 border shadow-sm" />
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded cursor-pointer" onClick={() => document.getElementById('logo-upload')?.click()}>
                                      <Edit2 className="text-white" size={16} />
                                  </div>
                              </div>
                          ) : (
                              <div className="h-16 w-16 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                  <ImageIcon size={24} />
                              </div>
                          )}
                          
                          <div className="flex-1">
                              <label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-medium text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                  <Upload className="mr-2" size={16} />
                                  {loading ? 'Enviando...' : 'Carregar Imagem (JPG/PNG)'}
                              </label>
                              <input 
                                  id="logo-upload" 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={handleUploadLogo}
                                  disabled={loading}
                              />
                              <p className="text-xs text-slate-500 mt-2">Recomendado: PNG transparente, 128x128px.</p>
                          </div>
                      </div>
                  </div>

                  <div className="pt-2 border-t dark:border-slate-700">
                      <button 
                          onClick={handleSaveSettings}
                          disabled={loading}
                          className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 disabled:opacity-50 flex items-center shadow-lg"
                      >
                          {loading ? <Loader className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18}/>}
                          Salvar Alterações
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- ABA USUÁRIOS --- */}
      {activeTab === 'users' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold dark:text-white flex items-center"><Users className="mr-2" size={20}/> Gerenciar Acesso</h3>
                  <button onClick={() => handleOpenUserModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 font-bold text-sm">
                      <Plus size={16} className="mr-2"/> Novo Usuário
                  </button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm">
                      <tr>
                          <th className="p-4">Usuário</th>
                          <th className="p-4">Permissão</th>
                          <th className="p-4">Senha</th>
                          <th className="p-4 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-bold dark:text-white">{u.username}</td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {u.role}
                                  </span>
                              </td>
                              <td className="p-4 font-mono text-slate-400 text-xs">••••••</td>
                              <td className="p-4 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={() => handleOpenUserModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                                      <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* --- ABA BANCO DE DADOS --- */}
      {activeTab === 'database' && (
          <div className="space-y-8">
              
              {user?.isBootstrap && !isUsingEnv && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start">
                      <AlertOctagon className="mr-3 mt-1 flex-shrink-0" />
                      <div>
                          <h4 className="font-bold">Passo 1: Conectar Banco de Dados</h4>
                          <p className="text-sm">Insira abaixo as credenciais (URL e Key) do seu projeto Supabase/Neon. <br/>Após salvar, copie o código SQL e execute-o na plataforma do banco.</p>
                      </div>
                  </div>
              )}

              {/* Database Connection Config */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold dark:text-white flex items-center mb-4"><Server className="mr-2" size={20}/> Conexão do Banco de Dados</h3>
                  
                  {isUsingEnv ? (
                      <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center mb-1 font-bold">
                              <Globe size={18} className="mr-2"/>
                              Conexão Gerenciada (Link Exclusivo)
                          </div>
                          <p className="text-sm">Este aplicativo está vinculado automaticamente ao banco de dados do cliente via servidor. Nenhuma configuração manual é necessária.</p>
                      </div>
                  ) : (
                      <>
                        <p className="text-sm text-slate-500 mb-4">
                            Configuração Manual Local (Salva neste navegador).
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project URL</label>
                                <input 
                                    type="text"
                                    value={dbUrl}
                                    onChange={(e) => setDbUrl(e.target.value)}
                                    className="w-full p-2 bg-white dark:bg-slate-800 border rounded text-slate-600 dark:text-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="https://seu-projeto.supabase.co"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Key (Anon)</label>
                                <div className="relative">
                                    <input 
                                        type={showDbKey ? "text" : "password"}
                                        value={dbKey}
                                        onChange={(e) => setDbKey(e.target.value)}
                                        className="w-full p-2 bg-white dark:bg-slate-800 border rounded text-slate-600 dark:text-slate-300 text-sm font-mono focus:outline-none pr-10 focus:ring-2 focus:ring-blue-500"
                                        placeholder="eyJ..."
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowDbKey(!showDbKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showDbKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <button 
                                onClick={handleClearConnectionFields}
                                className="px-4 py-2 bg-white border dark:bg-slate-800 dark:border-slate-600 text-slate-500 hover:bg-slate-100 rounded text-sm font-medium flex items-center transition-colors"
                            >
                                <Eraser size={16} className="mr-2"/> Limpar Campos
                            </button>
                            <button 
                                onClick={() => {
                                    if(confirm('Isso limpará as chaves manuais deste navegador. Continuar?')) {
                                        resetDatabaseConfig();
                                    }
                                }}
                                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-bold flex items-center transition-colors"
                            >
                                <X size={16} className="mr-2"/> Resetar
                            </button>
                            <button 
                                onClick={handleSaveConnection}
                                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded text-sm font-bold flex items-center transition-colors shadow-lg"
                            >
                                <Save size={16} className="mr-2"/> Salvar / Sobrescrever
                            </button>
                        </div>
                      </>
                  )}
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

              {/* Backup Section (Only in Production) */}
              {!user?.isBootstrap && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                              <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center"><Shield className="mr-2" size={20}/> Backup & Segurança</h3>
                              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                                  Baixe uma cópia completa dos dados (JSON) ou sincronize vendas antigas com o financeiro.
                              </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleFullBackup}
                                disabled={backupLoading}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow flex items-center whitespace-nowrap disabled:opacity-50 justify-center"
                            >
                                {backupLoading ? <Loader size={18} className="animate-spin mr-2"/> : <DownloadCloud size={18} className="mr-2"/>}
                                Backup JSON
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
              )}
          </div>
      )}

      {/* MODAL USUÁRIO */}
      {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                      <h3 className="text-lg font-bold dark:text-white">
                          {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                      </h3>
                      <button onClick={() => setIsUserModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário (Login)</label>
                          <input 
                              value={userForm.username}
                              onChange={e => setUserForm({...userForm, username: e.target.value})}
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                          <input 
                              value={userForm.password}
                              onChange={e => setUserForm({...userForm, password: e.target.value})}
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              placeholder={editingUser ? 'Deixe em branco para manter' : ''}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Permissão</label>
                          <select 
                              value={userForm.role}
                              onChange={e => setUserForm({...userForm, role: e.target.value as any})}
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          >
                              <option value="admin">Admin (Acesso Total)</option>
                              <option value="employee">Funcionário (Restrito)</option>
                          </select>
                      </div>
                      <button onClick={handleSaveUser} className="w-full py-2 bg-primary-600 text-white rounded font-bold mt-4">Salvar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
