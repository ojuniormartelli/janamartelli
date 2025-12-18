
import React, { useState, useEffect, useRef } from 'react';
import { supabase, resetDatabaseConfig, isUsingEnv } from '../supabaseClient';
import { migrations, fixSequencesSQL } from '../utils/database.sql';
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
  Maximize2
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  // Se for bootstrap, força aba database
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'payments' | 'sizes' | 'database'>(user?.isBootstrap ? 'database' : 'general');
  const [loading, setLoading] = useState(false);
  const [syncingSizes, setSyncingSizes] = useState(false);
  
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

  // Sizes Tab State
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<ProductSize | null>(null);
  const [sizeForm, setSizeForm] = useState({ name: '', sort_order: 0 });

  // Payments Tab State
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
      name: string;
      type: 'credit' | 'debit' | 'pix' | 'cash';
      active: boolean;
      rates: Record<string, number>;
  }>({ name: '', type: 'credit', active: true, rates: {} });
  
  // Auxiliary state for Max Installments in modal
  const [maxInstallments, setMaxInstallments] = useState(12);

  // Database Tab State
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [copied, setCopied] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  
  // Connection State
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');
  const [showDbKey, setShowDbKey] = useState(false);

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
      const { data } = await supabase.from('product_sizes').select('*').order('sort_order', { ascending: true });
      if(data) setSizes(data);
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
          alert("Logo enviado! Salve para confirmar.");
      } catch (error: any) {
          alert('Erro ao enviar imagem: ' + error.message);
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

  // --- SIZE ACTIONS ---
  const handleOpenSizeModal = (size?: ProductSize) => {
      if (size) {
          setEditingSize(size);
          setSizeForm({ name: size.name, sort_order: size.sort_order });
      } else {
          setEditingSize(null);
          // Auto-increment sort_order
          const lastOrder = sizes.length > 0 ? Math.max(...sizes.map(s => s.sort_order)) : 0;
          setSizeForm({ name: '', sort_order: lastOrder + 1 });
      }
      setIsSizeModalOpen(true);
  };

  const handleSaveSize = async () => {
      if(!sizeForm.name) return alert("Nome é obrigatório");
      if (editingSize) {
          await supabase.from('product_sizes').update(sizeForm).eq('id', editingSize.id);
      } else {
          const { error } = await supabase.from('product_sizes').insert(sizeForm);
          if (error) return alert("Erro ao criar (Nome já existe?)");
      }
      setIsSizeModalOpen(false);
      fetchSizes();
  };

  const handleDeleteSize = async (id: number) => {
      if(!confirm("Excluir tamanho?")) return;
      const { error } = await supabase.from('product_sizes').delete().eq('id', id);
      if (error) alert("Erro ao excluir. O tamanho pode estar em uso.");
      else fetchSizes();
  };

  // FUNÇÃO DE SINCRONIZAÇÃO COM O ESTOQUE
  const handleSyncSizesFromStock = async () => {
      if(!confirm("Deseja identificar tamanhos que você já usa no estoque e trazê-los para cá?")) return;
      setSyncingSizes(true);
      try {
          // 1. Busca todos os tamanhos únicos usados no estoque
          const { data: stockData, error: fetchError } = await supabase
              .from('estoque_tamanhos')
              .select('size');
          
          if (fetchError) throw fetchError;

          if (stockData) {
              const uniqueInStock = Array.from(new Set(stockData.map(s => s.size.trim().toUpperCase())));
              
              // 2. Busca o que já temos em product_sizes para não duplicar
              const { data: existingSizes } = await supabase.from('product_sizes').select('name');
              const existingNames = (existingSizes || []).map(s => s.name.toUpperCase());
              
              const toAdd = uniqueInStock.filter(name => !existingNames.includes(name));

              if (toAdd.length === 0) {
                  alert("Todos os tamanhos do estoque já estão configurados ou o estoque está vazio.");
                  return;
              }

              // Pega a última ordem para continuar de onde parou
              let currentOrder = sizes.length > 0 ? Math.max(...sizes.map(s => s.sort_order)) : 0;
              
              const payload = toAdd.map(name => ({
                  name: name,
                  sort_order: ++currentOrder
              }));

              const { error: insertError } = await supabase.from('product_sizes').insert(payload);
              if (insertError) throw insertError;

              alert(`${toAdd.length} tamanhos novos importados do estoque!`);
              fetchSizes();
          }
      } catch (e: any) {
          alert("Erro ao sincronizar: " + e.message);
      } finally {
          setSyncingSizes(false);
      }
  };

  // --- PAYMENT ACTIONS ---
  const handleOpenPaymentModal = (method?: PaymentMethod) => {
      if (method) {
          setEditingMethod(method);
          setPaymentForm({
              name: method.name,
              type: method.type,
              active: method.active,
              rates: method.rates || {}
          });
          const max = Object.keys(method.rates || {}).reduce((a, b) => Math.max(a, parseInt(b)), 1);
          setMaxInstallments(max > 1 ? max : 12);
      } else {
          setEditingMethod(null);
          setPaymentForm({ name: '', type: 'credit', active: true, rates: { "1": 0 } });
          setMaxInstallments(12);
      }
      setIsPaymentModalOpen(true);
  };

  const handleMaxInstallmentsChange = (val: number) => {
      setMaxInstallments(val);
      setPaymentForm(prev => {
          const newRates = { ...prev.rates };
          for(let i=1; i<=val; i++) { if (newRates[i.toString()] === undefined) newRates[i.toString()] = 0; }
          Object.keys(newRates).forEach(k => { if (parseInt(k) > val) delete newRates[k]; });
          return { ...prev, rates: newRates };
      });
  };

  const handleRateChange = (installment: string, value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;
      setPaymentForm(prev => ({ ...prev, rates: { ...prev.rates, [installment]: numValue } }));
  };

  const handleSavePaymentMethod = async () => {
      if (!paymentForm.name) return alert("Nome é obrigatório");
      const payload = { ...paymentForm };
      if (payload.type !== 'credit') payload.rates = {};
      else {
          const finalRates: Record<string, number> = {};
          for(let i=1; i<=maxInstallments; i++) finalRates[i.toString()] = payload.rates[i.toString()] || 0;
          payload.rates = finalRates;
      }
      if (editingMethod) await supabase.from('payment_methods').update(payload).eq('id', editingMethod.id);
      else await supabase.from('payment_methods').insert(payload);
      setIsPaymentModalOpen(false);
      fetchPaymentMethods();
  };

  const handleDeletePaymentMethod = async (id: number) => {
      if(!confirm("Excluir forma de pagamento?")) return;
      await supabase.from('payment_methods').delete().eq('id', id);
      fetchPaymentMethods();
  };

  // --- DB ACTIONS ---
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
      setProgress(0);
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              const data = json.data;
              const order = ['store_settings', 'profiles', 'payment_methods', 'product_sizes', 'clients', 'products', 'estoque_tamanhos', 'bank_accounts', 'vendas', 'venda_itens', 'transactions'];
              for (let i = 0; i < order.length; i++) {
                  const table = order[i];
                  if (data[table] && data[table].length > 0) await supabase.from(table).upsert(data[table]);
                  setProgress(Math.round(((i + 1) / order.length) * 100));
              }
              alert(`Restauração concluída!`);
              window.location.reload();
          } catch (err: any) { alert("Falha: " + err.message); }
          finally { setRestoreLoading(false); setProgress(0); }
      };
      reader.readAsText(file);
  };

  const handleSyncFinancial = async () => {
    setSyncLoading(true);
    const { data: sales } = await supabase.from('vendas').select('*').in('status_label', ['Venda', 'Baixa']);
    if (sales) {
        const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
        if (defaultAccount) {
            let count = 0;
            for (const sale of sales) {
                const { data: existing } = await supabase.from('transactions').select('id').ilike('description', `%${sale.code}%`).single();
                if (!existing) {
                    const isLoss = sale.status_label === 'Baixa';
                    await supabase.from('transactions').insert({
                        description: `${isLoss ? 'Baixa Estoque' : 'Venda'} ${sale.code}`,
                        amount: sale.total_value,
                        type: isLoss ? 'expense' : 'income',
                        account_id: defaultAccount.id,
                        category: isLoss ? 'Perdas' : 'Vendas',
                        date: sale.created_at.split('T')[0] 
                    });
                    count++;
                }
            }
            alert(`${count} registros sincronizados!`);
        } else alert("Defina uma conta padrão.");
    }
    setSyncLoading(false);
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
                  <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logotipo</label>
                      <div className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                          {storeSettings.logo_url ? <img src={storeSettings.logo_url} className="h-16 w-16 object-contain rounded bg-white p-1 border shadow-sm" /> : <div className="h-16 w-16 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center"><ImageIcon size={24} /></div>}
                          <div className="flex-1">
                              <label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 rounded-md font-medium text-sm">
                                  <Upload className="mr-2" size={16} /> Carregar Imagem
                              </label>
                              <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} disabled={loading} />
                          </div>
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
                  <div className="flex gap-2">
                      <button 
                        onClick={handleSyncSizesFromStock} 
                        disabled={syncingSizes}
                        className="flex items-center px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      >
                          {syncingSizes ? <Loader size={14} className="animate-spin mr-2"/> : <RefreshCw size={14} className="mr-2"/>}
                          Identificar do Estoque
                      </button>
                      <button onClick={() => handleOpenSizeModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded font-bold text-xs shadow-md">
                          <Plus size={14} className="mr-2"/> Novo Tamanho
                      </button>
                  </div>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 text-[10px] md:text-xs">
                  Dica: A "Ordem de Exibição" define a posição nas listas (Ex: 0 para RN, 1 para PP, 2 para P...). 
                  Novos tamanhos criados via "Identificar do Estoque" podem precisar de ajuste na ordem.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm uppercase">
                        <tr>
                            <th className="p-4">Tamanho</th>
                            <th className="p-4">Ordem de Exibição</th>
                            <th className="p-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sizes.length === 0 ? (
                            <tr><td colSpan={3} className="p-12 text-center text-slate-400 text-sm italic">
                                <AlertOctagon className="mx-auto mb-2 opacity-20" size={48} />
                                Lista vazia. Clique em "Identificar do Estoque" para importar o que já existe ou use "Novo Tamanho".
                            </td></tr>
                        ) : sizes.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4 font-bold dark:text-white uppercase">{s.name}</td>
                                <td className="p-4 text-slate-500">{s.sort_order}</td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => handleOpenSizeModal(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteSize(s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {activeTab === 'payments' && !user?.isBootstrap && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold dark:text-white flex items-center"><CreditCard className="mr-2" size={20}/> Pagamentos</h3>
                  <button onClick={() => handleOpenPaymentModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded font-bold text-sm">Novo Pagamento</button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm">
                      <tr><th className="p-4">Nome</th><th className="p-4">Tipo</th><th className="p-4 text-center">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {paymentMethods.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="p-4 font-bold dark:text-white">{m.name}</td>
                              <td className="p-4 capitalize">{m.type}</td>
                              <td className="p-4 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={() => handleOpenPaymentModal(m)} className="p-2 text-blue-600"><Edit2 size={16}/></button>
                                      <button onClick={() => handleDeletePaymentMethod(m.id)} className="p-2 text-red-600"><Trash2 size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'database' && (
          <div className="space-y-8">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <h3 className="text-lg font-bold dark:text-white flex items-center mb-4"><Server className="mr-2" size={20}/> Banco de Dados</h3>
                  {isUsingEnv ? <p className="text-sm text-blue-600">Conexão gerenciada via ambiente.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input className="p-2 border rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="URL" value={dbUrl} onChange={e => setDbUrl(e.target.value)} /><input className="p-2 border rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="Key" type="password" value={dbKey} onChange={e => setDbKey(e.target.value)} /></div>}
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center mb-4"><Shield className="mr-2" size={20}/> Backup & Segurança</h3>
                  <div className="flex flex-wrap gap-2">
                      <button onClick={handleFullBackup} disabled={backupLoading} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">Backup (JSON)</button>
                      <button onClick={() => restoreInputRef.current?.click()} className="px-6 py-2 bg-amber-500 text-white rounded font-bold">Restaurar</button>
                      <input type="file" accept=".json" ref={restoreInputRef} className="hidden" onChange={handleRestoreBackup} />
                      <button onClick={handleSyncFinancial} className="px-6 py-2 bg-slate-200 text-slate-700 rounded font-bold">Sincronizar Financeiro</button>
                  </div>
              </div>
              <div className="space-y-4">
                  <h3 className="text-lg font-bold dark:text-white">Scripts de Correção</h3>
                  <div className="bg-white dark:bg-slate-800 p-4 rounded border flex justify-between items-center">
                      <div><h4 className="font-bold">Corrigir IDs/Sequências</h4><p className="text-xs text-slate-500">Use se houver erro ao salvar registros.</p></div>
                      <button onClick={() => copyScript(fixSequencesSQL, 'fix_seq')} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded text-sm font-bold">{copied === 'fix_seq' ? 'Copiado!' : 'Copiar SQL'}</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL USUÁRIO */}
      {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <h3 className="text-lg font-bold dark:text-white mb-4">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                  <div className="space-y-4">
                      <input value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white" placeholder="Login" />
                      <input value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white" placeholder="Senha" type="password" />
                      <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white"><option value="admin">Admin</option><option value="employee">Funcionário</option></select>
                      <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2">Cancelar</button>
                        <button onClick={handleSaveUser} className="px-4 py-2 bg-primary-600 text-white rounded">Salvar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL TAMANHO */}
      {isSizeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <h3 className="text-lg font-bold dark:text-white">
                          {editingSize ? 'Editar Tamanho' : 'Novo Tamanho'}
                      </h3>
                      <button onClick={() => setIsSizeModalOpen(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome (Ex: PP, P, 42)</label>
                          <input 
                              value={sizeForm.name}
                              onChange={e => setSizeForm({...sizeForm, name: e.target.value.toUpperCase()})}
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                              autoFocus
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ordem de Exibição</label>
                          <input 
                              type="number"
                              value={sizeForm.sort_order}
                              onChange={e => setSizeForm({...sizeForm, sort_order: parseInt(e.target.value)})}
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Quanto menor o número, mais ao início da lista ele aparece.</p>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsSizeModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                        <button onClick={handleSaveSize} className="px-6 py-2 bg-primary-600 text-white rounded font-bold shadow-lg">Salvar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL PAGAMENTO */}
      {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
                  <h3 className="text-lg font-bold dark:text-white mb-4">Pagamento</h3>
                  <div className="space-y-4">
                      <input value={paymentForm.name} onChange={e => setPaymentForm({...paymentForm, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white" placeholder="Nome" />
                      <select value={paymentForm.type} onChange={e => setPaymentForm({...paymentForm, type: e.target.value as any})} className="w-full p-2 border rounded dark:bg-slate-700 dark:text-white"><option value="credit">Crédito</option><option value="debit">Débito</option><option value="pix">Pix</option><option value="cash">Dinheiro</option></select>
                      <div className="flex justify-end gap-2 pt-4">
                        <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2">Cancelar</button>
                        <button onClick={handleSavePaymentMethod} className="px-4 py-2 bg-primary-600 text-white rounded">Salvar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
