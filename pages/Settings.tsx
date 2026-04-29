
import React, { useState, useEffect, useRef } from 'react';
import { supabase, resetDatabaseConfig, isUsingEnv } from '../supabaseClient';
import { fixSequencesSQL, fullInstallScript, patchSizesScript, patchCrediarioScript } from '../utils/database.sql';
import { Profile, PaymentMethod, ProductSize } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Server, 
  RefreshCw, 
  Shield, 
  Loader, 
  Check, 
  Copy, 
  Save, 
  Building2,
  Users,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertOctagon,
  CreditCard,
  Maximize2,
  RotateCcw,
  Database,
  Wand2,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Percent,
  ImageIcon,
  Download,
  Upload,
  History
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'payments' | 'sizes' | 'database'>(user?.isBootstrap ? 'database' : 'general');
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  
  const [storeSettings, setStoreSettings] = useState({
    id: 1,
    store_name: '',
    theme_color: '#0ea5e9',
    logo_url: ''
  });

  const [users, setUsers] = useState<Profile[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'employee' as 'admin' | 'employee' });
  const [showUserPassword, setShowUserPassword] = useState(false);

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

  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');
  
  const backupInputRef = useRef<HTMLInputElement>(null);

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
          setDbUrl(localUrl || '');
          setDbKey(localKey || '');
      }
  };

  const fetchSettings = async () => {
    if(user?.isBootstrap) return;
    setLoading(true);
    const { data } = await supabase.from('store_settings').select('*').maybeSingle();
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
          setSizes([]);
      }
  };

  // --- FULL BACKUP LOGIC ---
  const handleFullExport = async () => {
    setBackupLoading(true);
    try {
        const tables = [
            'profiles', 'store_settings', 'product_sizes', 'payment_methods', 
            'bank_accounts', 'clients', 'products', 'estoque_tamanhos', 
            'vendas', 'venda_itens', 'transactions'
        ];
        
        const wb = XLSX.utils.book_new();

        for (const table of tables) {
            const { data } = await supabase.from(table).select('*');
            if (data) {
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31)); // XLSX sheet names max 31 chars
            }
        }

        XLSX.writeFile(wb, `pijamamanager_full_backup_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e: any) {
        alert("Erro ao gerar backup: " + e.message);
    } finally {
        setBackupLoading(false);
    }
  };

  const handleFullRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("AVISO: A restauração pode duplicar dados se as tabelas não estiverem vazias. Deseja continuar?")) return;

    setBackupLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Ordem de inserção para respeitar chaves estrangeiras
            const order = [
                'profiles', 'store_settings', 'product_sizes', 'payment_methods', 
                'bank_accounts', 'clients', 'products', 'estoque_tamanhos', 
                'vendas', 'venda_itens', 'transactions'
            ];

            for (const table of order) {
                const sheet = workbook.Sheets[table.substring(0, 31)];
                if (sheet) {
                    const rows = XLSX.utils.sheet_to_json(sheet);
                    if (rows.length > 0) {
                        // Inserir em lotes para evitar erro de limite
                        const { error } = await supabase.from(table).upsert(rows, { onConflict: table === 'profiles' ? 'username' : 'id' });
                        if (error) console.error(`Erro ao restaurar ${table}:`, error);
                    }
                }
            }
            alert("Restauração concluída com sucesso! Recarregando...");
            window.location.reload();
        } catch (err: any) {
            alert("Erro no processamento do arquivo: " + err.message);
        } finally {
            setBackupLoading(false);
            if (backupInputRef.current) backupInputRef.current.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
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

  const handleOpenUserModal = (userToEdit?: Profile) => {
      if (userToEdit) {
          setEditingUser(userToEdit);
          setUserForm({ username: userToEdit.username, password: userToEdit.password || '', role: userToEdit.role });
      } else {
          setEditingUser(null);
          setUserForm({ username: '', password: '', role: 'employee' });
      }
      setShowUserPassword(false);
      setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
      if(!userForm.username || !userForm.password) return alert("Preencha os campos");
      setLoading(true);
      try {
          let error;
          if (editingUser) {
              const { error: err } = await supabase.from('profiles').update(userForm).eq('id', editingUser.id);
              error = err;
          } else {
              const { error: err } = await supabase.from('profiles').insert(userForm);
              error = err;
          }
          if (error) throw error;
          setIsUserModalOpen(false);
          fetchUsers();
      } catch (err: any) {
          alert("Erro ao salvar usuário: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteUser = async (id: string) => {
      if(!confirm("Excluir usuário?")) return;
      setLoading(true);
      try {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) throw error;
          fetchUsers();
      } catch (err: any) {
          alert("Erro ao excluir usuário: " + err.message);
      } finally {
          setLoading(false);
      }
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
          await fetchSizes();
      } catch (err: any) {
          alert("Erro ao salvar: " + err.message);
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

  const handleOpenPaymentModal = (method?: PaymentMethod) => {
      if (method) {
          setEditingMethod(method);
          setPaymentForm({ 
            name: method.name, 
            type: method.type, 
            active: method.active, 
            rates: method.rates || { "1": 0 } 
          });
      } else {
          setEditingMethod(null);
          setPaymentForm({ name: '', type: 'credit', active: true, rates: { "1": 0 } });
      }
      setIsPaymentModalOpen(true);
  };

  const handleSavePaymentMethod = async () => {
      if (!paymentForm.name) return alert("Nome é obrigatório");
      setLoading(true);
      const payload = { ...paymentForm };
      if (editingMethod) await supabase.from('payment_methods').update(payload).eq('id', editingMethod.id);
      else await supabase.from('payment_methods').insert(payload);
      setLoading(false);
      setIsPaymentModalOpen(false);
      fetchPaymentMethods();
  };

  const updateRate = (installment: string, value: string) => {
      const num = parseFloat(value) || 0;
      setPaymentForm(prev => ({
          ...prev,
          rates: { ...prev.rates, [installment]: num }
      }));
  };

  return (
    <div className="space-y-6">
      <input type="file" accept=".xlsx" ref={backupInputRef} className="hidden" onChange={handleFullRestore} />

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

      {activeTab === 'general' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 p-8 max-w-2xl animate-in fade-in duration-300">
              <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2"><Building2 className="text-primary-600" size={24}/> Identidade da Loja</h3>
              <div className="space-y-6">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome da Loja</label>
                      <input value={storeSettings.store_name} onChange={e => setStoreSettings({...storeSettings, store_name: e.target.value})} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" placeholder="Minha Loja de Pijamas" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cor do Tema (Identidade Visual)</label>
                      <div className="flex items-center gap-3">
                          <input type="color" value={storeSettings.theme_color} onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})} className="h-12 w-16 border rounded-lg cursor-pointer bg-white dark:bg-slate-700 p-1" />
                          <input value={storeSettings.theme_color} onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})} className="flex-1 p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono" />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">URL da Logo (PNG/JPG)</label>
                      <div className="relative">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                          <input value={storeSettings.logo_url} onChange={e => setStoreSettings({...storeSettings, logo_url: e.target.value})} className="w-full p-3 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm" placeholder="https://exemplo.com/logo.png" />
                      </div>
                  </div>
                  <div className="pt-6 border-t dark:border-slate-700 flex justify-end">
                      <button onClick={handleSaveSettings} disabled={loading} className="px-8 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/20 flex items-center gap-2 transition-all">
                          {loading ? <Loader className="animate-spin" size={18}/> : <Save size={18}/>}
                          Salvar Configurações
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'users' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold dark:text-white flex items-center gap-2"><Users className="text-primary-600" size={24}/> Gestão de Acessos</h3>
                  <button onClick={() => handleOpenUserModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-primary-700"><Plus size={18} className="mr-1"/> Novo Usuário</button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs uppercase font-bold">
                      <tr><th className="p-4">Usuário</th><th className="p-4">Cargo / Permissão</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-bold dark:text-white">{u.username}</td>
                              <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'}`}>{u.role}</span></td>
                              <td className="p-4 text-center">
                                  <div className="flex justify-center gap-1">
                                      <button onClick={() => handleOpenUserModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                      <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {users.length === 0 && (
                          <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Nenhum usuário cadastrado.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'sizes' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold dark:text-white flex items-center gap-2"><Maximize2 className="text-primary-600" size={24}/> Grade de Tamanhos</h3>
                  <button onClick={() => handleOpenSizeModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-primary-700"><Plus size={18} className="mr-1"/> Novo Tamanho</button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs uppercase font-bold">
                      <tr><th className="p-4">Ordem</th><th className="p-4">Tamanho (Sigla)</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {sizes.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-mono text-xs text-slate-400">{s.sort_order}</td>
                              <td className="p-4 font-bold dark:text-white">{s.name}</td>
                              <td className="p-4 text-center">
                                  <div className="flex justify-center gap-1">
                                      <button onClick={() => handleOpenSizeModal(s)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                      <button onClick={() => handleDeleteSize(s.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {sizes.length === 0 && (
                          <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">Nenhum tamanho cadastrado.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'payments' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
              <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold dark:text-white flex items-center gap-2"><CreditCard className="text-primary-600" size={24}/> Métodos de Pagamento</h3>
                  <button onClick={() => handleOpenPaymentModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-primary-700"><Plus size={18} className="mr-1"/> Novo Método</button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs uppercase font-bold">
                      <tr><th className="p-4">Nome</th><th className="p-4">Tipo</th><th className="p-4">Status</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {paymentMethods.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-bold dark:text-white">{m.name}</td>
                              <td className="p-4 uppercase text-[10px] font-bold text-slate-500">{m.type}</td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${m.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50'}`}>
                                      {m.active ? 'Ativo' : 'Inativo'}
                                  </span>
                              </td>
                              <td className="p-4 text-center">
                                  <div className="flex justify-center gap-1">
                                      <button onClick={() => handleOpenPaymentModal(m)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                      <button onClick={async () => {
                                          if(!confirm("Excluir método?")) return;
                                          await supabase.from('payment_methods').delete().eq('id', m.id);
                                          fetchPaymentMethods();
                                      }} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {paymentMethods.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhum método cadastrado.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'database' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-8 shadow-lg">
                  <h3 className="text-xl font-bold dark:text-white flex items-center mb-6 gap-2"><History className="text-amber-500" size={24}/> Migração e Backups</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2"><Download size={18} className="text-primary-600"/> Backup Total</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Gera um arquivo Excel com todas as tabelas. Útil para migrar para um novo Supabase ou guardar cópia de segurança.</p>
                          <button 
                            onClick={handleFullExport} 
                            disabled={backupLoading}
                            className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-primary-500 text-primary-600 rounded-xl font-bold hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex justify-center items-center"
                          >
                              {backupLoading ? <Loader className="animate-spin mr-2" size={18}/> : <Download size={18} className="mr-2"/>}
                              Gerar Backup Completo
                          </button>
                      </div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2"><Upload size={18} className="text-green-600"/> Restaurar Backup</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Importa um arquivo Excel de backup multinível gerado pelo sistema. Atenção: Isso não apaga dados existentes, apenas adiciona/atualiza.</p>
                          <button 
                             onClick={() => backupInputRef.current?.click()} 
                             disabled={backupLoading}
                             className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg flex justify-center items-center"
                          >
                              {backupLoading ? <Loader className="animate-spin mr-2" size={18}/> : <Upload size={18} className="mr-2"/>}
                              Restaurar de Arquivo
                          </button>
                      </div>
                  </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-8">
                  <h3 className="text-xl font-bold dark:text-white flex items-center mb-6 gap-2"><Server className="text-primary-600" size={24}/> Configurações de Conectividade</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex items-start gap-4 mb-6">
                      <div className="p-2 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full"><Check size={20}/></div>
                      <div>
                          <p className="text-sm font-bold text-blue-800 dark:text-blue-200">Ambiente Gerenciado</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">O sistema está conectado via variáveis de ambiente. Para mudar de banco, atualize as chaves na Vercel ou use a configuração local se estiver em desenvolvimento.</p>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-dashed dark:border-slate-700 text-center">
                       <AlertCircle className="mx-auto mb-3 text-slate-400" size={32}/>
                       <p className="text-slate-500 dark:text-slate-400 text-sm">Para trocar o e-mail/conta do Supabase, você deve primeiro gerar o backup acima, configurar o novo banco e então restaurar.</p>
                  </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-8 shadow-lg">
                  <h3 className="text-xl font-bold dark:text-white flex items-center mb-6 gap-2"><Wand2 className="text-purple-500" size={24}/> Ferramentas de Reparo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2"><AlertTriangle size={18} className="text-amber-500"/> Corrigir Tabelas</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Cria as tabelas de Tamanhos e Pagamentos caso elas não existam no seu banco de dados.</p>
                          <button 
                            onClick={() => {
                                navigator.clipboard.writeText(patchSizesScript);
                                alert("Script SQL copiado! Cole no SQL Editor do Supabase e execute.");
                            }} 
                            className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-lg flex justify-center items-center"
                          >
                              <Copy size={18} className="mr-2"/> Copiar Script de Reparo
                          </button>
                      </div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2"><History size={18} className="text-purple-500"/> Configurar Crediário</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Cria as tabelas necessárias para o sistema de pagamentos parciais e crediário.</p>
                          <button 
                            onClick={() => {
                                navigator.clipboard.writeText(patchCrediarioScript);
                                alert("Script SQL copiado! Cole no SQL Editor do Supabase e execute.");
                            }} 
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-lg flex justify-center items-center"
                          >
                              <Copy size={18} className="mr-2"/> Copiar Script de Crediário
                          </button>
                      </div>
                      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2"><RotateCcw size={18} className="text-blue-500"/> Corrigir Sequências</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Resolve o erro "duplicate key value violates unique constraint" que ocorre após restaurações.</p>
                          <button 
                            onClick={() => {
                                navigator.clipboard.writeText(fixSequencesSQL);
                                alert("Script SQL copiado! Cole no SQL Editor do Supabase e execute.");
                            }} 
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg flex justify-center items-center"
                          >
                              <Copy size={18} className="mr-2"/> Copiar Script de Sequências
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* --- MODAIS DE USUÁRIO, TAMANHO E PAGAMENTO --- */}
      {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="text-lg font-bold dark:text-white">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                      <button onClick={() => setIsUserModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome de Usuário</label>
                          <input 
                            value={userForm.username} 
                            onChange={e => setUserForm({...userForm, username: e.target.value})} 
                            className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" 
                            placeholder="Ex: joao.silva" 
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha</label>
                          <div className="relative">
                              <input 
                                type={showUserPassword ? "text" : "password"}
                                value={userForm.password} 
                                onChange={e => setUserForm({...userForm, password: e.target.value})} 
                                className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                                placeholder="••••••••" 
                              />
                              <button 
                                type="button"
                                onClick={() => setShowUserPassword(!showUserPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {showUserPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                              </button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cargo / Permissão</label>
                          <select 
                            value={userForm.role} 
                            onChange={e => setUserForm({...userForm, role: e.target.value as any})} 
                            className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          >
                              <option value="employee">Funcionário</option>
                              <option value="admin">Administrador</option>
                          </select>
                      </div>
                  </div>
                  <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button onClick={handleSaveUser} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-primary-700">
                            {loading ? <Loader className="animate-spin" size={16}/> : <Save size={16}/>} 
                            Salvar
                        </button>
                  </div>
              </div>
          </div>
      )}

      {isSizeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="text-lg font-bold dark:text-white">{editingSize ? 'Editar Tamanho' : 'Novo Tamanho'}</h3>
                      <button onClick={() => setIsSizeModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome (Sigla)</label>
                          <input value={sizeForm.name} onChange={e => setSizeForm({...sizeForm, name: e.target.value})} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" placeholder="Ex: G, 42, GG" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ordem de Exibição</label>
                          <input type="number" value={sizeForm.sort_order} onChange={e => setSizeForm({...sizeForm, sort_order: parseInt(e.target.value) || 0})} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                      </div>
                  </div>
                  <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button onClick={() => setIsSizeModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button onClick={handleSaveSize} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-primary-700">
                            {loading ? <Loader className="animate-spin" size={16}/> : <Save size={16}/>} 
                            Salvar
                        </button>
                  </div>
              </div>
          </div>
      )}

      {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="text-lg font-bold dark:text-white flex items-center gap-2"><CreditCard size={20}/> Configurar Método</h3>
                      <button onClick={() => setIsPaymentModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome Visível</label>
                            <input value={paymentForm.name} onChange={e => setPaymentForm({...paymentForm, name: e.target.value})} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Ex: Cartão Visa" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Sistema</label>
                            <select value={paymentForm.type} onChange={e => setPaymentForm({...paymentForm, type: e.target.value as any})} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                <option value="cash">Dinheiro</option>
                                <option value="pix">Pix</option>
                                <option value="debit">Débito</option>
                                <option value="credit">Crédito</option>
                            </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                          <input type="checkbox" checked={paymentForm.active} onChange={e => setPaymentForm({...paymentForm, active: e.target.checked})} className="w-5 h-5 text-primary-600 rounded" />
                          <label className="text-sm font-medium dark:text-white">Ativo no Checkout (PDV)</label>
                      </div>
                      {paymentForm.type === 'credit' && (
                          <div className="space-y-4">
                              <h4 className="font-bold text-xs text-primary-600 uppercase flex items-center gap-1 border-b dark:border-slate-700 pb-2"><Percent size={14}/> Taxas de Parcelamento (%)</h4>
                              <div className="grid grid-cols-3 gap-3">
                                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
                                      <div key={num} className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">{num}x</label>
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            value={paymentForm.rates[num.toString()] || ''} 
                                            onChange={e => updateRate(num.toString(), e.target.value)}
                                            className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                                            placeholder="0.00"
                                          />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
                  <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button onClick={handleSavePaymentMethod} disabled={loading} className="px-8 py-2 bg-primary-600 text-white rounded-lg font-bold flex items-center gap-2">
                            {loading ? <Loader className="animate-spin" size={18}/> : <Save size={18}/>} 
                            Salvar Método
                        </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
