
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Product, CartItem, Client, ProductVariation } from '../types';
import { Search, ShoppingBag, Trash, CreditCard, UserPlus, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const POS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
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
    const { data: clientData } = await supabase.from('clients').select('id, full_name');
    
    if (prodData && varData) {
      const merged = prodData.map(p => ({
        ...p,
        variations: varData.filter(v => v.product_id === p.id)
      })).filter(p => p.variations && p.variations.length > 0);
      setProducts(merged);
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
        // Fallback direct update for this demo:
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

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(search.toLowerCase()) || 
    p.variations?.some(v => v.model_variant.toLowerCase().includes(search.toLowerCase()) || v.sku.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Buscar por nome, modelo, sku..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white truncate" title={product.nome}>{product.nome}</h3>
              <p className="text-xs text-slate-500 mb-3">{product.categoria}</p>
              
              <div className="flex-1 overflow-y-auto max-h-40 space-y-2">
                {product.variations?.map(v => (
                  <button 
                    key={v.id}
                    onClick={() => addToCart(product, v)}
                    className="w-full text-left p-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:border-primary-500 transition-colors group"
                  >
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm dark:text-slate-200">{v.model_variant}</span>
                        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-500 px-1 rounded">{v.size}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">{v.sku}</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(v.price_sale)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-white dark:bg-slate-800 rounded-lg shadow flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h2 className="font-bold text-lg dark:text-white flex items-center">
                <ShoppingBag className="mr-2" size={20}/> Carrinho
            </h2>
            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-bold">{cart.length} itens</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 && (
                <div className="text-center text-slate-400 mt-10">Carrinho vazio</div>
            )}
            {cart.map((item, idx) => (
                <div key={`${item.variation.id}-${idx}`} className="flex justify-between items-start border-b border-slate-100 dark:border-slate-700 pb-2">
                    <div className="flex-1">
                        <p className="font-medium text-slate-800 dark:text-white text-sm">{item.product.nome}</p>
                        <p className="text-xs text-slate-500">
                            {item.variation.model_variant} | Tam: {item.variation.size}
                        </p>
                        <p className="text-xs font-bold text-primary-600">{formatCurrency(item.customPrice || item.variation.price_sale)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">x{item.quantity}</span>
                        <button onClick={() => removeFromCart(item.variation.id)} className="text-red-400 hover:text-red-600">
                            <Trash size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-4">
            <select 
                className="w-full p-2 rounded border dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
            >
                <option value="">Cliente Não Identificado</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>

            <div className="flex justify-between items-end">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => { setTransactionType('quote'); setIsPaymentModalOpen(true); }}
                    disabled={cart.length === 0}
                    className="py-3 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                    Condicional
                </button>
                <button 
                    onClick={() => { setTransactionType('sale'); setIsPaymentModalOpen(true); }}
                    disabled={cart.length === 0}
                    className="py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                    Finalizar
                </button>
            </div>
        </div>
      </div>

      {/* Payment Modal (Reused Logic) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4 dark:text-white">
                    {transactionType === 'sale' ? 'Pagamento' : 'Confirmar Condicional'}
                </h3>
                
                {transactionType === 'sale' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-slate-300">Método</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['credit', 'debit', 'pix', 'cash'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setPaymentMethod(m)}
                                        className={`p-2 rounded border text-sm capitalize ${paymentMethod === m ? 'bg-primary-100 border-primary-500 text-primary-700' : 'border-slate-200 dark:border-slate-600 dark:text-slate-300'}`}
                                    >
                                        {m === 'credit' ? 'Crédito' : m === 'debit' ? 'Débito' : m}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {paymentMethod === 'credit' && (
                             <div>
                                <label className="block text-sm font-medium mb-1 dark:text-slate-300">Parcelas</label>
                                <select 
                                    value={installments} 
                                    onChange={e => setInstallments(Number(e.target.value))}
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    {[1,2,3,4,5,6].map(i => (
                                        <option key={i} value={i}>{i}x de {formatCurrency(total / i)}</option>
                                    ))}
                                </select>
                             </div>
                        )}
                    </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded mb-6 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-300">Valor Total</p>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">{formatCurrency(total)}</p>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-2 text-slate-600 dark:text-slate-300">Cancelar</button>
                    <button onClick={finalizeTransaction} className="flex-1 py-2 bg-primary-600 text-white rounded font-bold">
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
