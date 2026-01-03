/**
 * FULL FIXED FILE: market.js
 * Logic: Detailed Trade UI with Asset Full Names, Dynamic Currency, and Realtime Sync.
 * REMOVED: All dependencies on chart_control.trade.
 * PATH: Uses user_profiles.trade_status for individual trade state.
 */
import { initNavigation } from './nav.js';
import { supabase } from './chart.supabase.js';
import { USER_TABLE, REQUEST_TABLE } from '../../config.js'; // Removed CONTROL_TABLE import

const LEVEL_TABLE = 'account_level';

// Asset List with Full Names
const ASSETS = [
    { sym: "BTC", name: "Bitcoin" },
    { sym: "ETH", name: "Ethereum" },
    { sym: "SOL", name: "Solana" },
    { sym: "BNB", name: "Binance Coin" },
    { sym: "XRP", name: "Ripple" },
    { sym: "ADA", name: "Cardano" },
    { sym: "MATIC", name: "Polygon" },
    { sym: "DOT", name: "Polkadot" },
    { sym: "LTC", name: "Litecoin" },
    { sym: "AVAX", name: "Avalanche" },
    { sym: "LINK", name: "Chainlink" },
    { sym: "SHIB", name: "Shiba Inu" }
];

const getUrlUserId = () => new URLSearchParams(window.location.search).get('user_id');


export async function startMarket() {
    const urlId = getUrlUserId();
    const savedLoginId = localStorage.getItem('login_ID');
    if (!urlId || !savedLoginId) { window.location.href = '../login.html'; return; }

    const { data: user, error } = await supabase.from(USER_TABLE).select('*').eq('login_ID', savedLoginId).single();
    if (error || !user) { localStorage.clear(); window.location.href = '../login.html'; return; }

    initNavigation();
    updateUI(user);
    setupRealtimeListeners(urlId, savedLoginId);

    const aiBtn = document.getElementById('aiAssistBtn');
    if (aiBtn) {
        aiBtn.onclick = () => { if (!aiBtn.disabled) openSetupForm(urlId, savedLoginId); };
    }
}


export function updateUI(user) {
    const levelEl = document.getElementById('marketLevel');
    const balanceEl = document.getElementById('marketBalance');
    const currency = user.currency || '$';

    if (balanceEl) {
        const bal = parseFloat(user.account_balance) || 0;
        balanceEl.textContent = `${currency}${bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }

    // --- RULE 1: 'trade' controls the "Awaiting/Active" UI section ---
    const aiBtn = document.getElementById('aiAssistBtn');
    if (aiBtn) {
        // If trade is true, we hide or disable the setup button
        aiBtn.style.display = user.trade ? 'none' : 'flex';
    }

    if (levelEl) {
        // If user.account_level is missing, default to 'STARTER'
        const levelName = user.account_level || 'starter';
        levelEl.textContent = levelName.toUpperCase();
        console.log("[DEBUG] UI Level set to:", levelName);
    }

    // Accrued profit row only shows if engine is running (trade = true)
    toggleAccruedProfitRow(user.trade, user);

    // Check pending requests or show active details based on 'trade'
    checkPendingStatus(user.uuid, user);

    // --- RULE 2: 'trade_status' controls the "Collection" UI section ---
    toggleLiveTradeProfitUI(user);
}




// market.js - Refactor toggleAccruedProfitRow
function toggleAccruedProfitRow(isTradeActive, user) {
    let row = document.querySelector('.accrued-profit-row');

    if (!isTradeActive) {
        if (row) row.remove();
        return;
    }

    const valPos = parseFloat(user.positive_value || 0);
    const netProfit = valPos.toFixed(2);
    const isNegative = parseFloat(netProfit) < 0;
    const color = isNegative ? '#ff6b6b' : '#06d6a0';
    const sign = isNegative ? '' : '+';
    const currency = user.currency || '$';

    // If row exists, just update content to prevent flickering
    if (row) {
        const valueEl = row.querySelector('.row-value');
        if (valueEl) {
            valueEl.style.color = color;
            valueEl.textContent = `${currency}${sign}${netProfit}`;
        }
    } else {
        // Create it only once
        const html = `
            <div class="market-row accrued-profit-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--glass);">
                <span class="row-label">Total Accrued Profit</span>
                <span class="row-value" style="color:${color}; font-weight: bold;">${currency}${sign}${netProfit}</span>
            </div>
        `;
        const levelRow = document.getElementById('marketLevel')?.closest('.market-row');
        if (levelRow) levelRow.insertAdjacentHTML('afterend', html);
    }
}

async function checkPendingStatus(uuid, userRecord = null) {
    const { data: pendingData, error } = await supabase
        .from(REQUEST_TABLE)
        .select('*')
        .eq('uuid', uuid)
        .maybeSingle();

    if (error) {
        console.error("[DEBUG] PENDING_STATUS_FETCH_ERROR:", error.message);
        return;
    }

    const currency = userRecord?.currency || '$';

    if (pendingData) {
        renderTradeDetailsUI(pendingData.trade_amount, pendingData.percent, pendingData.asset, "AI analyzing chart, please wait...", currency);
    }
    else if (userRecord && userRecord.last_trade_amt > 0) {
        renderTradeDetailsUI(userRecord.last_trade_amt, userRecord.last_trade_pct, userRecord.trading_asset, "Trade Active", currency);
    }
    else {
        resetTradeUI();
    }
}

function renderTradeDetailsUI(amt, pct, asset, statusLabel, currency) {
    const aiBtn = document.getElementById('aiAssistBtn');
    const description = document.getElementById('aiDescription');
    document.querySelectorAll('.pending-row').forEach(el => el.remove());

    if (aiBtn) {
        aiBtn.disabled = true;
        aiBtn.innerHTML = `<i class="ph ph-hourglass-high"></i> ${statusLabel}...`;
        aiBtn.style.opacity = "0.6";
    }
    if (description) description.style.display = 'none';

    const amount = parseFloat(amt) || 0;
    const percent = parseFloat(pct) || 0;
    const profit = (amount * (percent / 100)).toFixed(2);
    const total = (amount + parseFloat(profit)).toFixed(2);

    const html = `
        <div class="market-row pending-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--glass);">
            <span class="row-label">Trading Asset</span>
            <span class="row-value" style="color:#fff; font-weight: bold;">${asset || 'N/A'}</span>
        </div>
        <div class="market-row pending-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--glass);">
            <span class="row-label">Amount / Target</span>
            <span class="row-value" style="color:#7c5cff">${currency}${amount.toFixed(2)} (+${percent}%)</span>
        </div>
        <div class="market-row pending-row" style="background: rgba(124, 92, 255, 0.05); margin: 10px -24px 0 -24px; padding: 14px 24px; display: flex; justify-content: space-between;">
            <span class="row-label" style="color: #fff">Est. Return</span>
            <span class="row-value" style="color: #fff; font-size: 16px; font-weight: bold;">${currency}${parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
    `;

    const levelRow = document.getElementById('marketLevel')?.closest('.market-row');
    if (levelRow) levelRow.insertAdjacentHTML('afterend', html);
}

function resetTradeUI() {
    const aiBtn = document.getElementById('aiAssistBtn');
    const description = document.getElementById('aiDescription');
    document.querySelectorAll('.pending-row').forEach(el => el.remove());
    document.querySelectorAll('.accrued-profit-row').forEach(el => el.remove());

    if (aiBtn) {
        aiBtn.disabled = false;
        aiBtn.innerHTML = `<i class="ph ph-robot"></i> Trade with AI Assist`;
        aiBtn.style.opacity = "1";
        aiBtn.style.display = 'flex';
    }
    if (description) description.style.display = 'block';
}


function toggleLiveTradeProfitUI(user) {
    document.querySelectorAll('.live-trade-row').forEach(el => el.remove());

    // This section ONLY appears when backend flips trade_status to true
    if (user.trade_status === true) {
        const html = `
            <div class="action-area live-trade-row" style="margin-top: 10px;">
                <button class="primary-btn" id="collectProfitBtn" style="background:#06d6a0; color: #0b1220;">
                    <i class="ph ph-hand-coins"></i> Collect & Close Trade
                </button>
            </div>
        `;
        const container = document.querySelector('.action-area');
        if (container) container.insertAdjacentHTML('beforeend', html);
        const btn = document.getElementById('collectProfitBtn');
        if (btn) btn.onclick = () => handleCollectProfit(user);
    }
}



/**
 * market.js - Final Collection Logic
 */
async function handleCollectProfit(user) {
    // 1. Convert all values to Numbers to ensure precision
    const currentBalance = parseFloat(user.account_balance || 0);
    const stake = parseFloat(user.last_trade_amt || 0);
    const profit = parseFloat(user.positive_value || 0);

    // 2. The Final Calculation: Stake + Profit + Wallet
    const finalBalance = (currentBalance + stake + profit).toFixed(2);

    Swal.fire({
        title: 'Collecting...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        background: '#0e1620',
        color: '#d7e6f3'
    });

    try {
        // 3. Update User Profile and Reset Trade Fields
        const { error } = await supabase.from(USER_TABLE).update({
            account_balance: finalBalance,
            positive_value: 0,
            negative_value: 0,
            last_trade_amt: 0,
            last_trade_pct: 0,
            trading_asset: null,
            trade: false,           // Set to false to allow new setup
            trade_status: false     // Reset status
        }).eq('uuid', user.uuid);

        if (error) throw error;

        Swal.fire({
            title: 'Success!',
            text: `Received: ${user.currency || '$'}${(stake + profit).toFixed(2)}`,
            icon: 'success',
            background: '#0e1620',
            color: '#d7e6f3'
        });

    } catch (err) {
        console.error("[DEBUG] COLLECT_ERROR:", err.message);
        Swal.fire({ title: 'Error', text: 'Failed to collect funds', icon: 'error', background: '#0e1620', color: '#d7e6f3' });
    }
}

function setupRealtimeListeners(uuid, loginId) {
    supabase.channel('market-main-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: USER_TABLE, filter: `uuid=eq.${uuid}` }, (payload) => {
            updateUI(payload.new);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: REQUEST_TABLE }, (payload) => {
            const isTarget = (payload.new && payload.new.uuid === uuid) || (payload.old && payload.old.uuid === uuid);
            if (isTarget || payload.eventType === 'DELETE') {
                supabase.from(USER_TABLE).select('*').eq('uuid', uuid).single().then(({ data, error }) => {
                    if (error) return console.error("[DEBUG] REALTIME_USER_FETCH_ERROR:", error.message);
                    checkPendingStatus(uuid, data);
                });
            }
        })
        .subscribe();
}

async function openSetupForm(uuid, loginId) {
    const { data: levels, error: lErr } = await supabase.from(LEVEL_TABLE).select('*').limit(1).single();
    const { data: user, error: uErr } = await supabase.from(USER_TABLE).select('*').eq('login_ID', loginId).single();

    if (lErr || uErr) {
        console.error("[DEBUG] SETUP_FORM_FETCH_ERROR:", lErr?.message || uErr?.message);
        return;
    }

    const curr = user.currency || '$';
    const order = ['starter', 'mini', 'silver', 'gold', 'platinum'];
    const userIndex = order.indexOf((user.account_level || 'starter').toLowerCase());

    const assetOptions = ASSETS.map(a => `<option value="${a.sym}">${a.sym} / ${a.name}</option>`).join('');
    const levelOptions = order.map((lv, i) => `<option value="${levels[lv]}" ${i > userIndex ? 'disabled' : ''}>${lv.toUpperCase()} — ${levels[lv]}%</option>`).join('');

    await Swal.fire({
        title: 'Set up AI Trade',
        background: '#0e1620',
        color: '#d7e6f3',
        showConfirmButton: false,
        showCloseButton: true,
        html: `
            <div style="text-align:left; padding: 0 10px;">
                <label style="font-size:11px; color:#9aa4b2;">Select Asset</label>
                <select id="swAsset" class="swal2-select" style="width:100%; color:white; background:#0b1220; border:1px solid #2a3441; margin: 8px 0;">${assetOptions}</select>
                
                <label style="font-size:11px; color:#9aa4b2; margin-top:10px; display:block;">Trade Amount (${curr})</label>
                <input id="swAmount" class="swal2-input" type="number" min="50" style="color:white; background:#0b1220; border:1px solid #2a3441; width: 100%; margin: 8px 0;">
                
                <label style="font-size:11px; color:#9aa4b2; margin-top:10px; display:block;">Profit Target</label>
                <select id="swPct" class="swal2-select" style="width:100%; color:white; background:#0b1220; border:1px solid #2a3441; margin: 8px 0;">${levelOptions}</select>
                
                <div id="estTotal" style="margin-top:15px; text-align:center; font-size:20px; font-weight:bold; color:#7c5cff;">${curr}0.00</div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="btnBuy" class="swal2-confirm swal2-styled" style="flex:1; background-color:#06d6a0; border:none; padding:12px; border-radius:6px; font-weight:bold; color:white;">BUY</button>
                    <button id="btnSell" class="swal2-confirm swal2-styled" style="flex:1; background-color:#ff6b6b; border:none; padding:12px; border-radius:6px; font-weight:bold; color:white;">SELL</button>
                </div>
            </div>`,
        didOpen: () => {
            const amtIn = document.getElementById('swAmount');
            const pctIn = document.getElementById('swPct');
            const calc = () => {
                const amount = parseFloat(amtIn.value) || 0;
                const percent = parseFloat(pctIn.value) || 0;
                document.getElementById('estTotal').textContent = `${curr}${(amount * (1 + percent / 100)).toFixed(2)}`;
            };
            amtIn.oninput = calc;
            pctIn.onchange = calc;
            document.getElementById('btnBuy').onclick = () => processTrade('green', amtIn.value, pctIn.value, document.getElementById('swAsset').value, user.account_balance, uuid, loginId);
            document.getElementById('btnSell').onclick = () => processTrade('red', amtIn.value, pctIn.value, document.getElementById('swAsset').value, user.account_balance, uuid, loginId);
        }
    });
}

async function processTrade(marketColor, amountStr, pctStr, asset, balance, uuid, loginId) {
    const amt = parseFloat(amountStr);
    const currentBalance = parseFloat(balance) || 0;

    if (!amt || amt < 50 || amt > currentBalance) {
        return Swal.showValidationMessage('Invalid amount or Insufficient balance');
    }

    Swal.fire({ title: 'Submitting...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#0e1620', color: '#d7e6f3' });

    try {
        const { error: insErr } = await supabase.from(REQUEST_TABLE).insert([{
            uuid: uuid,
            trade_amount: amt,
            market: marketColor,
            percent: parseFloat(pctStr),
            asset: asset.toUpperCase()
        }]);
        if (insErr) throw insErr;

        const newBalance = (currentBalance - amt).toFixed(2);
        const { error: updErr } = await supabase.from(USER_TABLE).update({ account_balance: newBalance }).eq('login_ID', loginId);
        if (updErr) throw updErr;

        Swal.fire({ title: 'Submitted', text: 'Request submitted, wait for AI to analyze market before joining', icon: 'success', background: '#0e1620', color: '#d7e6f3' });
    } catch (err) {
        console.error("[DEBUG] PROCESS_TRADE_ERROR:", err.message);
        Swal.fire({ title: 'Error', text: err.message, icon: 'error', background: '#0e1620', color: '#d7e6f3' });
    }
}