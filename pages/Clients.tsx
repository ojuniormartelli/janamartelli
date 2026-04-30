
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Client } from '../types';
import { Search, Plus, FileSpreadsheet, Download, Upload, Edit2, Trash2, X, Save, Loader, MapPin, Phone, Mail, User, History, DollarSign, ArrowRight, Eye, Printer, XCircle, ShoppingBag, FileText, AlertTriangle } from 'lucide-react';
import { maskCPF, maskPhone, capitalizeName } from '../utils/formatters';
import { formatCurrency } from '../utils/formatters';
import { processPartialPayment } from '../utils/payment';
import { Sale, SalePayment } from '../types';
import * as XLSX from 'xlsx';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'history'>('info');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // History State
  const [clientHistory, setClientHistory] = useState<Sale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Dinheiro');
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [selectedDetailSale, setSelectedDetailSale] = useState<Sale | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    cpf: '',
    phone: '',
    email: '',
    address: ''
  });

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
        const { data: clientsData, error: cErr } = await supabase.from('clients').select('*').order('full_name');
        if (cErr) throw cErr;

        // Fetch sales with payments to calculate debt
        const { data: salesData, error: sErr } = await supabase
            .from('vendas')
            .select('client_id, total_value, venda_pagamentos(amount)')
            .not('client_id', 'is', null);
            
        if (sErr) throw sErr;

        const processed = (clientsData || []).map(client => {
            const clientSales = (salesData || []).filter(s => s.client_id === client.id);
            const debt = clientSales.reduce((acc, sale) => {
                const paid = (sale.venda_pagamentos as any[] || []).reduce((sum, p) => sum + Number(p.amount), 0);
                return acc + (Number(sale.total_value) - paid);
            }, 0);
            return { ...client, total_debt: debt > 0.01 ? debt : 0 };
        });

        setClients(processed);
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const fetchClientHistory = async (clientId: string) => {
    setHistoryLoading(true);
    const { data, error } = await supabase
        .from('vendas')
        .select(`
            *,
            items:venda_itens(*, product_variation:estoque_tamanhos(*, products(*))),
            payments:venda_pagamentos(*)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (data) {
        const history = data.map((sale: any) => {
            const paid = (sale.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
            return { ...sale, paid_amount: paid };
        });
        setClientHistory(history);
    }
    setHistoryLoading(false);
  };

  const handleOpenModal = (client?: Client) => {
    setActiveModalTab('info');
    if (client) {
      setEditingClient(client);
      setFormData({
        full_name: client.full_name || '',
        cpf: client.cpf || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || ''
      });
      fetchClientHistory(client.id);
    } else {
      setEditingClient(null);
      setFormData({ full_name: '', cpf: '', phone: '', email: '', address: '' });
      setClientHistory([]);
    }
    setIsModalOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!editingClient) return;
    const amount = parseFloat(payAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return alert("Valor inválido");

    setIsProcessingPay(true);
    const result = await processPartialPayment(editingClient.id, amount, payMethod);
    setIsProcessingPay(false);

    if (result.success) {
        alert(result.message);
        setIsPaymentModalOpen(false);
        setPayAmount('');
        fetchClientHistory(editingClient.id);
        fetchClients();
    } else {
        alert(result.message);
    }
  };

  const handlePrintSale = () => {
    if (!selectedDetailSale) return;
    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
        printWindow.document.write('<html><head><title>Comprovante</title><style>body { font-family: monospace; padding: 20px; } .header { text-align: center; border-bottom: 1px dashed #000; } .row { display: flex; justify-content: space-between; }</style></head><body>');
        // Simple receipt generation
        const content = `
          <div class="header">
            <h2>${selectedDetailSale.status_label}</h2>
            <p>cod: ${selectedDetailSale.code}</p>
            <p>${new Date(selectedDetailSale.created_at).toLocaleString()}</p>
          </div>
          <div style="margin: 20px 0;">
            <p><b>Cliente:</b> ${editingClient?.full_name}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            ${selectedDetailSale.items?.map((item: any) => `
              <tr>
                <td style="padding: 5px 0;">${item.quantity}x ${item.product_variation?.products?.nome}</td>
                <td style="text-align: right;">${formatCurrency(item.unit_price * item.quantity)}</td>
              </tr>
            `).join('')}
          </table>
          <div style="text-align: right; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px;">
            <p><b>TOTAL: ${formatCurrency(selectedDetailSale.total_value)}</b></p>
          </div>
        `;
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }
  };

  const handleSave = async () => {
    if (!formData.full_name) return alert("Nome é obrigatório");

    const payload = { ...formData };

    if (editingClient) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id);
      if (error) alert("Erro ao atualizar");
    } else {
      const { error } = await supabase.from('clients').insert(payload);
      if (error) alert("Erro ao criar");
    }

    setIsModalOpen(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) fetchClients();
    else alert("Erro ao excluir. O cliente pode ter vendas vinculadas.");
  };

  // --- EXCEL LOGIC ---
  const handleExportExcel = () => {
    const data = clients.map(c => ({
      "Nome Completo": c.full_name,
      "CPF": c.cpf,
      "Telefone": c.phone,
      "E-mail": c.email,
      "Endereço": c.address
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "clientes_pijama_pro.xlsx");
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

        let success = 0;
        let errors = 0;

        for (const row of rows) {
          const nome = row["Nome Completo"] || row["Nome"] || "";
          const cpf = row["CPF"]?.toString() || "";
          const tel = row["Telefone"]?.toString() || row["Celular"]?.toString() || "";
          const email = row["E-mail"]?.toString() || row["Email"]?.toString() || "";
          const end = row["Endereço"]?.toString() || row["Endereco"]?.toString() || "";

          if (nome) {
            await supabase.from('clients').insert({
              full_name: nome,
              cpf: cpf,
              phone: tel,
              email: email,
              address: end
            });
            success++;
          } else {
            errors++;
          }
        }

        alert(`Importação finalizada!\nImportados: ${success}\nErros/Ignorados: ${errors}`);
      } catch (err) {
        alert("Erro ao ler o arquivo Excel.");
        console.error(err);
      } finally {
        setImporting(false);
        fetchClients();
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- RENDER ---
  const filteredClients = clients.filter(c => 
    c.full_name.toLowerCase().includes(search.toLowerCase()) || 
    c.cpf.includes(search) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleImportExcel} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Clientes</h2>
          <p className="text-slate-500 text-sm">Gerencie sua base de contatos</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleExportExcel} className="p-2 text-slate-600 bg-white border rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" title="Exportar Excel">
            <Download size={20} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="p-2 text-slate-600 bg-white border rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" title="Importar Excel">
            {importing ? <Loader className="animate-spin" size={20}/> : <Upload size={20} />}
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 font-medium">
            <Plus size={18} className="mr-2" /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF ou telefone..."
              className="w-full pl-10 pr-4 py-2 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm uppercase">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">CPF / Contato</th>
                <th className="p-4 hidden md:table-cell">Endereço</th>
                <th className="p-4 text-right pr-12">Saldo Devedor</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Carregando...</td></tr>
              ) : filteredClients.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Nenhum cliente encontrado.</td></tr>
              ) : (
                filteredClients.map(client => (
                  <tr 
                    key={client.id} 
                    onClick={() => handleOpenModal(client)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                  >
                    <td className="p-4 font-medium text-slate-800 dark:text-white">
                      {capitalizeName(client.full_name)}
                      {client.total_debt! > 0 && <span className="ml-2 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 text-[10px] rounded-full font-bold">EM DÉBITO</span>}
                    </td>
                    <td className="p-4">
                      <div className="text-slate-600 dark:text-slate-300 font-mono text-xs mb-1">{client.cpf}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col">
                        {client.phone && <span className="flex items-center"><Phone size={10} className="mr-1"/> {client.phone}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 text-sm hidden md:table-cell truncate max-w-xs" title={client.address}>
                      {client.address}
                    </td>
                    <td className="p-4 text-right pr-12">
                      <div className={`font-bold ${client.total_debt! > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                        {formatCurrency(client.total_debt || 0)}
                      </div>
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenModal(client)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="px-6 py-2 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-4">
                <button 
                  onClick={() => setActiveModalTab('info')} 
                  className={`py-2 px-1 text-xs font-bold uppercase transition-colors border-b-2 ${activeModalTab === 'info' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}
                >
                  Informações
                </button>
                {editingClient && (
                  <button 
                    onClick={() => setActiveModalTab('history')} 
                    className={`py-2 px-1 text-xs font-bold uppercase transition-colors border-b-2 ${activeModalTab === 'history' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400'}`}
                  >
                    Crediário / Extrato
                  </button>
                )}
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto">
              {activeModalTab === 'info' ? (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome Completo *</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          value={formData.full_name || ''}
                          onChange={e => setFormData({...formData, full_name: e.target.value})}
                          onBlur={e => setFormData({...formData, full_name: capitalizeName(e.target.value)})}
                          className="w-full pl-10 p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                          placeholder="Ex: Ana Silva"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">CPF</label>
                      <input 
                        value={formData.cpf || ''}
                        onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                        className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Telefone</label>
                      <input 
                        value={formData.phone || ''}
                        onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
                        className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">E-mail</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            value={formData.email || ''}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full pl-10 p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="cliente@email.com"
                        />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Endereço</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                        <textarea 
                            value={formData.address || ''}
                            onChange={e => setFormData({...formData, address: e.target.value})}
                            className="w-full pl-10 p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white h-24 resize-none"
                            placeholder="Rua, Número, Bairro, Cidade..."
                        />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Saldo Devedor Atual</p>
                      <p className="text-3xl font-black text-red-600">{formatCurrency(editingClient?.total_debt || 0)}</p>
                      {editingClient?.full_name && <p className="text-[10px] text-slate-400">Cliente: {capitalizeName(editingClient.full_name)}</p>}
                    </div>
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-700 disabled:opacity-50"
                      disabled={(editingClient?.total_debt || 0) <= 0}
                    >
                      <DollarSign size={18}/> Receber Pagamento
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                       <History size={16} className="text-primary-600"/> Histórico de Movimentações
                    </h4>
                    {historyLoading ? (
                      <div className="py-8 text-center text-slate-400 font-medium flex flex-col items-center gap-2">
                        <Loader className="animate-spin" size={32}/>
                        Carregando histórico...
                      </div>
                    ) : clientHistory.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 italic">Nenhuma compra registrada.</div>
                    ) : (
                      <div className="space-y-3">
                        {clientHistory.map(sale => {
                          const remaining = Number(sale.total_value) - (sale.paid_amount || 0);
                          return (
                            <div 
                              key={sale.id} 
                              onClick={() => setSelectedDetailSale(sale)}
                              className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 cursor-pointer transition-all active:scale-[0.98]"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    sale.status_label === 'Venda' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                  }`}>{sale.status_label} #{sale.code}</span>
                                  <p className="text-[10px] text-slate-400 mt-1">{new Date(sale.created_at).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-800 dark:text-white">{formatCurrency(sale.total_value)}</p>
                                  {remaining > 0 && <p className="text-[10px] font-bold text-red-500">Restante: {formatCurrency(remaining)}</p>}
                                  {remaining <= 0 && sale.total_value > 0 && <p className="text-[10px] font-bold text-green-500 uppercase">Pago</p>}
                                </div>
                              </div>
                              
                              {/* Payments for this sale */}
                              {sale.payments && sale.payments.length > 0 && (
                                <div className="mt-2 pt-2 border-t dark:border-slate-800 space-y-1">
                                  {sale.payments.map((p: any) => (
                                    <div key={p.id} className="flex justify-between items-center text-[10px] text-slate-500 italic">
                                      <span>{new Date(p.date).toLocaleDateString()} - Pagto ({p.payment_method})</span>
                                      <span className="text-green-600 font-bold">-{formatCurrency(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium">Fechar</button>
              {activeModalTab === 'info' && (
                <button onClick={handleSave} className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 flex items-center shadow-lg">
                  <Save size={18} className="mr-2" /> Salvar Alterações
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAGAMENTO PARCIAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2"><DollarSign size={20} className="text-green-600"/> Receber Valor</h3>
              <button onClick={() => setIsPaymentModalOpen(false)}><X size={20} className="text-slate-400"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor do Recebimento</label>
                <input 
                  type="text"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full p-4 border rounded-xl dark:bg-slate-700 dark:border-slate-600 dark:text-white text-2xl font-black focus:ring-2 focus:ring-primary-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Forma de Recebimento</label>
                <select 
                   value={payMethod}
                   onChange={e => setPayMethod(e.target.value)}
                   className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Pix">Pix</option>
                  <option value="Débito">Cartão de Débito</option>
                  <option value="Crédito">Cartão de Crédito</option>
                </select>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                <ArrowRight size={16} className="text-blue-600 mt-0.5 shrink-0"/>
                <p className="text-[10px] text-blue-800 dark:text-blue-300">
                  O valor será usado para quitar as contas pendentes mais antigas de <b>{editingClient?.full_name ? capitalizeName(editingClient.full_name) : 'este cliente'}</b>.
                </p>
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50">
              <button 
                onClick={handleProcessPayment} 
                disabled={isProcessingPay || !payAmount}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {isProcessingPay ? <Loader className="animate-spin" size={20}/> : <Save size={20}/>}
                Confirmar Recebimento
              </button>
              <button onClick={() => setIsPaymentModalOpen(false)} className="w-full py-2 text-slate-500 text-sm font-medium">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHE DA VENDA/CONSIGNACAO */}
      {selectedDetailSale && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300">
              <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  {selectedDetailSale.status_label === 'Venda' ? <ShoppingBag size={20} className="text-primary-600"/> : <FileText size={20} className="text-amber-500"/>}
                  <h3 className="font-bold dark:text-white uppercase tracking-wider">{selectedDetailSale.status_label} #{selectedDetailSale.code}</h3>
                </div>
                <button onClick={() => setSelectedDetailSale(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <XCircle size={24} className="text-slate-400"/>
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="text-center pb-6 border-b dark:border-slate-700 mb-6 font-mono">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Data da Transação</p>
                    <p className="text-lg font-bold dark:text-white">{new Date(selectedDetailSale.created_at).toLocaleString()}</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                      <ShoppingBag size={14}/> Itens da Transação
                    </h4>
                    <table className="w-full text-sm">
                      <tbody className="divide-y dark:divide-slate-700">
                        {selectedDetailSale.items?.map((item: any, i: number) => (
                          <tr key={i}>
                            <td className="py-3">
                              <div className="font-bold dark:text-white">{item.quantity}x {capitalizeName(item.product_variation?.products?.nome || '')}</div>
                              {item.product_variation?.products?.categoria && (
                                <div className="text-[10px] text-slate-400 uppercase italic">{capitalizeName(item.product_variation.products.categoria)}</div>
                              )}
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                <span className="bg-slate-50 dark:bg-slate-700 px-1 rounded"><b>Mod/Cor:</b> {capitalizeName(item.product_variation?.model_variant || 'Padrão')}</span>
                                <span className="bg-slate-50 dark:bg-slate-700 px-1 rounded"><b>Tam:</b> {item.product_variation?.size}</span>
                                <span className="bg-slate-50 dark:bg-slate-700 px-1 rounded font-mono"><b>SKU:</b> {item.product_variation?.sku}</span>
                              </div>
                            </td>
                            <td className="text-right py-3 font-mono">
                              <div className="dark:text-white font-bold">{formatCurrency(item.unit_price * item.quantity)}</div>
                              <div className="text-[10px] text-slate-400 font-medium">un: {formatCurrency(item.unit_price)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border-t-4 border-primary-600 shadow-inner">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 uppercase">Valor Total</span>
                      <span className="text-lg font-black dark:text-white tracking-tighter">{formatCurrency(selectedDetailSale.total_value)}</span>
                    </div>
                    {selectedDetailSale.paid_amount! > 0 && (
                      <>
                        <div className="flex justify-between items-center mb-2 text-green-600">
                          <span className="text-xs font-bold uppercase">Total Recebido</span>
                          <span className="text-base font-bold tracking-tighter">-{formatCurrency(selectedDetailSale.paid_amount!)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t dark:border-slate-700">
                          <span className="text-xs font-bold text-red-500 uppercase">Saldo em Aberto</span>
                          <span className="text-xl font-black text-red-600 tracking-tighter leading-none">{formatCurrency(Number(selectedDetailSale.total_value) - selectedDetailSale.paid_amount!)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {selectedDetailSale.payments && selectedDetailSale.payments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                        <DollarSign size={14} className="text-green-600"/> Histórico de Pagamentos
                      </h4>
                      <div className="space-y-2">
                        {selectedDetailSale.payments.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/30 rounded border dark:border-slate-700 text-xs italic">
                            <span className="text-slate-600 dark:text-slate-400">{new Date(p.date).toLocaleDateString()} - {p.payment_method}</span>
                            <span className="text-green-600 font-bold">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between gap-3">
                 <button onClick={handlePrintSale} className="flex-1 py-3 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm text-slate-700 dark:text-white hover:bg-slate-50 transition-all">
                    <Printer size={18}/> Imprimir
                 </button>
                 <button onClick={() => setSelectedDetailSale(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg">
                    Fechar Detalhes
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
