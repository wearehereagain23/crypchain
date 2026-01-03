/**
 * FULL FIXED FILE: admin.js
 * Logic: Admin Dashboard with URL-based UUID targeting.
 * Update: Added "Expected Sum" to Live UI and verified "Asset" transfer to on_trade.
 */
import { supabase } from '../chart/js/chart.supabase.js';
import { USER_TABLE, REQUEST_TABLE } from '../config.js';

const ON_TRADE_TABLE = 'on_trade';

const mainContainer = document.getElementById('dynamicContent');
const statusTitle = document.getElementById('statusTitle');

const getUrlUserId = () => new URLSearchParams(window.location.search).get('user_id');

async function refreshAdminView() {
    const targetUuid = getUrlUserId();
    console.log(`[DEBUG] Admin: Checking state for UUID: ${targetUuid || 'All Users'}`);

    // 1. Check for Pending Trade Requests
    let reqQuery = supabase.from(REQUEST_TABLE).select('*');
    if (targetUuid) reqQuery = reqQuery.eq('uuid', targetUuid);

    const { data: request, error: reqErr } = await reqQuery.order('created_at', { ascending: true }).limit(1).maybeSingle();

    if (reqErr) {
        console.error('[DEBUG] STATE_CHECK_REQ_ERROR:', reqErr.message);
        return;
    }

    if (request) {
        const { data: user, error: uErr } = await supabase.from(USER_TABLE).select('*').eq('uuid', request.uuid).single();
        if (!uErr && user) {
            renderRequestUI(request, user);
            return;
        }
    }

    // 2. Check for Live Execution using user_profiles.trade column
    let userQuery = supabase.from(USER_TABLE).select('*').eq('trade', true);
    if (targetUuid) userQuery = userQuery.eq('uuid', targetUuid);

    const { data: activeUser, error: activeErr } = await userQuery.limit(1).maybeSingle();

    if (activeErr) {
        console.error('[DEBUG] ACTIVE_TRADE_CHECK_ERROR:', activeErr.message);
        return;
    }

    if (activeUser) {
        renderLiveUI(activeUser);
        return;
    }

    renderIdleUI();
}

function renderIdleUI() {
    statusTitle.innerText = "System Idle";
    mainContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: #8b9bb5;">No active trade requests or live executions.</div>`;
}

function renderRequestUI(trade, user) {
    statusTitle.innerText = "New Trade Request";

    const tradeAmt = parseFloat(trade.trade_amount);
    const pct = parseFloat(trade.percent);
    const totalExpected = (tradeAmt + (tradeAmt * (pct / 100))).toFixed(2);
    const marketLabel = trade.market.toUpperCase() === 'GREEN' ? 'BUY' : 'SELL';
    const marketColor = trade.market.toUpperCase() === 'GREEN' ? '#06d6a0' : '#ff6b6b';
    const curr = user.currency || '$';

    mainContainer.innerHTML = `
        <div class="info-list">
            <div class="info-item"><span class="small-muted">Asset</span> <strong>${trade.asset}</strong></div>
            <div class="info-item"><span class="small-muted">User ID</span> <strong>${user.login_ID}</strong></div>
            <div class="info-item"><span class="small-muted">User Balance</span> <strong>${curr}${user.account_balance}</strong></div>
            <div class="info-item"><span class="small-muted">Trading Amount</span> <strong>${curr}${tradeAmt.toFixed(2)}</strong></div>
            <div class="info-item"><span class="small-muted">Selected %</span> <strong>${pct}%</strong></div>
            <div class="info-item"><span class="small-muted">Expected Sum</span> <strong style="color:var(--accent)">${curr}${totalExpected}</strong></div>
            <div class="info-item"><span class="small-muted">Market Action</span> <strong style="color:${marketColor}">${marketLabel}</strong></div>
            
            <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
                <label class="small-muted">Split Execution (Candles)</label>
                <input id="stepCount" type="number" value="10" min="1" style="width: 100%; background: #0b1220; border: 1px solid #2a3441; color: white; padding: 8px; border-radius: 4px; margin-top: 5px;">
            </div>
            <button id="approveBtn" class="btn primary" style="margin-top: 15px;">Approve & Execute</button>
            <button id="declineBtn" class="btn danger">Decline & Refund</button>
        </div>
    `;

    document.getElementById('approveBtn').onclick = () => handleApprove(trade, user);
    document.getElementById('declineBtn').onclick = () => handleDecline(trade, user);
}

// admin.js - Locate renderLiveUI(user)

// admin.js - Update renderLiveUI
async function renderLiveUI(user) {
    statusTitle.innerText = user.trade_status ? "Execution Complete" : "Live Execution Active";

    const { data: chunks } = await supabase.from(ON_TRADE_TABLE).select('*').eq('uuid', user.uuid);
    const tradeAmt = parseFloat(user.last_trade_amt || 0);
    const pct = parseFloat(user.last_trade_pct || 0);
    const totalExpected = (tradeAmt + (tradeAmt * (pct / 100))).toFixed(2);
    const stepsLeft = chunks ? chunks.length : 0;
    const currentProfit = parseFloat(user.positive_value || 0).toFixed(2);

    const isNegative = parseFloat(currentProfit) < 0;
    const profitColor = isNegative ? '#ff6b6b' : '#06d6a0';
    const sign = isNegative ? '' : '+';
    const curr = user.currency || '$';

    mainContainer.innerHTML = `
        <div class="info-list">
            <div class="info-item"><span class="small-muted">Active Asset</span> <strong>${user.trading_asset || 'N/A'}</strong></div>
            <div class="info-item"><span class="small-muted">Active User</span> <strong>${user.login_ID}</strong></div>
            <div class="info-item"><span class="small-muted">Expected Sum</span> <strong style="color:var(--accent)">${curr}${totalExpected} (${pct}%)</strong></div>
            
            <div style="margin: 15px 0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                <div class="info-item"><span class="small-muted">Steps Remaining</span> <strong style="color:var(--accent)">${stepsLeft} Candles</strong></div>
                <div class="info-item"><span class="small-muted">Total Accrued Profit</span> <strong style="color:${profitColor}">${sign}${curr}${currentProfit}</strong></div>
            </div>

            ${!user.trade_status ? `
                <button id="closeTradeBtn" class="btn danger">Force Close & Refund User</button>
            ` : `
                <div style="text-align:center; padding:10px; color:#06d6a0; font-weight:bold; border:1px solid #06d6a0; border-radius:8px;">
                    Awaiting User Collection
                </div>
            `}
        </div>
    `;

    const closeBtn = document.getElementById('closeTradeBtn');
    if (closeBtn) closeBtn.onclick = () => handleCloseTrade(user);
}

async function handleApprove(trade, user) {
    const stepsInput = document.getElementById('stepCount');
    const steps = parseInt(stepsInput.value) || 10;

    // This is the total profit we need to reach across all steps
    const totalProfitTarget = trade.trade_amount * (trade.percent / 100);

    // --- RANDOMIZED SPLITTING LOGIC ---
    let impactChunks = [];

    if (steps === 1) {
        impactChunks.push(totalProfitTarget);
    } else {
        // 1. Generate N-1 random breakpoints
        let points = [];
        for (let i = 0; i < steps - 1; i++) {
            points.push(Math.random() * totalProfitTarget);
        }
        points.sort((a, b) => a - b);

        // 2. Calculate the "gaps" between these points to create random chunks
        let lastPoint = 0;
        for (let p of points) {
            impactChunks.push(p - lastPoint);
            lastPoint = p;
        }
        // Add the final remaining piece
        impactChunks.push(totalProfitTarget - lastPoint);
    }

    // 3. Optional: Add a tiny bit of "noise" while ensuring the total remains identical
    // We round to 4 decimals (as per your current impact logic)
    let runningSum = 0;
    const randomizedImpacts = impactChunks.map((amt, idx) => {
        if (idx === impactChunks.length - 1) {
            // Last step absorbs all rounding errors to ensure perfect math
            return parseFloat((totalProfitTarget - runningSum).toFixed(4));
        }
        const roundedAmt = parseFloat(amt.toFixed(4));
        runningSum += roundedAmt;
        return roundedAmt;
    });

    // --- MAP TO DATABASE OBJECTS ---
    const chunks = randomizedImpacts.map((impact, i) => ({
        uuid: user.uuid,
        step_id: i + 1,
        price_impact: impact, // Each step now has a unique, random-looking value
        market: trade.market,
        asset: trade.asset
    }));

    // --- DATABASE OPERATIONS ---
    // 1. Insert execution chunks
    await supabase.from(ON_TRADE_TABLE).insert(chunks);

    // 2. SET ONLY 'trade' TO TRUE
    const { error: userErr } = await supabase.from(USER_TABLE).update({
        trade: true,
        last_trade_amt: trade.trade_amount,
        last_trade_pct: trade.percent,
        trading_asset: trade.asset,
        positive_value: 0,
        negative_value: 0
    }).eq('uuid', user.uuid);

    if (userErr) return console.error('[DEBUG] USER_STATUS_UPDATE_ERROR:', userErr.message);

    // 3. Delete the request
    await supabase.from(REQUEST_TABLE).delete().eq('id', trade.id);

    refreshAdminView();
}

async function handleDecline(trade, user) {
    const { isConfirmed } = await Swal.fire({
        title: 'Decline & Refund?',
        text: "Funds will be returned to the user.",
        icon: 'warning',
        showCancelButton: true,
        background: '#0e1620',
        color: '#d7e6f3'
    });
    if (!isConfirmed) return;

    const newBalance = (parseFloat(user.account_balance) + parseFloat(trade.trade_amount)).toFixed(2);
    const { error: updErr } = await supabase.from(USER_TABLE).update({ account_balance: newBalance }).eq('uuid', user.uuid);
    if (updErr) return console.error('[DEBUG] DECLINE_REFUND_ERROR:', updErr.message);

    await supabase.from(REQUEST_TABLE).delete().eq('id', trade.id);
    refreshAdminView();
}

async function handleCloseTrade(user) {
    const { isConfirmed } = await Swal.fire({
        title: 'Force Stop & Refund?',
        text: "Returns original trade amount and ends execution.",
        icon: 'warning',
        showCancelButton: true,
        background: '#0e1620',
        color: '#d7e6f3'
    });

    if (!isConfirmed) return;

    const refundBalance = (parseFloat(user.account_balance) + parseFloat(user.last_trade_amt || 0)).toFixed(2);

    await supabase.from(ON_TRADE_TABLE).delete().eq('uuid', user.uuid);

    // RESET ONLY 'trade' TO FALSE
    const { error: userErr } = await supabase.from(USER_TABLE).update({
        trade: false,
        positive_value: 0,
        negative_value: 0,
        account_balance: refundBalance,
        last_trade_amt: 0,
        last_trade_pct: 0,
        trading_asset: null
    }).eq('uuid', user.uuid);

    if (userErr) return console.error('[DEBUG] FORCE_CLOSE_USER_ERROR:', userErr.message);

    refreshAdminView();
}

function initAdmin() {
    refreshAdminView();
    supabase.channel('admin-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: REQUEST_TABLE }, refreshAdminView)
        .on('postgres_changes', { event: '*', schema: 'public', table: USER_TABLE }, refreshAdminView)
        .on('postgres_changes', { event: '*', schema: 'public', table: ON_TRADE_TABLE }, refreshAdminView)
        .subscribe();
}

initAdmin();