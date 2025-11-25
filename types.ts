
export interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'employee';
  password?: string; // Campo opcional para tipagem, mas obrigatório no DB
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
  modelo?: string; 
  descricao: string;
  categoria: string;
  active: boolean;
  variations?: ProductVariation[];
}

export interface ProductVariation {
  id: string;
  product_id: string;
  model_variant: string;
  size: string;
  quantity: number;
  price_cost: number;
  price_sale: number;
  sku: string;
  reference: string;
  products?: Product; // For joined queries
}

export interface PaymentMethod {
  id: number;
  name: string;
  type: 'credit' | 'debit' | 'pix' | 'cash';
  active: boolean;
  rates: Record<string, number>; // Ex: { "1": 0, "2": 5.5 } (Parcela -> Taxa %)
}

export interface Sale {
  id: number;
  code?: string; // V0001 ou C0001
  created_at: string;
  total_value: number;
  payment_method: string; // Armazena o nome do método
  payment_status: 'paid' | 'pending' | 'refunded' | 'loss';
  status_label: 'Venda' | 'Condicional' | 'Baixa' | 'Devolução' | 'Convertida';
  notes?: string;
  client_id?: string;
  client?: Client;
  items?: SaleItem[];
  payment_details?: any;
}

export interface SaleItem {
  id?: number;
  sale_id: number;
  product_variation_id: string;
  quantity: number;
  unit_price: number;
  original_cost: number;
  product_name?: string; // Joined view logic
  size?: string; // Joined view logic
  model_variant?: string; // Joined view logic
  product_variation?: ProductVariation; // For joined queries
}

export interface CartItem {
  variation: ProductVariation;
  product: Product;
  quantity: number;
  customPrice?: number;
}

// --- FINANCIAL MODULE TYPES ---

export interface BankAccount {
  id: number;
  name: string;
  balance: number;
  is_default: boolean;
  color?: string;
  active: boolean;
}

export interface FinancialTransaction {
  id: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  account_id: number;
  category: string;
  date: string;
  created_at: string;
  bank_account?: BankAccount; // joined
}
