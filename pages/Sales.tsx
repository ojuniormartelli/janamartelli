
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Sale } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Search, Eye, RefreshCw, CheckCircle, XCircle, ShoppingBag, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Sales: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // State das Abas
  const [activeTab, setActiveTab] = useState<'sales' | 'conditionals' | 'losses'>('sales');

  const navigate = useNavigate();

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vendas')
      .select(`*, client:clients(full_name), items:venda_itens(*, product_variation:estoque_tamanhos(*, products(*)))`)
      .order('created_at', { ascending: false });

    if (data) {
        setSales(data as any);
    }
    setLoading(false);
  };

  const handleStatusChange = async (sale: Sale, newStatus: string) => {
      if (newStatus === 'Devolução') {
          if (!confirm(sale.status_label === 'Baixa' ? `Estornar esta baixa? O item voltará ao estoque e a despesa será removida.` : `Confirmar devolução completa de ${sale.code}? Os itens voltarão ao estoque.`)) return;

          // Return stock
          if (sale.items) {
             for (const item of sale.items) {
                 const { data: curr } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.product_variation_id).single();
                 if (curr) {
                     await supabase.from('estoque_tamanhos').update({ quantity: curr.quantity + item.quantity }).eq('id', item.product_variation_id);
                 }
             }
          }
          
          if (sale.status_label === 'Baixa') {
              // If cancelling a LOSS/BAIXA, we should delete the financial transaction too
              const { data: tx } = await supabase.from('transactions').select('*').ilike('description', `%${sale.code}%`).single();
              if (tx) {
                  // Revert balance
                  const { data: acc } = await supabase.from('bank_accounts').select('*').eq('id', tx.account_id).single();
                  if (acc) {
                      await supabase.from('bank_accounts').update({ balance: acc.balance + tx.amount }).eq('id', acc.id);
                  }
                  // Delete tx
                  await supabase.from('transactions').delete().eq('id', tx.id);
              }
              await supabase.from('vendas').update({ 
                status_label: 'Devolução', 
                payment_status: 'refunded',
                observacoes: (sale.observacoes || '') + ' (Estornado)'
              }).eq('id', sale.id);

          } else {
             await supabase.from('vendas').update({ 
                status_label: 'Devolução', 
                payment_status: 'refunded' 
              }).eq('id', sale.id);
          }
            
      } else if (sale.status_label === 'Condicional' && newStatus === 'Convertida') {
          // LOGIC: CONVERT CONDITIONAL TO SALE
          // 1. Return stock from the Conditional (undoing the reservation logic if it was reserved, assuming stock was deducted on conditional creation)
          // Note: In current logic, stock IS deducted when Conditional is created.
          
          if (sale.items) {
              for (const item of sale.items) {
                  const { data: curr } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.product_variation_id).single();
                  if (curr) {
                      await supabase.from('estoque_tamanhos').update({ quantity: curr.quantity + item.quantity }).eq('id', item.product_variation_id);
                  }
              }
          }

          // 2. Mark old conditional as converted/closed
          await supabase.from('vendas').update({ 
              status_label: 'Convertida', 
              payment_status: 'refunded' 
          }).eq('id', sale.id);

          // 3. Redirect to POS to start a NEW sale with these items
          navigate('/', { state: { conversionSale: sale } });
          return; 
      }

      setSelectedSale(null);
      fetchSales();
  };

  // --- FILTERING LOGIC ---
  const filteredSales = sales.filter(s => {
      // 1. Filter by Tab
      let tabMatch = false;
      if (activeTab === 'sales') {
          tabMatch = s.status_label === 'Venda' || s.status_label === 'Devolução';
      } else if (activeTab === 'conditionals') {
          tabMatch = s.status_label === 'Condicional' || s.status_label === 'Convertida';
      } else if (activeTab === 'losses') {
          tabMatch = s.status_label === 'Baixa';
      }

      // 2. Filter by Search
      const searchMatch = 
        s.code?.toLowerCase().includes(search.toLowerCase()) ||
        s.client?.full_name.toLowerCase().includes(search.toLowerCase());

      return tabMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Movimentações</h2>
                <p className="text-slate-500 text-sm">Gerencie vendas, condicionais e baixas</p>
            </div>
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar Código ou Cliente..."
                    className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>
        </div>

        {/* TABS */}
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-700">
            <button 
                onClick={() => setActiveTab('sales')}
                className={`flex items-center px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'sales' ? 'border-primary-600 text-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <ShoppingBag size={16} className="mr-2"/> Vendas
            </button>
            <button 
                onClick={() => setActiveTab('conditionals')}
                className={`flex items-center px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'conditionals' ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <FileText size={16} className="mr-2"/> Condicionais
            </button>
            <button 
                onClick={() => setActiveTab('losses')}
                className={`flex items-center px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'losses' ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <AlertTriangle size={16} className="mr-2"/> Baixas / Perdas
            </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <tr>
                        <th className="p-4">Código</th>
                        <th className="p-4">Data</th>
                        <th className="p-4">Cliente / Detalhe</th>
                        <th className="p-4">Total</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? <tr><td colSpan={6} className="p-6 text-center">Carregando...</td></tr> : 
                     filteredSales.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-500 py-12">Nenhum registro encontrado nesta aba.</td></tr> :
                     filteredSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="p-4 font-mono font-bold dark:text-white">{sale.code || `ID-${sale.id}`}</td>
                            <td className="p-4 text-slate-500">{new Date(sale.created_at).toLocaleDateString()} <span className="text-xs">{new Date(sale.created_at).toLocaleTimeString().slice(0,5)}</span></td>
                            <td className="p-4 font-medium dark:text-slate-200">
                                {sale.client?.full_name || sale.observacoes || 'Consumidor Final'}
                            </td>
                            <td className="p-4 font-bold text-slate-800 dark:text-white">{formatCurrency(sale.total_value)}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                    sale.status_label === 'Venda' ? 'bg-green-100 text-green-700' :
                                    sale.status_label === 'Condicional' ? 'bg-amber-100 text-amber-700' :
                                    sale.status_label === 'Convertida' ? 'bg-blue-100 text-blue-700' :
                                    sale.status_label === 'Baixa' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {sale.status_label}
                                </span>
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => setSelectedSale(sale)} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition-colors" title="Ver Detalhes">
                                    <Eye size={18}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {selectedSale && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-lg font-bold dark:text-white">Detalhes: {selectedSale.code}</h3>
                        <button onClick={() => setSelectedSale(null)}><XCircle size={24} className="text-slate-400"/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto">
                        <div className="flex justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">{selectedSale.status_label === 'Baixa' ? 'Motivo da Baixa' : 'Cliente'}</p>
                                <p className="font-bold dark:text-white text-lg">{selectedSale.client?.full_name || selectedSale.observacoes || 'N/A'}</p>
                                {selectedSale.client?.phone && <p className="text-sm text-slate-500">{selectedSale.client.phone}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Valor Total</p>
                                <p className="font-bold text-primary-600 text-2xl">{formatCurrency(selectedSale.total_value)}</p>
                                <p className="text-xs text-slate-400">{selectedSale.payment_method}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <h4 className="text-sm font-bold mb-3 dark:text-slate-300 border-b dark:border-slate-700 pb-2">Itens da Transação</h4>
                            <ul className="space-y-3">
                                {(selectedSale.items as any[])?.map((item: any, idx: number) => {
                                    const productName = item.product_variation?.products?.nome || item.product_variation?.model_variant || 'Item';
                                    const details = `${item.product_variation?.model_variant} - ${item.product_variation?.size}`;
                                    
                                    return (
                                        <li key={idx} className="flex justify-between items-center text-sm dark:text-slate-200 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                                            <div>
                                                <span className="font-bold">{item.quantity}x</span> {productName}
                                                <span className="text-slate-500 ml-2 text-xs">({details})</span>
                                            </div>
                                            <span className="font-mono">
                                                {formatCurrency(selectedSale.status_label === 'Baixa' ? item.original_cost : item.unit_price * item.quantity)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        
                        {/* Exibir detalhes do pagamento se houver */}
                        {selectedSale.payment_details && (
                            <div className="mb-6 p-3 border border-slate-200 dark:border-slate-600 rounded text-sm text-slate-600 dark:text-slate-400">
                                <p><strong>Detalhes Financeiros:</strong></p>
                                <pre className="text-xs mt-1 whitespace-pre-wrap font-mono">{JSON.stringify(selectedSale.payment_details, null, 2)}</pre>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex justify-end gap-3">
                        {selectedSale.status_label === 'Condicional' && (
                            <button 
                                onClick={() => handleStatusChange(selectedSale, 'Convertida')}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-lg"
                            >
                                <CheckCircle size={18} className="mr-2"/> Converter em Venda (Ir ao Caixa)
                            </button>
                        )}
                        {selectedSale.status_label !== 'Devolução' && selectedSale.status_label !== 'Convertida' && (
                            <button 
                                onClick={() => handleStatusChange(selectedSale, 'Devolução')}
                                className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium"
                            >
                                <RefreshCw size={18} className="mr-2"/> {selectedSale.status_label === 'Baixa' ? 'Estornar Baixa' : 'Devolver Tudo'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
