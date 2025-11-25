
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Sale } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Search, Eye, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Sales: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
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
          if (!confirm(`Confirmar devolução completa de ${sale.code}? Os itens voltarão ao estoque.`)) return;

          // Return stock
          if (sale.items) {
             for (const item of sale.items) {
                 const { data: curr } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.product_variation_id).single();
                 if (curr) {
                     await supabase.from('estoque_tamanhos').update({ quantity: curr.quantity + item.quantity }).eq('id', item.product_variation_id);
                 }
             }
          }
          await supabase.from('vendas').update({ 
              status_label: 'Devolução', 
              payment_status: 'refunded' 
            }).eq('id', sale.id);
            
      } else if (sale.status_label === 'Condicional' && newStatus === 'Convertida') {
          // LOGIC: CONVERT CONDITIONAL TO SALE
          // 1. Return stock from the Conditional (undoing the reservation)
          // 2. Mark conditional as 'Convertida'
          // 3. Redirect to POS with items loaded to create a NEW Sale
          
          if (sale.items) {
              for (const item of sale.items) {
                  const { data: curr } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.product_variation_id).single();
                  if (curr) {
                      await supabase.from('estoque_tamanhos').update({ quantity: curr.quantity + item.quantity }).eq('id', item.product_variation_id);
                  }
              }
          }

          await supabase.from('vendas').update({ 
              status_label: 'Convertida', 
              payment_status: 'refunded' // Technically 'refunded' means reversed/closed here
          }).eq('id', sale.id);

          // Redirect to POS with data
          navigate('/pos', { state: { conversionSale: sale } });
          return; // Stop here, we are moving pages
      }

      setSelectedSale(null);
      fetchSales();
  };

  const filteredSales = sales.filter(s => 
      s.code?.toLowerCase().includes(search.toLowerCase()) ||
      s.client?.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Histórico</h2>
                <p className="text-slate-500 text-sm">Vendas e Condicionais</p>
            </div>
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar Código ou Cliente..."
                    className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <tr>
                        <th className="p-4">Código</th>
                        <th className="p-4">Data</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Total</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? <tr><td colSpan={6} className="p-6 text-center">Carregando...</td></tr> : 
                     filteredSales.length === 0 ? <tr><td colSpan={6} className="p-6 text-center">Nenhum registro.</td></tr> :
                     filteredSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="p-4 font-mono font-bold dark:text-white">{sale.code || `ID-${sale.id}`}</td>
                            <td className="p-4 text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</td>
                            <td className="p-4 font-medium dark:text-slate-200">{sale.client?.full_name || 'N/A'}</td>
                            <td className="p-4 font-bold text-slate-800 dark:text-white">{formatCurrency(sale.total_value)}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                    sale.status_label === 'Venda' ? 'bg-green-100 text-green-700' :
                                    sale.status_label === 'Condicional' ? 'bg-amber-100 text-amber-700' :
                                    sale.status_label === 'Convertida' ? 'bg-blue-100 text-blue-700' :
                                    'bg-red-100 text-red-700'
                                }`}>
                                    {sale.status_label}
                                </span>
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => setSelectedSale(sale)} className="text-blue-500 hover:bg-blue-50 p-2 rounded">
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
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-lg font-bold dark:text-white">Detalhes: {selectedSale.code}</h3>
                        <button onClick={() => setSelectedSale(null)}><XCircle size={24} className="text-slate-400"/></button>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-between mb-6">
                            <div>
                                <p className="text-sm text-slate-500">Cliente</p>
                                <p className="font-bold dark:text-white text-lg">{selectedSale.client?.full_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-500">Valor Total</p>
                                <p className="font-bold text-primary-600 text-xl">{formatCurrency(selectedSale.total_value)}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg mb-6">
                            <h4 className="text-sm font-bold mb-2 dark:text-slate-300">Itens</h4>
                            <ul className="space-y-2">
                                {(selectedSale.items as any[])?.map((item: any, idx: number) => {
                                    // Handle deeply nested join structure or flat structure depending on query
                                    const productName = item.product_variation?.products?.nome || item.product_variation?.model_variant || 'Item';
                                    const details = `${item.product_variation?.model_variant} - ${item.product_variation?.size}`;
                                    
                                    return (
                                        <li key={idx} className="flex justify-between text-sm dark:text-slate-200">
                                            <span>{item.quantity}x {productName} ({details})</span>
                                            <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="flex justify-end gap-3 border-t dark:border-slate-700 pt-4">
                            {selectedSale.status_label === 'Condicional' && (
                                <button 
                                    onClick={() => handleStatusChange(selectedSale, 'Convertida')}
                                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
                                >
                                    <CheckCircle size={18} className="mr-2"/> Editar & Finalizar Venda
                                </button>
                            )}
                            {selectedSale.status_label !== 'Devolução' && selectedSale.status_label !== 'Convertida' && (
                                <button 
                                    onClick={() => handleStatusChange(selectedSale, 'Devolução')}
                                    className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                    <RefreshCw size={18} className="mr-2"/> Devolver / Estornar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
