
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, CartItem, Client, ProductVariation, PaymentMethod, ProductSize } from '../types';
import { Search, ShoppingBag, Trash, UserPlus, CheckCircle, X, Save, User, Mail, MapPin, AlertCircle, Tag, TrendingDown, DollarSign, Percent, ScanBarcode, Clock, CreditCard, ClipboardList } from 'lucide-react';
import { formatCurrency, maskCPF, maskPhone, getLocalDate, capitalizeName, getSizeWeight } from '../utils/formatters';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const POS: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<{ product: Product, variation: ProductVariation } | null>(null);
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
      }
  };

  const loadData = async () => {
    const { data: prodData } = await supabase.from('products').select('*').eq('active', true);
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*').gt('quantity', 0);
    const { data: clientData } = await supabase.from('clients').select('*').order('full_name');
    const { data: payMethods } = await supabase.from('payment_methods').select('*').eq('active', true);
    
    // Busca os tamanhos dinâmicos
    const { data: sizeData } = await supabase.from('product_sizes').select('*').order('sort_order');
    
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

      const unifiedProducts = Array.from(groupedMap.values()).sort((a, b) => 
        a.nome.trim().localeCompare(b.nome.trim(), 'pt-BR', { sensitivity: 'base' })
      );
      setProducts(unifiedProducts);
    }
    
    if (clientData) setClients(clientData);
    if (payMethods) setPaymentMethods(payMethods);
    if (sizeData) setSizes(sizeData);
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
      let newQty = 1;
      if (existingIndex >= 0) {
        newQty = prev[existingIndex].quantity + 1;
      }
      
      if (newQty > variation.quantity) {
          alert("Estoque insuficiente!");
          return prev;
      }

      if (existingIndex >= 0) {
        const newCart = [...prev];
        newCart[existingIndex] = { ...newCart[existingIndex], quantity: newQty };
        return newCart;
      }
      return [...prev, { product, variation, quantity: 1 }];
    });
    setIsDetailModalOpen(false);
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
      // Regra: Venda Condicional ou Venda a Prazo (Fiado) EXIGEM cliente.
      // Venda à vista (Dinheiro/Pix/Cartão) não exige.
      if (!selectedClient) {
          if (type === 'quote') {
              alert("Por favor, selecione um cliente para gerar um Condicional/Consignado.");
              return;
          }
          if (isPendingSale) {
              alert("Vendas a Prazo (Fiado/A Receber) exigem um cliente identificado.");
              return;
          }
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
    const clientId = selectedClient || null;

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
        client_id: clientId || null,
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
        if (error?.code === '23505') {
            alert("Erro de Duplicidade: O banco de dados está com as sequências desajustadas. Vá em Configurações > Banco de Dados e clique em 'Corrigir Sequências'.");
        } else {
            alert("Erro ao finalizar: " + (error?.message || 'Desconhecido'));
        }
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

    for (const item of cart) {
        const { data: currentVar } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.variation.id).single();
        if(currentVar) {
            await supabase.from('estoque_tamanhos').update({ quantity: currentVar.quantity - item.quantity}).eq('id', item.variation.id);
        }
    }
    
    if (transactionType === 'sale' && !isPendingSale && method) {
        // Record the payment record for debt calculation logic
        await supabase.from('venda_pagamentos').insert({
            sale_id: sale.id,
            amount: finalTotal,
            payment_method: method.name,
            date: getLocalDate()
        });

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

    alert(transactionType === 'sale' ? (isPendingSale ? 'Venda registrada como A Receber.' : 'Venda finalizada com sucesso.') : 'Condicional gerada com sucesso.');
    setCart([]);
    setIsPaymentModalOpen(false);
    setSelectedClient('');
    navigate(location.pathname, { replace: true, state: {} });
    loadData();
  };

  const handleQuickSaveClient = async () => {
      if (!newClientData.full_name) return alert("Nome é obrigatório");
      try {
          const payload = {
              full_name: capitalizeName(newClientData.full_name.trim()),
              cpf: newClientData.cpf.trim(),
              phone: newClientData.phone.trim(),
              email: newClientData.email.trim().toLowerCase(),
              address: newClientData.address.trim()
          };
          
          const { data, error } = await supabase.from('clients').insert([payload]).select().single();
          
          if (error) throw error;

          if (data) {
              setClients(prev => [...prev, data].sort((a,b) => a.full_name.localeCompare(b.full_name)));
              setSelectedClient(data.id);
              setIsNewClientModalOpen(false);
              setNewClientData({ full_name: '', cpf: '', phone: '', email: '', address: '' });
          }
      } catch (error: any) {
          console.error("Erro ao criar cliente rápido:", error);
          alert("Erro ao criar cliente: " + (error.message || "Desconhecido"));
      }
  };

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(search.toLowerCase()) || 
    p.variations?.some(v => 
      (v.model_variant?.toLowerCase().includes(search.toLowerCase())) || 
      (v.sku?.toLowerCase().includes(search.toLowerCase()))
    )
  );

  const sortedProducts = React.useMemo(() => {
    return [...filteredProducts].sort((a, b) => 
      a.nome.trim().localeCompare(b.nome.trim(), 'pt-BR', { sensitivity: 'base' })
    );
  }, [filteredProducts]);

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-3 p-2">
      {/* Catálogo de Produtos */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600 dark:text-white text-sm"
                placeholder="Buscar ou bipar SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') processBarcode(search);
                }}
                autoFocus
                />
            </div>
            <div className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-500" title="Leitor Ativo">
                <ScanBarcode size={16} />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 bg-slate-100 dark:bg-slate-900/40 space-y-2">
            {sortedProducts.map(product => {
                if (!product.variations) return null;
                const variationsByModel: Record<string, ProductVariation[]> = {};
                product.variations.forEach(v => {
                    const key = v.model_variant?.trim() || 'Padrão';
                    if (!variationsByModel[key]) variationsByModel[key] = [];
                    variationsByModel[key].push(v);
                });

                const sortedModels = Object.keys(variationsByModel).sort((a, b) => 
                  a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' })
                );

                return (
                    <div key={product.id} className="bg-white dark:bg-slate-800 rounded-md shadow-sm border dark:border-slate-700 overflow-hidden">
                        <div className="px-2 py-1 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-tight">{capitalizeName(product.nome)}</h3>
                            <div className="flex gap-1.5 items-center">
                                <span className="text-[8px] uppercase font-bold text-slate-400">
                                    {capitalizeName(product.categoria)}
                                </span>
                                {product.modelo && (
                                    <span className="text-[8px] font-mono text-slate-400">({product.modelo})</span>
                                )}
                            </div>
                        </div>
                        <div className="p-1 px-2 divide-y divide-slate-50 dark:divide-slate-700/50">
                            {sortedModels.map(model => {
                                const modelVariations = variationsByModel[model].sort((a,b) => getSizeWeight(a.size, sizes) - getSizeWeight(b.size, sizes));
                                return (
                                    <div key={model} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                                        <div className="flex items-center gap-1.5 min-w-[100px] max-w-[150px]">
                                            <div className="w-0.5 h-2.5 bg-primary-500 rounded-full"></div>
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate" title={model}>{capitalizeName(model)}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {modelVariations.map(v => (
                                                <button 
                                                    key={v.id} 
                                                    onClick={() => { setSelectedVariation({ product, variation: v }); setIsDetailModalOpen(true); }} 
                                                    className={`group relative flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all active:scale-95 ${
                                                        v.quantity <= 0 
                                                        ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed' 
                                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10'
                                                    }`}
                                                    disabled={v.quantity <= 0}
                                                >
                                                    <span className="font-black text-[10px] text-slate-800 dark:text-white">{v.size}</span>
                                                    <span className={`text-[8px] font-bold px-0.5 rounded-sm ${
                                                        v.quantity <= 2 ? 'text-red-600' : 'text-slate-400'
                                                    }`}>
                                                        {v.quantity}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400 border-l border-slate-100 dark:border-slate-600 pl-1 leading-none">
                                                        {formatCurrency(v.price_sale)}
                                                    </span>
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
                        <p className="font-medium text-slate-800 dark:text-white text-sm">{capitalizeName(item.product.nome)}</p>
                        <p className="text-xs text-slate-500">{capitalizeName(item.variation.model_variant)} | Tam: <b>{item.variation.size}</b></p>
                        <div className="flex items-center gap-2 mt-1">
                             <p className="text-xs font-bold text-primary-600">{formatCurrency(item.customPrice || item.variation.price_sale)}</p>
                             {item.customPrice && <span className="text-[10px] line-through text-slate-400">{formatCurrency(item.variation.price_sale)}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => openDiscountModal(idx)} className="text-slate-400 hover:text-blue-500 p-1 rounded" title="Editar Preço"><Tag size={16} /></button>
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
                        className={`w-full pl-9 p-2 text-sm rounded border ${!selectedClient ? 'border-amber-300 bg-amber-50' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'} dark:text-white`}
                        value={selectedClient}
                        onChange={e => setSelectedClient(e.target.value)}
                    >
                        <option value="">{isPendingSale || transactionType === 'quote' ? 'Selecione um Cliente *' : 'Consumidor Final (Venda Balcão)'}</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{capitalizeName(c.full_name)}</option>)}
                    </select>
                </div>
                <button onClick={() => setIsNewClientModalOpen(true)} className="p-2 bg-primary-100 text-primary-600 rounded hover:bg-primary-200" title="Novo Cliente"><UserPlus size={20} /></button>
            </div>
            
            <div className="flex justify-between items-end">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Total</span>
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{formatCurrency(rawTotal)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleOpenPayment('quote')} disabled={cart.length === 0} className="py-3 bg-amber-100 text-amber-800 rounded-lg font-bold border border-amber-200 disabled:opacity-50 text-sm flex flex-col items-center justify-center">
                    <ClipboardList size={16} className="mb-1"/> Condicional / Consignado
                </button>
                <button onClick={() => handleOpenPayment('sale')} disabled={cart.length === 0} className="py-3 bg-primary-600 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 text-sm flex items-center justify-center">
                    <CheckCircle size={18} className="mr-2"/> Finalizar
                </button>
            </div>
        </div>
      </div>

      {selectedVariation && isDetailModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border dark:border-slate-700">
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold dark:text-white">Detalhes do Item</h3>
                    <button onClick={() => setIsDetailModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-3 font-black text-2xl border-2 border-primary-200 dark:border-primary-800">
                            {selectedVariation.variation.size}
                        </div>
                        <h4 className="text-xl font-bold dark:text-white leading-tight">{capitalizeName(selectedVariation.product.nome)}</h4>
                        <p className="text-sm text-slate-500 font-medium uppercase mt-1">{capitalizeName(selectedVariation.variation.model_variant)}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Preço</span>
                            <span className="text-lg font-black text-primary-600 dark:text-primary-400">{formatCurrency(selectedVariation.variation.price_sale)}</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Estoque</span>
                            <span className={`text-lg font-black ${selectedVariation.variation.quantity <= 2 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{selectedVariation.variation.quantity} un</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs py-2 border-b dark:border-slate-700">
                            <span className="text-slate-400 font-medium">SKU</span>
                            <span className="font-mono font-bold dark:text-slate-300">{selectedVariation.variation.sku || '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs py-2 border-b dark:border-slate-700">
                            <span className="text-slate-400 font-medium">Categoria</span>
                            <span className="font-bold dark:text-slate-300">{capitalizeName(selectedVariation.product.categoria)}</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => addToCart(selectedVariation.product, selectedVariation.variation)}
                        className="w-full py-4 bg-primary-600 text-white rounded-xl font-black text-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                    >
                        <ShoppingBag size={20} />
                        Adicionar ao Carrinho
                    </button>
                    <button onClick={() => setIsDetailModalOpen(false)} className="w-full py-3 text-slate-500 font-bold text-sm">Talvez depois</button>
                </div>
            </div>
        </div>
      )}

      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center border-b dark:border-slate-700">
                    <h3 className="font-bold dark:text-white flex items-center"><UserPlus size={18} className="mr-2"/> Cadastro Rápido</h3>
                    <button onClick={() => setIsNewClientModalOpen(false)}><X size={20} /></button>
                </div>
                <div className="p-4 space-y-3">
                    <input className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Nome Completo *" 
                        value={newClientData.full_name} 
                        onChange={e => setNewClientData({...newClientData, full_name: e.target.value})} 
                        onBlur={e => setNewClientData({...newClientData, full_name: capitalizeName(e.target.value)})}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="CPF" value={newClientData.cpf} onChange={e => setNewClientData({...newClientData, cpf: maskCPF(e.target.value)})} />
                        <input className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Telefone" value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: maskPhone(e.target.value)})} />
                    </div>
                    
                    <input 
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                        placeholder="E-mail" 
                        value={newClientData.email} 
                        onChange={e => setNewClientData({...newClientData, email: e.target.value})} 
                    />
                    
                    <textarea 
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none h-20" 
                        placeholder="Endereço" 
                        value={newClientData.address} 
                        onChange={e => setNewClientData({...newClientData, address: e.target.value})} 
                    />

                    <button onClick={handleQuickSaveClient} className="w-full py-2 bg-primary-600 text-white rounded font-bold mt-2">Salvar</button>
                </div>
            </div>
        </div>
      )}
      
      {discountItemIndex !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-80 shadow-2xl">
                  <h4 className="font-bold mb-4 dark:text-white">Alterar Preço Unitário</h4>
                  <input type="number" autoFocus className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mb-4 font-bold text-lg" value={discountValue} onChange={e => setDiscountValue(e.target.value)}/>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setDiscountItemIndex(null)} className="px-3 py-2 text-slate-500">Cancelar</button>
                      <button onClick={applyDiscount} className="px-3 py-2 bg-blue-600 text-white rounded font-bold">Aplicar</button>
                  </div>
              </div>
          </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center"><CheckCircle className="mr-2 text-primary-600" /> {transactionType === 'sale' ? 'Confirmar Pagamento' : 'Gerar Condicional'}</h3>
                {transactionType === 'sale' && (
                    <div className="mb-4">
                        <div className={`flex items-center p-3 rounded-lg border cursor-pointer mb-4 transition-colors ${isPendingSale ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`} onClick={() => setIsPendingSale(!isPendingSale)}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${isPendingSale ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-300'}`}>{isPendingSale && <CheckCircle size={14} />}</div>
                            <div className="flex-1"><span className="font-bold text-sm block dark:text-white">Venda a Prazo / Fiado</span></div>
                            <Clock size={20} className={isPendingSale ? 'text-amber-500' : 'text-slate-300'} />
                        </div>
                        {!isPendingSale && (
                            <div className="space-y-4">
                                <label className="block text-sm font-medium mb-2 dark:text-slate-300">Forma de Pagamento</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentMethods.map(m => (
                                        <button key={m.id} onClick={() => handleMethodSelect(m.id)} className={`p-3 rounded-lg border text-sm font-medium transition-all ${selectedMethodId === m.id ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-slate-200 dark:border-slate-600 dark:text-slate-300'}`}>{m.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-4 border dark:border-slate-600">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-center">Desconto na Venda</label>
                    <div className="flex gap-2">
                        <div className="flex border dark:border-slate-600 rounded overflow-hidden h-10">
                            <button 
                                onClick={() => setDiscountType('money')}
                                className={`px-3 flex items-center justify-center font-bold transition-colors ${discountType === 'money' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                R$
                            </button>
                            <button 
                                onClick={() => setDiscountType('percent')}
                                className={`px-3 flex items-center justify-center font-bold transition-colors ${discountType === 'percent' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                %
                            </button>
                        </div>
                        <div className="relative flex-1">
                            <input 
                                type="text"
                                className="w-full h-10 p-2 pl-8 text-lg border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="0,00"
                                value={discountVal}
                                onChange={e => setDiscountVal(e.target.value)}
                            />
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                                {discountType === 'money' ? <DollarSign size={16} /> : <Percent size={16} />}
                            </div>
                        </div>
                    </div>
                    {calculatedDiscountValue > 0 && (
                        <p className="text-[10px] text-red-500 font-bold mt-1 text-right">
                            Desconto aplicado: -{formatCurrency(calculatedDiscountValue)}
                        </p>
                    )}
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg mb-6 border dark:border-slate-600 text-center">
                    <p className="text-sm text-slate-500 uppercase tracking-wide">Valor Final</p>
                    <p className="text-4xl font-bold mt-1 dark:text-white">{formatCurrency(finalTotal)}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 border rounded-lg">Cancelar</button>
                    <button onClick={finalizeTransaction} className={`flex-1 py-3 text-white rounded-lg font-bold ${isPendingSale ? 'bg-amber-500' : 'bg-primary-600'}`}>{isPendingSale ? 'Salvar Pendente' : 'Confirmar'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
