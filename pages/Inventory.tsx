
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Product, ProductVariation, ProductSize } from '../types';
import { ChevronDown, ChevronRight, Plus, AlertTriangle, Loader, Trash2, Edit2, X, Save, Search, Download, Layers, Settings as SettingsIcon, Package, PlusCircle, Upload, Combine, FileSpreadsheet, FileText, Image as ImageIcon, Star, ArrowUp, ArrowDown, Check, Globe, Link, Info } from 'lucide-react';
import { formatCurrency, parseCurrencyString, capitalizeName, getSizeWeight } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { RomaneioImportModal } from '../components/RomaneioImportModal';

type SortField = 'modelo' | 'nome' | 'categoria' | 'stock';

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Modals
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isRomaneioModalOpen, setIsRomaneioModalOpen] = useState(false);
  
  // Search & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig] = useState<{ field: SortField; direction: 'asc' | 'desc' }>({ field: 'modelo', direction: 'asc' });

  // State for editing
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockVariation, setRestockVariation] = useState<{ id: string, name: string, current: number, add: number } | null>(null);

  // Forms
  const [newProduct, setNewProduct] = useState({ nome: '', modelo: '', categoria: '', variations: [] as any[] });
  const [newVariant, setNewVariant] = useState({ productId: '', model: '', size: '', sku: '', quantity: 0, price_cost: '', price_sale: '' });
  const [tempVar, setTempVar] = useState({ model: '', size: '', cost: '', sale: '', sku: '', qty: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMethod, setImageMethod] = useState<'file' | 'url'>('file');
  const [imageLinkUrl, setImageLinkUrl] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: prodData } = await supabase.from('products').select('*, product_images(*)');
    const { data: varData } = await supabase.from('estoque_tamanhos').select('*');
    const { data: sizeData } = await supabase.from('product_sizes').select('*').order('sort_order');

    if (prodData && varData) {
      const merged = prodData.map(p => {
        const rawImages = p.product_images || [];
        const sortedImages = [...rawImages].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        return {
          ...p,
          images: sortedImages,
          variations: varData.filter(v => v.product_id === p.id)
        };
      });
      setProducts(merged);
    }

    if (sizeData) {
        setSizes(sizeData);
        if (sizeData.length > 0) {
            setTempVar(prev => ({ ...prev, size: sizeData[0].name }));
        }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const processedProducts = React.useMemo(() => {
    let filtered = products;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = products.filter(p => 
            p.nome.toLowerCase().includes(q) || 
            (p.modelo && p.modelo.toLowerCase().includes(q)) ||
            p.variations?.some(v => 
              v.sku?.toLowerCase().includes(q) || 
              v.model_variant?.toLowerCase().includes(q)
            )
        );
    }

    // Sort products by name A-Z
    return [...filtered].sort((a, b) => 
      a.nome.trim().localeCompare(b.nome.trim(), 'pt-BR', { sensitivity: 'base' })
    );
  }, [products, searchQuery]);

  // --- EXCEL LOGIC ---
  const handleExportExcel = () => {
      const data = products.flatMap(p => 
        (p.variations || []).map(v => ({
            "SKU": v.sku,
            "Referência": p.modelo,
            "Nome": p.nome,
            "Modelo/Cor": v.model_variant,
            "Categoria": p.categoria,
            "Tamanho": v.size,
            "Quantidade": v.quantity,
            "Preço Custo": v.price_cost,
            "Preço Venda": v.price_sale
        }))
      );

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Estoque");
      XLSX.writeFile(wb, `estoque_${new Date().toISOString().slice(0,10)}.xlsx`);
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
              for (const row of rows) {
                  const sku = row["SKU"]?.toString() || "";
                  const ref = row["Referência"]?.toString() || row["Referencia"]?.toString() || "";
                  const nome = row["Nome"]?.toString() || "";
                  const cor = row["Modelo/Cor"]?.toString() || row["Cor"]?.toString() || "Padrão";
                  const cat = row["Categoria"]?.toString() || "Geral";
                  const tam = row["Tamanho"]?.toString() || "";
                  const qtd = parseInt(row["Quantidade"]) || 0;
                  const custo = parseCurrencyString(row["Preço Custo"] || row["Preco Custo"] || 0);
                  const venda = parseCurrencyString(row["Preço Venda"] || row["Preco Venda"] || 0);

                  if (!nome || !ref) continue;

                  let productId = '';
                  const capitalizedNome = capitalizeName(nome);
                  const capitalizedCat = capitalizeName(cat);
                  const capitalizedCor = capitalizeName(cor);
                  
                  const { data: existingProd } = await supabase.from('products').select('id').eq('nome', capitalizedNome).eq('modelo', ref).maybeSingle();
                  
                  if (existingProd) {
                      productId = existingProd.id;
                  } else {
                      const { data: newP } = await supabase.from('products').insert({ nome: capitalizedNome, modelo: ref, categoria: capitalizedCat }).select().single();
                      if (newP) productId = newP.id;
                  }

                  if (productId) {
                      const { data: existingVar } = await supabase.from('estoque_tamanhos')
                          .select('id, quantity')
                          .eq('product_id', productId)
                          .eq('model_variant', capitalizedCor)
                          .eq('size', tam)
                          .maybeSingle();

                      if (existingVar) {
                          await supabase.from('estoque_tamanhos').update({ 
                              quantity: existingVar.quantity + qtd,
                              price_cost: custo,
                              price_sale: venda
                          }).eq('id', existingVar.id);
                      } else {
                          await supabase.from('estoque_tamanhos').insert({
                              product_id: productId,
                              model_variant: capitalizedCor,
                              size: tam,
                              sku: sku,
                              quantity: qtd,
                              price_cost: custo,
                              price_sale: venda
                          });
                      }
                      success++;
                  }
              }
              alert(`Importação concluída: ${success} registros processados.`);
          } catch (err) {
              alert("Erro ao processar o arquivo Excel. Verifique o formato.");
              console.error(err);
          } finally {
              setImporting(false);
              fetchData();
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsArrayBuffer(file);
  };

  // --- MERGE LOGIC ---
  const handleMergeDuplicates = async () => {
    if (!confirm("Isso irá unir TODOS os produtos que possuem a mesma Referência. As quantidades serão somadas. Deseja continuar?")) return;
    
    setIsMerging(true);
    try {
        const { data: allProds } = await supabase.from('products').select('*');
        const { data: allVars } = await supabase.from('estoque_tamanhos').select('*');
        
        if (!allProds || !allVars) return;

        const groups: Record<string, any[]> = {};
        allProds.forEach(p => {
            if (p.modelo) {
                const key = p.modelo.toString().trim().toLowerCase();
                if (!groups[key]) groups[key] = [];
                groups[key].push({ ...p, variations: allVars.filter(v => v.product_id === p.id) });
            }
        });

        let totalMerged = 0;

        for (const refKey in groups) {
            const list = groups[refKey];
            if (list.length > 1) {
                const mainProduct = list[0];
                const duplicates = list.slice(1);

                for (const dup of duplicates) {
                    for (const v of dup.variations) {
                        const match = allVars.find(mainVar => 
                            mainVar.product_id === mainProduct.id && 
                            mainVar.model_variant.trim().toLowerCase() === v.model_variant.trim().toLowerCase() && 
                            mainVar.size === v.size
                        );

                        if (match) {
                            const newQty = (match.quantity || 0) + (v.quantity || 0);
                            await supabase.from('estoque_tamanhos').update({ quantity: newQty }).eq('id', match.id);
                            await supabase.from('estoque_tamanhos').delete().eq('id', v.id);
                            match.quantity = newQty;
                        } else {
                            await supabase.from('estoque_tamanhos').update({ product_id: mainProduct.id }).eq('id', v.id);
                        }
                    }
                    await supabase.from('products').delete().eq('id', dup.id);
                    totalMerged++;
                }
            }
        }
        
        alert(`Processo concluído! ${totalMerged} produtos duplicados foram limpos.`);
        fetchData();
    } catch (e: any) {
        alert("Erro na mesclagem: " + e.message);
    } finally {
        setIsMerging(false);
    }
  };

  const handleDeleteVariation = async (id: string) => {
    if(!confirm("Excluir esta variação?")) return;
    const { error } = await supabase.from('estoque_tamanhos').delete().eq('id', id);
    if (error) alert("Erro ao excluir");
    else fetchData();
  };

  const handleDeleteProduct = async (id: string) => {
    if(!confirm("Excluir produto COMPLETO? Isso removerá todas as variações.")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("Erro ao excluir produto");
    else fetchData();
  };

  const handleSaveVariationEdit = async () => {
    if (!editingVariation) return;
    setLoading(true);
    const { error } = await supabase.from('estoque_tamanhos').update({ 
        price_cost: parseCurrencyString(editingVariation.price_cost), 
        price_sale: parseCurrencyString(editingVariation.price_sale), 
        quantity: editingVariation.quantity, 
        sku: editingVariation.sku,
        model_variant: editingVariation.model_variant,
        size: editingVariation.size
    }).eq('id', editingVariation.id);
    
    if (error) alert("Erro ao salvar: " + error.message);
    else { setEditingVariation(null); fetchData(); }
    setLoading(false);
  };

  const handleQuickRestock = async () => {
      if (!restockVariation) return;
      setLoading(true);
      const newQty = restockVariation.current + restockVariation.add;
      const { error } = await supabase.from('estoque_tamanhos').update({ quantity: newQty }).eq('id', restockVariation.id);
      if (error) alert("Erro ao atualizar estoque");
      else { setIsRestockModalOpen(false); setRestockVariation(null); fetchData(); }
      setLoading(false);
  };

  const generateProductSlug = (name: string) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleSaveImageLink = async () => {
    if (!imageLinkUrl || !editingProduct) return;
    if (!imageLinkUrl.startsWith('http://') && !imageLinkUrl.startsWith('https://')) {
      alert('Por favor, insira uma URL válida iniciando com http:// ou https://');
      return;
    }
    
    try {
      const currentImgCount = editingProduct.images?.length || 0;
      const { data: imgRecord, error: dbError } = await supabase
        .from('product_images')
        .insert({
          product_id: editingProduct.id,
          storage_path: 'via-url',
          public_url: imageLinkUrl,
          alt_text: 'Imagem via Link',
          is_cover: currentImgCount === 0,
          sort_order: currentImgCount
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setEditingProduct(prev => {
        if (!prev) return null;
        const updated = [...(prev.images || []), imgRecord];
        return { ...prev, images: updated };
      });

      setImageLinkUrl('');
      fetchData();
    } catch (err: any) {
      alert("Erro ao salvar link da imagem: " + err.message);
    }
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editingProduct) return;

    setUploadingImage(true);
    try {
      // Tenta criar preventivamente o bucket 'products' de forma silenciosa
      try {
        await supabase.storage.createBucket('products', { public: true });
      } catch (eCheck) {
        console.warn("Nota: Não foi possível criar bucket automaticamente (permissão de anon key restrita, o que é esperado).", eCheck);
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop() || 'jpg';
        const sanitizedFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `${editingProduct.id}/${sanitizedFileName}`;

        // Upload diretamente para o bucket 'products'
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          if (uploadError.message?.toLowerCase().includes('bucket not found') || (uploadError as any).statusCode === '404' || (uploadError as any).status === 404) {
            throw new Error("O bucket 'products' não foi encontrado no Supabase Storage. Por favor, acesse o painel do Supabase, clique em 'Storage' e crie um bucket público chamado 'products'. Como alternativa rápida, você também pode usar a aba 'Inserir Link (URL)' acima para cadastrar imagens usando links diretos.");
          }
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('products')
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;
        const currentImgCount = editingProduct.images?.length || 0;

        // Insert database record
        const { data: imgRecord, error: dbError } = await supabase
          .from('product_images')
          .insert({
            product_id: editingProduct.id,
            storage_path: filePath,
            public_url: publicUrl,
            alt_text: file.name,
            is_cover: currentImgCount === 0,
            sort_order: currentImgCount
          })
          .select()
          .single();

        if (dbError) {
          // Excluir arquivo órfão no Storage se houver falha de banco de dados
          await supabase.storage.from('products').remove([filePath]);
          throw dbError;
        }

        // Update local memory
        setEditingProduct(prev => {
          if (!prev) return null;
          const updated = [...(prev.images || []), imgRecord];
          return { ...prev, images: updated };
        });
      }
    } catch (err: any) {
      alert("Erro ao enviar imagem: " + (err.message || "Verifique se o bucket 'products' foi criado no Supabase."));
      console.error(err);
    } finally {
      setUploadingImage(false);
      fetchData();
      if (e.target) e.target.value = ''; // clean files
    }
  };

  const handleDeleteImage = async (imgId: string, storagePath: string) => {
    if (!confirm("Excluir esta imagem de forma permanente?")) return;
    
    try {
      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('products')
        .remove([storagePath]);

      if (storageError) {
        console.warn("Storage removal warning:", storageError);
      }

      // 2. Delete from Database
      const { error: dbError } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imgId);

      if (dbError) throw dbError;

      // 3. Update local state
      setEditingProduct(prev => {
        if (!prev) return null;
        const remaining = (prev.images || []).filter(img => img.id !== imgId);
        
        // Next active cover determination
        const wasCover = (prev.images || []).find(img => img.id === imgId)?.is_cover;
        if (wasCover && remaining.length > 0) {
          remaining[0].is_cover = true;
          supabase.from('product_images').update({ is_cover: true }).eq('id', remaining[0].id).then();
        }
        return { ...prev, images: remaining };
      });

      fetchData();
    } catch (err: any) {
      alert("Erro ao excluir imagem: " + err.message);
    }
  };

  const handleSetCoverImage = async (imgId: string) => {
    if (!editingProduct) return;
    
    try {
      await supabase
        .from('product_images')
        .update({ is_cover: false })
        .eq('product_id', editingProduct.id);

      const { error } = await supabase
        .from('product_images')
        .update({ is_cover: true })
        .eq('id', imgId);

      if (error) throw error;

      setEditingProduct(prev => {
        if (!prev) return null;
        const updated = (prev.images || []).map(img => ({
          ...img,
          is_cover: img.id === imgId
        }));
        return { ...prev, images: updated };
      });

      fetchData();
    } catch (err: any) {
      alert("Erro ao definir capa: " + err.message);
    }
  };

  const handleMoveImage = async (imgId: string, direction: 'up' | 'down') => {
    if (!editingProduct || !editingProduct.images) return;
    const images = [...editingProduct.images];
    const index = images.findIndex(img => img.id === imgId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const id1 = imgId;
    const id2 = images[targetIndex].id;
    const sort1 = images[targetIndex].sort_order;
    const sort2 = images[index].sort_order;

    try {
      await supabase.from('product_images').update({ sort_order: sort1 }).eq('id', id1);
      await supabase.from('product_images').update({ sort_order: sort2 }).eq('id', id2);

      setEditingProduct(prev => {
        if (!prev) return null;
        const updated = (prev.images || []).map(img => {
          if (img.id === id1) return { ...img, sort_order: sort1 };
          if (img.id === id2) return { ...img, sort_order: sort2 };
          return img;
        }).sort((a, b) => a.sort_order - b.sort_order);
        return { ...prev, images: updated };
      });

      fetchData();
    } catch (err: any) {
      alert("Erro ao ordenar: " + err.message);
    }
  };

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    setLoading(true);
    const { error } = await supabase.from('products').update({ 
        nome: editingProduct.nome, 
        modelo: editingProduct.modelo, 
        categoria: editingProduct.categoria,
        slug: editingProduct.slug?.trim() || null,
        short_description: editingProduct.short_description || '',
        published: editingProduct.published !== undefined ? editingProduct.published : true,
        display_order: Number(editingProduct.display_order) || 0
    }).eq('id', editingProduct.id);

    if (error) alert("Erro ao salvar produto");
    else { setEditingProduct(null); fetchData(); }
    setLoading(false);
  };

  const handleAddTempVar = () => {
    if (!tempVar.model) return alert("Modelo/Cor é obrigatório");
    setNewProduct(prev => ({
        ...prev,
        variations: [...prev.variations, {
            model_variant: tempVar.model, size: tempVar.size, sku: tempVar.sku || '', quantity: tempVar.qty,
            price_cost: parseCurrencyString(tempVar.cost), price_sale: parseCurrencyString(tempVar.sale)
        }]
    }));
    setTempVar(prev => ({ ...prev, sku: '', cost: '', sale: '', qty: 0 }));
  };

  const saveNewProduct = async () => {
    if (!newProduct.nome || newProduct.variations.length === 0) return alert("Preencha o nome e adicione ao menos uma variação.");
    setLoading(true);
    const capitalizedNome = capitalizeName(newProduct.nome);
    const capitalizedCat = capitalizeName(newProduct.categoria);
    const { data: parent, error: pError } = await supabase.from('products').insert({ 
        nome: capitalizedNome, 
        categoria: capitalizedCat, 
        modelo: newProduct.modelo || 'Geral', 
        descricao: capitalizedNome 
    }).select().single();
    
    if (!pError && parent) {
        const payload = newProduct.variations.map(v => ({ 
          product_id: parent.id, 
          ...v,
          model_variant: capitalizeName(v.model_variant)
        }));
        await supabase.from('estoque_tamanhos').insert(payload);
        setIsNewProductModalOpen(false);
        setNewProduct({ nome: '', modelo: '', categoria: '', variations: [] });
        fetchData();
    }
    setLoading(false);
  };

  const openAddVariantModal = (productId: string) => {
      setNewVariant({ productId, model: '', size: sizes[0]?.name || '', sku: '', quantity: 0, price_cost: '', price_sale: '' });
      setIsAddVariantModalOpen(true);
  };

  const handleSaveNewVariant = async () => {
      if(!newVariant.model) return alert("Preencha o Modelo/Cor");
      setLoading(true);
      const { error } = await supabase.from('estoque_tamanhos').insert({ 
          product_id: newVariant.productId, 
          model_variant: capitalizeName(newVariant.model), 
          size: newVariant.size, 
          sku: newVariant.sku || '', 
          quantity: newVariant.quantity, 
          price_cost: parseCurrencyString(newVariant.price_cost), 
          price_sale: parseCurrencyString(newVariant.price_sale) 
      });
      if (!error) { setIsAddVariantModalOpen(false); fetchData(); }
      setLoading(false);
  };

  return (
    <div className="space-y-4">
      <input type="file" accept=".xlsx, .xls" ref={fileInputRef} className="hidden" onChange={handleImportExcel} />

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-white">Estoque</h2><p className="text-[11px] text-slate-500">Gestão centralizada por modelo</p></div>
        
        <div className="flex-1 max-w-sm w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Buscar por Nome, Ref ou SKU..." className="w-full pl-9 pr-3 py-1.5 border rounded-lg dark:bg-slate-700 dark:text-white text-xs shadow-sm focus:ring-2 focus:ring-primary-500 outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button 
            onClick={handleMergeDuplicates} 
            disabled={isMerging || loading} 
            className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded text-xs font-bold flex items-center hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {isMerging ? <Loader className="animate-spin mr-1" size={14}/> : <Combine size={14} className="mr-1"/>}
            Mesclar
          </button>
          
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-white dark:bg-slate-800 border rounded text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs flex items-center font-bold">
            <Download size={14} className="mr-1"/> Exportar
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={importing}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border rounded text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs flex items-center font-bold"
          >
            {importing ? <Loader className="animate-spin mr-1" size={14}/> : <FileSpreadsheet size={14} className="mr-1"/>}
            Importar
          </button>

          <button 
            onClick={() => setIsRomaneioModalOpen(true)}
            className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-bold shadow hover:bg-purple-700 flex items-center"
          >
            <FileText size={14} className="mr-1"/> Romaneio PDF
          </button>

          <button onClick={() => setIsNewProductModalOpen(true)} className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-bold shadow hover:bg-primary-700 flex items-center">
            <Plus size={14} className="mr-1"/> Novo Item
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border dark:border-slate-700">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold sticky top-0 z-10">
                <tr>
                    <th className="p-1.5 pl-3">Item / Var. / Tamanho</th>
                    <th className="p-1.5">SKU</th>
                    <th className="p-1.5 text-right">Custo</th>
                    <th className="p-1.5 text-right">Venda</th>
                    <th className="p-1.5 text-center">Saldo</th>
                    <th className="p-1.5 text-right pr-3">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading && products.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center"><Loader className="animate-spin mx-auto text-primary-500" size={24} /></td></tr>
                ) : processedProducts.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500 text-xs">Nenhum produto encontrado.</td></tr>
                ) : (
                    processedProducts.map(product => {
                        // Grouping variations by model
                        const variationsByModel: Record<string, ProductVariation[]> = {};
                        (product.variations || []).forEach(v => {
                            const key = v.model_variant?.trim() || 'Padrão';
                            if (!variationsByModel[key]) variationsByModel[key] = [];
                            variationsByModel[key].push(v);
                        });

                        const sortedModels = Object.keys(variationsByModel).sort((a, b) => 
                          a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' })
                        );
                        const totalStock = (product.variations || []).reduce((acc, v) => acc + v.quantity, 0);

                        return (
                            <React.Fragment key={product.id}>
                                {/* Product Header Row */}
                                <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b dark:border-slate-700">
                                    <td colSpan={6} className="p-1.5 px-3">
                                        <div className="flex items-center gap-2">
                                            {product.images && product.images.length > 0 ? (
                                                <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0" title="Ver imagem">
                                                    <img 
                                                        src={product.images.find((img: any) => img.is_cover)?.public_url || product.images[0].public_url} 
                                                        alt={product.nome}
                                                        referrerPolicy="no-referrer"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <Package size={12} className="text-primary-500" />
                                            )}
                                            <span className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-tight">
                                                {capitalizeName(product.nome)}
                                            </span>
                                            {product.modelo && (
                                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                                    #{product.modelo}
                                                </span>
                                            )}
                                            <span className="text-[8px] uppercase font-bold text-slate-400 ml-1">
                                                {capitalizeName(product.categoria)}
                                            </span>
                                            <span className={`text-[9px] font-bold ml-2 ${totalStock <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                Sum: {totalStock}
                                            </span>
                                            <div className="ml-auto flex gap-1">
                                                <button onClick={() => setEditingProduct(product)} className="text-blue-600 hover:bg-blue-50 p-0.5 rounded" title="Editar"><Edit2 size={10}/></button>
                                                <button onClick={() => openAddVariantModal(product.id)} className="text-primary-600 hover:bg-primary-50 p-0.5 rounded" title="Add Variação"><PlusCircle size={10}/></button>
                                                <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:bg-red-50 p-0.5 rounded" title="Excluir"><Trash2 size={10}/></button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {sortedModels.map(model => {
                                    const variations = variationsByModel[model].sort((a, b) => getSizeWeight(a.size, sizes) - getSizeWeight(b.size, sizes));
                                    
                                    return (
                                        <React.Fragment key={`${product.id}-${model}`}>
                                            {/* Model Row Header */}
                                            <tr className="bg-white dark:bg-slate-800/10 border-l-2 border-primary-500">
                                                <td colSpan={6} className="px-5 py-0.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight bg-slate-50/20">
                                                    Var: <span className="text-primary-600 dark:text-primary-400">{capitalizeName(model)}</span>
                                                </td>
                                            </tr>

                                            {/* Variation Rows */}
                                            {variations.map(v => (
                                                <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors border-l-2 border-slate-200 dark:border-slate-700">
                                                    <td className="p-1 px-3 pl-8">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded bg-slate-50 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-[10px] border border-slate-100 dark:border-slate-600">
                                                                {v.size}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400">T{v.size}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-1 font-mono text-[9px] text-slate-400">{v.sku || '-'}</td>
                                                    <td className="p-1 text-right text-slate-400 text-[10px]">{formatCurrency(v.price_cost)}</td>
                                                    <td className="p-1 text-right font-bold dark:text-white text-[10px]">{formatCurrency(v.price_sale)}</td>
                                                    <td className="p-1 text-center">
                                                        <span className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold ${
                                                            v.quantity <= 0 
                                                            ? 'text-red-500' 
                                                            : v.quantity <= 2
                                                            ? 'text-amber-500'
                                                            : 'text-green-600'
                                                        }`}>
                                                            {v.quantity} un
                                                        </span>
                                                    </td>
                                                    <td className="p-1 text-right pr-3">
                                                        <div className="flex justify-end gap-1">
                                                            <button 
                                                                onClick={() => { setRestockVariation({ id: v.id, name: `${product.nome} - ${v.model_variant} (${v.size})`, current: v.quantity, add: 0 }); setIsRestockModalOpen(true); }} 
                                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                                title="Entrada"
                                                            >
                                                                <PlusCircle size={12}/></button>
                                                            <button 
                                                                onClick={() => setEditingVariation(v)} 
                                                                className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                                title="Editar"
                                                            >
                                                                <Edit2 size={12}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteVariation(v.id)} 
                                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })
                )}
            </tbody></table>
        </div>
      </div>

      {/* --- MODAIS --- */}
      {isRestockModalOpen && restockVariation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-xs overflow-hidden border dark:border-slate-700">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold dark:text-white">Entrada de Estoque</h3>
                    <button onClick={() => setIsRestockModalOpen(false)}><X size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-500 font-medium">Produto: <b className="text-slate-800 dark:text-white">{capitalizeName(restockVariation.name)}</b></p>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Quantidade a Adicionar</label>
                        <input 
                          type="number" autoFocus
                          className="w-full p-4 border-2 border-primary-500 rounded-lg dark:bg-slate-700 dark:text-white text-3xl font-bold text-center"
                          value={restockVariation.add || ''}
                          onChange={e => setRestockVariation({...restockVariation, add: parseInt(e.target.value) || 0})}
                        />
                    </div>
                    <div className="text-center text-xs text-slate-500">Saldo Final: <b className="text-primary-600">{restockVariation.current + restockVariation.add} un</b></div>
                    <button onClick={handleQuickRestock} className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold shadow-lg hover:bg-primary-700 transition-all">Confirmar Entrada</button>
                </div>
            </div>
        </div>
      )}

      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold dark:text-white text-lg">Cadastrar Novo Produto</h3>
                <button onClick={() => setIsNewProductModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Referência / Código</label><input placeholder="Ex: 100-02" value={newProduct.modelo} 
                        onChange={e => setNewProduct({...newProduct, modelo: e.target.value})} 
                        onBlur={e => setNewProduct({...newProduct, modelo: e.target.value.toUpperCase()})}
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Categoria</label><input placeholder="Ex: Camisola" value={newProduct.categoria} 
                        onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} 
                        onBlur={e => setNewProduct({...newProduct, categoria: capitalizeName(e.target.value)})}
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Nome do Produto</label><input placeholder="Ex: Pijama de Ursinho" value={newProduct.nome} 
                    onChange={e => setNewProduct({...newProduct, nome: e.target.value})} 
                    onBlur={e => setNewProduct({...newProduct, nome: capitalizeName(e.target.value)})}
                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" /></div>
                
                <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border dark:border-slate-600">
                    <h4 className="font-bold text-sm mb-4 dark:text-white flex items-center"><Layers size={16} className="mr-2 text-primary-500"/> Adicionar Variações</h4>
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input placeholder="Modelo/Cor" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.model} 
                                onChange={e => setTempVar({...tempVar, model: e.target.value})} 
                                onBlur={e => setTempVar({...tempVar, model: capitalizeName(e.target.value)})}
                            />
                            <select className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.size} onChange={e => setTempVar({...tempVar, size: e.target.value})}>
                                {sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                            <input placeholder="SKU (Opcional)" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.sku} onChange={e => setTempVar({...tempVar, sku: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <input placeholder="Custo" type="text" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.cost} onChange={e => setTempVar({...tempVar, cost: e.target.value})} />
                            <input placeholder="Venda" type="text" className="p-2 border rounded dark:bg-slate-800 dark:text-white font-bold" value={tempVar.sale} onChange={e => setTempVar({...tempVar, sale: e.target.value})} />
                            <input placeholder="Qtd" type="number" className="p-2 border rounded dark:bg-slate-800 dark:text-white" value={tempVar.qty} onChange={e => setTempVar({...tempVar, qty: parseInt(e.target.value) || 0})} />
                            <button onClick={handleAddTempVar} className="bg-primary-600 text-white rounded font-bold h-10 hover:bg-primary-700 transition-colors flex items-center justify-center"><Plus size={20} /></button>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {newProduct.variations.map((v, i) => (
                        <div key={i} className="text-xs p-3 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded flex justify-between items-center shadow-sm">
                            <div className="flex flex-wrap gap-x-4 gap-y-1"><span className="font-bold dark:text-white">{capitalizeName(v.model_variant)} - {v.size}</span><span className="text-primary-600 font-bold">{formatCurrency(v.price_sale)}</span><span className="px-2 bg-green-100 text-green-700 rounded font-bold">Qtd: {v.quantity}</span></div>
                            <button onClick={() => setNewProduct({...newProduct, variations: newProduct.variations.filter((_, idx) => idx !== i)})} className="text-red-500 p-1"><X size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setIsNewProductModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                <button onClick={saveNewProduct} disabled={newProduct.variations.length === 0 || loading} className="px-8 py-2 bg-primary-600 text-white rounded font-bold disabled:opacity-50 hover:bg-primary-700 transition-all">Finalizar Cadastro</button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl my-8 flex flex-col border dark:border-slate-700 max-h-[90vh]">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <Package className="text-primary-500" size={20} />
                    <div>
                        <h3 className="font-bold dark:text-white text-md">Editar Produto e Vitrine</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Configure imagens, slug e visibilidade para a vitrine</p>
                    </div>
                </div>
                <button onClick={() => setEditingProduct(null)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* COLUNA ESQUERDA: DADOS */}
                <div className="space-y-4">
                    <h4 className="font-bold text-xs text-primary-600 dark:text-primary-400 uppercase tracking-wider flex items-center gap-1.5 border-b dark:border-slate-700 pb-1.5">
                        <Info size={14} /> Informações Principais
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Referência / Código</label>
                            <input value={editingProduct.modelo || ''} 
                                onChange={e => setEditingProduct({...editingProduct, modelo: e.target.value})} 
                                onBlur={e => setEditingProduct({...editingProduct, modelo: e.target.value.toUpperCase()})}
                                className="w-full p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mt-1 h-9" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Categoria</label>
                            <input value={editingProduct.categoria || ''} 
                                onChange={e => setEditingProduct({...editingProduct, categoria: e.target.value})} 
                                onBlur={e => setEditingProduct({...editingProduct, categoria: capitalizeName(e.target.value)})}
                                className="w-full p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mt-1 h-9" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nome do Produto</label>
                        <input value={editingProduct.nome || ''} 
                            onChange={e => setEditingProduct({...editingProduct, nome: e.target.value})} 
                            onBlur={e => setEditingProduct({...editingProduct, nome: capitalizeName(e.target.value)})}
                            className="w-full p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mt-1 font-bold h-9" />
                    </div>

                    <h4 className="font-bold text-xs text-primary-600 dark:text-primary-400 uppercase tracking-wider flex items-center gap-1.5 border-b dark:border-slate-700 pt-2 pb-1.5">
                        <Globe size={14} /> Configuração na Vitrine / Site
                    </h4>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                <Link size={12} /> Slug amigável
                            </label>
                            <button 
                                type="button"
                                onClick={() => {
                                    const generated = generateProductSlug(editingProduct.nome || '');
                                    setEditingProduct({ ...editingProduct, slug: generated });
                                }}
                                className="text-[10px] text-primary-600 dark:text-primary-400 font-bold hover:underline"
                            >
                                Gerar do Nome
                            </button>
                        </div>
                        <input 
                            placeholder="pijama-de-ursinho" 
                            value={editingProduct.slug || ''} 
                            onChange={e => setEditingProduct({...editingProduct, slug: generateProductSlug(e.target.value)})} 
                            className="w-full p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono h-9" 
                        />
                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono">pijama-store/produto/<b>{editingProduct.slug || 'slug'}</b></p>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição Curta (Vitrine)</label>
                        <textarea 
                            rows={3} 
                            placeholder="Descreva brevemente o pijama. Material, detalhes das estampas, etc."
                            value={editingProduct.short_description || ''} 
                            onChange={e => setEditingProduct({...editingProduct, short_description: e.target.value})} 
                            className="w-full p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mt-1 resize-none" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border dark:border-slate-700">
                            <input 
                                type="checkbox" 
                                id="published-checkbox"
                                checked={editingProduct.published ?? true} 
                                onChange={e => setEditingProduct({...editingProduct, published: e.target.checked})} 
                                className="w-4 h-4 text-primary-600 rounded cursor-pointer border-slate-300" 
                            />
                            <div className="leading-tight">
                                <label htmlFor="published-checkbox" className="text-xs font-bold dark:text-white cursor-pointer block">Publicar Produto</label>
                                <span className="text-[9px] text-slate-400">Exibir no catálogo</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ordem de Exibição</label>
                            <input 
                                type="number" 
                                value={editingProduct.display_order ?? 0} 
                                onChange={e => setEditingProduct({...editingProduct, display_order: parseInt(e.target.value) || 0})} 
                                className="w-full p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white h-9" 
                            />
                        </div>
                    </div>
                </div>

                {/* COLUNA DIREITA: IMAGENS */}
                <div className="space-y-4 flex flex-col h-full border-t md:border-t-0 md:border-l dark:border-slate-700 md:pl-6 pt-4 md:pt-0">
                    <h4 className="font-bold text-xs text-primary-600 dark:text-primary-400 uppercase tracking-wider flex items-center gap-1.5 border-b dark:border-slate-700 pb-1.5">
                        <ImageIcon size={14} /> Imagens do Produto
                    </h4>

                    {/* ENTRADA DE IMAGEM (UPLOAD OU LINK) */}
                    <div className="space-y-3">
                      <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 text-[11px]">
                        <button 
                          type="button" 
                          onClick={() => setImageMethod('file')}
                          className={`flex-1 py-1 px-2 rounded font-bold transition-all ${imageMethod === 'file' ? 'bg-white dark:bg-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                        >
                          Fazer Upload de Arquivo
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setImageMethod('url')}
                          className={`flex-1 py-1 px-2 rounded font-bold transition-all ${imageMethod === 'url' ? 'bg-white dark:bg-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                        >
                          Inserir Link da Imagem (URL)
                        </button>
                      </div>

                      {imageMethod === 'file' ? (
                        <div className="relative">
                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                id="product-images-upload" 
                                className="hidden" 
                                onChange={handleUploadImages} 
                                disabled={uploadingImage}
                            />
                            <label 
                                htmlFor="product-images-upload" 
                                className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary-500 rounded-lg cursor-pointer transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {uploadingImage ? (
                                    <>
                                        <Loader className="animate-spin text-primary-500 mb-2" size={24} />
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Enviando imagens...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="text-slate-400 mb-2" size={24} />
                                        <span className="text-xs font-bold text-slate-800 dark:text-white">Selecionar Imagens</span>
                                        <span className="text-[10px] text-slate-400 mt-1">PNG, JPG ou WEBP (Permite vários)</span>
                                    </>
                                )}
                            </label>
                        </div>
                      ) : (
                        <div className="flex gap-2 p-3 border rounded-lg dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10">
                            <input 
                                type="url"
                                placeholder="Coloque a URL da imagem aqui..."
                                value={imageLinkUrl}
                                onChange={e => setImageLinkUrl(e.target.value)}
                                className="flex-1 p-2 border text-xs rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white bg-white h-9"
                            />
                            <button 
                                type="button"
                                onClick={handleSaveImageLink}
                                className="px-3 bg-primary-600 text-white font-bold rounded text-xs hover:bg-primary-700 h-9 shrink-0 flex items-center justify-center shadow"
                            >
                                Adicionar
                            </button>
                        </div>
                      )}
                    </div>

                    {/* LISTA DE IMAGENS */}
                    <div className="flex-1 space-y-2 overflow-y-auto max-h-72 pr-1 scrollbar-thin">
                        {(!editingProduct.images || editingProduct.images.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 dark:bg-slate-900/10 border border-dashed rounded-lg">
                                <ImageIcon size={32} className="text-slate-300 mb-2" />
                                <span className="text-xs text-slate-400 font-medium">Nenhuma imagem enviada ainda.</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {editingProduct.images.map((img, idx) => (
                                    <div key={img.id} className="flex items-center gap-3 p-2 bg-slate-50/50 dark:bg-slate-900/30 rounded-lg border dark:border-slate-700">
                                        {/* Thumbnail */}
                                        <div className="w-12 h-12 rounded bg-slate-100 dark:bg-slate-800 border dark:border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                                            <img 
                                                src={img.public_url} 
                                                alt={img.alt_text} 
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-slate-650 dark:text-slate-300 truncate">{img.alt_text || 'Imagem'}</p>
                                            <p className="text-[8px] text-slate-400 font-mono">Ordem: {img.sort_order}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            {/* Cover Button */}
                                            <button 
                                                type="button"
                                                onClick={() => handleSetCoverImage(img.id)}
                                                className={`p-1 rounded hover:bg-slate-150 dark:hover:bg-slate-700 ${img.is_cover ? 'text-amber-500' : 'text-slate-300 hover:text-slate-600'}`}
                                                title={img.is_cover ? "Imagem de vitrine de capa" : "Definir como capa"}
                                            >
                                                <Star size={14} fill={img.is_cover ? "currentColor" : "none"} />
                                            </button>

                                            {/* Move Buttons */}
                                            <button 
                                                type="button"
                                                disabled={idx === 0}
                                                onClick={() => handleMoveImage(img.id, 'up')}
                                                className="p-1 rounded hover:bg-slate-150 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                title="Mover para cima"
                                            >
                                                <ArrowUp size={14} />
                                            </button>
                                            <button 
                                                type="button"
                                                disabled={idx === (editingProduct.images?.length || 1) - 1}
                                                onClick={() => handleMoveImage(img.id, 'down')}
                                                className="p-1 rounded hover:bg-slate-150 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                                                title="Mover para baixo"
                                            >
                                                <ArrowDown size={14} />
                                            </button>

                                            {/* Delete Button */}
                                            <button 
                                                type="button"
                                                onClick={() => handleDeleteImage(img.id, img.storage_path)}
                                                className="p-1 rounded hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                                                title="Excluir imagem"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                <button onClick={() => setEditingProduct(null)} className="px-5 py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold">Cancelar</button>
                <button onClick={handleSaveProductEdit} className="px-8 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 flex items-center shadow-lg gap-1.5 text-xs">
                    <Save size={14} /> Salvar Produto e Vitrine
                </button>
            </div>
          </div>
        </div>
      )}

      {editingVariation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-bold dark:text-white text-lg flex items-center"><Package className="mr-2" size={20}/> Editar Variação</h3>
                <button onClick={() => setEditingVariation(null)}><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Modelo / Cor</label><input value={editingVariation.model_variant || ''} 
                        onChange={e => setEditingVariation({...editingVariation, model_variant: e.target.value})} 
                        onBlur={e => setEditingVariation({...editingVariation, model_variant: capitalizeName(e.target.value)})}
                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Tamanho</label><select className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={editingVariation.size || ''} onChange={e => setEditingVariation({...editingVariation, size: e.target.value})}>{sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">SKU / Cód. Barras (Opcional)</label><input value={editingVariation.sku || ''} onChange={e => setEditingVariation({...editingVariation, sku: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-mono" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Custo (R$)</label><input type="text" value={editingVariation.price_cost || ''} onChange={e => setEditingVariation({...editingVariation, price_cost: e.target.value as any})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase">Venda (R$)</label><input type="text" value={editingVariation.price_sale || ''} onChange={e => setEditingVariation({...editingVariation, price_sale: e.target.value as any})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold text-primary-600" /></div>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase">Qtd Atual</label><input type="number" value={editingVariation.quantity || 0} onChange={e => setEditingVariation({...editingVariation, quantity: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" /></div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
                <button onClick={() => setEditingVariation(null)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                <button onClick={handleSaveVariationEdit} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {isAddVariantModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border dark:border-slate-700">
                   <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h4 className="font-bold dark:text-white text-lg">Nova Variação</h4>
                        <button onClick={() => setIsAddVariantModalOpen(false)}><X size={20}/></button>
                   </div>
                   <div className="p-6 space-y-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Modelo / Cor</label><input placeholder="Ex: Azul" 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" 
                            value={newVariant.model} 
                            onChange={e => setNewVariant({...newVariant, model: e.target.value})} 
                            onBlur={e => setNewVariant({...newVariant, model: capitalizeName(e.target.value)})}
                        /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Tamanho</label><select className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.size} onChange={e => setNewVariant({...newVariant, size: e.target.value})}>{sizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">SKU (Opcional)</label><input placeholder="Cód. Barras" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.sku} onChange={e => setNewVariant({...newVariant, sku: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Custo</label><input type="text" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.price_cost} onChange={e => setNewVariant({...newVariant, price_cost: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase">Venda</label><input type="text" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold" value={newVariant.price_sale} onChange={e => setNewVariant({...newVariant, price_sale: e.target.value})} /></div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Quantidade Inicial</label><input type="number" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={newVariant.quantity} onChange={e => setNewVariant({...newVariant, quantity: parseInt(e.target.value) || 0})} /></div>
                   </div>
                   <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
                        <button onClick={() => setIsAddVariantModalOpen(false)} className="px-4 py-2 text-slate-500 font-medium">Cancelar</button>
                        <button onClick={handleSaveNewVariant} disabled={loading} className="px-6 py-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700 shadow-md flex items-center"><Plus size={16} className="mr-2"/> Adicionar</button>
                    </div>
               </div>
          </div>
      )}

      {isRomaneioModalOpen && (
        <RomaneioImportModal 
          onClose={() => setIsRomaneioModalOpen(false)} 
          onSuccess={() => {
            setIsRomaneioModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};
