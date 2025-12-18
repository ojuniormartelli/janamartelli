
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, ProductVariation, ProductSize } from '../types';
import { ChevronDown, ChevronRight, Plus, AlertTriangle, FileSpreadsheet, Loader, Trash2, Edit2, X, Save, Search, RefreshCw, ArrowUpDown, Download, Layers, Settings as SettingsIcon } from 'lucide-react';
import { formatCurrency, parseCurrencyString, getLocalDate } from '../utils/formatters';
import { Link } from 'react-router-dom';

type SortField = 'modelo' | 'nome' | 'categoria' | 'stock';

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Modals
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [replenishModal, setReplenishModal] = useState<{ variant: ProductVariation; qtyToAdd: string } | null>(null);
  
  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'modelo', direction: 'asc' });

  // State for editing a specific variation
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);

  // State for editing the PARENT Product (Group)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({ 
    nome: '', 
    modelo: '', 
    categoria: '', 
    variations: [] as any[] 
  });
  
  // Add Variant to Existing Product State
  const [newVariant, setNewVariant] = useState({
      productId: '',
      model: '',
      size: '',
      sku: '',
      quantity: 0,
      price_cost: '',
      price_sale: ''
  });

  // Temp state for adding variation line in new product modal
  const [tempVar, setTempVar] = useState({ model: '', size: '', cost: '', sale: '', sku: '', qty: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Products and Variations
    const { data: prodData } = await supabase.from('products').select('*');
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*');
    
    // Fetch Dynamic Sizes
    const { data: sizeData } = await supabase.from('product_sizes').select('*').order('sort_order');

    if (prodData && varData) {
      const merged = prodData.map(p => ({
        ...p,
        variations: varData.filter(v => v.product_id === p.id)
      }));
      setProducts(merged);
    }

    if (sizeData) {
        setSizes(sizeData);
        // Define default values for selects
        if (sizeData.length > 0) {
            setTempVar(prev => ({ ...prev, size: sizeData[0].name }));
            setNewVariant(prev => ({ ...prev, size: sizeData[0].name }));
        }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
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

  const handleExportCSV = () => {
      const header = "SKU,Referencia,Nome,Modelo,Categoria,Tamanho,Quantidade,Preco_Custo,Preco_Venda\n";
      const rows: string[] = [];
      products.forEach(p => {
          if (p.variations && p.variations.length > 0) {
              p.variations.forEach(v => {
                  const escape = (t: any) => `"${(t || '').toString().replace(/"/g, '""')}"`;
                  const row = [escape(v.sku), escape(p.modelo), escape(p.nome), escape(v.model_variant), escape(p.categoria), escape(v.size), v.quantity, v.price_cost.toFixed(2).replace('.', ','), v.price_sale.toFixed(2).replace('.', ',')].join(',');
                  rows.push(row);
              });
          }
      });
      const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `estoque_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
      const startIndex = lines[0].toLowerCase().includes('sku') ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, '').trim(); 
        if (!line) continue;
        try {
            const cols = line.split(','); 
            const [sku, ref, nome, varMod, cat, tam, qtd, cost, sale] = cols.map(c => c.replace(/^"|"$/g, '').trim());
            if (!ref || !nome) continue;
        } catch (err) {}
      }
      setImporting(false);
      fetchData();
    };
    reader.readAsText(file);
  };

  const handleReplenish = async () => {
      if(!replenishModal) return;
      const qty = parseInt(replenishModal.qtyToAdd);
      await supabase.from('estoque_tamanhos').update({ quantity: replenishModal.variant.quantity + qty }).eq('id', replenishModal.variant.id);
      setReplenishModal(null); fetchData();
  };

  const handleDeleteVariation = async (id: string) => {
    if(!confirm("Excluir?")) return;
    await supabase.from('estoque_tamanhos').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteProduct = async (id: string) => {
    if(!confirm("Excluir produto COMPLETO?")) return;
    await supabase.from('products').delete().eq('id', id);
    fetchData();
  };

  const handleSaveVariationEdit = async () => {
    if (!editingVariation) return;
    await supabase.from('estoque_tamanhos').update({ price_cost: editingVariation.price_cost, price_sale: editingVariation.price_sale, quantity: editingVariation.quantity, sku: editingVariation.sku }).eq('id', editingVariation.id);
    setEditingVariation(null); fetchData();
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    await supabase.from('products').update({ nome: editingProduct.nome, modelo: editingProduct.modelo, categoria: editingProduct.categoria }).eq('id', editingProduct.id);
    setEditingProduct(null); fetchData();
  };

  const handleAddTempVar = () => {
    if (!tempVar.model || !tempVar.sku) return alert("Modelo e SKU obrigatórios");
    if (!tempVar.size) return alert("Cadastre ao menos um tamanho nas configurações!");
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
    setTempVar(prev => ({ ...prev, sku: '' }));
  };

  const saveNewProduct = async () => {
    if (!newProduct.nome || newProduct.variations.length === 0) return alert("Preencha dados");
    const { data: parent } = await supabase.from('products').insert({ nome: newProduct.nome, categoria: newProduct.categoria, modelo: newProduct.modelo || 'Geral', descricao: newProduct.nome }).select().single();
    if (parent) {
        const payload = newProduct.variations.map(v => ({ product_id: parent.id, ...v }));
        await supabase.from('estoque_tamanhos').insert(payload);
        setIsNewProductModalOpen(false);
        setNewProduct({ nome: '', modelo: '', categoria: '', variations: [] });
        fetchData();
    }
  };

  const openAddVariantModal = (productId: string) => {
      setNewVariant({ productId, model: '', size: sizes[0]?.name || '', sku: '', quantity: 0, price_cost: '', price_sale: '' });
      setIsAddVariantModalOpen(true);
  };

  const handleSaveNewVariant = async () => {
      if(!newVariant.model || !newVariant.sku) return alert("Preencha Modelo e SKU");
      if(!newVariant.size) return alert("Tamanho obrigatório");
      await supabase.from('estoque_tamanhos').insert({ product_id: newVariant.productId, model_variant: newVariant.model, size: newVariant.size, sku: newVariant.sku, quantity: newVariant.quantity, price_cost: parseCurrencyString(newVariant.price_cost), price_sale: parseCurrencyString(newVariant.price_sale) });
      setIsAddVariantModalOpen(false); fetchData();
  };

  return (
    <div>
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImport} />

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Estoque Inteligente</h2><p className="text-sm text-slate-500">Agrupado por Referência (Nome)</p></div>
        <div className="flex-1 max-w-md w-full relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-slate-700 dark:text-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="px-4 py-2 bg-white dark:bg-slate-800 border rounded text-sm"><Download size={16} /></button>
          <button onClick={() => setIsNewProductModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white rounded text-sm font-bold shadow-md">Novo Produto</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        {loading ? <div className="p-12 text-center"><Loader className="animate-spin mx-auto text-primary-500" size={32} /><p className="mt-2 text-slate-500">Carregando estoque...</p></div> : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300"><tr><th className="p-4 w-10"></th><th className="p-4">Referência</th><th className="p-4">Nome</th><th className="p-4">Categoria</th><th className="p-4 text-right">Estoque</th><th className="p-4 text-center">Ações</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {processedProducts.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-slate-500 italic">Nenhum produto no estoque.</td></tr>
                    ) : processedProducts.map(product => (
                        <React.Fragment key={product.id}>
                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="p-4 cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>{expandedRow === product.id ? <ChevronDown size={18} className="text-primary-500" /> : <ChevronRight size={18} />}</td>
                                <td className="p-4 font-mono text-sm">{product.modelo}</td>
                                <td className="p-4 font-bold dark:text-white">{product.nome}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">{product.categoria}</span></td>
                                <td className="p-4 text-right font-bold text-primary-600">{product.variations?.reduce((acc, v) => acc + v.quantity, 0) || 0} un</td>
                                <td className="p-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setEditingProduct(product)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors" title="Editar Grupo"><Edit2 size={16}/></button>
                                        <button onClick={() => openAddVariantModal(product.id)} className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-3 py-1 text-xs rounded font-bold hover:bg-primary-100 transition-colors">Nova Var</button>
                                        <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Excluir tudo"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                            {expandedRow === product.id && (
                            <tr>
                                <td colSpan={6} className="bg-slate-50 dark:bg-slate-900/30 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <table className="w-full text-sm bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
                                        <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-500"><tr className="border-b dark:border-slate-700"><th className="p-2 text-left">Modelo/Cor</th><th className="p-2">Tam</th><th className="p-2">SKU</th><th className="p-2 text-right">Custo</th><th className="p-2 text-right">Venda</th><th className="p-2 text-right">Qtd</th><th className="p-2 text-center">Ações</th></tr></thead>
                                        <tbody>{product.variations?.map(v => (
                                            <tr key={v.id} className="border-b dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="p-2 font-medium">{v.model_variant}</td>
                                                <td className="p-2 font-bold text-primary-600">{v.size}</td>
                                                <td className="p-2 font-mono text-xs">{v.sku}</td>
                                                <td className="p-2 text-right text-slate-400">{formatCurrency(v.price_cost)}</td>
                                                <td className="p-2 text-right font-bold">{formatCurrency(v.price_sale)}</td>
                                                <td className="p-2 text-right">
                                                    <span className={`px-2 py-0.5 rounded font-bold ${v.quantity <= 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{v.quantity} un</span>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => setEditingVariation(v)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14}/></button>
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </td>
                            </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody></table>
            </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold dark:text-white text-lg">Cadastrar Novo Produto</h3>
                <button onClick={() => setIsNewProductModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Referência / Código</label>
                        <input placeholder="Ex: 100-02" value={newProduct.modelo} onChange={e => setNewProduct({...newProduct, modelo: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                        <input placeholder="Ex: Camisola" value={newProduct.categoria} onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Nome do Produto</label>
                    <input placeholder="Ex: Pijama de Ursinho" value={newProduct.nome} onChange={e => setNewProduct({...newProduct, nome: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" />
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border dark:border-slate-600">
                    <h4 className="font-bold text-sm mb-4 dark:text-white flex items-center"><Layers size={16} className="mr-2 text-primary-500"/> Adicionar Variações (Tamanho/Cor)</h4>
                    
                    {sizes.length === 0 ? (
                        <div className="bg-amber-100 text-amber-800 p-4 rounded text-sm flex items-center justify-between">
                            <div className="flex items-center">
                                <AlertTriangle size={18} className="mr-2"/>
                                NENHUM TAMANHO CADASTRADO.
                            </div>
                            <Link to="/settings" className="flex items-center font-bold underline">
                                Ir para Configurações <SettingsIcon size={14} className="ml-1"/>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            <input placeholder="Modelo/Cor" className="sm:col-span-2 p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.model} onChange={e => setTempVar({...tempVar, model: e.target.value})} />
                            <select className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.size} onChange={e => setTempVar({...tempVar, size: e.target.value})}>
                                {sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                            <input placeholder="SKU" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.sku} onChange={e => setTempVar({...tempVar, sku: e.target.value})} />
                            <button onClick={handleAddTempVar} className="bg-primary-600 text-white rounded font-bold flex items-center justify-center hover:bg-primary-700 transition-colors"><Plus size={20}/></button>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    {newProduct.variations.map((v, i) => (
                        <div key={i} className="text-xs p-3 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded flex justify-between items-center shadow-sm">
                            <div className="flex gap-4">
                                <span className="font-bold">{v.model_variant}</span>
                                <span className="text-primary-600 font-bold">{v.size}</span>
                                <span className="text-slate-400 font-mono">{v.sku}</span>
                            </div>
                            <button onClick={() => setNewProduct({...newProduct, variations: newProduct.variations.filter((_, idx) => idx !== i)})} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded transition-colors"><X size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsNewProductModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                <button onClick={saveNewProduct} disabled={newProduct.variations.length === 0} className="px-8 py-2 bg-primary-600 text-white rounded font-bold disabled:opacity-50">Finalizar Cadastro</button>
            </div>
          </div>
        </div>
      )}

      {isAddVariantModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                   <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <h4 className="font-bold dark:text-white text-lg">Adicionar Variação</h4>
                        <button onClick={() => setIsAddVariantModalOpen(false)}><X size={20}/></button>
                   </div>
                   <div className="p-6 space-y-4">
                        {sizes.length === 0 ? (
                            <div className="bg-amber-100 text-amber-800 p-4 rounded text-sm flex items-center justify-between">
                                <div className="flex items-center">
                                    <AlertTriangle size={18} className="mr-2"/>
                                    NENHUM TAMANHO CADASTRADO.
                                </div>
                                <Link to="/settings" className="font-bold underline">Configurar</Link>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Modelo / Cor</label>
                                    <input placeholder="Ex: Azul com Poá" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.model} onChange={e => setNewVariant({...newVariant, model: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Tamanho</label>
                                        <select className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.size} onChange={e => setNewVariant({...newVariant, size: e.target.value})}>
                                            {sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">SKU / Cód. Barras</label>
                                        <input placeholder="Bipe ou digite" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.sku} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Preço de Custo</label>
                                        <input placeholder="R$ 0,00" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.price_cost} onChange={e => setNewVariant({...newVariant, price_cost: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Preço de Venda</label>
                                        <input placeholder="R$ 0,00" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.price_sale} onChange={e => setNewVariant({...newVariant, price_sale: e.target.value})} />
                                    </div>
                                </div>
                            </>
                        )}
                   </div>
                   <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button onClick={() => setIsAddVariantModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                        <button onClick={handleSaveNewVariant} disabled={sizes.length === 0} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 transition-colors disabled:opacity-50">Adicionar Variação</button>
                    </div>
               </div>
          </div>
      )}
    </div>
  );
};
