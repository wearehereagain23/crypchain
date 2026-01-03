/**
 * history.js - Updated for trade_history table
 */
import { supabase } from './chart.supabase.js';

export async function initHistoryPage() {
    const userId = new URLSearchParams(window.location.search).get('user_id');
    const container = document.getElementById('historyTableBody');

    if (!userId || !container) return;

    const renderTrades = async () => {
        const { data: trades, error } = await supabase
            .from('trade_history')
            .select('*')
            .eq('uuid', userId)
            .order('created_at', { ascending: false });

        if (error) return console.error(error);

        container.innerHTML = trades.map(t => {
            const profitVal = parseFloat(t.profit || 0);
            const isPositive = profitVal > 0;
            const colorClass = isPositive ? 'badge-win' : 'badge-loss';
            const sign = isPositive ? '+' : '';

            // Format time to readable string
            const timeStr = new Date(t.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <tr>
                    <td><strong>${t.asset}</strong></td>
                    <td>$${parseFloat(t.amount).toFixed(2)}</td>
                    <td>
                        <span class="${colorClass}">
                            ${sign}${profitVal.toFixed(2)}
                        </span>
                    </td>
                    <td class="time-col">${timeStr}</td>
                </tr>
            `;
        }).join('');
    };

    await renderTrades();

    // Realtime listener for instant history updates
    supabase.channel('history-updates')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'trade_history',
            filter: `uuid=eq.${userId}`
        }, renderTrades)
        .subscribe();
}