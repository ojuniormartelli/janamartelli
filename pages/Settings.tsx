
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { dbSetupScript } from '../utils/database.sql';
import { Copy, Check, CreditCard, Trash2, Plus, Save, Store, Palette, Image as ImageIcon } from 'lucide-react';
import { PaymentMethod } from '../types';

export const Settings: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'database'>('general');
  
  // Store Settings
  const [storeSettings, setStoreSettings] = useState({
      id: 1,
      store_name: '',
      theme_color: '#0ea5e9',
      logo_url: ''
  });

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
  }, []);

  const fetchSettings = async () => {
      const { data } = await supabase.from('store_settings').select('*').single();
      if (data) setStoreSettings(data);
  };

  const saveGeneralSettings = async () => {
      const { error } = await supabase.from('store_settings').upsert({
          id: 1, // Always ID 1 for single store
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

  const fetchPaymentMethods = async () => {
    const { data } = await supabase.from('payment_methods').select('*').order('id');
    if (data) setMethods(data);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dbSetupScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditMethod = (method?: PaymentMethod) => {
      if (method) {
          setCurrentMethod(method);
          // Convert rates object to array for inputs
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

  const addRateRow = () => {
      setTempRates([...tempRates, { installments: '', rate: '' }]);
  };

  const removeRateRow = (index: number) => {
      setTempRates(tempRates.filter((_, i) => i !== index));
  };

  const saveMethod = async () => {
      if (!currentMethod.name) return alert("Nome é obrigatório");

      // Convert rates array back to object
      const ratesObj: Record<string, number> = {};
      tempRates.forEach(r => {
          if (r.installments && r.rate) {
              ratesObj[r.installments] = parseFloat(r.rate);
          }
      });

      const payload = {
          name: currentMethod.name,
          type: currentMethod.type,
          rates: ratesObj,
          active: true
      };

      if (currentMethod.id) {
          await supabase.from('payment_methods').update(payload).eq('id', currentMethod.id);
      } else {
          await supabase.from('payment_methods').insert(payload);
      }

      setIsEditingMethod(false);
      fetchPaymentMethods();
  };

  const deleteMethod = async (id: number) => {
      if (confirm('Excluir este método de pagamento?')) {
          await supabase.from('payment_methods').delete().eq('id', id);
          fetchPaymentMethods();
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Configurações</h2>
            <p className="text-slate-500 dark:text-slate-400">Gerencie sistema, pagamentos e banco de dados.</p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
            <button 
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-primary-100 text-primary-700 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
            >
                Geral
            </button>
            <button 
                onClick={() => setActiveTab('payments')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'payments' ? 'bg-primary-100 text-primary-700 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
            >
                Pagamentos
            </button>
            <button 
                onClick={() => setActiveTab('database')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'database' ? 'bg-primary-100 text-primary-700 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
            >
                Banco de Dados
            </button>
        </div>
      </div>

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
                           placeholder="Minha Loja"
                       />
                   </div>
                   
                   <div>
                       <label className="block text-sm font-medium mb-1 dark:text-slate-300">URL do Logotipo</label>
                       <div className="relative">
                            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                value={storeSettings.logo_url || ''}
                                onChange={e => setStoreSettings({...storeSettings, logo_url: e.target.value})}
                                className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                placeholder="https://..."
                            />
                       </div>
                   </div>

                   <div>
                       <label className="block text-sm font-medium mb-1 dark:text-slate-300">Cor de Destaque (Botões)</label>
                       <div className="flex items-center gap-3">
                            <input 
                                type="color"
                                value={storeSettings.theme_color}
                                onChange={e => setStoreSettings({...storeSettings, theme_color: e.target.value})}
                                className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-600"
                            />
                            <span className="text-sm text-slate-500 font-mono">{storeSettings.theme_color}</span>
                       </div>
                   </div>
               </div>

               <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                    <button onClick={saveGeneralSettings} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 flex items-center">
                        <Save size={18} className="mr-2"/> Salvar Alterações
                    </button>
               </div>
          </div>
      )}

      {activeTab === 'payments' && (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold dark:text-white">Métodos de Pagamento</h3>
                  <button onClick={() => handleEditMethod()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm">
                      <Plus size={16} className="mr-2"/> Novo Método
                  </button>
              </div>

              {isEditingMethod && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                              <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nome</label>
                              <input 
                                  value={currentMethod.name}
                                  onChange={e => setCurrentMethod({...currentMethod, name: e.target.value})}
                                  className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                  placeholder="Ex: Cartão Master"
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-medium mb-1 dark:text-slate-300">Tipo</label>
                              <select 
                                  value={currentMethod.type}
                                  onChange={e => setCurrentMethod({...currentMethod, type: e.target.value as any})}
                                  className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                              >
                                  <option value="credit">Crédito (Parcelado)</option>
                                  <option value="debit">Débito</option>
                                  <option value="pix">Pix</option>
                                  <option value="cash">Dinheiro</option>
                              </select>
                          </div>
                      </div>

                      {currentMethod.type === 'credit' && (
                          <div className="mb-4">
                              <label className="block text-sm font-medium mb-2 dark:text-slate-300">Taxas de Juros por Parcela</label>
                              <div className="space-y-2">
                                  {tempRates.map((r, idx) => (
                                      <div key={idx} className="flex gap-2 items-center">
                                          <input 
                                              type="number" 
                                              placeholder="Parcela (ex: 1)" 
                                              className="w-24 p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm"
                                              value={r.installments}
                                              onChange={e => handleRateChange(idx, 'installments', e.target.value)}
                                          />
                                          <span className="text-slate-500">x</span>
                                          <div className="relative flex-1">
                                              <input 
                                                  type="number" step="0.1"
                                                  placeholder="Taxa % (ex: 5.5)" 
                                                  className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white text-sm"
                                                  value={r.rate}
                                                  onChange={e => handleRateChange(idx, 'rate', e.target.value)}
                                              />
                                              <span className="absolute right-3 top-2 text-slate-400">%</span>
                                          </div>
                                          <button onClick={() => removeRateRow(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                                      </div>
                                  ))}
                                  <button onClick={addRateRow} className="text-primary-600 text-sm hover:underline flex items-center"><Plus size={14} className="mr-1"/> Adicionar Parcela</button>
                              </div>
                          </div>
                      )}

                      <div className="flex justify-end gap-2">
                          <button onClick={() => setIsEditingMethod(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                          <button onClick={saveMethod} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
                              <Save size={16} className="mr-2"/> Salvar
                          </button>
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
                              <p className="text-xs text-slate-500 mt-1 uppercase">{m.type === 'credit' ? 'Crédito' : m.type}</p>
                              {m.type === 'credit' && (
                                  <div className="mt-2 text-xs bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                      {Object.keys(m.rates || {}).length} opções de parcelamento configuradas.
                                  </div>
                              )}
                          </div>
                          <div className="flex gap-1">
                              <button onClick={() => handleEditMethod(m)} className="p-2 text-blue-500 hover:bg-blue-50 rounded"><CreditCard size={16}/></button>
                              <button onClick={() => deleteMethod(m.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'database' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-bold dark:text-white">Script SQL de Instalação</h3>
                <button 
                    onClick={copyToClipboard}
                    className="flex items-center text-primary-600 hover:text-primary-700 font-medium text-sm"
                >
                    {copied ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
                    {copied ? 'Copiado!' : 'Copiar Script'}
                </button>
            </div>
            <div className="p-0 bg-slate-900 overflow-x-auto">
                <pre className="p-4 text-xs text-green-400 font-mono leading-relaxed select-all">
                    {dbSetupScript}
                </pre>
            </div>
          </div>
      )}
    </div>
  );
};
