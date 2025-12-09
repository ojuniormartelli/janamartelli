
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, CartItem, Client, ProductVariation, PaymentMethod } from '../types';
import { Search, ShoppingBag, Trash, UserPlus, CheckCircle, X, Save, User, Mail, MapPin, AlertCircle, Tag, TrendingDown, DollarSign, Percent, ScanBarcode, Clock, CreditCard, ClipboardList } from 'lucide-react';
import { formatCurrency, maskCPF, maskPhone, getLocalDate } from '../utils/formatters';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const getSizeWeight = (size: string) => {
  const weights: Record<string, number> = {
    'RN': 0, 'PB': 1, '1': 2, '2': 3, '3': 4, '4': 5, '6': 6, '8': 7, '10': 8, '12': 9, '14': 10, '16': 11,
    'PP': 20, 'P': 21, 'M': 22, 'G': 23, 'GG': 24, 'XG': 25, 'XXG': 26, 'U': 100
  };
  return weights[size.toUpperCase()] || 99;
};

export const POS: React.FC = () => {
  const { user } = useAuth();
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
  
  // Pending Sale State (Fiado)
  const [isPendingSale, setIsPendingSale] = useState(false);
  
  // Discount States
  const [discountVal, setDiscountVal] = useState(''); 
  const [discountType, setDiscountType] = useState<'money' | 'percent'>('money');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ full_name: '', cpf: '', phone: '', email: '', address: '' });
  
  // Discount Modal State (Item level)
  const [discountItemIndex, setDiscountItemIndex] = useState<number | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  const [transactionType, setTransactionType] = useState<'sale' | 'quote'>('sale');
  const location = useLocation();
  const navigate = useNavigate();

  // Barcode Buffer
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);

  useEffect(() => {
    loadData();
  }, []);

  // --- BARCODE SCANNER LISTENER ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
             return; 
        }

        if (isPaymentModalOpen || isNewClientModalOpen || discountItemIndex !== null) return;

        const currentTime = Date.now();
        const timeDiff = currentTime - lastKeyTime.current;
        lastKeyTime.current = currentTime;

        if (e.key === 'Enter') {
            if (barcodeBuffer.current.length > 0) {
                processBarcode(barcodeBuffer.current);
                barcodeBuffer.current = '';
            }
            return;
        }

        if (timeDiff > 100) {
            barcodeBuffer.current = '';
        }

        if (e.key.length === 1) {
            barcodeBuffer.current += e.key;
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [products, isPaymentModalOpen, isNewClientModalOpen, discountItemIndex]);


  const processBarcode = (sku: string) => {
      if (!sku) return;
      const cleanSku = sku.trim().toUpperCase();

      let foundProduct: Product | undefined;
      let foundVariation: ProductVariation | undefined;

      for (const p of products) {
          const v = p.variations?.find(variation => variation.sku && variation.sku.toUpperCase() === cleanSku);
          if (v) {
              foundProduct = p;
              foundVariation = v;
              break;
          }
      }

      if (foundProduct && foundVariation) {
          addToCart(foundProduct, foundVariation);
          if (search.toUpperCase() === cleanSku) {
              setSearch('');
          }
      } else {
          console.log(`Produto com SKU ${sku} não encontrado.`);
      }
  };

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

  useEffect(() => {
      if (location.state?.conversionSale) {
          const sale = location.state.conversionSale;
          if (sale.client_id) setSelectedClient(sale.client_id);
          if (sale.items) {
              const convertedCart: CartItem[] = [];
              sale.items.forEach((item: any) => {
                  const variation = item.product_variation;
                  const product = variation?.products; 
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
          navigate(location.pathname, { replace: true, state: {} });
      }
  }, [location.state, navigate]);

  const addToCart = (product: Product, variation: ProductVariation) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.variation.id === variation.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        if (existing.quantity >= variation.quantity) {
            alert("Estoque insuficiente!");
            return prev;
        }
        const newCart = [...prev];
        newCart[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
        return newCart;
      }
      return [...prev, { product, variation, quantity: 1 }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const openDiscountModal = (index: number) => {
      setDiscountItemIndex(index);
      const currentPrice = cart[index].customPrice || cart[index].variation.price_sale;
      setDiscountValue(currentPrice.toString());
  };

  const applyDiscount = () => {
      if (discountItemIndex === null) return;
      const newVal = parseFloat(discountValue.replace(',', '.'));
      if (isNaN(newVal) || newVal < 0) return alert("Valor inválido");

      setCart(prev => {
          const newCart = [...prev];
          newCart[discountItemIndex] = { ...newCart[discountItemIndex], customPrice: newVal };
          return newCart;
      });
      setDiscountItemIndex(null);
  };

  const rawTotal = cart.reduce((acc, item) => acc + (item.customPrice || item.variation.price_sale) * item.quantity, 0);
  
  const discountInput = parseFloat(discountVal.replace(',', '.')) || 0;
  
  const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);
  const isCredit = selectedMethod?.type === 'credit';
  
  const subTotalWithInterest = (isCredit && applyInterest && !isPendingSale)
    ? rawTotal * (1 + (interestRate / 100)) 
    : rawTotal;
  
  const calculatedDiscountValue = discountType === 'percent' 
    ? subTotalWithInterest * (discountInput / 100)
    : discountInput;

  const finalTotal = Math.max(0, subTotalWithInterest - calculatedDiscountValue);

  const handleOpenPayment = (type: 'sale' | 'quote') => {
      if (!selectedClient) {
          alert("Por favor, selecione um cliente antes de finalizar.");
          return;
      }
      setTransactionType(type);
      setDiscountVal('');
      setDiscountType('money');
      setIsPendingSale(false); 
      setIsPaymentModalOpen(true);
      if (paymentMethods.length > 0) handleMethodSelect(paymentMethods[0].id);
  };

  const handleMethodSelect = (id: number) => {
      setSelectedMethodId(id);
      setInstallments(1);
      setApplyInterest(true); 
      const method = paymentMethods.find(m => m.id === id);
      if (method) {
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
    const prefix = transactionType === 'sale' ? 'V' : 'C';
    const { data: code } = await supabase.rpc('get_next_code', { prefix });

    const method = paymentMethods.find(m => m.id === selectedMethodId);
    const isCreditPayment = method?.type === 'credit';

    const finalPaymentStatus = transactionType === 'sale' 
        ? (isPendingSale ? 'pending' : 'paid') 
        : 'pending';

    const finalMethodName = isPendingSale 
        ? 'A Receber' 
        : (method ? method.name : 'Outros');

    const { data: sale, error } = await supabase.from('vendas').insert({
        code: code, 
        client_id: selectedClient,
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        total_value: finalTotal,
        payment_method: finalMethodName,
        payment_status: finalPaymentStatus,
        status_label: transactionType === 'sale' ? 'Venda' : 'Condicional',
        payment_details: { 
            installments: (isCreditPayment && !isPendingSale) ? installments : 1, 
            interest_rate: (isCreditPayment && applyInterest && !isPendingSale) ? interestRate : 0, 
            raw_value: rawTotal,
            method_type: isPendingSale ? 'pending' : method?.type,
            interest_applied: (isCreditPayment && applyInterest && !isPendingSale),
            discount_applied: calculatedDiscountValue,
            discount_type: discountType
        }
    }).select().single();

    if (error || !sale) {
        alert("Erro ao finalizar: " + (error?.message || 'Desconhecido'));
        return;
    }

    const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_variation_id: item.variation.id,
        quantity: item.quantity,
        unit_price: item.customPrice || item.variation.price_sale,
        original_cost: item.variation.price_cost
    }));

    await supabase.from('venda_itens').insert(saleItems);

    // 4. Update Stock (Always - Sale or Conditional)
    // O estoque é baixado aqui para garantir que o produto não seja vendido para outro enquanto estiver em condicional.
    for (const item of cart) {
        const { data: currentVar } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.variation.id).single();
        if(currentVar) {
            await supabase.from('estoque_tamanhos').update({ quantity: currentVar.quantity - item.quantity}).eq('id', item.variation.id);
        }
    }
    
    if (transactionType === 'sale' && !isPendingSale && method) {
        const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
        const accountId = defaultAccount ? defaultAccount.id : (await supabase.from('bank_accounts').select('id').limit(1).single()).data?.id;

        if (accountId) {
             await supabase.from('transactions').insert({
                 description: `Venda ${code} - ${method.name}`,
                 amount: finalTotal,
                 type: 'income',
                 account_id: accountId,
                 category: 'Vendas',
                 date: getLocalDate()
             });
             if (defaultAccount) {
                 await supabase.from('bank_accounts').update({ balance: defaultAccount.balance + finalTotal }).eq('id', accountId);
             }
        }
    }

    // Mensagem Confirmando Baixa de Estoque
    let msg = '';
    if (isPendingSale) {
        msg = `Venda ${code} registrada como PENDENTE (Fiado). Estoque atualizado (Baixado).`;
    } else if (transactionType === 'quote') {
        msg = `Condicional ${code} gerada. Itens baixados do estoque com sucesso.`;
    } else {
        msg = `Venda ${code} realizada com sucesso! Estoque atualizado.`;
    }

    alert(msg);
    setCart([]);
    setIsPaymentModalOpen(false);
    setSelectedClient('');
    window.history.replaceState({}, document.title);
    navigate(location.pathname, { replace: true, state: {} });
    loadData();
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

  const getInstallmentOptions = () => {
      if (!selectedMethod?.rates) return [];
      return Object.keys(selectedMethod.rates)
        .sort((a,b) => parseInt(a) - parseInt(b));
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Product Catalog */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 dark:text-white"
                placeholder="Buscar por nome ou bipar código (SKU)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') processBarcode(search);
                }}
                autoFocus
                />
            </div>
            <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400" title="Leitor de Código de Barras Ativo">
                <ScanBarcode size={20} />
            </div>
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
                                <div className="flex justify-between items-start mt-1">
                                     <p className="text-xs text-slate-500">{product.categoria}</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-60 p-3 space-y-4">
                                {Object.keys(variationsByModel).sort().map(model => {
                                    // Pega a referência do primeiro item deste modelo, ou usa a do produto pai
                                    const variantRef = variationsByModel[model][0]?.reference || product.modelo;
                                    return (
                                        <div key={model} className="space-y-2">
                                            <div className="border-b border-slate-200 dark:border-slate-600 pb-1">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block">{model}</span>
                                                {variantRef && (
                                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-700/50 px-1 rounded inline-block mt-0.5">
                                                        Ref: {variantRef}
                                                    </span>
                                                )}
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
                                    );
                                })}
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
                        
                        {/* Reference Display in Cart */}
                        {(item.variation.reference || item.product.modelo) && (
                             <p className="text-[10px] text-slate-400 font-mono leading-tight mt-0.5">
                                Ref: {item.variation.reference || item.product.modelo}
                             </p>
                        )}
                        {item.variation.sku && (
                             <p className="text-[10px] text-slate-300 font-mono leading-tight mt-0.5">SKU: {item.variation.sku}</p>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                             <p className="text-xs font-bold text-primary-600">{formatCurrency(item.customPrice || item.variation.price_sale)}</p>
                             {item.customPrice && item.customPrice !== item.variation.price_sale && (
                                 <span className="text-[10px] line-through text-slate-400">{formatCurrency(item.variation.price_sale)}</span>
                             )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => openDiscountModal(idx)}
                            className="text-slate-400 hover:text-blue-500 p-1 rounded"
                            title="Editar Preço (Desconto)"
                        >
                            <Tag size={16} />
                        </button>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">x{item.quantity}</span>
                        <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash size={16} /></button>
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
                <button 
                    onClick={() => handleOpenPayment('quote')} 
                    disabled={cart.length === 0} 
                    className="py-3 bg-amber-100 text-amber-800 rounded-lg font-bold border border-amber-200 disabled:opacity-50 text-sm flex flex-col items-center justify-center leading-tight hover:bg-amber-200 transition-colors"
                >
                    <span className="flex items-center"><ClipboardList size={16} className="mr-1"/> Condicional</span>
                    <span className="text-[10px] font-normal opacity-80">(Baixa Estoque)</span>
                </button>
                <button 
                    onClick={() => handleOpenPayment('sale')} 
                    disabled={cart.length === 0} 
                    className="py-3 bg-primary-600 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 text-sm flex items-center justify-center hover:bg-primary-700 transition-colors"
                >
                    <CheckCircle size={18} className="mr-2"/> Finalizar
                </button>
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
                    
                    <input className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="E-mail (Opcional)" value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})} />
                    <textarea 
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none h-20" 
                        placeholder="Endereço (Opcional)" 
                        value={newClientData.address} 
                        onChange={e => setNewClientData({...newClientData, address: e.target.value})} 
                    />

                    <button onClick={handleQuickSaveClient} className="w-full py-2 bg-primary-600 text-white rounded font-bold mt-2">Salvar</button>
                </div>
            </div>
        </div>
      )}
      
      {/* Discount / Custom Price Modal */}
      {discountItemIndex !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-80 shadow-2xl">
                  <h4 className="font-bold mb-4 dark:text-white">Alterar Preço Unitário</h4>
                  <p className="text-xs text-slate-500 mb-2">Preço de Venda Original: {formatCurrency(cart[discountItemIndex].variation.price_sale)}</p>
                  <input 
                      type="number" 
                      autoFocus
                      className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mb-4 font-bold text-lg"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setDiscountItemIndex(null)} className="px-3 py-2 text-slate-500">Cancelar</button>
                      <button onClick={applyDiscount} className="px-3 py-2 bg-blue-600 text-white rounded font-bold">Aplicar</button>
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
                    <div className="mb-4">
                         {/* TOGGLE VENDA PENDENTE / FIADO */}
                        <div 
                            className={`flex items-center p-3 rounded-lg border cursor-pointer mb-4 transition-colors ${isPendingSale ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}
                            onClick={() => setIsPendingSale(!isPendingSale)}
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isPendingSale ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-300'}`}>
                                {isPendingSale && <CheckCircle size={14} />}
                            </div>
                            <div className="flex-1">
                                <span className="font-bold text-sm block dark:text-white">Venda a Prazo / Fiado</span>
                                <span className="text-xs text-slate-500 dark:text-slate-300">Marcar como "A Receber". O estoque sai, mas o dinheiro não entra agora.</span>
                            </div>
                            <Clock size={20} className={isPendingSale ? 'text-amber-500' : 'text-slate-300'} />
                        </div>

                        {!isPendingSale && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
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

                                {/* EXIBIR PARCELAMENTO APENAS SE FOR CRÉDITO */}
                                {selectedMethod?.type === 'credit' && selectedMethod?.rates && Object.keys(selectedMethod.rates).length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-slate-300">Parcelamento</label>
                                        <select 
                                            value={installments} 
                                            onChange={e => handleInstallmentChange(Number(e.target.value))}
                                            className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        >
                                            {getInstallmentOptions().map(i => (
                                                <option key={i} value={i}>
                                                    {i}x {selectedMethod.rates[i] > 0 ? `(Juros: ${selectedMethod.rates[i]}%)` : '(Sem Juros)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* EXIBIR JUROS APENAS SE FOR CRÉDITO */}
                                {selectedMethod?.type === 'credit' && interestRate > 0 && (
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
                    </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-6 border border-slate-100 dark:border-slate-600">
                    {/* Discount Input */}
                    {transactionType === 'sale' && (
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Desconto</label>
                            <div className="flex gap-2">
                                <div className="flex rounded-md shadow-sm">
                                    <button 
                                        type="button"
                                        onClick={() => setDiscountType('money')}
                                        className={`px-3 py-2 text-sm font-medium border rounded-l-md ${discountType === 'money' ? 'bg-white text-primary-600 border-primary-500' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                                    >
                                        R$
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setDiscountType('percent')}
                                        className={`px-3 py-2 text-sm font-medium border rounded-r-md border-l-0 ${discountType === 'percent' ? 'bg-white text-primary-600 border-primary-500' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                                    >
                                        %
                                    </button>
                                </div>
                                <div className="relative flex-1">
                                    {discountType === 'money' ? (
                                        <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    ) : (
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                    )}
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="w-full pl-9 p-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white font-medium"
                                        placeholder="0,00"
                                        value={discountVal}
                                        onChange={e => setDiscountVal(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1 border-t border-slate-200 dark:border-slate-600 pt-3">
                         <div className="flex justify-between text-sm text-slate-500">
                            <span>Subtotal</span>
                            <span>{formatCurrency(rawTotal)}</span>
                        </div>
                        {selectedMethod?.type === 'credit' && interestRate > 0 && applyInterest && !isPendingSale && (
                            <div className="flex justify-between text-sm text-red-500">
                                <span>Juros ({interestRate}%)</span>
                                <span>+ {formatCurrency(rawTotal * (interestRate/100))}</span>
                            </div>
                        )}
                        {calculatedDiscountValue > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Desconto {discountType === 'percent' ? `(${discountVal}%)` : ''}</span>
                                <span>- {formatCurrency(calculatedDiscountValue)}</span>
                            </div>
                        )}
                    </div>
                   
                    <div className="text-center mt-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor Final</p>
                        <p className={`text-4xl font-bold mt-1 ${isPendingSale ? 'text-amber-500' : 'text-slate-800 dark:text-white'}`}>{formatCurrency(finalTotal)}</p>
                        {installments > 1 && applyInterest && isCredit && !isPendingSale && (
                            <p className="text-sm text-primary-600 mt-1">{installments}x de {formatCurrency(finalTotal/installments)}</p>
                        )}
                        {isPendingSale && (
                            <p className="text-xs text-amber-600 font-bold mt-2 uppercase bg-amber-50 inline-block px-2 py-1 rounded">Pagamento Pendente</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-medium border rounded-lg hover:bg-slate-50">Cancelar</button>
                    <button 
                        onClick={finalizeTransaction} 
                        className={`flex-1 py-3 text-white rounded-lg font-bold shadow-lg ${isPendingSale ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary-600 hover:bg-primary-700'}`}
                    >
                        {isPendingSale ? 'Salvar como Pendente' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
