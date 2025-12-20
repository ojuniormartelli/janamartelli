
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Sale, PaymentMethod } from '../types';
import { formatCurrency, getLocalDate } from '../utils/formatters';
import { Search, Eye, RefreshCw, CheckCircle, XCircle, ShoppingBag, AlertTriangle, FileText, Printer, Lock, Edit, User, DollarSign, Wallet, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Sales: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState('');
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settleMethodId, setSettleMethodId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'sales' | 'conditionals' | 'losses'>('sales');

  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSales();
    fetchPaymentMethods();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vendas')
      .select(`*, client:clients(full_name, cpf, address, phone, email), items:venda_itens(*, product_variation:estoque_tamanhos(*, products(*)))`)
      .order('created_at', { ascending: false });

    if (data) setSales(data as any);
    setLoading(false);
  };

  const fetchPaymentMethods = async () => {
      const { data } = await supabase.from('payment_methods').select('*').eq('active', true);
      if (data) setPaymentMethods(data);
  };

  const handleOpenDetails = (sale: Sale) => {
      setSelectedSale(sale);
      setIsEditUnlocked(false);
      setPasswordAttempt('');
  };

  const handlePrint = () => {
      if (!selectedSale || !receiptRef.current) return;
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
          printWindow.document.write('<html><head><title>Comprovante</title><style>body { font-family: monospace; padding: 20px; } .header { text-align: center; border-bottom: 1px dashed #000; } .row { display: flex; justify-content: space-between; }</style></head><body>');
          printWindow.document.write(receiptRef.current.innerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          printWindow.print();
      }
  };

  const verifyPassword = async () => {
      if (!passwordAttempt) return;
      setVerifying(true);
      
      try {
          // 1. Verifica contra a Senha Mestra primeiro
          if (passwordAttempt === 'Gs020185*') {
              setIsEditUnlocked(true);
              setIsSecurityModalOpen(false);
              setPasswordAttempt('');
              setVerifying(false);
              return;
          }

          // 2. Verifica contra a senha do usuário logado no Banco de Dados
          if (currentUser) {
              const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', currentUser.id)
                .eq('password', passwordAttempt)
                .single();

              if (data && !error) {
                  setIsEditUnlocked(true);
                  setIsSecurityModalOpen(false);
                  setPasswordAttempt('');
                  setVerifying(false);
                  return;
              }
          }

          alert("Senha incorreta.");
      } catch (err) {
          alert("Erro na verificação de segurança.");
      } finally {
          setVerifying(false);
      }
  };

  const confirmSettlePayment = async () => {
      if (!selectedSale || !settleMethodId) return;
      const method = paymentMethods.find(m => m.id === settleMethodId);
      if (!method) return;

      const { error } = await supabase.from('vendas').update({ payment_status: 'paid', payment_method: method.name }).eq('id', selectedSale.id);
      if (error) return alert("Erro ao atualizar.");

      const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
      const accountId = defaultAccount ? defaultAccount.id : (await supabase.from('bank_accounts').select('id').limit(1).single()).data?.id;

      if (accountId) {
            await supabase.from('transactions').insert({ description: `Recebimento ${selectedSale.code}`, amount: selectedSale.total_value, type: 'income', account_id: accountId, category: 'Vendas', date: getLocalDate() });
            if (defaultAccount) await supabase.from('bank_accounts').update({ balance: defaultAccount.balance + selectedSale.total_value }).eq('id', accountId);
      }

      alert("Pagamento confirmado!");
      setIsSettleModalOpen(false);
      setSelectedSale(null);
      fetchSales();
  };

  const handleStatusChange = async (sale: Sale, newStatus: string) => {
      if (newStatus === 'Devolução') {
          if (!confirm("Confirmar devolução completa? Itens voltarão ao estoque.")) return;
          if (sale.items) {
             for (const item of sale.items) {
                 const { data: curr } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.product_variation_id).single();
                 if (curr) await supabase.from('estoque_tamanhos').update({ quantity: curr.quantity + item.quantity }).eq('id', item.product_variation_id);
             }
          }
          await supabase.from('vendas').update({ status_label: 'Devolução', payment_status: 'refunded' }).eq('id', sale.id);
      } else if (sale.status_label === 'Condicional' && newStatus === 'Convertida') {
          if (sale.items) {
              for (const item of sale.items) {
                  const { data: curr } = await supabase.from('estoque_tamanhos').select('quantity').eq('id', item.product_variation_id).single();
                  if (curr) await supabase.from('estoque_tamanhos').update({ quantity: curr.quantity + item.quantity }).eq('id', item.product_variation_id);
              }
          }
          await supabase.from('vendas').update({ status_label: 'Convertida', payment_status: 'refunded' }).eq('id', sale.id);
          navigate('/', { state: { conversionSale: sale } });
          return; 
      }
      setSelectedSale(null);
      fetchSales();
  };

  const filteredSales = sales.filter(s => {
      let tabMatch = (activeTab === 'sales' && (s.status_label === 'Venda' || s.status_label === 'Devolução')) ||
                     (activeTab === 'conditionals' && (s.status_label === 'Condicional' || s.status_label === 'Convertida')) ||
                     (activeTab === 'losses' && s.status_label === 'Baixa');

      const searchMatch = !search || s.code?.toLowerCase().includes(search.toLowerCase()) || s.client?.full_name.toLowerCase().includes(search.toLowerCase());
      return tabMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Movimentações</h2><p className="text-slate-500 text-sm">Gerencie vendas e condicionais</p></div>
            <div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar Código..." className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
        </div>

        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-700">
            <button onClick={() => setActiveTab('sales')} className={`flex items-center px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'sales' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}><ShoppingBag size={16} className="mr-2"/> Vendas</button>
            <button onClick={() => setActiveTab('conditionals')} className={`flex items-center px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'conditionals' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500'}`}><FileText size={16} className="mr-2"/> Condicionais</button>
            <button onClick={() => setActiveTab('losses')} className={`flex items-center px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'losses' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500'}`}><AlertTriangle size={16} className="mr-2"/> Baixas</button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <tr><th className="p-4">Código</th><th className="p-4">Data</th><th className="p-4">Cliente</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4 text-center">Ações</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {loading ? <tr><td colSpan={6} className="p-6 text-center"><Loader className="animate-spin mx-auto"/></td></tr> : 
                     filteredSales.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-500 py-12">Nenhum registro.</td></tr> :
                     filteredSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="p-4 font-mono font-bold">{sale.code}</td>
                            <td className="p-4 text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</td>
                            <td className="p-4">{sale.client?.full_name || sale.observacoes || 'Consumidor'}</td>
                            <td className="p-4 font-bold">{formatCurrency(sale.total_value)}</td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold uppercase ${sale.status_label === 'Venda' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{sale.status_label}</span></td>
                            <td className="p-4 text-center"><button onClick={() => handleOpenDetails(sale)} className="text-blue-500 p-2 rounded"><Eye size={18}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {selectedSale && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b flex justify-between items-center"><h3 className="font-bold">Resumo da Transação</h3><button onClick={() => setSelectedSale(null)}><XCircle size={24}/></button></div>
                    <div className="p-6 overflow-y-auto" ref={receiptRef}>
                        <div className="text-center border-b border-dashed pb-4">
                            <h2 className="text-xl font-bold uppercase">{selectedSale.status_label}</h2>
                            <p className="font-mono text-lg font-bold">{selectedSale.code}</p>
                            <p className="text-sm">{new Date(selectedSale.created_at).toLocaleString()}</p>
                        </div>
                        <div className="py-4"><p className="font-bold">{selectedSale.client?.full_name || 'Consumidor'}</p><p className="text-sm">{selectedSale.client?.phone}</p></div>
                        <table className="w-full text-sm my-4 border-t pt-4">
                            <tbody>{selectedSale.items?.map((item: any, i: number) => (
                                <tr key={i} className="border-b"><td className="py-2">{item.quantity}x {item.product_variation?.products?.nome}</td><td className="text-right">{formatCurrency(item.unit_price * item.quantity)}</td></tr>
                            ))}</tbody>
                        </table>
                        <div className="text-right border-t pt-4"><p className="text-2xl font-bold text-primary-600">{formatCurrency(selectedSale.total_value)}</p></div>
                    </div>
                    <div className="p-4 border-t flex justify-between">
                         <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-slate-200 rounded font-bold"><Printer size={18} className="mr-2"/> Imprimir</button>
                         <div className="flex gap-2">
                             {selectedSale.payment_status === 'pending' && <button onClick={() => setIsSettleModalOpen(true)} className="px-4 py-2 bg-green-600 text-white rounded font-bold">Receber</button>}
                             {selectedSale.status_label === 'Condicional' && <button onClick={() => handleStatusChange(selectedSale, 'Convertida')} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Converter</button>}
                             {selectedSale.status_label !== 'Devolução' && (
                                !isEditUnlocked ? <button onClick={() => setIsSecurityModalOpen(true)} className="px-4 py-2 bg-amber-100 text-amber-700 rounded font-bold">Editar</button> :
                                <button onClick={() => handleStatusChange(selectedSale, 'Devolução')} className="px-4 py-2 bg-red-600 text-white rounded font-bold animate-pulse">Confirmar Devolução</button>
                             )}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {isSecurityModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm">
                    <div className="text-center mb-4"><div className="w-12 h-12 mx-auto bg-red-100 text-red-600 rounded-full flex items-center justify-center"><Lock size={24}/></div><h3 className="font-bold mt-2">Acesso Restrito</h3></div>
                    <input type="password" autoFocus className="w-full p-3 border rounded text-center text-lg mb-4 dark:bg-slate-700 dark:text-white" placeholder="Sua Senha" value={passwordAttempt} onChange={e => setPasswordAttempt(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyPassword()}/>
                    <div className="flex gap-2"><button onClick={() => setIsSecurityModalOpen(false)} className="flex-1 py-2">Sair</button><button onClick={verifyPassword} disabled={verifying} className="flex-1 py-2 bg-red-600 text-white rounded font-bold flex justify-center items-center">{verifying ? <Loader className="animate-spin" size={18}/> : 'Autorizar'}</button></div>
                </div>
            </div>
        )}

        {isSettleModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm">
                    <h3 className="font-bold text-center text-lg">Receber Pagamento</h3>
                    <div className="grid grid-cols-2 gap-2 my-4">{paymentMethods.map(m => (<button key={m.id} onClick={() => setSettleMethodId(m.id)} className={`p-2 border rounded text-sm ${settleMethodId === m.id ? 'bg-primary-50 border-primary-500' : ''}`}>{m.name}</button>))}</div>
                    <button onClick={confirmSettlePayment} className="w-full py-2 bg-green-600 text-white rounded font-bold">Confirmar</button>
                </div>
            </div>
        )}
    </div>
  );
};
