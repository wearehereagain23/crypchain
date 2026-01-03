/**
 * server/tradeEngine.js
 * Logic:
 * Amount = trade_amount + current positive_value (Moving Balance)
 * Profit = The exact change made to the positive_value field this loop.
 * - Match: (impact + negative_value)
 * - Mismatch: (-impact)
 */

async function processTradeLogic(supabase, sym, candleColor) {
    try {
        const targetSym = sym.trim().toUpperCase();

        const { data: activeTrades, error: fetchErr } = await supabase
            .from('on_trade')
            .select('*')
            .eq('asset', targetSym)
            .order('step_id', { ascending: true });

        if (fetchErr) {
            console.error("[DEBUG] DB_FETCH_ERROR in tradeEngine:", fetchErr.message);
            return;
        }

        if (!activeTrades || activeTrades.length === 0) return;

        // Process only the current step (oldest step_id) per user
        const userCurrentStep = {};
        activeTrades.forEach(t => { if (!userCurrentStep[t.uuid]) userCurrentStep[t.uuid] = t; });

        for (const uuid in userCurrentStep) {
            const trade = userCurrentStep[uuid];

            // Fetch fresh user profile
            const { data: user, error: userErr } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('uuid', uuid)
                .single();

            if (userErr || !user) {
                console.error("[DEBUG] USER_NOT_FOUND or DB_ERROR:", userErr?.message || "No user data");
                continue;
            }

            // --- INPUTS ---
            const currentPos = Number(user.positive_value) || 0;
            const currentNeg = Number(user.negative_value) || 0;
            const impact = Number(trade.price_impact) || 0;
            const stake = Number(user.last_trade_amt) || 0;

            // Simple noise calculation
            const noise = (Math.random() * 0.04 - 0.02) * impact;
            const finalImpact = impact + noise;

            const userChoice = trade.market.toLowerCase();
            const actualColor = candleColor.toLowerCase();

            // --- RULES MATH ---
            let loopProfit = 0;
            // Rule: Amount => trade amount + current positive_value (state before this loop)
            const movingAmount = stake + currentPos;

            if (userChoice === actualColor) {
                // MATCH: Rule -> Profit = impact + current negative_value (recovery)
                loopProfit = finalImpact + currentNeg;

                const nextPos = (currentPos + loopProfit).toFixed(4);

                // Update User: Reset debt, update positive value
                const { error: updErr } = await supabase.from('user_profiles').update({
                    positive_value: nextPos,
                    negative_value: 0
                }).eq('uuid', uuid);

                if (updErr) console.error("[DEBUG] MATCH_UPDATE_FAIL:", updErr.message);

                // Clear current execution step
                await supabase.from('on_trade').delete().eq('auto_id', trade.auto_id);

                // Check if trade is fully completed
                const { count } = await supabase.from('on_trade')
                    .select('*', { count: 'exact', head: true })
                    .eq('uuid', uuid);

                if (count === 0) {
                    await supabase.from('user_profiles').update({ trade_status: true }).eq('uuid', uuid);
                }
            } else {
                // MISMATCH: Rule -> Profit = -impact
                loopProfit = -finalImpact;

                const nextPos = (currentPos + loopProfit).toFixed(4);
                const nextNeg = (currentNeg + finalImpact).toFixed(4);

                // Update User: Balance decreases, Debt increases
                const { error: updErr } = await supabase.from('user_profiles').update({
                    positive_value: nextPos,
                    negative_value: nextNeg
                }).eq('uuid', uuid);

                if (updErr) console.error("[DEBUG] MISMATCH_UPDATE_FAIL:", updErr.message);
            }

            // --- CREATE HISTORY ENTRY ---
            const historyData = {
                uuid: uuid,
                asset: targetSym,
                amount: movingAmount,
                profit: loopProfit,
                created_at: new Date().toISOString()
            };

            const { error: histErr } = await supabase.from('trade_history').insert([historyData]);
            if (histErr) console.error("[DEBUG] HISTORY_INSERT_FAIL:", histErr.message);

            console.log(`[LOOP LOG] ${user.login_ID} | Match: ${userChoice === actualColor} | Profit: ${loopProfit.toFixed(4)}`);
            return {
                user_id: uuid,
                symbol: targetSym,
                amount: movingAmount, // The trade amount
                profit: loopProfit,   // The win/loss amount
                result: userChoice === actualColor ? 'green' : 'red'
            };
        }
    } catch (err) {
        console.error("[CRITICAL ENGINE ERROR]", err);
    }
}

module.exports = processTradeLogic;