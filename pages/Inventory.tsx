import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Product, ProductVariation } from '../types';
import { ChevronDown, ChevronRight, Plus, Trash2, Save, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ active: true, variations: [] });

  const fetchInventory = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*').order('nome');
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

  const handleReportLoss = async (variant: ProductVariation) => {
    if (!confirm(`Confirmar baixa por PERDA/DEFEITO de 1 unidade de ${variant.size}? Isso registrará um prejuízo de ${formatCurrency(variant.price_cost)}.`)) return;

    // 1. Decrement Stock
    const { error: stockError } = await supabase
      .from('estoque_tamanhos')
      .update({ quantity: variant.quantity - 1 })
      .eq('id', variant.id);

    if (stockError) return alert('Erro ao atualizar estoque');

    // 2. Create "Loss" Sale Record
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('vendas').insert({
        total_value: variant.price_cost, // Record cost as value (loss)
        payment_status: 'loss',
        status_label: 'Baixa',
        user_id: userData.user?.id,
        observacoes: `Baixa de item defeituoso: SKU ${variant.sku || 'N/A'}`
    });

    fetchInventory();
  };

  const saveProduct = async () => {
    if (!newProduct.nome) return;

    // Save Parent
    const { data: parent, error } = await supabase.from('products').insert({
      nome: newProduct.nome,
      modelo: newProduct.modelo,
      categoria: newProduct.categoria,
      descricao: newProduct.descricao
    }).select().single();

    if (error || !parent) {
      alert('Erro ao salvar produto');
      return;
    }

    // Save Children (Default Size Grade)
    const sizes = ['P', 'M', 'G', 'GG'];
    const variations = sizes.map(size => ({
        product_id: parent.id,
        size,
        quantity: 0,
        price_cost: 0,
        price_sale: 0,
        sku: `${parent.nome.substring(0,3).toUpperCase()}-${size}`
    }));

    await supabase.from('estoque_tamanhos').insert(variations);
    setIsModalOpen(false);
    fetchInventory();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Estoque Inteligente</h2>
        <div className="flex gap-2">
          <button className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200">
            <FileSpreadsheet className="mr-2" size={18} />
            Importar CSV
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
            <Plus className="mr-2" size={18} />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold w-10"></th>
              <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold">Produto</th>
              <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold">Modelo</th>
              <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold">Categoria</th>
              <th className="p-4 text-slate-600 dark:text-slate-300 font-semibold text-right">Total Itens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {products.map(product => (
              <React.Fragment key={product.id}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 cursor-pointer" onClick={() => setExpandedRow(expandedRow === product.id ? null : product.id)}>
                    {expandedRow === product.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </td>
                  <td className="p-4 font-medium dark:text-white">{product.nome}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{product.modelo}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{product.categoria}</td>
                  <td className="p-4 text-right font-mono dark:text-slate-300">
                    {product.variations?.reduce((acc, v) => acc + v.quantity, 0)}
                  </td>
                </tr>
                {expandedRow === product.id && (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 dark:bg-slate-900/50 p-4 shadow-inner">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="pb-2 text-left">Tamanho</th>
                            <th className="pb-2 text-left">SKU</th>
                            <th className="pb-2 text-right">Custo</th>
                            <th className="pb-2 text-right">Venda</th>
                            <th className="pb-2 text-right">Qtd</th>
                            <th className="pb-2 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.variations?.map(v => (
                            <tr key={v.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <td className="py-2 dark:text-slate-300 font-bold">{v.size}</td>
                              <td className="py-2 text-slate-500">{v.sku}</td>
                              <td className="py-2 text-right text-slate-600 dark:text-slate-400">{formatCurrency(v.price_cost)}</td>
                              <td className="py-2 text-right text-green-600 dark:text-green-400 font-medium">{formatCurrency(v.price_sale)}</td>
                              <td className="py-2 text-right dark:text-white">{v.quantity}</td>
                              <td className="py-2 flex justify-center gap-2">
                                <button 
                                    onClick={() => handleReportLoss(v)}
                                    title="Baixa por Defeito"
                                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                  <AlertTriangle size={16} />
                                </button>
                                {/* Edit functionality would go here (omitted for brevity) */}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Novo Produto</h3>
            <div className="space-y-4">
              <input 
                placeholder="Nome do Produto" 
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                onChange={e => setNewProduct({...newProduct, nome: e.target.value})}
              />
              <input 
                placeholder="Modelo / Cor" 
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                onChange={e => setNewProduct({...newProduct, modelo: e.target.value})}
              />
              <input 
                placeholder="Categoria (ex: Masculino)" 
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                onChange={e => setNewProduct({...newProduct, categoria: e.target.value})}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300">Cancelar</button>
              <button onClick={saveProduct} className="px-4 py-2 bg-primary-600 text-white rounded">Salvar & Gerar Grade</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
