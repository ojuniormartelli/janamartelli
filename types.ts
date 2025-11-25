
export interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'employee';
}

export interface Client {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  created_at?: string;
}

export interface Product {
  id: string;
  nome: string;
  modelo?: string; // Mantido para compatibilidade, mas usado como referência geral
  descricao: string;
  categoria: string;
  active: boolean;
  variations?: ProductVariation[];
}

export interface ProductVariation {
  id: string;
  product_id: string;
  model_variant: string; // Nova coluna: Cor/Estampa específica
  size: string;
  quantity: number;
  price_cost: number;
  price_sale: number;
  sku: string;
  reference: string;
}

export interface Sale {
  id: number; // BigInt in DB
  created_at: string;
  total_value: number;
  payment_method: string;
  payment_status: 'paid' | 'pending' | 'refunded' | 'loss';
  status_label?: 'Venda' | 'Condicional' | 'Baixa' | 'Devolução';
  notes: string;
  client_id?: string;
  client?: Client;
  items?: SaleItem[];
}

export interface SaleItem {
  id?: number;
  sale_id: number;
  product_variation_id: string;
  quantity: number;
  unit_price: number;
  product_name?: string; // Joined view
  size?: string; // Joined view
  model_variant?: string; // Joined view
}

export interface CartItem {
  variation: ProductVariation;
  product: Product;
  quantity: number;
  customPrice?: number;
}
