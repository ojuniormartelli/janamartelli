
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Product, CartItem, Client, ProductVariation } from '../types';
import { Search, ShoppingBag, Trash, UserPlus, CheckCircle, X, Save, User, Mail, MapPin } from 'lucide-react';
import { formatCurrency, maskCPF, maskPhone } from '../utils/formatters';

// Helper para ordenação de tamanhos
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // New Client Modal State
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
      full_name: '', cpf: '', phone: '', email: '', address: ''
  });
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [installments, setInstallments] = useState(1);
  const [transactionType, setTransactionType] = useState<'sale' | 'quote'>('sale');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Fetch active products with variations
    const { data: prodData } = await supabase.from('products').select('*').eq('active', true);
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*').gt('quantity', 0);
    const { data: clientData } = await supabase.from('clients').select('*').order('full_name');
    
    if (prodData && varData) {
      // 1. Merge Variations into Parents
      const rawProducts = prodData.map(p => ({
        ...p,
        variations: varData.filter(v => v.product_id === p.id)
      })).filter(p => p.variations && p.variations.length > 0);

      // 2. Client-Side Grouping by NAME (Unify products with exact same name)
      const groupedMap = new Map<string, Product>();

      rawProducts.forEach(p => {
        const normalizedName = p.nome.trim();
        if (groupedMap.has(normalizedName)) {
            const existing = groupedMap.get(normalizedName)!;
            // Merge variations
            existing.variations = [...(existing.variations || []), ...(p.variations || [])];
        } else {
            groupedMap.set(normalizedName, { ...p });
        }
      });

      // 3. Convert back to array and Sort Alphabetically
      const unifiedProducts = Array.from(groupedMap.values()).sort((a, b) => 
        a.nome.localeCompare(b.nome)
      );

      setProducts(unifiedProducts);
    }
    if (clientData) setClients(clientData);
  };

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

  const total = cart.reduce((acc, item) => acc + (item.customPrice || item.variation.price_sale) * item.quantity, 0);

  const finalizeTransaction = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // 1. Create Sale Header
    const { data: sale, error } = await supabase.from('vendas').insert({
        client_id: selectedClient || null,
        user_id: userData.user.id,
        total_value: total,
        payment_method: paymentMethod,
        payment_status: transactionType === 'sale' ? 'paid' : 'pending',
        status_label: transactionType === 'sale' ? 'Venda' : 'Condicional',
        payment_details: { installments }
    }).select().single();

    if (error || !sale) {
        alert("Erro ao finalizar venda.");
        return;
    }

    // 2. Create Sale Items
    const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_variation_id: item.variation.id,
        quantity: item.quantity,
        unit_price: item.customPrice || item.variation.price_sale,
        original_cost: item.variation.price_cost
    }));

    await supabase.from('venda_itens').insert(saleItems);

    // 3. Update Stock
    for (const item of cart) {
        const { data: currentVar } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.variation.id).single();
        if(currentVar) {
            await supabase.from('estoque_tamanhos').update({ quantity: currentVar.quantity - item.quantity}).eq('id', item.variation.id);
        }
    }

    alert(`Transação ${sale.id} finalizada com sucesso!`);
    setCart([]);
    setIsPaymentModalOpen(false);
    loadData(); // Refresh stock
  };

  const handleQuickSaveClient = async () => {
      if (!newClientData.full_name) return alert("Nome é obrigatório");
      
      const { data, error } = await supabase.from('clients').insert([newClientData]).select().single();
      
      if (error) {
          alert("Erro ao cadastrar cliente.");
      } else if (data) {
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

  // Helper to render grouped variations inside a card
  const renderProductCard = (product: Product) => {
    if (!product.variations) return null;

    // Group variations by Model/Color
    const variationsByModel: Record<string, ProductVariation[]> = {};
    product.variations.forEach(v => {
        const key = v.model_variant || 'Padrão';
        if (!variationsByModel[key]) variationsByModel[key] = [];
        variationsByModel[key].push(v);
    });

    // Sort Models Alphabetically
    const sortedModels = Object.keys(variationsByModel).sort();

    return (
        <div key={product.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all flex flex-col overflow-hidden">
            <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-600">
                <h3 className="font-bold text-slate-800 dark:text-white leading-tight" title={product.nome}>{product.nome}</h3>
                <p className="text-xs text-slate-500 mt-1">{product.categoria}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-60 p-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                {sortedModels.map(model => {
                    const modelVars = variationsByModel[model].sort((a, b) => getSizeWeight(a.size) - getSizeWeight(b.size));

                    return (
                        <div key={model} className="space-y-2">
                            <div className="flex justify-between items-baseline border-b border-slate-200 dark:border-slate-600 pb-1">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{model}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {modelVars.map(v => (
                                    <button 
                                        key={v.id}
                                        onClick={() => addToCart(product, v)}
                                        className="flex flex-col items-center justify-center bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded p-1 min-w-[3.5rem] h-14 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-500 transition-colors shadow-sm"
                                        title={`SKU: ${v.sku} | Estoque: ${v.quantity}`}
                                    >
                                        <span className="font-bold text-sm text-slate-800 dark:text-white">{v.size}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{formatCurrency(v.price_sale)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Buscar por nome, modelo, sku..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900/20">
            {filteredProducts.length === 0 ? (
                <div className="text-center text-slate-400 mt-20">Nenhum produto encontrado.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {filteredProducts.map(renderProductCard)}
                </div>
            )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-white dark:bg-slate-800 rounded-lg shadow flex flex-col border-l border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h2 className="font-bold text-lg dark:text-white flex items-center">
                <ShoppingBag className="mr-2" size={20}/> Carrinho
            </h2>
            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-bold">{cart.length} itens</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <ShoppingBag size={48} className="mb-2 opacity-20" />
                    <p>Carrinho vazio</p>
                    <p className="text-xs">Selecione produtos ao lado</p>
                </div>
            )}
            {cart.map((item, idx) => (
                <div key={`${item.variation.id}-${idx}`} className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-2 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex-1">
                        <p className="font-medium text-slate-800 dark:text-white text-sm line-clamp-1">{item.product.nome}</p>
                        <p className="text-xs text-slate-500">
                            {item.variation.model_variant} | Tam: <b>{item.variation.size}</b>
                        </p>
                        <p className="text-xs font-bold text-primary-600 mt-1">{formatCurrency(item.customPrice || item.variation.price_sale)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded px-2">
                             <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">x{item.quantity}</span>
                        </div>
                        <button onClick={() => removeFromCart(item.variation.id)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors">
                            <Trash size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-4">
            <div className="relative flex gap-2">
                <div className="relative flex-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select 
                        className="w-full pl-9 p-2 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                    >
                        <option value="">Cliente Não Identificado</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                </div>
                <button 
                    onClick={() => setIsNewClientModalOpen(true)}
                    className="p-2 bg-primary-100 text-primary-600 rounded hover:bg-primary-200 transition-colors"
                    title="Cadastro Rápido de Cliente"
                >
                    <UserPlus size={20} />
                </button>
            </div>

            <div className="flex justify-between items-end">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Total a Pagar</span>
                <span className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{formatCurrency(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => { setTransactionType('quote'); setIsPaymentModalOpen(true); }}
                    disabled={cart.length === 0}
                    className="py-3 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                    Condicional
                </button>
                <button 
                    onClick={() => { setTransactionType('sale'); setIsPaymentModalOpen(true); }}
                    disabled={cart.length === 0}
                    className="py-3 bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm"
                >
                    Finalizar Venda
                </button>
            </div>
        </div>
      </div>

      {/* New Client Modal (Quick Add) */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold dark:text-white flex items-center"><UserPlus size={18} className="mr-2"/> Cadastro Rápido</h3>
                    <button onClick={() => setIsNewClientModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="p-4 space-y-3">
                    <input 
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="Nome Completo *"
                        value={newClientData.full_name} onChange={e => setNewClientData({...newClientData, full_name: e.target.value})}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input 
                            className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="CPF"
                            value={newClientData.cpf} onChange={e => setNewClientData({...newClientData, cpf: maskCPF(e.target.value)})}
                        />
                        <input 
                            className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="Telefone"
                            value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: maskPhone(e.target.value)})}
                        />
                    </div>
                    <input 
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="Email"
                        value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})}
                    />
                    <textarea 
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white h-20 resize-none"
                        placeholder="Endereço Completo"
                        value={newClientData.address} onChange={e => setNewClientData({...newClientData, address: e.target.value})}
                    />
                    <button onClick={handleQuickSaveClient} className="w-full py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 mt-2">
                        Salvar e Selecionar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center">
                    <CheckCircle className="mr-2 text-primary-600" />
                    {transactionType === 'sale' ? 'Confirmar Pagamento' : 'Gerar Condicional'}
                </h3>
                
                {transactionType === 'sale' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 dark:text-slate-300">Forma de Pagamento</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['credit', 'debit', 'pix', 'cash'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setPaymentMethod(m)}
                                        className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${paymentMethod === m ? 'bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'border-slate-200 dark:border-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        {m === 'credit' ? 'Crédito' : m === 'debit' ? 'Débito' : m === 'cash' ? 'Dinheiro' : 'Pix'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {paymentMethod === 'credit' && (
                             <div className="animate-in slide-in-from-top-2">
                                <label className="block text-sm font-medium mb-1 dark:text-slate-300">Parcelamento</label>
                                <select 
                                    value={installments} 
                                    onChange={e => setInstallments(Number(e.target.value))}
                                    className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    {[1,2,3,4,5,6].map(i => (
                                        <option key={i} value={i}>{i}x de {formatCurrency(total / i)}</option>
                                    ))}
                                </select>
                             </div>
                        )}
                    </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-6 text-center border border-slate-100 dark:border-slate-600">
                    <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor Total</p>
                    <p className="text-4xl font-bold text-slate-800 dark:text-white mt-1">{formatCurrency(total)}</p>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                    <button onClick={finalizeTransaction} className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all">
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
