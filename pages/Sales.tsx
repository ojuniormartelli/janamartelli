
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Sale, PaymentMethod } from '../types';
import { formatCurrency, getLocalDate } from '../utils/formatters';
import { Search, Eye, RefreshCw, CheckCircle, XCircle, ShoppingBag, AlertTriangle, FileText, Printer, Lock, Edit, MapPin, Phone, User, Calendar, DollarSign, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Sales: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // Security / Edit State
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState('');
  const [isEditUnlocked, setIsEditUnlocked] = useState(false);

  // Settle Payment State (Receber Venda Pendente)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settleMethodId, setSettleMethodId] = useState<number | null>(null);

  // State das Abas
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

    if (data) {
        setSales(data as any);
    }
    setLoading(false);
  };

  const fetchPaymentMethods = async () => {
      const { data } = await supabase.from('payment_methods').select('*').eq('active', true);
      if (data) setPaymentMethods(data);
  };

  const handleOpenDetails = (sale: Sale) => {
      setSelectedSale(sale);
      setIsEditUnlocked(false); // Reset security
      setPasswordAttempt('');
  };

  const handlePrint = () => {
      if (!selectedSale || !receiptRef.current) return;
      
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
          printWindow.document.write('<html><head><title>Comprovante de Venda</title>');
          printWindow.document.write('<style>');
          printWindow.document.write(`
            body { font-family: 'Courier New', monospace; font-size: 14px; color: #000; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .section { margin-bottom: 15px; }
            .label { font-weight: bold; }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .items-table th { text-align: left; border-bottom: 1px solid #000; }
            .items-table td { padding: 4px 0; }
            .total-section { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; }
          `);
          printWindow.document.write('</style></head><body>');
          printWindow.document.write(receiptRef.current.innerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          printWindow.print();
      }
  };

  const verifyPassword = async () => {
      // Verifica senha mestra ou senha do usuário logado
      if (passwordAttempt === 'Gs020185*' || (user && user.password === passwordAttempt)) {
          setIsEditUnlocked(true);
          setIsSecurityModalOpen(false);
          setPasswordAttempt('');
      } else {
          alert("Senha incorreta.");
      }
  };

  const handleOpenSettleModal = () => {
      if (!selectedSale) return;
      setIsSettleModalOpen(true);
      if (paymentMethods.length > 0) setSettleMethodId(paymentMethods[0].id);
  };

  const confirmSettlePayment = async () => {
      if (!selectedSale || !settleMethodId) return;
      const method = paymentMethods.find(m => m.id === settleMethodId);
      if (!method) return;

      // 1. Update Sale
      const { error } = await supabase.from('vendas').update({
          payment_status: 'paid',
          payment_method: method.name
      }).eq('id', selectedSale.id);

      if (error) {
          alert("Erro ao atualizar venda.");
          return;
      }

      // 2. Insert Transaction (Entrada Financeira)
      const { data: defaultAccount } = await supabase.from('bank_accounts').select('*').eq('is_default', true).single();
      const accountId = defaultAccount ? defaultAccount.id : (await supabase.from('bank_accounts').select('id').limit(1).single()).data?.id;

      if (accountId) {
            await supabase.from('transactions').insert({
                description: `Recebimento ${selectedSale.code} - ${method.name}`,
                amount: selectedSale.total_value,
                type: 'income',
                account_id: accountId,
                category: 'Vendas',
                date: getLocalDate()
            });
            // Update balance
            if (defaultAccount) {
                await supabase.from('bank_accounts').update({ balance: defaultAccount.balance + selectedSale.total_value }).eq('id', accountId);
            }
      }

      alert("Pagamento confirmado com sucesso!");
      setIsSettleModalOpen(false);
      setSelectedSale(null);
      fetchSales();
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
                                {sale.payment_status === 'pending' && sale.status_label === 'Venda' ? (
                                    <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-red-500 text-white animate-pulse">
                                        Pagamento Pendente
                                    </span>
                                ) : (
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                        sale.status_label === 'Venda' ? 'bg-green-100 text-green-700' :
                                        sale.status_label === 'Condicional' ? 'bg-amber-100 text-amber-700' :
                                        sale.status_label === 'Convertida' ? 'bg-blue-100 text-blue-700' :
                                        sale.status_label === 'Baixa' ? 'bg-orange-100 text-orange-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {sale.status_label}
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={() => handleOpenDetails(sale)} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition-colors" title="Ver Detalhes">
                                    <Eye size={18}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* MODAL DE DETALHES DA VENDA */}
        {selectedSale && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                             <FileText size={20}/> Resumo da Transação
                        </h3>
                        <button onClick={() => setSelectedSale(null)}><XCircle size={24} className="text-slate-400 hover:text-red-500 transition-colors"/></button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto bg-white dark:bg-slate-800">
                        {/* AREA DE IMPRESSÃO - REF */}
                        <div ref={receiptRef} className="space-y-6 text-slate-800 dark:text-slate-200">
                            
                            {/* Cabeçalho do Recibo */}
                            <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-600 pb-4 header">
                                <h2 className="text-xl font-bold uppercase">{selectedSale.status_label}</h2>
                                {selectedSale.payment_status === 'pending' && <h3 className="text-red-500 font-bold uppercase text-sm mb-1">(Pendente / A Receber)</h3>}
                                <p className="font-mono text-lg font-bold">{selectedSale.code}</p>
                                <p className="text-sm text-slate-500">{new Date(selectedSale.created_at).toLocaleString()}</p>
                            </div>

                            {/* Detalhes do Cliente */}
                            <div className="section">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center"><User size={12} className="mr-1"/> Cliente</h4>
                                <div className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded text-sm">
                                    <p className="font-bold text-base">{selectedSale.client?.full_name || 'Consumidor Final'}</p>
                                    {selectedSale.client?.cpf && <p>CPF: {selectedSale.client.cpf}</p>}
                                    {selectedSale.client?.phone && <p>Tel: {selectedSale.client.phone}</p>}
                                    {selectedSale.client?.address && <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{selectedSale.client.address}</p>}
                                    {!selectedSale.client && selectedSale.observacoes && <p className="italic text-slate-500">{selectedSale.observacoes}</p>}
                                </div>
                            </div>

                            {/* Lista de Itens */}
                            <div className="section">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center"><ShoppingBag size={12} className="mr-1"/> Itens</h4>
                                <table className="w-full text-sm items-table">
                                    <thead>
                                        <tr className="border-b border-slate-300 dark:border-slate-600 text-left">
                                            <th className="pb-2">Qtd</th>
                                            <th className="pb-2">Descrição</th>
                                            <th className="pb-2 text-right">Unit.</th>
                                            <th className="pb-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedSale.items as any[])?.map((item: any, idx: number) => {
                                            const productName = item.product_variation?.products?.nome || 'Item Removido';
                                            const variantInfo = item.product_variation ? `${item.product_variation.model_variant} - ${item.product_variation.size}` : '';
                                            const totalItem = item.unit_price * item.quantity;
                                            return (
                                                <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50">
                                                    <td className="py-2 font-bold">{item.quantity}x</td>
                                                    <td className="py-2">
                                                        <div>{productName}</div>
                                                        <div className="text-xs text-slate-500">{variantInfo}</div>
                                                    </td>
                                                    <td className="py-2 text-right text-slate-500">{formatCurrency(item.unit_price)}</td>
                                                    <td className="py-2 text-right font-medium">{formatCurrency(totalItem)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Resumo Financeiro Formatado */}
                            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded section total-section">
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between row">
                                        <span className="text-slate-500">Subtotal</span>
                                        <span>{formatCurrency(selectedSale.payment_details?.raw_value || selectedSale.total_value)}</span>
                                    </div>
                                    
                                    {/* Exibir Juros se houver */}
                                    {selectedSale.payment_details?.interest_applied && (
                                        <div className="flex justify-between text-red-500 row">
                                            <span>Juros ({selectedSale.payment_details?.interest_rate}%)</span>
                                            <span>+ Acréscimo</span>
                                        </div>
                                    )}

                                    {/* Exibir Desconto se houver */}
                                    {selectedSale.payment_details?.discount_applied > 0 && (
                                        <div className="flex justify-between text-green-600 row">
                                            <span>Desconto</span>
                                            <span>- {formatCurrency(selectedSale.payment_details.discount_applied)}</span>
                                        </div>
                                    )}
                                    
                                    <div className="border-t border-slate-300 dark:border-slate-600 my-2 pt-2 flex justify-between items-center total-row">
                                        <span className="font-bold text-lg">TOTAL</span>
                                        <span className="font-bold text-xl text-primary-600">{formatCurrency(selectedSale.total_value)}</span>
                                    </div>

                                    <div className="flex justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-dashed border-slate-300 row">
                                        <span className="uppercase font-bold">Forma de Pagamento</span>
                                        <span className="font-bold uppercase">{selectedSale.payment_method}</span>
                                    </div>
                                    
                                    {/* Detalhes de Parcelas */}
                                    {selectedSale.payment_details?.installments > 1 && (
                                        <div className="flex justify-between text-xs text-slate-500 row">
                                            <span>Parcelamento</span>
                                            <span>{selectedSale.payment_details.installments}x de {formatCurrency(selectedSale.total_value / selectedSale.payment_details.installments)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-700 flex justify-between gap-3">
                         <button 
                            onClick={handlePrint}
                            className="flex items-center px-4 py-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white rounded hover:bg-slate-300 font-bold"
                        >
                            <Printer size={18} className="mr-2"/> Imprimir
                        </button>
                        
                        <div className="flex gap-2">
                             {/* BOTÃO DE RECEBER (Se pendente) */}
                             {selectedSale.payment_status === 'pending' && selectedSale.status_label !== 'Condicional' && selectedSale.status_label !== 'Convertida' && (
                                <button 
                                    onClick={handleOpenSettleModal}
                                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold shadow-lg animate-pulse"
                                >
                                    <DollarSign size={18} className="mr-2"/> Receber Agora
                                </button>
                             )}

                            {selectedSale.status_label === 'Condicional' && (
                                <button 
                                    onClick={() => handleStatusChange(selectedSale, 'Convertida')}
                                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-lg"
                                >
                                    <CheckCircle size={18} className="mr-2"/> Converter
                                </button>
                            )}
                            
                            {selectedSale.status_label !== 'Devolução' && selectedSale.status_label !== 'Convertida' && selectedSale.payment_status !== 'pending' && (
                                !isEditUnlocked ? (
                                    <button 
                                        onClick={() => setIsSecurityModalOpen(true)}
                                        className="flex items-center px-4 py-2 bg-amber-100 text-amber-700 border border-amber-200 rounded hover:bg-amber-200 font-bold"
                                    >
                                        <Edit size={18} className="mr-2"/> Editar Venda
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleStatusChange(selectedSale, 'Devolução')}
                                        className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold shadow-lg animate-pulse"
                                    >
                                        <RefreshCw size={18} className="mr-2"/> 
                                        {selectedSale.status_label === 'Baixa' ? 'Estornar Baixa' : 'Confirmar Devolução'}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL DE SEGURANÇA (SENHA) */}
        {isSecurityModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <div className="text-center mb-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-2">
                            <Lock size={24}/>
                        </div>
                        <h3 className="text-lg font-bold dark:text-white">Acesso Restrito</h3>
                        <p className="text-sm text-slate-500">Digite sua senha para editar esta venda.</p>
                    </div>
                    
                    <input 
                        type="password"
                        autoFocus
                        className="w-full p-3 border rounded text-center text-lg mb-4 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="Senha do Usuário"
                        value={passwordAttempt}
                        onChange={e => setPasswordAttempt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                    />
                    
                    <div className="flex gap-2">
                        <button onClick={() => setIsSecurityModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button>
                        <button onClick={verifyPassword} className="flex-1 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">Autorizar</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL DE RECEBIMENTO (SETTLE PAYMENT) */}
        {isSettleModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
                            <Wallet size={24}/>
                        </div>
                        <h3 className="text-lg font-bold dark:text-white">Receber Pagamento</h3>
                        <p className="text-sm text-slate-500">Escolha como o cliente pagou esta dívida.</p>
                        <p className="text-2xl font-bold mt-2 text-slate-800 dark:text-white">{selectedSale && formatCurrency(selectedSale.total_value)}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        {paymentMethods.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSettleMethodId(m.id)}
                                className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${settleMethodId === m.id ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-slate-200 dark:border-slate-600 dark:text-slate-300'}`}
                            >
                                {m.name}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={() => setIsSettleModalOpen(false)} className="flex-1 py-2 text-slate-500">Cancelar</button>
                        <button onClick={confirmSettlePayment} className="flex-1 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">Confirmar</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
