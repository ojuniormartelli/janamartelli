import { supabase } from '../supabaseClient';
import { Sale, FinancialTransaction } from '../types';

export const processPartialPayment = async (
    clientId: string, 
    totalAmount: number, 
    paymentMethod: string,
    accountId: number = 1 // Default account (usually Loja)
) => {
    if (totalAmount <= 0) return { success: false, message: 'Valor deve ser maior que zero' };

    try {
        // 1. Fetch pending sales for this client, ordered by oldest first
        const { data: sales, error: salesError } = await supabase
            .from('vendas')
            .select(`
                *,
                payments:venda_pagamentos(*)
            `)
            .eq('client_id', clientId)
            .in('payment_status', ['pending', 'paid']) // Check if they are truly paid or just have partials
            .order('created_at', { ascending: true });

        if (salesError) throw salesError;

        // Filter and calculate truly pending sales (where total_value > sum of payments)
        const pendingSales = (sales as any[] || []).map(sale => {
            const paid = (sale.payments || []).reduce((acc: number, p: any) => acc + Number(p.amount), 0);
            return {
                ...sale,
                paid_amount: paid,
                remaining: Number(sale.total_value) - paid
            };
        }).filter(sale => sale.remaining > 0);

        if (pendingSales.length === 0) {
            return { success: false, message: 'Este cliente não possui dívidas pendentes' };
        }

        let remainingPayment = totalAmount;
        const processedSales = [];

        for (const sale of pendingSales) {
            if (remainingPayment <= 0) break;

            const amountToPayInThisSale = Math.min(remainingPayment, sale.remaining);
            
            // 2. Record the payment for this specific sale
            const { error: payError } = await supabase
                .from('venda_pagamentos')
                .insert({
                    sale_id: sale.id,
                    amount: amountToPayInThisSale,
                    payment_method: paymentMethod,
                    date: new Date().toISOString().split('T')[0]
                });

            if (payError) throw payError;

            // 3. Update sale status if fully paid
            if (amountToPayInThisSale >= sale.remaining) {
                await supabase
                    .from('vendas')
                    .update({ payment_status: 'paid' })
                    .eq('id', sale.id);
            }

            remainingPayment -= amountToPayInThisSale;
            processedSales.push({ sale_id: sale.id, amount: amountToPayInThisSale });
        }

        // 4. Record the overall transaction in the financial module
        const { data: clientData } = await supabase.from('clients').select('full_name').eq('id', clientId).single();
        
        await supabase
            .from('transactions')
            .insert({
                description: `PAGTO CREDIÁRIO: ${clientData?.full_name || 'Cliente'}`,
                amount: totalAmount,
                type: 'income',
                account_id: accountId,
                category: 'Recebimento de Vendas',
                date: new Date().toISOString().split('T')[0]
            });

        // 5. Update bank account balance
        const { data: account } = await supabase.from('bank_accounts').select('balance').eq('id', accountId).single();
        if (account) {
            await supabase
                .from('bank_accounts')
                .update({ balance: Number(account.balance) + totalAmount })
                .eq('id', accountId);
        }

        return { 
            success: true, 
            message: `Recebimento de R$ ${totalAmount.toFixed(2)} processado com sucesso!`,
            processedSales 
        };

    } catch (error: any) {
        console.error('Error in processPartialPayment:', error);
        return { success: false, message: error.message };
    }
};
