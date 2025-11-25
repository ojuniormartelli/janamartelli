
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, ProductVariation } from '../types';
import { ChevronDown, ChevronRight, Plus, AlertTriangle, FileSpreadsheet, Loader, Trash2, Edit2, X, Save } from 'lucide-react';
import { formatCurrency, parseCurrencyString } from '../utils/formatters';

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for editing a specific variation
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({ 
    nome: '', 
    categoria: '', 
    variations: [] as any[] 
  });
  // Temp state for adding variation line in modal
  const [tempVar, setTempVar] = useState({ model: '', size: 'M', cost: '', sale: '', sku: '', qty: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInventory = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*').order('nome');
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*').order('model_variant');

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

      // Skip header if first col is "Nome"
      const startIndex = lines[0].toLowerCase().includes('nome') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV: Nome, Modelo(Cor), Categoria, Tamanho, SKU, Quantidade, Custo, Venda
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 8) { errorCount++; continue; }

        const [nome, modelo, categoria, size, sku, qtdStr, costStr, saleStr] = cols;

        try {
            // 1. Check if PARENT exists (by Name only)
            // We cache products locally to avoid too many requests in loop, but for safety in demo we fetch or use list
            let productId = products.find(p => p.nome.toLowerCase() === nome.toLowerCase())?.id;

            if (!productId) {
                // Check DB
                const { data: existing } = await supabase
                    .from('products')
                    .select('id')
                    .ilike('nome', nome)
                    .maybeSingle();
                
                if (existing) {
                    productId = existing.id;
                } else {
                    const { data: newProd, error: createError } = await supabase
                        .from('products')
                        .insert({ 
                            nome, 
                            categoria, 
                            modelo: 'Multi', // Generic reference
                            descricao: nome 
                        })
                        .select('id')
                        .single();
                    if (createError) throw createError;
                    productId = newProd!.id;
                }
            }

            // 2. Upsert Variation (Unique constraint: product_id + model_variant + size)
            const quantity = parseInt(qtdStr) || 0;
            const price_cost = parseCurrencyString(costStr);
            const price_sale = parseCurrencyString(saleStr);

            const { error: upsertError } = await supabase
                .from('estoque_tamanhos')
                .upsert({
                    product_id: productId,
                    model_variant: modelo, // Specific Color/Model
                    size: size.toUpperCase(),
                    sku,
                    quantity,
                    price_cost,
                    price_sale,
                    reference: sku
                }, { onConflict: 'product_id, model_variant, size' });

            if (upsertError) throw upsertError;
            successCount++;

        } catch (err) {
            console.error(`Erro na linha ${i + 1}:`, err);
            errorCount++;
        }
      }

      alert(`Importação concluída!\nSucessos: ${successCount}\nErros: ${errorCount}`);
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchInventory();
    };

    reader.readAsText(file);
  };

  const handleReportLoss = async (variant: ProductVariation) => {
    if (!confirm(`Baixar 1 unidade defeituosa de "${variant.model_variant} - ${variant.size}"?`)) return;

    const { error } = await supabase.from('estoque_tamanhos').update({ quantity: variant.quantity - 1 }).eq('id', variant.id);
    if (error) return alert('Erro ao atualizar estoque');

    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('vendas').insert({
        total_value: variant.price_cost,
        payment_status: 'loss',
        status_label: 'Baixa',
        user_id: userData.user?.id,
        observacoes: `Baixa: ${variant.sku} (${variant.model_variant})`
    });
    fetchInventory();
  };

  const handleDeleteVariation = async (id: string) => {
    if(!confirm("Excluir esta variação permanentemente?")) return;
    const { error } = await supabase.from('estoque_tamanhos').delete().eq('id', id);
    if(error) alert("Erro ao excluir");
    else fetchInventory();
  };

  const handleDeleteProduct = async (id: string) => {
    if(!confirm("Excluir produto COMPLETO e todas as suas variações?")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if(error) alert("Erro ao excluir");
    else fetchInventory();
  };

  const handleSaveVariationEdit = async () => {
    if (!editingVariation) return;
    const { error } = await supabase
      .from('estoque_tamanhos')
      .update({
        price_cost: editingVariation.price_cost,
        price_sale: editingVariation.price_sale,
        quantity: editingVariation.quantity,
        sku: editingVariation.sku
      })
      .eq('id', editingVariation.id);

    if (error) alert("Erro ao salvar");
    else {
      setEditingVariation(null);
      fetchInventory();
    }
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
    // Reset temp slightly but keep generic info
    setTempVar(prev => ({ ...prev, size: 'M', sku: '' }));
  };

  const saveNewProduct = async () => {
    if (!newProduct.nome || newProduct.variations.length === 0) return alert("Preencha nome e adicione ao menos uma variação.");

    // 1. Create Parent
    const { data: parent, error } = await supabase.from('products').insert({
        nome: newProduct.nome,
        categoria: newProduct.categoria,
        modelo: 'Geral',
        descricao: newProduct.nome
    }).select().single();

    if (error || !parent) return alert("Erro ao criar produto pai.");

    // 2. Create Children
    const variationsPayload = newProduct.variations.map(v => ({
        product_id: parent.id,
        ...v
    }));

    const { error: varError } = await supabase.from('estoque_tamanhos').insert(variationsPayload);
    
    if (varError) {
        console.error(varError);
        alert("Produto criado, mas erro nas variações.");
    }

    setIsModalOpen(false);
    setNewProduct({ nome: '', categoria: '', variations: [] });
    fetchInventory();
  };

  return (
    <div>
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImport} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Estoque Inteligente</h2>
            <p className="text-sm text-slate-500">Agrupado por Referência (Nome)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 disabled:opacity-50 text-sm"
          >
            {importing ? <Loader className="mr-2 animate-spin" size={16} /> : <FileSpreadsheet className="mr-2" size={16} />}
            CSV
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm">
            <Plus className="mr-2" size={16} />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        {loading ? (
            <div className="p-8 text-center text-slate-500">Carregando estoque...</div>
        ) : (
            <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                <th className="p-4 w-10"></th>
                <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold">Produto / Referência</th>
                <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold">Categoria</th>
                <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold text-right">Total em Estoque</th>
                <th className="p-4 w-10"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {products.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum produto cadastrado.</td></tr>
                )}
                {products.map(product => {
                    const totalQty = product.variations?.reduce((acc, v) => acc + v.quantity, 0) || 0;
                    return (
                    <React.Fragment key={product.id}>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <td className="p-4 cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>
                                {expandedRow === product.id ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                            </td>
                            <td className="p-4 font-bold text-slate-700 dark:text-white cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>
                                {product.nome}
                            </td>
                            <td className="p-4 text-slate-500 dark:text-slate-400">{product.categoria}</td>
                            <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-900/30 rounded">
                                {totalQty} un
                            </td>
                            <td className="p-4 text-right">
                                <button onClick={() => handleDeleteProduct(product.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                        {expandedRow === product.id && (
                        <tr>
                            <td colSpan={5} className="bg-slate-50 dark:bg-slate-900/30 p-4 border-b border-slate-200 dark:border-slate-700 shadow-inner">
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
                                {product.variations?.map(v => (
                                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="py-2 px-4 font-medium dark:text-white">{v.model_variant}</td>
                                        <td className="py-2 px-4 font-bold bg-slate-100 dark:bg-slate-700 rounded text-center w-12 mx-auto block mt-1">{v.size}</td>
                                        <td className="py-2 px-4 text-slate-500 font-mono text-xs">{v.sku}</td>
                                        <td className="py-2 px-4 text-right text-slate-500">{formatCurrency(v.price_cost)}</td>
                                        <td className="py-2 px-4 text-right text-green-600 dark:text-green-400 font-bold">{formatCurrency(v.price_sale)}</td>
                                        <td className={`py-2 px-4 text-right font-bold ${v.quantity <= 2 ? 'text-red-500' : 'dark:text-white'}`}>{v.quantity}</td>
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

      {/* MODAL: NOVO PRODUTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b dark:border-slate-700">
                <h3 className="text-xl font-bold dark:text-white">Novo Produto</h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium mb-1 dark:text-slate-300">Nome do Produto (Referência)</label>
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
                            placeholder="Modelo/Cor (Ex: Azul)" 
                            className="col-span-2 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.model} onChange={e => setTempVar({...tempVar, model: e.target.value})}
                        />
                        <select 
                            className="col-span-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.size} onChange={e => setTempVar({...tempVar, size: e.target.value})}
                        >
                            {['P','M','G','GG','XG','U'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input 
                            placeholder="SKU" 
                            className="col-span-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.sku} onChange={e => setTempVar({...tempVar, sku: e.target.value})}
                        />
                         <input 
                            placeholder="Qtd" 
                            type="number"
                            className="col-span-1 p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.qty} onChange={e => setTempVar({...tempVar, qty: Number(e.target.value)})}
                        />
                         <button 
                            onClick={handleAddTempVar}
                            className="col-span-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center">
                             <Plus size={18} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <input 
                            placeholder="Preço Custo (R$)" 
                            className="p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.cost} onChange={e => setTempVar({...tempVar, cost: e.target.value})}
                        />
                        <input 
                            placeholder="Preço Venda (R$)" 
                            className="p-2 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            value={tempVar.sale} onChange={e => setTempVar({...tempVar, sale: e.target.value})}
                        />
                    </div>
                </div>

                {/* List of pending variations */}
                <div className="space-y-2">
                    {newProduct.variations.map((v, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-700 rounded text-sm">
                            <span className="dark:text-white font-medium">{v.model_variant} - {v.size}</span>
                            <span className="text-slate-500">{v.sku}</span>
                            <span className="text-green-600 font-bold">{formatCurrency(v.price_sale)}</span>
                            <button onClick={() => setNewProduct(prev => ({...prev, variations: prev.variations.filter((_, i) => i !== idx)}))} className="text-red-500">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {newProduct.variations.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Nenhuma variação adicionada ainda.</p>}
                </div>
            </div>

            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300">Cancelar</button>
              <button onClick={saveNewProduct} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Salvar Tudo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR VARIAÇÃO INDIVIDUAL */}
      {editingVariation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-xl w-80">
                  <h4 className="font-bold mb-4 dark:text-white">Editar: {editingVariation.model_variant} ({editingVariation.size})</h4>
                  
                  <div className="space-y-3">
                      <div>
                          <label className="text-xs text-slate-500">SKU</label>
                          <input 
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              value={editingVariation.sku}
                              onChange={e => setEditingVariation({...editingVariation, sku: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-xs text-slate-500">Estoque</label>
                          <input 
                              type="number"
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              value={editingVariation.quantity}
                              onChange={e => setEditingVariation({...editingVariation, quantity: Number(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="text-xs text-slate-500">Preço Custo</label>
                          <input 
                              type="number" step="0.01"
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              value={editingVariation.price_cost}
                              onChange={e => setEditingVariation({...editingVariation, price_cost: Number(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="text-xs text-slate-500">Preço Venda</label>
                          <input 
                              type="number" step="0.01"
                              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                              value={editingVariation.price_sale}
                              onChange={e => setEditingVariation({...editingVariation, price_sale: Number(e.target.value)})}
                          />
                      </div>
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
