/**
 * FULL FIXED FILE: watchlist.js
 */
import { setActiveSymbol } from './chart-engine.js';
import * as STATE from './chart-state.js';

export const WATCH = [
    { sym: 'BTC', name: 'Bitcoin', price: null, change: 0, basePrice: null, file: './assets/logos/btc.png' },
    { sym: 'ETH', name: 'Ethereum', price: null, change: 0, basePrice: null, file: './assets/logos/eth.png' },
    { sym: 'BNB', name: 'Binance Coin', price: null, change: 0, basePrice: null, file: './assets/logos/bnb.png' },
    { sym: 'SOL', name: 'Solana', price: null, change: 0, basePrice: null, file: './assets/logos/sol.png' },
    { sym: 'ADA', name: 'Cardano', price: null, change: 0, basePrice: null, file: './assets/logos/ada.png' },
    { sym: 'XRP', name: 'Ripple', price: null, change: 0, basePrice: null, file: './assets/logos/xrp.png' },
    { sym: 'DOGE', name: 'Dogecoin', price: null, change: 0, basePrice: null, file: './assets/logos/doge.png' },
    { sym: 'MATIC', name: 'Polygon', price: null, change: 0, basePrice: null, file: './assets/logos/matic.png' },
    { sym: 'TRX', name: 'TRON', price: null, change: 0, basePrice: null, file: './assets/logos/trx.png' },
    { sym: 'LTC', name: 'Litecoin', price: null, change: 0, basePrice: null, file: './assets/logos/ltc.png' },
    { sym: 'DOT', name: 'Polkadot', price: null, change: 0, basePrice: null, file: './assets/logos/dot.png' },
    { sym: 'AVAX', name: 'Avalanche', price: null, change: 0, basePrice: null, file: './assets/logos/avax.png' }
];

export function renderWatchlist() {
    const wlContainer = document.getElementById('watchlistItems');
    if (!wlContainer) return;
    wlContainer.innerHTML = '';

    const currentSym = STATE.activeSymbol;

    WATCH.forEach(w => {
        const row = document.createElement('div');
        row.id = `row_${w.sym}`;
        row.className = `watchlist-item ${w.sym === currentSym ? 'active' : ''}`;
        row.onclick = () => {
            document.querySelectorAll('.watchlist-item').forEach(el => el.classList.remove('active'));
            row.classList.add('active');
            window.changeSymbol(w.sym);
        };

        row.innerHTML = `
            <div class="wl-left">
                <div class="wl-logo"><img src="${w.file}" onerror="this.src='https://via.placeholder.com/24'"></div>
                <div class="wl-symbol">${w.sym}</div>
            </div>
            <div class="wl-right">
                <div class="wl-price" id="p_${w.sym}">---</div>
                <div class="wl-change" id="c_${w.sym}">0.00%</div>
            </div>`;
        wlContainer.appendChild(row);
    });
}

export function updateWatchData(symbol, newPrice, openPrice) {
    const asset = WATCH.find(a => a.sym === symbol);
    if (!asset) return;
    asset.price = newPrice;
    if (openPrice) asset.basePrice = openPrice;
    if (asset.basePrice) {
        asset.change = ((newPrice - asset.basePrice) / asset.basePrice) * 100;
    }
}

export function refreshWatchUI() {
    WATCH.forEach(w => {
        const pEl = document.getElementById('p_' + w.sym);
        const cEl = document.getElementById('c_' + w.sym);
        if (!pEl || !cEl || w.price === null) return;

        const isBullish = w.change >= 0;
        const color = isBullish ? '#06d6a0' : '#ff6b6b';

        pEl.textContent = w.price.toFixed(w.price >= 100 ? 2 : 4);
        cEl.textContent = (isBullish ? '+' : '') + w.change.toFixed(2) + '%';
        cEl.style.color = color;
    });
}