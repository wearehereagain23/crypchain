/**
 * FULL FIXED FILE: src/js/chart-engine.js
 * Logic: Strictly matches the new Backend structure.
 */
import * as STATE from './chart-state.js';
import * as DRAW from './chart-drawing.js';
import { updateWatchData, refreshWatchUI, renderWatchlist } from './watchlist.js';

let socket = null;

export async function initChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    renderWatchlist();
    DRAW.fitCanvas(canvas);
    DRAW.setupCanvasEvents(canvas);

    // Initialize Socket
    socket = io();

    // 1. Initial Sync: Setup the chart memory
    socket.on('initial_sync', (data) => {
        if (!data || !data.history || !data.market) {
            console.error("[DEBUG] initial_sync: Missing data from server.");
            return;
        }

        STATE.setConfig(data.settings);

        Object.keys(data.history).forEach(sym => {
            const stateRef = STATE.ensureSymbolData(sym);
            // Ensure we only keep the last 150
            stateRef.candles = [...data.history[sym]].slice(-150);

            const m = data.market[sym];
            if (m) {
                updateWatchData(sym, m.price, m.open);
                if (sym === STATE.activeSymbol) {
                    STATE.syncFromSocket(m, m.candleStartTime);
                }
            }
        });

        STATE.setLoaded(true);
        refreshWatchUI();
        DRAW.scheduleDraw();
    });

    // 2. Ticks: The "Live" price movement
    socket.on('tick', (payload) => {
        if (!STATE.isLoaded || !payload.market) return;

        Object.keys(payload.market).forEach(sym => {
            const m = payload.market[sym];
            updateWatchData(sym, m.price, m.open);

            // Only update the active chart's drawing state
            if (sym === STATE.activeSymbol) {
                STATE.syncFromSocket(m, m.candleStartTime);
            }
        });

        refreshWatchUI();
        DRAW.scheduleDraw();
    });

    // 3. New Candle: Finalizing a period
    socket.on('start_new_simulation', (payload) => {
        if (!STATE.isLoaded || !payload.confirmedCandle) return;

        console.log(`[DEBUG] Period closed for ${payload.symbol}`);
        STATE.commitOfficialCandle(payload.confirmedCandle);
        DRAW.scheduleDraw();
    });
}

export async function setActiveSymbol(symbol) {
    if (!STATE.isLoaded || !symbol) return;
    STATE.setActiveSymbol(symbol);
    refreshWatchUI();
    DRAW.scheduleDraw();
}