
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, ProductVariation, ProductSize } from '../types';
import { ChevronDown, ChevronRight, Plus, AlertTriangle, Loader, Trash2, Edit2, X, Save, Search, Download, Layers, Settings as SettingsIcon, Package, PlusCircle } from 'lucide-react';
import { formatCurrency, parseCurrencyString } from '../utils/formatters';
import { Link } from 'react-router-dom';

type SortField = 'modelo' | 'nome' | 'categoria' | 'stock';

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Modals
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  
  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'modelo', direction: 'asc' });

  // State for editing
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockVariation, setRestockVariation] = useState<{ id: string, name: string, current: number, add: number } | null>(null);

  // Forms
  const [newProduct, setNewProduct] = useState({ nome: '', modelo: '', categoria: '', variations: [] as any[] });
  const [newVariant, setNewVariant] = useState({ productId: '', model: '', size: '', sku: '', quantity: 0, price_cost: '', price_sale: '' });
  const [tempVar, setTempVar] = useState({ model: '', size: '', cost: '', sale: '', sku: '', qty: 0 });
  
  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*');
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*');
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
        if (sizeData.length > 0) {
            setTempVar(prev => ({ ...prev, size: sizeData[0].name }));
        }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
        let valA = (a as any)[sortConfig.field]?.toString().toLowerCase() || '';
        let valB = (b as any)[sortConfig.field]?.toString().toLowerCase() || '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [products, searchQuery, sortConfig]);

  const handleExportCSV = () => {
      const header = "SKU,Referencia,Nome,Modelo,Categoria,Tamanho,Quantidade,Preco_Custo,Preco_Venda\n";
      const rows: string[] = [];
      products.forEach(p => {
          p.variations?.forEach(v => {
              const escape = (t: any) => `"${(t || '').toString().replace(/"/g, '""')}"`;
              const row = [escape(v.sku), escape(p.modelo), escape(p.nome), escape(v.model_variant), escape(p.categoria), escape(v.size), v.quantity, v.price_cost.toFixed(2), v.price_sale.toFixed(2)].join(',');
              rows.push(row);
          });
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

  const handleDeleteVariation = async (id: string) => {
    if(!confirm("Excluir esta variação?")) return;
    const { error } = await supabase.from('estoque_tamanhos').delete().eq('id', id);
    if (error) alert("Erro ao excluir");
    else fetchData();
  };

  const handleDeleteProduct = async (id: string) => {
    if(!confirm("Excluir produto COMPLETO? Isso removerá todas as variações.")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("Erro ao excluir produto");
    else fetchData();
  };

  const handleSaveVariationEdit = async () => {
    if (!editingVariation) return;
    setLoading(true);
    const { error } = await supabase.from('estoque_tamanhos').update({ 
        price_cost: editingVariation.price_cost, 
        price_sale: editingVariation.price_sale, 
        quantity: editingVariation.quantity, 
        sku: editingVariation.sku,
        model_variant: editingVariation.model_variant,
        size: editingVariation.size
    }).eq('id', editingVariation.id);
    
    if (error) alert("Erro ao salvar: " + error.message);
    else { setEditingVariation(null); fetchData(); }
    setLoading(false);
  };

  const handleQuickRestock = async () => {
      if (!restockVariation) return;
      setLoading(true);
      const newQty = restockVariation.current + restockVariation.add;
      const { error } = await supabase.from('estoque_tamanhos').update({ quantity: newQty }).eq('id', restockVariation.id);
      if (error) alert("Erro ao atualizar estoque");
      else { setIsRestockModalOpen(false); setRestockVariation(null); fetchData(); }
      setLoading(false);
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    setLoading(true);
    const { error } = await supabase.from('products').update({ 
        nome: editingProduct.nome, 
        modelo: editingProduct.modelo, 
        categoria: editingProduct.categoria 
    }).eq('id', editingProduct.id);

    if (error) alert("Erro ao salvar produto");
    else { setEditingProduct(null); fetchData(); }
    setLoading(false);
  };

  const handleAddTempVar = () => {
    if (!tempVar.model || !tempVar.sku) return alert("Modelo e SKU obrigatórios");
    setNewProduct(prev => ({
        ...prev,
        variations: [...prev.variations, {
            model_variant: tempVar.model, size: tempVar.size, sku: tempVar.sku, quantity: tempVar.qty,
            price_cost: parseCurrencyString(tempVar.cost.toString()), price_sale: parseCurrencyString(tempVar.sale.toString())
        }]
    }));
    setTempVar(prev => ({ ...prev, sku: '' }));
  };

  const saveNewProduct = async () => {
    if (!newProduct.nome || newProduct.variations.length === 0) return alert("Preencha o nome e adicione ao menos uma variação.");
    setLoading(true);
    const { data: parent, error: pError } = await supabase.from('products').insert({ 
        nome: newProduct.nome, categoria: newProduct.categoria, modelo: newProduct.modelo || 'Geral', descricao: newProduct.nome 
    }).select().single();
    
    if (!pError && parent) {
        const payload = newProduct.variations.map(v => ({ product_id: parent.id, ...v }));
        await supabase.from('estoque_tamanhos').insert(payload);
        setIsNewProductModalOpen(false);
        setNewProduct({ nome: '', modelo: '', categoria: '', variations: [] });
        fetchData();
    }
    setLoading(false);
  };

  const openAddVariantModal = (productId: string) => {
      setNewVariant({ productId, model: '', size: sizes[0]?.name || '', sku: '', quantity: 0, price_cost: '', price_sale: '' });
      setIsAddVariantModalOpen(true);
  };

  const handleSaveNewVariant = async () => {
      if(!newVariant.model || !newVariant.sku) return alert("Preencha Modelo e SKU");
      setLoading(true);
      const { error } = await supabase.from('estoque_tamanhos').insert({ 
          product_id: newVariant.productId, model_variant: newVariant.model, size: newVariant.size, 
          sku: newVariant.sku, quantity: newVariant.quantity, price_cost: parseCurrencyString(newVariant.price_cost), 
          price_sale: parseCurrencyString(newVariant.price_sale) 
      });
      if (!error) { setIsAddVariantModalOpen(false); fetchData(); }
      setLoading(false);
  };

  return (
    <div>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Estoque Inteligente</h2><p className="text-sm text-slate-500">Agrupado por Referência (Nome)</p></div>
        <div className="flex-1 max-w-md w-full relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-slate-700 dark:text-white shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="px-4 py-2 bg-white dark:bg-slate-800 border rounded text-sm hover:bg-slate-50 transition-colors shadow-sm"><Download size={16} /></button>
          <button onClick={() => setIsNewProductModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white rounded text-sm font-bold shadow-md hover:bg-primary-700 transition-colors">Novo Produto</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden border dark:border-slate-700">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <tr><th className="p-4 w-10"></th><th className="p-4">Referência</th><th className="p-4">Nome</th><th className="p-4">Categoria</th><th className="p-4 text-right">Estoque</th><th className="p-4 text-center">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading && products.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center"><Loader className="animate-spin mx-auto text-primary-500" size={32} /></td></tr>
                ) : processedProducts.map(product => (
                    <React.Fragment key={product.id}>
                        <tr 
                          onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                        >
                            <td className="p-4">{expandedRow === product.id ? <ChevronDown size={18} className="text-primary-500" /> : <ChevronRight size={18} />}</td>
                            <td className="p-4 font-mono text-sm">{product.modelo}</td>
                            <td className="p-4 font-bold dark:text-white">{product.nome}</td>
                            <td className="p-4"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs">{product.categoria}</span></td>
                            <td className="p-4 text-right font-bold text-primary-600">{product.variations?.reduce((acc, v) => acc + v.quantity, 0) || 0} un</td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setEditingProduct(product)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors"><Edit2 size={16}/></button>
                                    <button onClick={() => openAddVariantModal(product.id)} className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-3 py-1 text-xs rounded font-bold hover:bg-primary-100 transition-colors">Nova Var</button>
                                    <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </td>
                        </tr>
                        {expandedRow === product.id && (
                        <tr>
                            <td colSpan={6} className="bg-slate-50 dark:bg-slate-900/30 p-4 border-t border-slate-100 dark:border-slate-700">
                                <table className="w-full text-sm bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden border dark:border-slate-700">
                                    <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 font-bold uppercase text-[10px]"><tr className="border-b dark:border-slate-700"><th className="p-3 text-left">Modelo/Cor</th><th className="p-3">Tam</th><th className="p-3">SKU</th><th className="p-3 text-right">Custo</th><th className="p-3 text-right">Venda</th><th className="p-3 text-right">Qtd</th><th className="p-3 text-center">Ações</th></tr></thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {product.variations?.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className="p-3 font-medium">{v.model_variant}</td>
                                            <td className="p-3 font-bold text-primary-600 uppercase">{v.size}</td>
                                            <td className="p-3 font-mono text-xs">{v.sku}</td>
                                            <td className="p-3 text-right text-slate-400">{formatCurrency(v.price_cost)}</td>
                                            <td className="p-3 text-right font-bold">{formatCurrency(v.price_sale)}</td>
                                            <td className="p-3 text-right">
                                                <span className={`px-2 py-0.5 rounded font-bold ${v.quantity <= 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{v.quantity} un</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => { setRestockVariation({ id: v.id, name: `${product.nome} - ${v.size}`, current: v.quantity, add: 0 }); setIsRestockModalOpen(true); }} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Entrada de Estoque"><PlusCircle size={16}/></button>
                                                    <button onClick={() => setEditingVariation(v)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Editar"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteVariation(v.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={16}/></button>
                                                </div>
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
      </div>

      {/* --- MODAL ENTRADA RÁPIDA DE ESTOQUE --- */}
      {isRestockModalOpen && restockVariation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-xs overflow-hidden border dark:border-slate-700">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold dark:text-white">Entrada de Estoque</h3>
                    <button onClick={() => setIsRestockModalOpen(false)}><X size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-500 font-medium">Produto: <b className="text-slate-800 dark:text-white uppercase">{restockVariation.name}</b></p>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Quantidade a Adicionar</label>
                        <input 
                          type="number" autoFocus
                          className="w-full p-4 border-2 border-primary-500 rounded-lg dark:bg-slate-700 dark:text-white text-3xl font-bold text-center"
                          value={restockVariation.add || ''}
                          onChange={e => setRestockVariation({...restockVariation, add: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <div className="text-center text-xs text-slate-500">Saldo Final: <b className="text-primary-600">{restockVariation.current + restockVariation.add} un</b></div>
                    <button onClick={handleQuickRestock} className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold shadow-lg hover:bg-primary-700 transition-all">Confirmar Entrada</button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL NOVO PRODUTO --- */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold dark:text-white text-lg">Cadastrar Novo Produto</h3>
                <button onClick={() => setIsNewProductModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Referência / Código</label><input placeholder="Ex: 100-02" value={newProduct.modelo} onChange={e => setNewProduct({...newProduct, modelo: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Categoria</label><input placeholder="Ex: Camisola" value={newProduct.categoria} onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Nome do Produto</label><input placeholder="Ex: Pijama de Ursinho" value={newProduct.nome} onChange={e => setNewProduct({...newProduct, nome: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" /></div>
                
                <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border dark:border-slate-600">
                    <h4 className="font-bold text-sm mb-4 dark:text-white flex items-center"><Layers size={16} className="mr-2 text-primary-500"/> Adicionar Variações (Tamanho/Cor)</h4>
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input placeholder="Modelo/Cor (Ex: Azul Poá)" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.model} onChange={e => setTempVar({...tempVar, model: e.target.value})} />
                            <select className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.size} onChange={e => setTempVar({...tempVar, size: e.target.value})}>
                                {sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                            <input placeholder="SKU / Código Barras" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.sku} onChange={e => setTempVar({...tempVar, sku: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <input placeholder="Custo R$" type="number" className="p-2 border rounded dark:bg-slate-800 dark:text-white text-sm" value={tempVar.cost} onChange={e => setTempVar({...tempVar, cost: parseFloat(e.target.value) || 0})} />
                            <input placeholder="Venda R$" type="number" className="p-2 border rounded dark:bg-slate-800 dark:text-white text-sm font-bold" value={tempVar.sale} onChange={e => setTempVar({...tempVar, sale: parseFloat(e.target.value) || 0})} />
                            <input placeholder="Qtd Inicial" type="number" className="p-2 border rounded dark:bg-slate-800 dark:text-white text-sm" value={tempVar.qty} onChange={e => setTempVar({...tempVar, qty: parseInt(e.target.value) || 0})} />
                            <button onClick={handleAddTempVar} className="bg-primary-600 text-white rounded font-bold h-10 hover:bg-primary-700 transition-colors flex items-center justify-center"><Plus size={20} /></button>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {newProduct.variations.map((v, i) => (
                        <div key={i} className="text-xs p-3 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded flex justify-between items-center shadow-sm">
                            <div className="flex flex-wrap gap-x-4 gap-y-1"><span className="font-bold dark:text-white uppercase">{v.model_variant} - {v.size}</span><span className="text-primary-600 font-bold">Venda: {formatCurrency(v.price_sale)}</span><span className="px-2 bg-green-100 text-green-700 rounded font-bold">Qtd: {v.quantity}</span></div>
                            <button onClick={() => setNewProduct({...newProduct, variations: newProduct.variations.filter((_, idx) => idx !== i)})} className="text-red-500 p-1"><X size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsNewProductModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                <button onClick={saveNewProduct} disabled={newProduct.variations.length === 0 || loading} className="px-8 py-2 bg-primary-600 text-white rounded font-bold disabled:opacity-50 hover:bg-primary-700 transition-all">Finalizar Cadastro</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR PRODUTO --- */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-bold dark:text-white text-lg">Editar Produto</h3>
                <button onClick={() => setEditingProduct(null)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase">Referência / Código</label><input value={editingProduct.modelo} onChange={e => setEditingProduct({...editingProduct, modelo: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Nome</label><input value={editingProduct.nome} onChange={e => setEditingProduct({...editingProduct, nome: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Categoria</label><input value={editingProduct.categoria} onChange={e => setEditingProduct({...editingProduct, categoria: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
                <button onClick={() => setEditingProduct(null)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                <button onClick={handleSaveProductEdit} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR VARIAÇÃO --- */}
      {editingVariation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-bold dark:text-white text-lg flex items-center"><Package className="mr-2" size={20}/> Editar Variação</h3>
                <button onClick={() => setEditingVariation(null)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Modelo / Cor</label><input value={editingVariation.model_variant} onChange={e => setEditingVariation({...editingVariation, model_variant: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Tamanho</label>
                        <select className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editingVariation.size} onChange={e => setEditingVariation({...editingVariation, size: e.target.value})}>
                            {sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">SKU / Cód. Barras</label><input value={editingVariation.sku} onChange={e => setEditingVariation({...editingVariation, sku: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Custo (R$)</label><input type="number" step="0.01" value={editingVariation.price_cost} onChange={e => setEditingVariation({...editingVariation, price_cost: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Venda (R$)</label><input type="number" step="0.01" value={editingVariation.price_sale} onChange={e => setEditingVariation({...editingVariation, price_sale: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold text-primary-600" /></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Qtd Atual</label><input type="number" value={editingVariation.quantity} onChange={e => setEditingVariation({...editingVariation, quantity: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" /></div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
                <button onClick={() => setEditingVariation(null)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                <button onClick={handleSaveVariationEdit} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ADICIONAR NOVA VARIAÇÃO --- */}
      {isAddVariantModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-700">
                   <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h4 className="font-bold dark:text-white text-lg">Nova Variação</h4>
                        <button onClick={() => setIsAddVariantModalOpen(false)}><X size={20}/></button>
                   </div>
                   <div className="p-6 space-y-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Modelo / Cor</label><input placeholder="Ex: Azul com Poá" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.model} onChange={e => setNewVariant({...newVariant, model: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Tamanho</label><select className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.size} onChange={e => setNewVariant({...newVariant, size: e.target.value})}>{sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">SKU</label><input placeholder="Bipe ou digite" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.sku} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Custo</label><input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.price_cost} onChange={e => setNewVariant({...newVariant, price_cost: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Venda</label><input type="number" step="0.01" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.price_sale} onChange={e => setNewVariant({...newVariant, price_sale: e.target.value})} /></div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Quantidade Inicial</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.quantity} onChange={e => setNewVariant({...newVariant, quantity: parseInt(e.target.value) || 0})} /></div>
                   </div>
                   <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button onClick={() => setIsAddVariantModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button onClick={handleSaveNewVariant} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 shadow-md flex items-center"><Plus size={16} className="mr-2"/> Adicionar</button>
                    </div>
               </div>
          </div>
      )}
    </div>
  );
};
