import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState({ revenue: 0, losses: 0, profit: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchFinancials();
  }, []);

  const fetchFinancials = async () => {
    // Simplistic fetch for demo - usually would use RPC or date ranges
    const { data: sales } = await supabase.from('vendas').select(`
        id, total_value, status_label, created_at,
        venda_itens ( original_cost, quantity )
    `);

    if (!sales) return;

    let revenue = 0;
    let costOfGoods = 0;
    let losses = 0;
    const dailyMap: Record<string, any> = {};

    sales.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString('pt-BR');
      if (!dailyMap[date]) dailyMap[date] = { name: date, venda: 0, perda: 0 };

      if (sale.status_label === 'Venda') {
        revenue += sale.total_value;
        dailyMap[date].venda += sale.total_value;
        
        // Calculate COGS
        if (sale.venda_itens) {
            sale.venda_itens.forEach((item: any) => {
                costOfGoods += (item.original_cost || 0) * item.quantity;
            });
        }
      } else if (sale.status_label === 'Baixa') {
        losses += sale.total_value; // Cost price recorded as value
        dailyMap[date].perda += sale.total_value;
      }
    });

    setMetrics({
        revenue,
        losses,
        profit: revenue - costOfGoods - losses
    });
    setChartData(Object.values(dailyMap).slice(-7)); // Last 7 active days
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Visão Financeira</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Receita Bruta</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{formatCurrency(metrics.revenue)}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full text-green-600"><DollarSign size={20} /></div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-red-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Perdas / Baixas</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(metrics.losses)}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-full text-red-600"><TrendingDown size={20} /></div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Lucro Estimado</p>
                    <p className={`text-2xl font-bold mt-1 ${metrics.profit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(metrics.profit)}</p>
                    <p className="text-xs text-slate-400 mt-1">(Receita - Custo Produtos - Perdas)</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full text-blue-600"><TrendingUp size={20} /></div>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow h-96">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Fluxo Recente</h3>
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="venda" name="Vendas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="perda" name="Perdas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
