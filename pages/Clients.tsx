
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Client } from '../types';
import { Search, Plus, FileSpreadsheet, Download, Upload, Edit2, Trash2, X, Save, Loader, MapPin, Phone, Mail, User } from 'lucide-react';
import { maskCPF, maskPhone } from '../utils/formatters';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
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
    const { data } = await supabase.from('clients').select('*').order('full_name');
    if (data) setClients(data);
    setLoading(false);
  };

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        full_name: client.full_name,
        cpf: client.cpf,
        phone: client.phone,
        email: client.email,
        address: client.address
      });
    } else {
      setEditingClient(null);
      setFormData({ full_name: '', cpf: '', phone: '', email: '', address: '' });
    }
    setIsModalOpen(true);
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

  // --- CSV LOGIC ---

  const handleExportCSV = () => {
    const header = "Nome,CPF,Telefone,Email,Endereco\n";
    const rows = clients.map(c => {
      // Escape quotes for CSV format
      const escape = (txt: string) => `"${(txt || '').replace(/"/g, '""')}"`;
      return `${escape(c.full_name)},${escape(c.cpf)},${escape(c.phone)},${escape(c.email)},${escape(c.address)}`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'clientes_pijama_pro.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (text: string) => {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(cell.trim()); cell = ''; }
        else cell += char;
    }
    result.push(cell.trim());
    return result.map(c => c.replace(/^"|"$/g, '').trim()); // Remove surrounding quotes
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      let success = 0;
      let errors = 0;

      // Skip header if it contains "Nome"
      const startIndex = lines[0].toLowerCase().includes('nome') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, '').trim();
        if (!line) continue;

        try {
          const cols = parseCSVLine(line);
          // Expected: Nome, CPF, Telefone, Email, Endereco
          if (cols.length < 1) continue;

          const [nome, cpf, tel, email, end] = cols;

          if (nome) {
            await supabase.from('clients').insert({
              full_name: nome,
              cpf: cpf || '',
              phone: tel || '',
              email: email || '',
              address: end || ''
            });
            success++;
          }
        } catch (err) {
          errors++;
        }
      }

      alert(`Importação finalizada!\nImportados: ${success}\nErros: ${errors}`);
      setImporting(false);
      fetchClients();
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- RENDER ---
  const filteredClients = clients.filter(c => 
    c.full_name.toLowerCase().includes(search.toLowerCase()) || 
    c.cpf.includes(search) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImportCSV} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Clientes</h2>
          <p className="text-slate-500 text-sm">Gerencie sua base de contatos</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleExportCSV} className="p-2 text-slate-600 bg-white border rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" title="Exportar CSV">
            <Download size={20} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="p-2 text-slate-600 bg-white border rounded hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" title="Importar CSV">
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
                <th className="p-4">CPF</th>
                <th className="p-4">Contato</th>
                <th className="p-4 hidden md:table-cell">Endereço</th>
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
                  <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="p-4 font-medium text-slate-800 dark:text-white">{client.full_name}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm">{client.cpf}</td>
                    <td className="p-4">
                      <div className="text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-1">
                        {client.phone && <span className="flex items-center"><Phone size={12} className="mr-1"/> {client.phone}</span>}
                        {client.email && <span className="flex items-center"><Mail size={12} className="mr-1"/> {client.email}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-slate-400 text-sm hidden md:table-cell truncate max-w-xs" title={client.address}>
                      {client.address}
                    </td>
                    <td className="p-4 text-center">
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
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo *</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      placeholder="Ex: Ana Silva"
                    />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CPF</label>
                  <input 
                    value={formData.cpf}
                    onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                  <input 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="cliente@email.com"
                    />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço</label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                    <textarea 
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        className="w-full pl-10 p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white h-24 resize-none"
                        placeholder="Rua, Número, Bairro, Cidade..."
                    />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium">Cancelar</button>
              <button onClick={handleSave} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 flex items-center">
                <Save size={18} className="mr-2" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
