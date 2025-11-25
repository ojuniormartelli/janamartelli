
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { BankAccount, FinancialTransaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Calendar, Filter, Save, X, Banknote } from 'lucide-react';

export const Financial: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [totalBalance, setTotalBalance] = useState(0);

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Forms
  const [newTx, setNewTx] = useState({
      description: '',
      amount: '',
      type: 'income' as 'income' | 'expense',
      account_id: '',
      category: '',
      date: new Date().toISOString().slice(0, 10)
  });

  const [newAccount, setNewAccount] = useState({
      name: '',
      initial_balance: '',
      color: '#10b981'
  });

  useEffect(() => {
    fetchData();
  }, [filterMonth]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Accounts
    const { data: accData } = await supabase.from('bank_accounts').select('*').eq('active', true).order('id');
    if (accData) {
        setAccounts(accData);
        setTotalBalance(accData.reduce((acc, curr) => acc + curr.balance, 0));
        
        // Set default account for new Tx
        if (!newTx.account_id && accData.length > 0) {
            setNewTx(prev => ({ ...prev, account_id: accData[0].id.toString() }));
        }
    }

    // Fetch Transactions for selected month
    const startOfMonth = `${filterMonth}-01`;
    const endOfMonth = `${filterMonth}-31`;

    const { data: txData } = await supabase
        .from('transactions')
        .select(`*, bank_account:bank_accounts(name)`)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (txData) setTransactions(txData as any);

    setLoading(false);
  };

  const handleSaveTransaction = async () => {
      if (!newTx.description || !newTx.amount || !newTx.account_id) return alert("Preencha todos os campos");

      const amountVal = parseFloat(newTx.amount.replace(',', '.'));
      if (isNaN(amountVal) || amountVal <= 0) return alert("Valor inválido");

      // 1. Insert Transaction
      const { error: txError } = await supabase.from('transactions').insert({
          description: newTx.description,
          amount: amountVal,
          type: newTx.type,
          account_id: parseInt(newTx.account_id),
          category: newTx.category || 'Geral',
          date: newTx.date
      });

      if (txError) return alert("Erro ao salvar transação");

      // 2. Update Account Balance
      const account = accounts.find(a => a.id === parseInt(newTx.account_id));
      if (account) {
          const newBalance = newTx.type === 'income' 
             ? account.balance + amountVal 
             : account.balance - amountVal;
          
          await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', account.id);
      }

      setIsTxModalOpen(false);
      setNewTx({ description: '', amount: '', type: 'income', account_id: accounts[0]?.id.toString() || '', category: '', date: new Date().toISOString().slice(0, 10) });
      fetchData();
  };

  const handleSaveAccount = async () => {
      if (!newAccount.name) return alert("Nome obrigatório");
      
      const initialBalance = parseFloat(newAccount.initial_balance.replace(',', '.')) || 0;

      await supabase.from('bank_accounts').insert({
          name: newAccount.name,
          balance: initialBalance,
          color: newAccount.color
      });

      setIsAccountModalOpen(false);
      setNewAccount({ name: '', initial_balance: '', color: '#10b981' });
      fetchData();
  };

  const handleDeleteTransaction = async (tx: FinancialTransaction) => {
      if(!confirm("Excluir esta transação? O saldo da conta será revertido.")) return;

      // 1. Delete Tx
      await supabase.from('transactions').delete().eq('id', tx.id);

      // 2. Revert Balance
      const account = accounts.find(a => a.id === tx.account_id);
      if (account) {
          // If it was income, we remove it (subtract). If expense, we add it back.
          const newBalance = tx.type === 'income'
             ? account.balance - tx.amount
             : account.balance + tx.amount;
          
          await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', account.id);
      }
      fetchData();
  };

  const handleDeleteAccount = async (id: number) => {
      if(!confirm("Tem certeza? O histórico de transações será mantido, mas a conta será desativada.")) return;
      await supabase.from('bank_accounts').update({ active: false }).eq('id', id);
      fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Controle Financeiro</h2>
          <p className="text-slate-500 text-sm">Gerencie contas, entradas e saídas</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsAccountModalOpen(true)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-white text-sm font-medium flex items-center hover:bg-slate-50">
                <Banknote className="mr-2" size={18}/> Nova Conta
            </button>
            <button onClick={() => setIsTxModalOpen(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold flex items-center hover:bg-primary-700 shadow-lg">
                <Plus className="mr-2" size={18}/> Lançamento
            </button>
        </div>
      </div>

      {/* --- CARDS DE CONTAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={64}/></div>
              <p className="text-slate-300 text-sm font-medium">Saldo Total Consolidado</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalBalance)}</p>
          </div>
          
          {accounts.map(acc => (
              <div key={acc.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow border-l-4 relative group" style={{ borderLeftColor: acc.color }}>
                  <button onClick={() => handleDeleteAccount(acc.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={14}/>
                  </button>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium truncate pr-4">{acc.name}</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{formatCurrency(acc.balance)}</p>
              </div>
          ))}
      </div>

      {/* --- EXTRATO --- */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-700 dark:text-white flex items-center"><Calendar className="mr-2" size={18}/> Extrato de Movimentações</h3>
              <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400"/>
                  <input 
                      type="month" 
                      value={filterMonth} 
                      onChange={e => setFilterMonth(e.target.value)}
                      className="p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm"
                  />
              </div>
          </div>

          <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  <tr>
                      <th className="p-4">Data</th>
                      <th className="p-4">Descrição</th>
                      <th className="p-4">Categoria</th>
                      <th className="p-4">Conta</th>
                      <th className="p-4 text-right">Valor</th>
                      <th className="p-4 w-10"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loading ? <tr><td colSpan={6} className="p-6 text-center">Carregando...</td></tr> : 
                   transactions.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum lançamento neste mês.</td></tr> :
                   transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="p-4 text-slate-500">{new Date(tx.date + 'T12:00:00').toLocaleDateString()}</td>
                          <td className="p-4 font-medium dark:text-white">{tx.description}</td>
                          <td className="p-4 text-slate-500">
                              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs">{tx.category}</span>
                          </td>
                          <td className="p-4 text-slate-500">{tx.bank_account?.name}</td>
                          <td className={`p-4 text-right font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                          </td>
                          <td className="p-4 text-center">
                              <button onClick={() => handleDeleteTransaction(tx)} className="text-slate-300 hover:text-red-500">
                                  <Trash2 size={16}/>
                              </button>
                          </td>
                      </tr>
                   ))
                  }
              </tbody>
          </table>
      </div>

      {/* --- MODAL NOVA TRANSAÇÃO --- */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
               <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                   <h3 className="font-bold dark:text-white">Novo Lançamento</h3>
                   <button onClick={() => setIsTxModalOpen(false)}><X size={20} className="text-slate-400"/></button>
               </div>
               <div className="p-6 space-y-4">
                   <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                       <button 
                         onClick={() => setNewTx({...newTx, type: 'income'})}
                         className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center ${newTx.type === 'income' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-slate-500'}`}
                       >
                           <TrendingUp size={16} className="mr-2"/> Entrada
                       </button>
                       <button 
                         onClick={() => setNewTx({...newTx, type: 'expense'})}
                         className={`flex-1 py-2 rounded-md font-bold text-sm flex items-center justify-center ${newTx.type === 'expense' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-slate-500'}`}
                       >
                           <TrendingDown size={16} className="mr-2"/> Saída
                       </button>
                   </div>
                   
                   <div>
                       <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                       <input 
                           className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                           placeholder="Ex: Venda Balcão, Pagamento Luz..."
                           value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})}
                       />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Valor (R$)</label>
                           <input 
                               type="number" step="0.01"
                               className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" 
                               value={newTx.amount} onChange={e => setNewTx({...newTx, amount: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                           <input 
                               type="date"
                               className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                               value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})}
                           />
                       </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Conta</label>
                           <select 
                               className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                               value={newTx.account_id} onChange={e => setNewTx({...newTx, account_id: e.target.value})}
                           >
                               {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                           <input 
                               className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                               placeholder="Ex: Vendas, Luz..."
                               list="categories"
                               value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})}
                           />
                           <datalist id="categories">
                               <option value="Vendas"/>
                               <option value="Fornecedores"/>
                               <option value="Aluguel"/>
                               <option value="Água/Luz"/>
                               <option value="Pessoal"/>
                           </datalist>
                       </div>
                   </div>

                   <button onClick={handleSaveTransaction} className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 mt-2">
                       Salvar Lançamento
                   </button>
               </div>
           </div>
        </div>
      )}

      {/* --- MODAL NOVA CONTA --- */}
      {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                 <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                     <h3 className="font-bold dark:text-white">Nova Conta Bancária / Caixa</h3>
                 </div>
                 <div className="p-6 space-y-4">
                     <input 
                         className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                         placeholder="Nome da Conta (Ex: Banco X)"
                         value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                     />
                     <input 
                         type="number" step="0.01"
                         className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                         placeholder="Saldo Inicial (R$)"
                         value={newAccount.initial_balance} onChange={e => setNewAccount({...newAccount, initial_balance: e.target.value})}
                     />
                     <div>
                         <label className="text-xs text-slate-500 mb-1 block">Cor de Identificação</label>
                         <div className="flex gap-2">
                             {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'].map(c => (
                                 <button 
                                   key={c} 
                                   onClick={() => setNewAccount({...newAccount, color: c})}
                                   className={`w-8 h-8 rounded-full border-2 ${newAccount.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                   style={{ backgroundColor: c }}
                                 />
                             ))}
                         </div>
                     </div>
                     <div className="flex justify-end gap-2 mt-4">
                         <button onClick={() => setIsAccountModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                         <button onClick={handleSaveAccount} className="px-4 py-2 bg-primary-600 text-white rounded font-bold">Criar</button>
                     </div>
                 </div>
             </div>
          </div>
      )}

    </div>
  );
};
