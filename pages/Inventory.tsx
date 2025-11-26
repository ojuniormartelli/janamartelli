
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, ProductVariation } from '../types';
import { ChevronDown, ChevronRight, Plus, AlertTriangle, FileSpreadsheet, Loader, Trash2, Edit2, X, Save, Search, RefreshCw, ArrowUpDown, Download } from 'lucide-react';
import { formatCurrency, parseCurrencyString, getLocalDate } from '../utils/formatters';

type SortField = 'modelo' | 'nome' | 'categoria' | 'stock';

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Modals
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [replenishModal, setReplenishModal] = useState<{ variant: ProductVariation; qtyToAdd: string } | null>(null);
  
  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'nome', direction: 'asc' });

  // State for editing a specific variation
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({ 
    nome: '', 
    categoria: '', 
    variations: [] as any[] 
  });
  
  // Add Variant to Existing Product State
  const [newVariant, setNewVariant] = useState({
      productId: '',
      model: '',
      size: 'M',
      sku: '',
      quantity: 0,
      price_cost: '',
      price_sale: ''
  });

  // Temp state for adding variation line in new product modal
  const [tempVar, setTempVar] = useState({ model: '', size: 'M', cost: '', sale: '', sku: '', qty: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInventory = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*');
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*');

    if (prodData && varData) {
      const merged = prodData.map(p => ({
        ...p,
        variations: varData.filter(v => v.product_id === p.id)
      }));
      setProducts(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // --- LOGIC: SEARCH & SORT ---
  const handleSort = (field: SortField) => {
      setSortConfig(prev => ({
          field,
          direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const processedProducts = React.useMemo(() => {
    let filtered = products;

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = products.filter(p => 
            p.nome.toLowerCase().includes(q) || 
            (p.modelo && p.modelo.toLowerCase().includes(q)) ||
            p.variations?.some(v => v.sku.toLowerCase().includes(q) || v.model_variant.toLowerCase().includes(q))
        );
    }

    return filtered.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.field === 'stock') {
            valA = a.variations?.reduce((acc, v) => acc + v.quantity, 0) || 0;
            valB = b.variations?.reduce((acc, v) => acc + v.quantity, 0) || 0;
        } else {
            valA = (a as any)[sortConfig.field]?.toString().toLowerCase() || '';
            valB = (b as any)[sortConfig.field]?.toString().toLowerCase() || '';
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [products, searchQuery, sortConfig]);


  // --- LOGIC: IMPORT, EXPORT & CRUD ---
  const handleExportCSV = () => {
      // Header: SKU, Referencia, Nome, Modelo, Categoria, Tamanho, Quantidade, Preco_Custo, Preco_Venda
      const header = "SKU,Referencia,Nome,Modelo,Categoria,Tamanho,Quantidade,Preco_Custo,Preco_Venda\n";
      
      const rows: string[] = [];
      
      products.forEach(p => {
          if (p.variations && p.variations.length > 0) {
              p.variations.forEach(v => {
                  const escape = (t: any) => `"${(t || '').toString().replace(/"/g, '""')}"`;
                  const row = [
                      escape(v.sku),
                      escape(p.modelo),
                      escape(p.nome),
                      escape(v.model_variant),
                      escape(p.categoria),
                      escape(v.size),
                      v.quantity,
                      v.price_cost.toFixed(2).replace('.', ','),
                      v.price_sale.toFixed(2).replace('.', ',')
                  ].join(',');
                  rows.push(row);
              });
          } else {
               // Produto sem variação (raro, mas possível)
               const escape = (t: any) => `"${(t || '').toString().replace(/"/g, '""')}"`;
               const row = [
                  "",
                  escape(p.modelo),
                  escape(p.nome),
                  "",
                  escape(p.categoria),
                  "",
                  0,
                  "0,00",
                  "0,00"
               ].join(',');
               rows.push(row);
          }
      });

      const csvContent = header + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `estoque_completo_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const parseCSVLine = (text: string) => {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(cell.trim()); cell = ''; }
        else cell += char;
    }
    result.push(cell.trim());
    return result.map(c => c.replace(/^"|"$/g, '').trim());
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      let successCount = 0;
      let errorCount = 0;
      let errorMsg = "";
      
      const { data: existingProducts } = await supabase.from('products').select('id, modelo');
      const productCache = new Map<string, string>();
      if (existingProducts) {
        existingProducts.forEach(p => { if(p.modelo) productCache.set(p.modelo.trim(), p.id); });
      }

      const startIndex = lines[0].toLowerCase().includes('sku') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, '').trim(); 
        if (!line) continue;
        try {
            const cols = parseCSVLine(line);
            if (cols.length < 8) { errorCount++; continue; }

            const [sku, referencia, nome, modeloVariante, categoria, tamanho, qtdStr, costStr, saleStr] = cols;
            if (!referencia || !nome) { errorCount++; continue; }

            let productId = productCache.get(referencia);

            if (!productId) {
                const { data: newProd } = await supabase.from('products').insert({ 
                    nome: nome,
                    modelo: referencia,
                    categoria: categoria, 
                    descricao: `${nome} - ${referencia}`
                }).select('id').single();
                
                if (newProd) {
                    productId = newProd.id;
                    productCache.set(referencia, productId);
                }
            }

            if (productId) {
                const { error } = await supabase.from('estoque_tamanhos').upsert({
                    product_id: productId,
                    model_variant: modeloVariante || 'Padrão',
                    size: tamanho.toUpperCase(),
                    sku: sku,
                    quantity: parseInt(qtdStr) || 0,
                    price_cost: parseCurrencyString(costStr),
                    price_sale: parseCurrencyString(saleStr),
                    reference: referencia
                }, { onConflict: 'product_id, model_variant, size' });
                
                if (error) {
                    errorCount++;
                    errorMsg = error.message;
                } else {
                    successCount++;
                }
            }
        } catch (err: any) { 
            errorCount++; 
            errorMsg = err.message;
        }
      }
      
      let msg = `Importação concluída!\nSucessos: ${successCount}\nErros: ${errorCount}`;
      if (errorCount > 0 && errorMsg) msg += `\nÚltimo Erro: ${errorMsg}`;
      
      alert(msg);
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchInventory();
    };
    reader.readAsText(file);
  };

  const handleReportLoss = async (variant: ProductVariation) => {
    if (!confirm(`Baixar 1 unidade defeituosa de "${variant.model_variant} - ${variant.size}"?`)) return;
    
    // 0. Generate "B" Code
    const { data: code } = await supabase.rpc('get_next_code', { prefix: 'B' });

    // 1. Create a "Loss" sale record for financial tracking in SALES History
    const { data: lossSale, error: saleError } = await supabase.from('vendas').insert({
        code: code,
        total_value: variant.price_cost, // Record cost as value
        payment_status: 'loss',
        status_label: 'Baixa',
        payment_method: 'Perda',
        observacoes: `Baixa de item defeituoso: ${variant.sku}`
    }).select().single();

    if (saleError) {
        alert("Erro ao registrar baixa: " + saleError.message);
        return;
    }

    if (lossSale) {
        await supabase.from('venda_itens').insert({
            sale_id: lossSale.id,
            product_variation_id: variant.id,
            quantity: 1,
            unit_price: 0,
            original_cost: variant.price_cost
        });

        // 2. Register Financial Transaction (Expense) for Cash Flow
        // Find default account to attribute the loss
        const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
        const accountId = defaultAccount ? defaultAccount.id : (await supabase.from('bank_accounts').select('id').limit(1).single()).data?.id;

        if (accountId) {
             await supabase.from('transactions').insert({
                 description: `Baixa Estoque: ${code} - ${variant.sku}`,
                 amount: variant.price_cost,
                 type: 'expense',
                 account_id: accountId,
                 category: 'Perdas',
                 date: getLocalDate()
             });
             // Update account balance (reduce asset value)
             if (defaultAccount) {
                 await supabase.from('bank_accounts').update({ balance: defaultAccount.balance - variant.price_cost }).eq('id', accountId);
             }
        }
    }

    // 3. Reduce Stock
    const { error } = await supabase.from('estoque_tamanhos').update({ quantity: variant.quantity - 1 }).eq('id', variant.id);
    if (!error) {
        alert(`Baixa registrada com sucesso! Código: ${code}`);
        fetchInventory();
    }
  };

  const handleReplenish = async () => {
      if(!replenishModal) return;
      const qty = parseInt(replenishModal.qtyToAdd);
      if(isNaN(qty) || qty <= 0) return alert("Quantidade inválida");

      const { error } = await supabase
        .from('estoque_tamanhos')
        .update({ quantity: replenishModal.variant.quantity + qty })
        .eq('id', replenishModal.variant.id);
      
      if(error) alert("Erro ao atualizar estoque");
      else {
          setReplenishModal(null);
          fetchInventory();
      }
  };

  const handleDeleteVariation = async (id: string) => {
    if(!confirm("Excluir esta variação permanentemente?")) return;
    const { error } = await supabase.from('estoque_tamanhos').delete().eq('id', id);
    if (!error) fetchInventory();
  };

  const handleDeleteProduct = async (id: string) => {
    if(!confirm("Excluir produto COMPLETO e todas as suas variações?")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchInventory();
  };

  const handleSaveVariationEdit = async () => {
    if (!editingVariation) return;
    const { error } = await supabase.from('estoque_tamanhos').update({
        price_cost: editingVariation.price_cost,
        price_sale: editingVariation.price_sale,
        quantity: editingVariation.quantity,
        sku: editingVariation.sku
      }).eq('id', editingVariation.id);
    if (!error) { setEditingVariation(null); fetchInventory(); }
  };

  const handleAddTempVar = () => {
    if (!tempVar.model || !tempVar.sku) return alert("Modelo e SKU obrigatórios");
    setNewProduct(prev => ({
        ...prev,
        variations: [...prev.variations, {
            model_variant: tempVar.model,
            size: tempVar.size,
            sku: tempVar.sku,
            quantity: tempVar.qty,
            price_cost: parseCurrencyString(tempVar.cost),
            price_sale: parseCurrencyString(tempVar.sale)
        }]
    }));
    setTempVar(prev => ({ ...prev, size: 'M', sku: '' }));
  };

  const saveNewProduct = async () => {
    if (!newProduct.nome || newProduct.variations.length === 0) return alert("Preencha dados");
    const { data: parent } = await supabase.from('products').insert({
        nome: newProduct.nome,
        categoria: newProduct.categoria,
        modelo: 'Geral',
        descricao: newProduct.nome
    }).select().single();

    if (parent) {
        const payload = newProduct.variations.map(v => ({ product_id: parent.id, ...v }));
        await supabase.from('estoque_tamanhos').insert(payload);
        setIsNewProductModalOpen(false);
        setNewProduct({ nome: '', categoria: '', variations: [] });
        fetchInventory();
    }
  };

  // --- LOGIC: ADD VARIANT TO EXISTING ---
  const openAddVariantModal = (productId: string) => {
      setNewVariant({
          productId,
          model: '',
          size: 'M',
          sku: '',
          quantity: 0,
          price_cost: '',
          price_sale: ''
      });
      setIsAddVariantModalOpen(true);
  };

  const handleSaveNewVariant = async () => {
      if(!newVariant.model || !newVariant.sku) return alert("Preencha Modelo e SKU");
      
      const { error } = await supabase.from('estoque_tamanhos').insert({
          product_id: newVariant.productId,
          model_variant: newVariant.model,
          size: newVariant.size,
          sku: newVariant.sku,
          quantity: newVariant.quantity,
          price_cost: parseCurrencyString(newVariant.price_cost),
          price_sale: parseCurrencyString(newVariant.price_sale)
      });

      if(error) alert("Erro ao criar variação: " + error.message);
      else {
          setIsAddVariantModalOpen(false);
          fetchInventory();
      }
  };


  return (
    <div>
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImport} />

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Estoque Inteligente</h2>
            <p className="text-sm text-slate-500">Agrupado por Referência (Nome)</p>
        </div>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-md w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar Referência, Nome ou SKU..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
        </div>

        <div className="flex gap-2 w-full xl:w-auto">
          <button 
            onClick={handleExportCSV}
            className="flex items-center px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 text-sm"
            title="Exportar Estoque Completo para CSV"
          >
            <Download className="mr-2" size={16} />
            Exportar
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 disabled:opacity-50 text-sm"
          >
            {importing ? <Loader className="mr-2 animate-spin" size={16} /> : <FileSpreadsheet className="mr-2" size={16} />}
            Importar
          </button>
          
          <button onClick={() => setIsNewProductModalOpen(true)} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm whitespace-nowrap">
            <Plus className="mr-2" size={16} />
            Novo Produto
          </button>
        </div>
      </div>

      {/* ... Rest of the component (Tables, Modals) - No changes needed below ... */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        {loading ? (
            <div className="p-8 text-center text-slate-500">Carregando estoque...</div>
        ) : (
            <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                <th className="p-4 w-10"></th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors group" onClick={() => handleSort('modelo')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-300 font-semibold">
                        Referência <ArrowUpDown size={14} className="ml-2 opacity-50 group-hover:opacity-100" />
                    </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors group" onClick={() => handleSort('nome')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-300 font-semibold">
                        Nome <ArrowUpDown size={14} className="ml-2 opacity-50 group-hover:opacity-100" />
                    </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors group" onClick={() => handleSort('categoria')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-300 font-semibold">
                        Categoria <ArrowUpDown size={14} className="ml-2 opacity-50 group-hover:opacity-100" />
                    </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors group text-right" onClick={() => handleSort('stock')}>
                    <div className="flex items-center justify-end text-slate-600 dark:text-slate-300 font-semibold">
                        Total em Estoque <ArrowUpDown size={14} className="ml-2 opacity-50 group-hover:opacity-100" />
                    </div>
                </th>
                <th className="p-4 text-center text-slate-600 dark:text-slate-300 font-semibold">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {processedProducts.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum produto encontrado.</td></tr>
                )}
                {processedProducts.map(product => {
                    const totalQty = product.variations?.reduce((acc, v) => acc + v.quantity, 0) || 0;
                    return (
                    <React.Fragment key={product.id}>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <td className="p-4 cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>
                                {expandedRow === product.id ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                            </td>
                            <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>
                                {product.modelo}
                            </td>
                            <td className="p-4 font-bold text-slate-700 dark:text-white cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>
                                {product.nome}
                            </td>
                            <td className="p-4 text-slate-500 dark:text-slate-400">{product.categoria}</td>
                            <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-900/30 rounded">
                                {totalQty} un
                            </td>
                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                <button 
                                    onClick={() => openAddVariantModal(product.id)}
                                    className="flex items-center px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
                                    title="Adicionar Novo Tamanho/Cor neste Produto"
                                >
                                    <Plus size={14} className="mr-1"/> Var
                                </button>
                                <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                        {expandedRow === product.id && (
                        <tr>
                            <td colSpan={6} className="bg-slate-50 dark:bg-slate-900/30 p-4 border-b border-slate-200 dark:border-slate-700 shadow-inner">
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                <thead>
                                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700/50">
                                    <th className="py-2 px-4 text-left">Modelo / Cor</th>
                                    <th className="py-2 px-4 text-left">Tam</th>
                                    <th className="py-2 px-4 text-left">SKU</th>
                                    <th className="py-2 px-4 text-right">Custo</th>
                                    <th className="py-2 px-4 text-right">Venda</th>
                                    <th className="py-2 px-4 text-right">Qtd</th>
                                    <th className="py-2 px-4 text-center">Ações</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {product.variations?.sort((a,b) => a.model_variant.localeCompare(b.model_variant)).map(v => (
                                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="py-2 px-4 font-medium dark:text-white">{v.model_variant}</td>
                                        <td className="py-2 px-4 font-bold bg-slate-100 dark:bg-slate-700 rounded text-center w-12 mx-auto block mt-1">{v.size}</td>
                                        <td className="py-2 px-4 text-slate-500 font-mono text-xs">{v.sku}</td>
                                        <td className="py-2 px-4 text-right text-slate-500">{formatCurrency(v.price_cost)}</td>
                                        <td className="py-2 px-4 text-right text-green-600 dark:text-green-400 font-bold">{formatCurrency(v.price_sale)}</td>
                                        <td className="py-2 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className={`font-bold ${v.quantity <= 2 ? 'text-red-500' : 'dark:text-white'}`}>{v.quantity}</span>
                                                <button 
                                                    onClick={() => setReplenishModal({ variant: v, qtyToAdd: '' })}
                                                    className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200" title="Repor Estoque"
                                                >
                                                    <RefreshCw size={10} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-2 px-4 flex justify-center gap-2">
                                            <button 
                                                onClick={() => setEditingVariation(v)}
                                                className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Editar">
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleReportLoss(v)}
                                                className="p-1 text-orange-500 hover:bg-orange-50 rounded" title="Baixa (Perda)">
                                                <AlertTriangle size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteVariation(v.id)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded" title="Excluir Variação">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            </div>
                            </td>
                        </tr>
                        )}
                    </React.Fragment>
                    );
                })}
            </tbody>
            </table>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* 1. NEW PRODUCT MODAL (COMPLETE) */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b dark:border-slate-700">
                <h3 className="text-xl font-bold dark:text-white">Novo Produto Completo</h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nome do Produto</label>
                        <input 
                            value={newProduct.nome}
                            onChange={e => setNewProduct({...newProduct, nome: e.target.value})}
                            placeholder="Ex: Pijama Seda Longo" 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium mb-1 dark:text-slate-300">Categoria</label>
                        <input 
                            value={newProduct.categoria}
                            onChange={e => setNewProduct({...newProduct, categoria: e.target.value})}
                            placeholder="Ex: Feminino" 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-sm mb-3 dark:text-white flex items-center"><Plus size={16} className="mr-2"/> Adicionar Variação</h4>
                    <div className="grid grid-cols-6 gap-2 mb-2">
                        <input 
                            placeholder="Modelo/Cor" className="col-span-2 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.model} onChange={e => setTempVar({...tempVar, model: e.target.value})}
                        />
                        <select className="col-span-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={tempVar.size} onChange={e => setTempVar({...tempVar, size: e.target.value})}>
                            {['P','M','G','GG','XG','U'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input placeholder="SKU" className="col-span-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={tempVar.sku} onChange={e => setTempVar({...tempVar, sku: e.target.value})} />
                        <input placeholder="Qtd" type="number" className="col-span-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={tempVar.qty} onChange={e => setTempVar({...tempVar, qty: Number(e.target.value)})} />
                        <button onClick={handleAddTempVar} className="col-span-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center"><Plus size={18} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <input placeholder="Preço Custo (R$)" className="p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={tempVar.cost} onChange={e => setTempVar({...tempVar, cost: e.target.value})} />
                         <input placeholder="Preço Venda (R$)" className="p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={tempVar.sale} onChange={e => setTempVar({...tempVar, sale: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-2">
                    {newProduct.variations.map((v, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                            <span className="dark:text-white font-medium">{v.model_variant} - {v.size}</span>
                            <span className="text-slate-500">{v.sku}</span>
                            <span className="text-green-600 font-bold">{formatCurrency(v.price_sale)}</span>
                            <button onClick={() => setNewProduct(prev => ({...prev, variations: prev.variations.filter((_, i) => i !== idx)}))} className="text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-b-xl">
              <button onClick={() => setIsNewProductModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300">Cancelar</button>
              <button onClick={saveNewProduct} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Salvar Tudo</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ADD VARIANT TO EXISTING MODAL */}
      {isAddVariantModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
               <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-xl w-full max-w-md">
                   <h4 className="font-bold mb-4 dark:text-white text-lg">Adicionar Novo Tamanho/Cor</h4>
                   <div className="space-y-4">
                       <input 
                           placeholder="Modelo / Cor (Ex: Azul Marinho)" 
                           className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                           value={newVariant.model} onChange={e => setNewVariant({...newVariant, model: e.target.value})}
                       />
                       <div className="grid grid-cols-2 gap-4">
                           <select 
                               className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                               value={newVariant.size} onChange={e => setNewVariant({...newVariant, size: e.target.value})}
                           >
                               {['P','M','G','GG','XG','U','1','2','3','4','6','8','10'].map(s => <option key={s} value={s}>{s}</option>)}
                           </select>
                           <input 
                               placeholder="SKU" 
                               className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                               value={newVariant.sku} onChange={e => setNewVariant({...newVariant, sku: e.target.value})}
                           />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <input placeholder="Custo (R$)" className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.price_cost} onChange={e => setNewVariant({...newVariant, price_cost: e.target.value})} />
                           <input placeholder="Venda (R$)" className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.price_sale} onChange={e => setNewVariant({...newVariant, price_sale: e.target.value})} />
                       </div>
                       <div>
                           <label className="text-xs text-slate-500">Quantidade Inicial</label>
                           <input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.quantity} onChange={e => setNewVariant({...newVariant, quantity: Number(e.target.value)})} />
                       </div>
                   </div>
                   <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setIsAddVariantModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                      <button onClick={handleSaveNewVariant} className="px-4 py-2 bg-green-600 text-white rounded">Adicionar</button>
                   </div>
               </div>
          </div>
      )}

      {/* 3. REPLENISH MODAL */}
      {replenishModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
               <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-xl w-80">
                   <h4 className="font-bold mb-2 dark:text-white">Repor Estoque</h4>
                   <p className="text-sm text-slate-500 mb-4">{replenishModal.variant.model_variant} - {replenishModal.variant.size}</p>
                   
                   <label className="text-xs font-bold dark:text-slate-300 block mb-1">Quantidade a adicionar (+)</label>
                   <input 
                       type="number" autoFocus
                       className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mb-4"
                       value={replenishModal.qtyToAdd}
                       onChange={e => setReplenishModal({...replenishModal, qtyToAdd: e.target.value})}
                   />
                   <div className="flex justify-end gap-2">
                      <button onClick={() => setReplenishModal(null)} className="px-3 py-2 text-slate-500">Cancelar</button>
                      <button onClick={handleReplenish} className="px-3 py-2 bg-blue-600 text-white rounded">Confirmar</button>
                   </div>
               </div>
          </div>
      )}

      {/* 4. EDIT VARIATION MODAL */}
      {editingVariation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-xl w-80">
                  <h4 className="font-bold mb-4 dark:text-white">Editar: {editingVariation.model_variant}</h4>
                  <div className="space-y-3">
                      <input className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editingVariation.sku} onChange={e => setEditingVariation({...editingVariation, sku: e.target.value})} placeholder="SKU" />
                      <input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editingVariation.quantity} onChange={e => setEditingVariation({...editingVariation, quantity: Number(e.target.value)})} placeholder="Estoque" />
                      <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editingVariation.price_cost} onChange={e => setEditingVariation({...editingVariation, price_cost: Number(e.target.value)})} placeholder="Custo" />
                      <input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editingVariation.price_sale} onChange={e => setEditingVariation({...editingVariation, price_sale: Number(e.target.value)})} placeholder="Venda" />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setEditingVariation(null)} className="p-2 text-slate-500"><X size={20}/></button>
                      <button onClick={handleSaveVariationEdit} className="px-4 py-2 bg-primary-600 text-white rounded"><Save size={18}/></button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
