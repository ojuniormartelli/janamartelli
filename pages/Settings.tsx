
import React, { useState, useEffect, useRef } from 'react';
import { supabase, resetDatabaseConfig, isUsingEnv } from '../supabaseClient';
// Fix: Removed non-existent 'migrations' import
import { fixSequencesSQL, fullInstallScript, patchSizesScript } from '../utils/database.sql';
import { Profile, PaymentMethod, ProductSize } from '../types';
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
  AlertOctagon,
  CreditCard,
  Percent,
  Layers,
  FileJson,
  Wrench,
  Maximize2,
  RotateCcw,
  Database,
  FileText,
  Wand2,
  AlertTriangle,
  // Fix: Added missing AlertCircle import
  AlertCircle
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'payments' | 'sizes' | 'database'>(user?.isBootstrap ? 'database' : 'general');
  const [loading, setLoading] = useState(false);
  const [syncingSizes, setSyncingSizes] = useState(false);
  
  const [storeSettings, setStoreSettings] = useState({
    id: 1,
    store_name: '',
    theme_color: '#0ea5e9',
    logo_url: ''
  });

  const [users, setUsers] = useState<Profile[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'employee' });

  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<ProductSize | null>(null);
  const [sizeForm, setSizeForm] = useState({ name: '', sort_order: 0 });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
      name: string;
      type: 'credit' | 'debit' | 'pix' | 'cash';
      active: boolean;
      rates: Record<string, number>;
  }>({ name: '', type: 'credit', active: true, rates: {} });
  
  const [maxInstallments, setMaxInstallments] = useState(12);

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [copied, setCopied] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');

  useEffect(() => {
    if (!user?.isBootstrap) {
        fetchSettings();
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'payments') fetchPaymentMethods();
        if (activeTab === 'sizes') fetchSizes();
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

  const fetchPaymentMethods = async () => {
      if(user?.isBootstrap) return;
      const { data } = await supabase.from('payment_methods').select('*').order('id');
      if(data) setPaymentMethods(data as any);
  };

  const fetchSizes = async () => {
      if(user?.isBootstrap) return;
      try {
          const { data, error } = await supabase.from('product_sizes').select('*').order('sort_order', { ascending: true });
          if(error) throw error;
          if(data) setSizes(data);
      } catch (err: any) {
          console.warn("Tabela product_sizes não encontrada.");
          setSizes([]);
      }
  };

  const handleSaveSettings = async () => {
    if(user?.isBootstrap) return;
    setLoading(true);
    const { error } = await supabase.from('store_settings').upsert(storeSettings);
    if (error) alert('Erro ao salvar configurações');
    else {
        alert('Configurações salvas!');
        window.location.reload();
    }
    setLoading(false);
  };

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
      if(!userForm.username || !userForm.password) return alert("Preencha os campos");
      if (editingUser) {
          await supabase.from('profiles').update(userForm).eq('id', editingUser.id);
      } else {
          await supabase.from('profiles').insert(userForm);
      }
      setIsUserModalOpen(false);
      fetchUsers();
  };

  const handleDeleteUser = async (id: string) => {
      if(!confirm("Excluir usuário?")) return;
      await supabase.from('profiles').delete().eq('id', id);
      fetchUsers();
  };

  const handleOpenSizeModal = (size?: ProductSize) => {
      if (size) {
          setEditingSize(size);
          setSizeForm({ name: size.name, sort_order: size.sort_order });
      } else {
          setEditingSize(null);
          const lastOrder = sizes.length > 0 ? Math.max(...sizes.map(s => s.sort_order)) : 0;
          setSizeForm({ name: '', sort_order: lastOrder + 1 });
      }
      setIsSizeModalOpen(true);
  };

  const handleSaveSize = async () => {
      if(!sizeForm.name) return alert("Nome é obrigatório");
      setLoading(true);
      try {
          if (editingSize) {
              const { error } = await supabase.from('product_sizes').update(sizeForm).eq('id', editingSize.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('product_sizes').insert(sizeForm);
              if (error) throw error;
          }
          setIsSizeModalOpen(false);
          setSizeForm({ name: '', sort_order: 0 }); 
          await fetchSizes();
      } catch (err: any) {
          console.error("Erro ao salvar tamanho:", err);
          if (err.message?.includes('product_sizes')) {
              alert("ERRO: A tabela 'product_sizes' não existe. Vá na aba 'Banco de Dados' e use o 'Script de Correção (Opção B)'.");
          } else {
              alert("Erro ao salvar: " + err.message);
          }
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteSize = async (id: number) => {
      if(!confirm("Excluir tamanho?")) return;
      const { error } = await supabase.from('product_sizes').delete().eq('id', id);
      if (error) alert("Erro ao excluir. O tamanho pode estar em uso.");
      else fetchSizes();
  };

  const handleResetSizesToDefault = async () => {
      if (!confirm("Isso irá resetar a lista para os tamanhos padrão. Deseja continuar?")) return;
      setSyncingSizes(true);
      try {
          const defaults = [
              { name: 'RN', sort_order: 0 }, { name: 'PB', sort_order: 1 }, 
              { name: 'PP', sort_order: 2 }, { name: 'P', sort_order: 3 }, 
              { name: 'M', sort_order: 4 }, { name: 'G', sort_order: 5 }, 
              { name: 'GG', sort_order: 6 }, { name: 'XG', sort_order: 7 }, 
              { name: 'XXG', sort_order: 8 }, { name: 'U', sort_order: 9 }
          ];
          for (const s of defaults) {
              await supabase.from('product_sizes').upsert(s, { onConflict: 'name' });
          }
          alert("Tamanhos padrão restaurados!");
          await fetchSizes();
      } catch (e: any) {
          alert("Erro: " + e.message + "\n\nCertifique-se de que rodou o SQL de Correção.");
      } finally {
          setSyncingSizes(false);
      }
  };

  const handleSyncSizesFromStock = async () => {
      if(!confirm("Deseja identificar tamanhos que você já usa no estoque?")) return;
      setSyncingSizes(true);
      try {
          const { data: stockData, error: fetchError } = await supabase.from('estoque_tamanhos').select('size');
          if (fetchError) throw fetchError;
          if (stockData && stockData.length > 0) {
              const uniqueInStock = Array.from(new Set(stockData.map(s => s.size.trim().toUpperCase())));
              const { data: existingSizes, error: sizeErr } = await supabase.from('product_sizes').select('name');
              if (sizeErr) throw sizeErr;
              const existingNames = (existingSizes || []).map(s => s.name.toUpperCase());
              const toAdd = uniqueInStock.filter(name => !existingNames.includes(name));
              if (toAdd.length === 0) {
                  alert("Todos os tamanhos do estoque já estão cadastrados.");
                  return;
              }
              let currentOrder = sizes.length > 0 ? Math.max(...sizes.map(s => s.sort_order)) : 0;
              const payload = toAdd.map(name => ({ name, sort_order: ++currentOrder }));
              const { error: insertError } = await supabase.from('product_sizes').insert(payload);
              if (insertError) throw insertError;
              alert(`${toAdd.length} novos tamanhos importados!`);
              await fetchSizes();
          } else {
              alert("Estoque vazio.");
          }
      } catch (e: any) {
          alert("Erro ao sincronizar: " + e.message + "\n\nSe o erro for 'relation does not exist', use o 'Script de Correção' na aba Banco de Dados.");
      } finally {
          setSyncingSizes(false);
      }
  };

  const handleOpenPaymentModal = (method?: PaymentMethod) => {
      if (method) {
          setEditingMethod(method);
          setPaymentForm({ name: method.name, type: method.type, active: method.active, rates: method.rates || {} });
      } else {
          setEditingMethod(null);
          setPaymentForm({ name: '', type: 'credit', active: true, rates: { "1": 0 } });
      }
      setIsPaymentModalOpen(true);
  };

  const handleSavePaymentMethod = async () => {
      if (!paymentForm.name) return alert("Nome é obrigatório");
      const payload = { ...paymentForm };
      if (editingMethod) await supabase.from('payment_methods').update(payload).eq('id', editingMethod.id);
      else await supabase.from('payment_methods').insert(payload);
      setIsPaymentModalOpen(false);
      fetchPaymentMethods();
  };

  const handleFullBackup = async () => {
    setBackupLoading(true);
    setProgress(0);
    try {
        const tables = ['store_settings', 'profiles', 'clients', 'payment_methods', 'product_sizes', 'products', 'estoque_tamanhos', 'bank_accounts', 'vendas', 'venda_itens', 'transactions'];
        const backupData: Record<string, any> = { timestamp: new Date().toISOString(), version: '1.0', data: {} };
        for(let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const { data } = await supabase.from(table).select('*');
            backupData.data[table] = data || [];
            setProgress(Math.round(((i + 1) / tables.length) * 100));
        }
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_pijama_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e: any) { alert('Erro: ' + e.message); }
    setBackupLoading(false);
    setProgress(0);
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !confirm("Restaurar backup?")) return;
      setRestoreLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              const data = json.data;
              const order = ['store_settings', 'profiles', 'payment_methods', 'product_sizes', 'clients', 'products', 'estoque_tamanhos', 'bank_accounts', 'vendas', 'venda_itens', 'transactions'];
              for (const table of order) {
                  if (data[table] && data[table].length > 0) await supabase.from(table).upsert(data[table]);
              }
              alert(`Restauração concluída!`);
              window.location.reload();
          } catch (err: any) { alert("Falha: " + err.message); }
          finally { setRestoreLoading(false); }
      };
      reader.readAsText(file);
  };

  const copyScript = (sql: string, id: string) => {
      navigator.clipboard.writeText(sql);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {user?.isBootstrap ? 'Instalação / Configuração' : 'Configurações'}
        </h2>
      </div>

      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {!user?.isBootstrap && (
            <>
                <button onClick={() => setActiveTab('general')} className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Geral</button>
                <button onClick={() => setActiveTab('users')} className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Usuários</button>
                <button onClick={() => setActiveTab('sizes')} className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'sizes' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Tamanhos</button>
                <button onClick={() => setActiveTab('payments')} className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'payments' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Pagamentos</button>
            </>
        )}
        <button onClick={() => setActiveTab('database')} className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'database' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Banco de Dados</button>
      </div>

      {activeTab === 'database' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold dark:text-white flex items-center mb-4"><Server className="mr-2" size={20}/> Conexão Supabase</h3>
                  {isUsingEnv ? (
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-100 dark:border-blue-800">
                          <Check size={18}/>
                          <p className="text-sm font-medium">Conexão gerenciada via Variáveis de Ambiente (Vercel).</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">URL DO PROJETO</label>
                              <input className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm" placeholder="https://..." value={dbUrl} onChange={e => setDbUrl(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500">ANON PUBLIC KEY</label>
                              <input className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm" placeholder="eyJhbG..." type="password" value={dbKey} onChange={e => setDbKey(e.target.value)} />
                          </div>
                      </div>
                  )}
              </div>

              {/* OPÇÃO B - PATCH SEGURO */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/30 flex justify-between items-center border-b border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm"><Wand2 size={24}/></div>
                        <div>
                            <h3 className="font-bold text-blue-900 dark:text-blue-200">Opção B: Script de Correção (Patch)</h3>
                            <p className="text-xs text-blue-700 dark:text-blue-400">Use este script para adicionar novas tabelas e correções <b>SEM APAGAR</b> seu histórico de vendas e estoque.</p>
                        </div>
                      </div>
                      <button onClick={() => copyScript(patchSizesScript, 'patch_sql')} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center">
                          {copied === 'patch_sql' ? <Check size={18} className="mr-2"/> : <Copy size={18} className="mr-2"/>}
                          {copied === 'patch_sql' ? 'Copiado!' : 'Copiar Patch'}
                      </button>
                  </div>
                  <div className="p-4">
                      <pre className="bg-slate-900 text-blue-300 p-4 rounded-lg text-xs font-mono overflow-auto max-h-40 border border-slate-700 shadow-inner">
                          {patchSizesScript}
                      </pre>
                  </div>
              </div>

              {/* OPÇÃO A - INSTALAÇÃO DO ZERO */}
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-100 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 text-white rounded-lg shadow-sm"><Database size={24}/></div>
                        <div>
                            <h3 className="font-bold dark:text-white">Opção A: Script de Instalação Completa</h3>
                            <p className="text-xs text-red-600 font-bold uppercase flex items-center"><AlertTriangle size={12} className="mr-1"/> Atenção: Este script APAGA TUDO e reinstala do zero!</p>
                        </div>
                      </div>
                      <button onClick={() => copyScript(fullInstallScript, 'full_sql')} className="px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-md hover:bg-slate-700 active:scale-95 transition-all flex items-center">
                          {copied === 'full_sql' ? <Check size={18} className="mr-2"/> : <Copy size={18} className="mr-2"/>}
                          {copied === 'full_sql' ? 'Copiado!' : 'Copiar SQL Completo'}
                      </button>
                  </div>
                  <div className="p-4">
                      <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-40 border border-slate-700 shadow-inner">
                          {fullInstallScript}
                      </pre>
                  </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold dark:text-white flex items-center mb-1"><Shield className="mr-2 text-primary-500" size={20}/> Backup & Segurança</h3>
                    <p className="text-sm text-slate-500">Exporte ou restaure seus dados via arquivo JSON.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      <button onClick={handleFullBackup} disabled={backupLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-colors">Baixar Backup (JSON)</button>
                      <button onClick={() => restoreInputRef.current?.click()} className="px-6 py-2 bg-amber-500 text-white rounded-lg font-bold shadow-md hover:bg-amber-600 transition-colors">Restaurar do Arquivo</button>
                      <input type="file" accept=".json" ref={restoreInputRef} className="hidden" onChange={handleRestoreBackup} />
                  </div>
              </div>
          </div>
      )}

      {/* Resto do componente mantido (Tamanhos, Usuários, Modais etc) */}
      {activeTab === 'general' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 max-w-2xl">
              <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center"><Building2 className="mr-2" size={20}/> Dados da Loja</h3>
              <div className="space-y-6">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Loja</label>
                      <input value={storeSettings.store_name} onChange={e => setStoreSettings({...storeSettings, store_name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cor do Tema</label>
                      <div className="flex items-center gap-2">
                          <input type="color" value={storeSettings.theme_color} onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})} className="h-10 w-10 border rounded cursor-pointer" />
                          <input value={storeSettings.theme_color} onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})} className="flex-1 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                      </div>
                  </div>
                  <div className="pt-2 border-t dark:border-slate-700">
                      <button onClick={handleSaveSettings} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Salvar Alterações</button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'users' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold dark:text-white flex items-center"><Users className="mr-2" size={20}/> Usuários</h3>
                  <button onClick={() => handleOpenUserModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded font-bold text-sm">Novo Usuário</button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm uppercase">
                      <tr><th className="p-4">Usuário</th><th className="p-4">Permissão</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-bold dark:text-white">{u.username}</td>
                              <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                              <td className="p-4 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={() => handleOpenUserModal(u)} className="p-2 text-blue-600"><Edit2 size={16}/></button>
                                      <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'sizes' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold dark:text-white flex items-center"><Maximize2 className="mr-2" size={20}/> Gerenciar Tamanhos</h3>
                  <div className="flex gap-2 flex-wrap">
                      <button onClick={handleResetSizesToDefault} disabled={syncingSizes} className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white border rounded font-bold text-xs hover:bg-slate-200"><RotateCcw size={14} className="mr-2"/> Restaurar Padrões</button>
                      <button onClick={handleSyncSizesFromStock} disabled={syncingSizes} className="flex items-center px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border rounded font-bold text-xs hover:bg-slate-100">
                          {syncingSizes ? <Loader size={14} className="animate-spin mr-2"/> : <RefreshCw size={14} className="mr-2"/>} Identificar do Estoque
                      </button>
                      <button onClick={() => handleOpenSizeModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded font-bold text-xs shadow-md"><Plus size={14} className="mr-2"/> Novo Tamanho</button>
                  </div>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14}/>
                  Dica: Se encontrar erros de "table not found", execute o <b>Script de Correção (Opção B)</b> na aba Banco de Dados.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm uppercase">
                        <tr><th className="p-4">Tamanho</th><th className="p-4">Ordem</th><th className="p-4 text-center">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sizes.length === 0 ? (
                            <tr><td colSpan={3} className="p-12 text-center text-slate-400 text-sm italic"><AlertOctagon className="mx-auto mb-2 opacity-20" size={48} /> Lista vazia.</td></tr>
                        ) : sizes.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4 font-bold dark:text-white uppercase">{s.name}</td>
                                <td className="p-4 text-slate-500">{s.sort_order}</td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => handleOpenSizeModal(s)} className="p-2 text-blue-600"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteSize(s.id)} className="p-2 text-red-600"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {isSizeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="text-lg font-bold dark:text-white">{editingSize ? 'Editar Tamanho' : 'Novo Tamanho'}</h3>
                      <button onClick={() => setIsSizeModalOpen(false)} disabled={loading}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                          <input value={sizeForm.name} onChange={e => setSizeForm({...sizeForm, name: e.target.value.toUpperCase()})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold uppercase" autoFocus disabled={loading} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ordem</label>
                          <input type="number" value={sizeForm.sort_order} onChange={e => setSizeForm({...sizeForm, sort_order: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" disabled={loading} />
                      </div>
                      <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-700">
                        <button onClick={() => setIsSizeModalOpen(false)} disabled={loading} className="px-4 py-2 text-slate-500">Cancelar</button>
                        <button onClick={handleSaveSize} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded font-bold shadow-lg flex items-center hover:bg-primary-700">
                            {loading ? <Loader className="animate-spin mr-2" size={16}/> : <Save className="mr-2" size={16}/>} Salvar
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
