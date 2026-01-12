/**
 * FULL FIXED FILE: src/js/chart-engine.js
 * Logic: Strictly matches the new Backend structure.
 */
import * as STATE from './chart-state.js';
import * as DRAW from './chart-drawing.js';
import { updateWatchData, refreshWatchUI, renderWatchlist } from './watchlist.js';
import { checkSecurityIntegrity } from './notifications.js';

let socket = null;

/**
 * FULL REWRITE: initChart
 * Optimized for Render (Free Tier) + PWA Reconnection logic.
 */
export async function initChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    renderWatchlist();
    DRAW.fitCanvas(canvas);
    DRAW.setupCanvasEvents(canvas);

    // 1. Initialize Socket with Reconnection Settings
    // We add reconnection delay to prevent overwhelming the Render server
    socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    // 2. Initial Sync & Re-Sync Logic
    // This event fires on the first load AND every successful reconnection
    socket.on('initial_sync', (data) => {
        if (!data || !data.history || !data.market) {
            console.error("[DEBUG] Sync Error: Data packet incomplete.");
            return;
        }

        console.log(`[DEBUG] Terminal Synced. History: ${Object.keys(data.history).length} assets.`);
        STATE.setConfig(data.settings);

        Object.keys(data.history).forEach(sym => {
            const stateRef = STATE.ensureSymbolData(sym);

            // Sync history cache (limit to last 150 candles)
            stateRef.candles = [...data.history[sym]].slice(-150);

            const m = data.market[sym];
            if (m) {
                updateWatchData(sym, m.price, m.open);
                // If this is the asset we are currently viewing, update the active state
                if (sym === STATE.activeSymbol) {
                    STATE.syncFromSocket(m, m.candleStartTime);
                }
            }
        });

        STATE.setLoaded(true);
        refreshWatchUI();
        DRAW.scheduleDraw(); // Trigger a redraw now that we have data
    });

    // 3. Ticks: Real-time price updates
    socket.on('tick', (payload) => {
        if (!STATE.isLoaded || !payload.market) return;

        Object.keys(payload.market).forEach(sym => {
            const m = payload.market[sym];
            updateWatchData(sym, m.price, m.open);

            if (sym === STATE.activeSymbol) {
                STATE.syncFromSocket(m, m.candleStartTime);
            }
        });

        refreshWatchUI();
        DRAW.scheduleDraw();
    });

    // 4. New Candle: Finalizing the 1m/5m period
    socket.on('start_new_simulation', (payload) => {
        if (!STATE.isLoaded || !payload.confirmedCandle) return;

        console.log(`[DEBUG] Period Closed: ${payload.symbol}`);
        STATE.commitOfficialCandle(payload.confirmedCandle);
        DRAW.scheduleDraw();
    });

    // 5. Connection Status Monitoring (Optional but recommended for PWAs)
    socket.on('disconnect', (reason) => {
        console.warn(`[DEBUG] Connection Lost: ${reason}`);
        // Render free tier might disconnect you if inactive; UptimeRobot helps prevent this.
        if (reason === "io server disconnect") {
            socket.connect();
        }
    });

    socket.on('reconnect_attempt', () => {
        console.log("[DEBUG] Attempting to reconnect to Terminal Engine...");
    });

    setInterval(() => {
        checkSecurityIntegrity();
    }, 30000);
}

export async function setActiveSymbol(symbol) {
    if (!STATE.isLoaded || !symbol) return;
    STATE.setActiveSymbol(symbol);
    refreshWatchUI();
    DRAW.scheduleDraw();
}