
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { migrations } from '../utils/database.sql';
import { Copy, Check, CreditCard, Trash2, Plus, Save, Store, Palette, Image as ImageIcon, Upload, Loader, User, Lock, Shield, DownloadCloud, RefreshCw } from 'lucide-react';
import { PaymentMethod, Profile } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const Settings: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'payments' | 'database'>('general');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  
  // Store Settings
  const [storeSettings, setStoreSettings] = useState({
      id: 1,
      store_name: '',
      theme_color: '#0ea5e9',
      logo_url: ''
  });

  // Users Management
  const [users, setUsers] = useState<Profile[]>([]);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUserData, setEditingUserData] = useState<Partial<Profile>>({ username: '', password: '', role: 'employee' });

  // Payment Methods
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isEditingMethod, setIsEditingMethod] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<Partial<PaymentMethod>>({ 
      name: '', type: 'credit', rates: {} 
  });
  const [tempRates, setTempRates] = useState<{installments: string, rate: string}[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchPaymentMethods();
    fetchUsers();
  }, []);

  const fetchSettings = async () => {
      const { data } = await supabase.from('store_settings').select('*').single();
      if (data) setStoreSettings(data);
  };

  const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('*').order('username');
      if (data) setUsers(data);
  };

  const saveGeneralSettings = async () => {
      const { error } = await supabase.from('store_settings').upsert({
          id: 1, 
          store_name: storeSettings.store_name,
          theme_color: storeSettings.theme_color,
          logo_url: storeSettings.logo_url
      });

      if (error) alert("Erro ao salvar configurações");
      else {
          alert("Configurações salvas! Recarregue a página para ver as mudanças.");
          window.location.reload();
      }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      try {
          setUploadingLogo(true);
          const file = event.target.files?.[0];
          if (!file) return;

          const fileExt = file.name.split('.').pop();
          const fileName = `logo-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
              .from('store-assets')
              .upload(fileName, file);

          if (uploadError) {
              alert('Erro no upload. Verifique o Bucket no banco de dados.');
              return;
          }

          const { data } = supabase.storage.from('store-assets').getPublicUrl(fileName);
          if (data) setStoreSettings(prev => ({ ...prev, logo_url: data.publicUrl }));

      } catch (error) {
          alert('Erro desconhecido no upload.');
      } finally {
          setUploadingLogo(false);
      }
  };

  // --- BACKUP LOGIC ---
  const handleFullBackup = async () => {
      setBackupLoading(true);
      try {
          // Fetch all critical data
          const [
              { data: clients },
              { data: products },
              { data: variations },
              { data: sales },
              { data: saleItems },
              { data: accounts },
              { data: txs },
              { data: methods }
          ] = await Promise.all([
              supabase.from('clients').select('*'),
              supabase.from('products').select('*'),
              supabase.from('estoque_tamanhos').select('*'),
              supabase.from('vendas').select('*'),
              supabase.from('venda_itens').select('*'),
              supabase.from('bank_accounts').select('*'),
              supabase.from('transactions').select('*'),
              supabase.from('payment_methods').select('*')
          ]);

          const backupData = {
              timestamp: new Date().toISOString(),
              system: "PijamaManager Pro",
              data: {
                  clients: clients || [],
                  products: products || [],
                  variations: variations || [],
                  sales: sales || [],
                  saleItems: saleItems || [],
                  accounts: accounts || [],
                  transactions: txs || [],
                  paymentMethods: methods || []
              }
          };

          const jsonStr = JSON.stringify(backupData, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `backup-pijama-manager-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (e) {
          alert("Erro ao gerar backup: " + e);
      } finally {
          setBackupLoading(false);
      }
  };

  const handleSyncFinancial = async () => {
    if (!confirm("Isso irá criar lançamentos financeiros para TODAS as vendas já realizadas e pagas que ainda não constam no extrato. Deseja continuar?")) return;
    setSyncLoading(true);

    try {
        // 1. Get default account
        const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
        const accountId = defaultAccount ? defaultAccount.id : (await supabase.from('bank_accounts').select('id').limit(1).single()).data?.id;

        if (!accountId) throw new Error("Nenhuma conta bancária padrão encontrada.");

        // 2. Get all PAID sales
        const { data: sales } = await supabase.from('vendas').select('*').eq('payment_status', 'paid');
        
        // 3. Get existing transactions descriptions to avoid duplicates (naive check)
        const { data: txs } = await supabase.from('transactions').select('description');
        const existingDescs = new Set(txs?.map(t => t.description) || []);

        let addedCount = 0;
        let totalVal = 0;

        if (sales) {
            for (const sale of sales) {
                const desc = `Venda ${sale.code} - ${sale.payment_method}`;
                
                if (!existingDescs.has(desc)) {
                    await supabase.from('transactions').insert({
                        description: desc,
                        amount: sale.total_value,
                        type: 'income',
                        account_id: accountId,
                        category: 'Vendas',
                        date: new Date(sale.created_at).toISOString().slice(0, 10)
                    });
                    totalVal += sale.total_value;
                    addedCount++;
                }
            }
        }

        if (addedCount > 0 && defaultAccount) {
            await supabase.from('bank_accounts').update({ balance: defaultAccount.balance + totalVal }).eq('id', accountId);
        }

        alert(`Sincronização concluída! ${addedCount} vendas adicionadas ao financeiro.`);

    } catch (e: any) {
        alert("Erro na sincronização: " + e.message);
    } finally {
        setSyncLoading(false);
    }
  };

  // --- USERS LOGIC ---
  const handleEditUser = (u?: Profile) => {
      if (u) {
          setEditingUserData({ ...u }); // Load existing
      } else {
          setEditingUserData({ username: '', password: '', role: 'employee' }); // New
      }
      setIsEditingUser(true);
  };

  const saveUser = async () => {
      if (!editingUserData.username || !editingUserData.password) return alert("Usuário e senha obrigatórios");
      
      const payload = {
          username: editingUserData.username,
          password: editingUserData.password,
          role: editingUserData.role
      };

      let error;
      if (editingUserData.id) {
          const { error: err } = await supabase.from('profiles').update(payload).eq('id', editingUserData.id);
          error = err;
      } else {
          const { error: err } = await supabase.from('profiles').insert(payload);
          error = err;
      }

      if (error) alert("Erro ao salvar usuário: " + error.message);
      else {
          setIsEditingUser(false);
          fetchUsers();
      }
  };

  const deleteUser = async (id: string) => {
      if (id === currentUser?.id) return alert("Você não pode excluir a si mesmo.");
      if (confirm('Tem certeza que deseja excluir este usuário?')) {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) alert("Erro ao excluir.");
          else fetchUsers();
      }
  };

  // --- PAYMENTS LOGIC ---
  const fetchPaymentMethods = async () => {
    const { data } = await supabase.from('payment_methods').select('*').order('id');
    if (data) setMethods(data);
  };

  const handleEditMethod = (method?: PaymentMethod) => {
      if (method) {
          setCurrentMethod(method);
          const ratesArr = Object.entries(method.rates || {}).map(([k, v]) => ({
              installments: k,
              rate: v.toString()
          }));
          setTempRates(ratesArr.length > 0 ? ratesArr : [{ installments: '1', rate: '0' }]);
      } else {
          setCurrentMethod({ name: '', type: 'credit', rates: {} });
          setTempRates([{ installments: '1', rate: '0' }]);
      }
      setIsEditingMethod(true);
  };

  const handleRateChange = (index: number, field: 'installments' | 'rate', value: string) => {
      const newRates = [...tempRates];
      newRates[index][field] = value;
      setTempRates(newRates);
  };

  const addRateRow = () => setTempRates([...tempRates, { installments: '', rate: '' }]);
  const removeRateRow = (index: number) => setTempRates(tempRates.filter((_, i) => i !== index));

  const saveMethod = async () => {
      if (!currentMethod.name) return alert("Nome é obrigatório");
      const ratesObj: Record<string, number> = {};
      tempRates.forEach(r => {
          if (r.installments && r.rate) ratesObj[r.installments] = parseFloat(r.rate);
      });

      const payload = {
          name: currentMethod.name,
          type: currentMethod.type,
          rates: ratesObj,
          active: true
      };

      if (currentMethod.id) await supabase.from('payment_methods').update(payload).eq('id', currentMethod.id);
      else await supabase.from('payment_methods').insert(payload);

      setIsEditingMethod(false);
      fetchPaymentMethods();
  };

  const deleteMethod = async (id: number) => {
      if (confirm('Excluir este método de pagamento?')) {
          await supabase.from('payment_methods').delete().eq('id', id);
          fetchPaymentMethods();
      }
  };

  const copyScript = (script: string, id: string) => {
      navigator.clipboard.writeText(script);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações</h2>
            <p className="text-slate-500 dark:text-slate-400">Gerencie sistema, usuários e pagamentos.</p>
        </div>
        <div className="flex flex-wrap bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
            {['general', 'users', 'payments', 'database'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-primary-100 text-primary-700 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                    {tab === 'general' ? 'Geral' : tab === 'users' ? 'Usuários' : tab === 'payments' ? 'Pagamentos' : 'Banco de Dados'}
                </button>
            ))}
        </div>
      </div>

      {/* --- ABA GERAL --- */}
      {activeTab === 'general' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
               <h3 className="text-lg font-bold dark:text-white flex items-center"><Store className="mr-2" size={20}/> Identidade da Loja</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                       <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nome da Loja</label>
                       <input 
                           value={storeSettings.store_name}
                           onChange={e => setStoreSettings({...storeSettings, store_name: e.target.value})}
                           className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                       />
                   </div>
                   
                   <div>
                       <label className="block text-sm font-medium mb-1 dark:text-slate-300">Logotipo</label>
                       <div className="flex items-start gap-4">
                           {storeSettings.logo_url ? (
                               <div className="relative w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600">
                                   <img src={storeSettings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                                   <button onClick={() => setStoreSettings({...storeSettings, logo_url: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><Trash2 size={12} /></button>
                               </div>
                           ) : (
                               <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-lg flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-500 text-slate-400">
                                   <ImageIcon size={24} />
                                   <span className="text-[10px] mt-1">Sem logo</span>
                               </div>
                           )}
                           
                           <div className="flex-1">
                               <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                                   {uploadingLogo ? <Loader size={18} className="mr-2 animate-spin"/> : <Upload size={18} className="mr-2 text-slate-500" />}
                                   <span className="text-sm dark:text-slate-300">{uploadingLogo ? 'Enviando...' : 'Fazer Upload'}</span>
                                   <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                               </label>
                           </div>
                       </div>
                   </div>

                   <div>
                       <label className="block text-sm font-medium mb-1 dark:text-slate-300">Cor de Destaque</label>
                       <div className="flex items-center gap-3">
                            <input type="color" value={storeSettings.theme_color} onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})} className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-600" />
                            <span className="text-sm text-slate-500 font-mono">{storeSettings.theme_color}</span>
                       </div>
                   </div>
               </div>

               <div className="pt-4 border-t dark:border-slate-700 flex justify-end">
                    <button onClick={saveGeneralSettings} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 flex items-center">
                        <Save size={18} className="mr-2"/> Salvar
                    </button>
               </div>
          </div>
      )}

      {/* --- ABA USUÁRIOS --- */}
      {activeTab === 'users' && (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold dark:text-white">Gerenciar Usuários</h3>
                  <button onClick={() => handleEditUser()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm">
                      <Plus size={16} className="mr-2"/> Novo Usuário
                  </button>
              </div>

              {isEditingUser && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <h4 className="font-bold mb-4 dark:text-white">{editingUserData.id ? 'Editar Usuário' : 'Novo Usuário'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                              <label className="block text-xs font-bold mb-1 dark:text-slate-300">Nome de Usuário</label>
                              <div className="relative">
                                <User className="absolute left-2 top-2 text-slate-400" size={16}/>
                                <input 
                                    value={editingUserData.username}
                                    onChange={e => setEditingUserData({...editingUserData, username: e.target.value})}
                                    className="w-full pl-8 p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder="Ex: vendedor1"
                                />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold mb-1 dark:text-slate-300">Senha</label>
                              <div className="relative">
                                <Lock className="absolute left-2 top-2 text-slate-400" size={16}/>
                                <input 
                                    value={editingUserData.password}
                                    onChange={e => setEditingUserData({...editingUserData, password: e.target.value})}
                                    className="w-full pl-8 p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder="Senha"
                                />
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold mb-1 dark:text-slate-300">Permissão</label>
                              <select 
                                  value={editingUserData.role}
                                  onChange={e => setEditingUserData({...editingUserData, role: e.target.value as any})}
                                  className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                              >
                                  <option value="employee">Funcionário</option>
                                  <option value="admin">Administrador</option>
                              </select>
                          </div>
                      </div>
                      <div className="flex justify-end gap-2">
                          <button onClick={() => setIsEditingUser(false)} className="px-4 py-2 text-slate-500 text-sm">Cancelar</button>
                          <button onClick={saveUser} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold">Salvar</button>
                      </div>
                  </div>
              )}

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm">
                          <tr>
                              <th className="p-3">Usuário</th>
                              <th className="p-3">Permissão</th>
                              <th className="p-3 text-right">Ações</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {users.map(u => (
                              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                  <td className="p-3 flex items-center dark:text-white">
                                      <div className="bg-slate-200 dark:bg-slate-600 p-1 rounded-full mr-2"><User size={16}/></div>
                                      {u.username} 
                                      {u.id === currentUser?.id && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1 rounded">(Você)</span>}
                                  </td>
                                  <td className="p-3">
                                      <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                          {u.role}
                                      </span>
                                  </td>
                                  <td className="p-3 text-right">
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => handleEditUser(u)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Palette size={16}/></button>
                                          <button onClick={() => deleteUser(u.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- ABA PAGAMENTOS --- */}
      {activeTab === 'payments' && (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold dark:text-white">Métodos de Pagamento</h3>
                  <button onClick={() => handleEditMethod()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm">
                      <Plus size={16} className="mr-2"/> Novo Método
                  </button>
              </div>

              {isEditingMethod && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      {/* Formulário de Método (igual ao anterior) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                              <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nome</label>
                              <input value={currentMethod.name} onChange={e => setCurrentMethod({...currentMethod, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium mb-1 dark:text-slate-300">Tipo</label>
                              <select value={currentMethod.type} onChange={e => setCurrentMethod({...currentMethod, type: e.target.value as any})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                  <option value="credit">Crédito</option>
                                  <option value="debit">Débito</option>
                                  <option value="pix">Pix</option>
                                  <option value="cash">Dinheiro</option>
                              </select>
                          </div>
                      </div>
                      
                      {currentMethod.type === 'credit' && (
                          <div className="mb-4 space-y-2">
                              <label className="block text-sm font-medium dark:text-slate-300">Taxas</label>
                              {tempRates.map((r, idx) => (
                                  <div key={idx} className="flex gap-2 items-center">
                                      <input className="w-20 p-2 text-sm border rounded dark:bg-slate-800 dark:text-white" placeholder="Parc." value={r.installments} onChange={e => handleRateChange(idx, 'installments', e.target.value)} />
                                      <input className="flex-1 p-2 text-sm border rounded dark:bg-slate-800 dark:text-white" placeholder="Taxa %" value={r.rate} onChange={e => handleRateChange(idx, 'rate', e.target.value)} />
                                      <button onClick={() => removeRateRow(idx)} className="text-red-500"><Trash2 size={16}/></button>
                                  </div>
                              ))}
                              <button onClick={addRateRow} className="text-xs text-primary-600 flex items-center"><Plus size={12} className="mr-1"/> Add Taxa</button>
                          </div>
                      )}

                      <div className="flex justify-end gap-2">
                          <button onClick={() => setIsEditingMethod(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                          <button onClick={saveMethod} className="px-4 py-2 bg-green-600 text-white rounded">Salvar</button>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {methods.map(m => (
                      <div key={m.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700 flex justify-between items-start">
                          <div>
                              <div className="flex items-center gap-2">
                                  <CreditCard size={18} className="text-primary-500"/>
                                  <h4 className="font-bold dark:text-white">{m.name}</h4>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 uppercase">{m.type}</p>
                          </div>
                          <div className="flex gap-1">
                              <button onClick={() => handleEditMethod(m)} className="p-2 text-blue-500 hover:bg-blue-50 rounded"><Palette size={16}/></button>
                              <button onClick={() => deleteMethod(m.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- ABA BANCO DE DADOS (MIGRATIONS & BACKUP) --- */}
      {activeTab === 'database' && (
          <div className="space-y-8">
              {/* Backup Section */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                          <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center"><Shield className="mr-2" size={20}/> Backup & Segurança</h3>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              O banco de dados é hospedado na nuvem (Supabase) e possui backups automáticos na infraestrutura deles.
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
