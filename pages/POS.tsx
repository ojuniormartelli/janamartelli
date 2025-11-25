
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Product, CartItem, Client, ProductVariation, PaymentMethod } from '../types';
import { Search, ShoppingBag, Trash, UserPlus, CheckCircle, X, Save, User, Mail, MapPin, AlertCircle } from 'lucide-react';
import { formatCurrency, maskCPF, maskPhone } from '../utils/formatters';
import { useLocation } from 'react-router-dom';

const getSizeWeight = (size: string) => {
  const weights: Record<string, number> = {
    'RN': 0, 'PB': 1, '1': 2, '2': 3, '3': 4, '4': 5, '6': 6, '8': 7, '10': 8, '12': 9, '14': 10, '16': 11,
    'PP': 20, 'P': 21, 'M': 22, 'G': 23, 'GG': 24, 'XG': 25, 'XXG': 26, 'U': 100
  };
  return weights[size.toUpperCase()] || 99;
};

export const POS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  
  // Payment Configs
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [installments, setInstallments] = useState(1);
  const [interestRate, setInterestRate] = useState(0);
  const [applyInterest, setApplyInterest] = useState(true);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ full_name: '', cpf: '', phone: '', email: '', address: '' });
  
  const [transactionType, setTransactionType] = useState<'sale' | 'quote'>('sale');
  const location = useLocation();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: prodData } = await supabase.from('products').select('*').eq('active', true);
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*').gt('quantity', 0);
    const { data: clientData } = await supabase.from('clients').select('*').order('full_name');
    const { data: payMethods } = await supabase.from('payment_methods').select('*').eq('active', true);
    
    if (prodData && varData) {
      const rawProducts = prodData.map(p => ({
        ...p,
        variations: varData.filter(v => v.product_id === p.id)
      })).filter(p => p.variations && p.variations.length > 0);

      const groupedMap = new Map<string, Product>();

      rawProducts.forEach(p => {
        const normalizedName = p.nome.trim();
        if (groupedMap.has(normalizedName)) {
            const existing = groupedMap.get(normalizedName)!;
            existing.variations = [...(existing.variations || []), ...(p.variations || [])];
        } else {
            groupedMap.set(normalizedName, { ...p });
        }
      });

      const unifiedProducts = Array.from(groupedMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      setProducts(unifiedProducts);
    }
    
    if (clientData) setClients(clientData);
    if (payMethods) setPaymentMethods(payMethods);
  };

  // --- HANDLE CONVERSION FROM SALES PAGE ---
  useEffect(() => {
      if (location.state?.conversionSale && products.length > 0) {
          const sale = location.state.conversionSale;
          
          if (sale.client_id) {
              setSelectedClient(sale.client_id);
          }

          if (sale.items) {
              const convertedCart: CartItem[] = [];
              sale.items.forEach((item: any) => {
                  const variation = item.product_variation;
                  const product = variation?.products; 
                  
                  // Reconstruct Cart Item logic
                  if (variation && product) {
                      convertedCart.push({
                          product: product,
                          variation: variation,
                          quantity: item.quantity,
                          customPrice: item.unit_price
                      });
                  }
              });
              setCart(convertedCart);
          }
          
          // Clear state so refresh doesn't re-trigger
          window.history.replaceState({}, document.title);
      }
  }, [location.state, products]);

  const addToCart = (product: Product, variation: ProductVariation) => {
    setCart(prev => {
      const existing = prev.find(item => item.variation.id === variation.id);
      if (existing) {
        if (existing.quantity >= variation.quantity) {
            alert("Estoque insuficiente!");
            return prev;
        }
        return prev.map(item => item.variation.id === variation.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, variation, quantity: 1 }];
    });
  };

  const removeFromCart = (varId: string) => {
    setCart(prev => prev.filter(i => i.variation.id !== varId));
  };

  const rawTotal = cart.reduce((acc, item) => acc + (item.customPrice || item.variation.price_sale) * item.quantity, 0);
  
  // Calculate Total with Interest only if applyInterest is true
  const finalTotal = applyInterest 
    ? rawTotal * (1 + (interestRate / 100)) 
    : rawTotal;

  const handleOpenPayment = (type: 'sale' | 'quote') => {
      if (!selectedClient) {
          alert("Por favor, selecione um cliente antes de finalizar.");
          return;
      }
      setTransactionType(type);
      setIsPaymentModalOpen(true);
      // Reset payment selection
      if (paymentMethods.length > 0) handleMethodSelect(paymentMethods[0].id);
  };

  const handleMethodSelect = (id: number) => {
      setSelectedMethodId(id);
      setInstallments(1);
      setApplyInterest(true); // Default to applying interest
      const method = paymentMethods.find(m => m.id === id);
      if (method) {
          // Check for single installment rate (default)
          const rate = method.rates?.['1'] || 0;
          setInterestRate(rate);
      }
  };

  const handleInstallmentChange = (count: number) => {
      setInstallments(count);
      const method = paymentMethods.find(m => m.id === selectedMethodId);
      if (method) {
          const rate = method.rates?.[count.toString()] || 0;
          setInterestRate(rate);
      }
  };

  const finalizeTransaction = async () => {
    const { data: userData } = await supabase.auth.getUser();
    
    // 1. Get Formatted Code (V0001 or C0001) via RPC
    const prefix = transactionType === 'sale' ? 'V' : 'C';
    const { data: code } = await supabase.rpc('get_next_code', { prefix });

    const method = paymentMethods.find(m => m.id === selectedMethodId);

    // 2. Create Sale Header
    const { data: sale, error } = await supabase.from('vendas').insert({
        code: code, // Saved code
        client_id: selectedClient,
        user_id: userData.user?.id || '00000000-0000-0000-0000-000000000000',
        total_value: finalTotal,
        payment_method: method ? method.name : 'Outros',
        payment_status: transactionType === 'sale' ? 'paid' : 'pending',
        status_label: transactionType === 'sale' ? 'Venda' : 'Condicional',
        payment_details: { 
            installments, 
            interest_rate: applyInterest ? interestRate : 0, 
            raw_value: rawTotal,
            method_type: method?.type,
            interest_applied: applyInterest
        }
    }).select().single();

    if (error || !sale) {
        alert("Erro ao finalizar: " + (error?.message || 'Desconhecido'));
        return;
    }

    // 3. Create Sale Items
    const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_variation_id: item.variation.id,
        quantity: item.quantity,
        unit_price: item.customPrice || item.variation.price_sale,
        original_cost: item.variation.price_cost
    }));

    await supabase.from('venda_itens').insert(saleItems);

    // 4. Update Stock (Deduct for BOTH Sale and Quote based on user request)
    // "Ao colocar um produto em condicional, o produto deve ficar como pendente" -> For simplicity, we deduct from 'quantity'
    // If returned, we add it back.
    for (const item of cart) {
        const { data: currentVar } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.variation.id).single();
        if(currentVar) {
            await supabase.from('estoque_tamanhos').update({ quantity: currentVar.quantity - item.quantity}).eq('id', item.variation.id);
        }
    }

    alert(`${transactionType === 'sale' ? 'Venda' : 'Condicional'} ${code} realizada com sucesso!`);
    setCart([]);
    setIsPaymentModalOpen(false);
    loadData(); // Refresh stock
  };

  const handleQuickSaveClient = async () => {
      if (!newClientData.full_name) return alert("Nome é obrigatório");
      const { data } = await supabase.from('clients').insert([newClientData]).select().single();
      if (data) {
          setClients(prev => [...prev, data].sort((a,b) => a.full_name.localeCompare(b.full_name)));
          setSelectedClient(data.id);
          setIsNewClientModalOpen(false);
          setNewClientData({ full_name: '', cpf: '', phone: '', email: '', address: '' });
      }
  };

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(search.toLowerCase()) || 
    p.variations?.some(v => v.model_variant.toLowerCase().includes(search.toLowerCase()) || v.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 dark:text-white"
              placeholder="Buscar por nome, modelo, sku..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                    if (!product.variations) return null;
                    const variationsByModel: Record<string, ProductVariation[]> = {};
                    product.variations.forEach(v => {
                        const key = v.model_variant || 'Padrão';
                        if (!variationsByModel[key]) variationsByModel[key] = [];
                        variationsByModel[key].push(v);
                    });

                    return (
                        <div key={product.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all flex flex-col overflow-hidden">
                            <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-600">
                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{product.nome}</h3>
                                <p className="text-xs text-slate-500 mt-1">{product.categoria}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-60 p-3 space-y-4">
                                {Object.keys(variationsByModel).sort().map(model => (
                                    <div key={model} className="space-y-2">
                                        <div className="border-b border-slate-200 dark:border-slate-600 pb-1">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{model}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {variationsByModel[model].sort((a,b) => getSizeWeight(a.size) - getSizeWeight(b.size)).map(v => (
                                                <button 
                                                    key={v.id} 
                                                    onClick={() => addToCart(product, v)} 
                                                    className="flex flex-col items-center justify-center bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded p-1 min-w-[3.5rem] min-h-[3.5rem] hover:border-primary-500 shadow-sm transition-all"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-bold text-sm text-slate-800 dark:text-white">{v.size}</span>
                                                        <span className={`text-[10px] font-medium ${v.quantity < 2 ? 'text-red-500' : 'text-slate-400'}`}>
                                                            ({v.quantity})
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{formatCurrency(v.price_sale)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-white dark:bg-slate-800 rounded-lg shadow flex flex-col border-l border-slate-200 dark:border-slate-700">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-lg dark:text-white flex items-center"><ShoppingBag className="mr-2" size={20}/> Carrinho</h2>
            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-bold">{cart.length} itens</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.map((item, idx) => (
                <div key={`${item.variation.id}-${idx}`} className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-2">
                    <div className="flex-1">
                        <p className="font-medium text-slate-800 dark:text-white text-sm">{item.product.nome}</p>
                        <p className="text-xs text-slate-500">{item.variation.model_variant} | Tam: <b>{item.variation.size}</b></p>
                        <p className="text-xs font-bold text-primary-600 mt-1">{formatCurrency(item.customPrice || item.variation.price_sale)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">x{item.quantity}</span>
                        <button onClick={() => removeFromCart(item.variation.id)} className="text-red-400 hover:text-red-600"><Trash size={16} /></button>
                    </div>
                </div>
            ))}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-4">
            <div className="relative flex gap-2">
                <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select 
                        className={`w-full pl-9 p-2 text-sm rounded border ${!selectedClient ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'} dark:text-white`}
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                    >
                        <option value="">Selecione um Cliente *</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                </div>
                <button onClick={() => setIsNewClientModalOpen(true)} className="p-2 bg-primary-100 text-primary-600 rounded hover:bg-primary-200" title="Novo Cliente"><UserPlus size={20} /></button>
            </div>
            
            {!selectedClient && (
                <div className="text-xs text-red-500 flex items-center justify-center bg-red-50 p-1 rounded">
                    <AlertCircle size={12} className="mr-1"/> Obrigatório selecionar cliente
                </div>
            )}

            <div className="flex justify-between items-end">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Total</span>
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{formatCurrency(rawTotal)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleOpenPayment('quote')} disabled={cart.length === 0} className="py-3 bg-amber-100 text-amber-800 rounded-lg font-bold border border-amber-200 disabled:opacity-50 text-sm">Condicional</button>
                <button onClick={() => handleOpenPayment('sale')} disabled={cart.length === 0} className="py-3 bg-primary-600 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 text-sm">Finalizar</button>
            </div>
        </div>
      </div>

      {/* New Client Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center border-b dark:border-slate-700">
                    <h3 className="font-bold dark:text-white flex items-center"><UserPlus size={18} className="mr-2"/> Cadastro Rápido</h3>
                    <button onClick={() => setIsNewClientModalOpen(false)}><X size={20} /></button>
                </div>
                <div className="p-4 space-y-3">
                    <input className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Nome Completo *" value={newClientData.full_name} onChange={e => setNewClientData({...newClientData, full_name: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                        <input className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="CPF" value={newClientData.cpf} onChange={e => setNewClientData({...newClientData, cpf: maskCPF(e.target.value)})} />
                        <input className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Telefone" value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: maskPhone(e.target.value)})} />
                    </div>
                    <button onClick={handleQuickSaveClient} className="w-full py-2 bg-primary-600 text-white rounded font-bold mt-2">Salvar</button>
                </div>
            </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center">
                    <CheckCircle className="mr-2 text-primary-600" />
                    {transactionType === 'sale' ? 'Confirmar Pagamento' : 'Gerar Condicional'}
                </h3>
                
                {transactionType === 'sale' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 dark:text-slate-300">Forma de Pagamento</label>
                            <div className="grid grid-cols-2 gap-2">
                                {paymentMethods.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleMethodSelect(m.id)}
                                        className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${selectedMethodId === m.id ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-slate-200 dark:border-slate-600 dark:text-slate-300'}`}
                                    >
                                        {m.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedMethod?.rates && Object.keys(selectedMethod.rates).length > 0 && (
                             <div>
                                <label className="block text-sm font-medium mb-1 dark:text-slate-300">Parcelamento</label>
                                <select 
                                    value={installments} 
                                    onChange={e => handleInstallmentChange(Number(e.target.value))}
                                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    {Object.keys(selectedMethod.rates).map(i => (
                                        <option key={i} value={i}>{i}x (Juros: {selectedMethod.rates[i]}%)</option>
                                    ))}
                                </select>
                             </div>
                        )}

                        {interestRate > 0 && (
                            <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded border dark:border-slate-600">
                                <input 
                                    type="checkbox" 
                                    id="applyInterest"
                                    checked={applyInterest}
                                    onChange={(e) => setApplyInterest(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 rounded"
                                />
                                <label htmlFor="applyInterest" className="text-sm dark:text-slate-300 cursor-pointer select-none">
                                    Cobrar Juros da Maquininha (Repassar ao cliente)
                                </label>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-6 border border-slate-100 dark:border-slate-600">
                    {interestRate > 0 && applyInterest && (
                        <div className="flex justify-between text-sm text-slate-500 mb-1">
                            <span>Subtotal</span>
                            <span>{formatCurrency(rawTotal)}</span>
                        </div>
                    )}
                    {interestRate > 0 && applyInterest && (
                        <div className="flex justify-between text-sm text-red-500 mb-2">
                            <span>Juros ({interestRate}%)</span>
                            <span>+ {formatCurrency(finalTotal - rawTotal)}</span>
                        </div>
                    )}
                    <div className="text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor Final</p>
                        <p className="text-4xl font-bold text-slate-800 dark:text-white mt-1">{formatCurrency(finalTotal)}</p>
                        {installments > 1 && applyInterest && (
                            <p className="text-sm text-primary-600 mt-1">{installments}x de {formatCurrency(finalTotal/installments)}</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-medium border rounded-lg hover:bg-slate-50">Cancelar</button>
                    <button onClick={finalizeTransaction} className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-lg">Confirmar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
