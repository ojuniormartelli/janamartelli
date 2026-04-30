
import React, { useState } from 'react';
import { X, FileText, Loader, CheckCircle, Edit2, Trash2, Save, AlertCircle } from 'lucide-react';
import { parseRomaneioText, RomaneioItem } from '../services/geminiService';
import { supabase } from '../supabaseClient';
import { formatCurrency } from '../utils/formatters';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const RomaneioImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2>(1); // 1: Input text, 2: Review/Edit
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<RomaneioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleProcess = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    try {
      const parsedItems = await parseRomaneioText(rawText);
      // Inicializar valor de venda como 0 conforme pedido
      const itemsWithSalePrice = parsedItems.map(item => ({
        ...item,
        price_sale: 0
      }));
      setItems(itemsWithSalePrice);
      setStep(2);
    } catch (error: any) {
      alert(error.message || "Houve um erro ao processar o texto. Verifique se o conteúdo é válido.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImport = async () => {
    setSaving(true);
    try {
      for (const item of items) {
        // 1. Encontrar ou criar o produto base
        let productId = '';
        const { data: existingProd } = await supabase
          .from('products')
          .select('id')
          .eq('nome', item.name)
          .eq('modelo', item.sku) // Usando SKU como referência/modelo
          .maybeSingle();

        if (existingProd) {
          productId = existingProd.id;
        } else {
          const { data: newP, error: pError } = await supabase
            .from('products')
            .insert({ 
              nome: item.name, 
              modelo: item.sku, 
              categoria: item.category,
              descricao: item.name 
            })
            .select()
            .single();
          
          if (pError) throw pError;
          if (newP) productId = newP.id;
        }

        if (productId) {
          // 2. Verificar se a variação já existe
          const { data: existingVar } = await supabase
            .from('estoque_tamanhos')
            .select('id, quantity')
            .eq('product_id', productId)
            .eq('model_variant', item.variant)
            .eq('size', item.size)
            .maybeSingle();

          if (existingVar) {
            // Atualizar
            await supabase
              .from('estoque_tamanhos')
              .update({ 
                quantity: existingVar.quantity + item.quantity,
                price_cost: item.cost,
              })
              .eq('id', existingVar.id);
          } else {
            // Inserir
            await supabase
              .from('estoque_tamanhos')
              .insert({
                product_id: productId,
                model_variant: item.variant,
                size: item.size,
                sku: `${item.sku}-${item.size}`, // Gerar um SKU composto
                quantity: item.quantity,
                price_cost: item.cost,
                price_sale: item.price_sale || 0
              });
          }
        }
      }
      alert("Importação concluída com sucesso!");
      onSuccess();
    } catch (error: any) {
      alert("Erro ao salvar importação: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border dark:border-slate-700"
      >
        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold dark:text-white">Importar Romaneio Inteligente</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Processamento automático via IA para romaneios PDF</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col space-y-4"
            >
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-bold">Como funciona:</p>
                  <p>Copie o texto da tabela do seu PDF de romaneio e cole no campo abaixo. Nossa IA irá identificar automaticamente Referência, Nome, Cor, Tamanho, Quantidade e Preço de Custo.</p>
                </div>
              </div>
              
              <div className="flex-1 min-h-0 flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2">Conteúdo do Romaneio (Cole aqui)</label>
                <textarea 
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Ex: 14697-PIJAMA FEMININO INVERNO CAMISA DE VISCO C/BOTOES CALCA VISCO MOCHA MOUSSE G CJ 1,000 125,90 125,90..."
                  className="flex-1 w-full p-4 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-center pt-4">
                <button 
                  onClick={handleProcess}
                  disabled={loading || !rawText.trim()}
                  className="px-12 py-4 bg-primary-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                  Começar Mapeamento
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col space-y-6"
            >
               <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <CheckCircle className="text-green-500" size={20} />
                    Conferência de Dados ({items.length} itens extraídos)
                  </h4>
                  <button 
                    onClick={() => setStep(1)}
                    className="text-primary-600 text-sm font-bold hover:underline"
                  >
                    ← Voltar e colar novo texto
                  </button>
               </div>

               <div className="flex-1 border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] uppercase font-bold z-10">
                        <tr>
                          <th className="p-3 border-b dark:border-slate-700">Ref/SKU</th>
                          <th className="p-3 border-b dark:border-slate-700">Categoria</th>
                          <th className="p-3 border-b dark:border-slate-700">Produto (Nome)</th>
                          <th className="p-3 border-b dark:border-slate-700">Cor/Variação</th>
                          <th className="p-3 border-b dark:border-slate-700">Tam</th>
                          <th className="p-3 border-b dark:border-slate-700 text-right">Qtd</th>
                          <th className="p-3 border-b dark:border-slate-700 text-right">Custo</th>
                          <th className="p-3 border-b dark:border-slate-700 text-right">Venda</th>
                          <th className="p-3 border-b dark:border-slate-700 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-800">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            {editingIndex === idx ? (
                              <>
                                <td className="p-2"><input className="w-full p-1 border rounded text-xs dark:bg-slate-700 dark:text-white" value={item.sku} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, sku: e.target.value} : it))} /></td>
                                <td className="p-2"><input className="w-full p-1 border rounded text-xs dark:bg-slate-700 dark:text-white" value={item.category} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, category: e.target.value} : it))} /></td>
                                <td className="p-2"><input className="w-full p-1 border rounded text-xs dark:bg-slate-700 dark:text-white" value={item.name} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, name: e.target.value} : it))} /></td>
                                <td className="p-2"><input className="w-full p-1 border rounded text-xs dark:bg-slate-700 dark:text-white" value={item.variant} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, variant: e.target.value} : it))} /></td>
                                <td className="p-2"><input className="w-full p-1 border rounded text-xs dark:bg-slate-700 dark:text-white" value={item.size} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, size: e.target.value} : it))} /></td>
                                <td className="p-2"><input type="number" className="w-full p-1 border rounded text-xs text-right dark:bg-slate-700 dark:text-white" value={item.quantity} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, quantity: parseInt(e.target.value) || 0} : it))} /></td>
                                <td className="p-2"><input type="number" step="0.01" className="w-full p-1 border rounded text-xs text-right dark:bg-slate-700 dark:text-white" value={item.cost} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, cost: parseFloat(e.target.value) || 0} : it))} /></td>
                                <td className="p-2"><input type="number" step="0.01" className="w-full p-1 border rounded text-xs text-right dark:bg-slate-700 dark:text-white font-bold" value={item.price_sale} onChange={(e) => setItems(items.map((it, i) => i === idx ? {...it, price_sale: parseFloat(e.target.value) || 0} : it))} /></td>
                                <td className="p-2 text-center"><button onClick={() => setEditingIndex(null)} className="p-1 px-2 bg-green-600 text-white rounded text-[10px] font-bold">OK</button></td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 text-xs font-mono font-bold text-primary-600">{item.sku}</td>
                                <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">{item.category}</td>
                                <td className="p-3 text-xs font-bold dark:text-white">{item.name}</td>
                                <td className="p-3 text-xs dark:text-slate-300">{item.variant}</td>
                                <td className="p-3 text-xs font-black text-center">{item.size}</td>
                                <td className="p-3 text-xs text-right font-bold">{item.quantity}</td>
                                <td className="p-3 text-xs text-right text-slate-500 font-bold">{formatCurrency(item.cost)}</td>
                                <td className="p-3 text-xs text-right text-green-600 font-bold">{formatCurrency(item.price_sale || 0)}</td>
                                <td className="p-3 text-center">
                                  <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingIndex(idx)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit2 size={14} /></button>
                                    <button onClick={() => removeItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={14} /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>

               <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={onClose}
                    className="px-6 py-3 border dark:border-slate-700 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveImport}
                    disabled={saving || items.length === 0}
                    className="px-10 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                    Finalizar Importação de {items.length} Itens
                  </button>
               </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
