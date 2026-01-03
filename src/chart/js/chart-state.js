/**
 * FULL FILE: chart-state.js
 * Logic: Memory-only container. No fallback data. Strict debugging.
 */
export let allChartData = {};
export let activeSymbol = localStorage.getItem('selected_asset') || 'BTC';
export let isLoaded = false;
export let config = { duration: 60000 };
export let cross = { x: 0, y: 0, visible: false };
export let hoveredCandle = null;

export function setLoaded(val) { isLoaded = val; }
export function setConfig(c) {
    if (c?.duration) {
        config.duration = parseInt(c.duration);
    } else {
        console.error("[DEBUG] STATE_ERROR: Invalid config received", c);
    }
}
export function setCrosshair(x, y, v) { cross.x = x; cross.y = y; cross.visible = v; }
export function setHoveredCandle(c) { hoveredCandle = c; }

export function ensureSymbolData(sym) {
    if (!allChartData[sym]) {
        allChartData[sym] = { candles: [], lastPrice: 0 };
    }
    return allChartData[sym];
}

export function getActiveData() {
    return allChartData[activeSymbol] || null;
}

export function getAllCandles() {
    const data = getActiveData();
    if (!data) {
        console.warn(`[DEBUG] STATE_WARN: No candle history for ${activeSymbol}`);
        return [];
    }
    return data.candles;
}

export function getCurrentCandle() {
    const c = getAllCandles();
    return c.length > 0 ? c[c.length - 1] : null;
}

export function setActiveSymbol(sym) {
    activeSymbol = sym;
    localStorage.setItem('selected_asset', sym);
}

/**
 * Logic: Updates the "Live" candle based on backend ticks.
 * If timestamps don't match, it logs a mismatch instead of guessing.
 */
// ... inside chart-state.js ...

export function syncFromSocket(marketData, serverStartTime) {
    const data = ensureSymbolData(activeSymbol);
    const sTime = Number(serverStartTime);

    if (!marketData || isNaN(sTime)) return;

    const candles = data.candles;
    const last = candles[candles.length - 1];

    // CLEANUP FIX: Added 500ms jitter tolerance to prevent candle duplication
    const isSameCandle = last && Math.abs(sTime - last.time) < 500;

    if (isSameCandle) {
        last.close = parseFloat(marketData.price);
        last.high = Math.max(last.high, parseFloat(marketData.price));
        last.low = Math.min(last.low, parseFloat(marketData.price));
    } else {
        // Only push if it's strictly newer and not a duplicate
        if (!last || sTime > last.time + 500) {
            candles.push({
                open: parseFloat(marketData.open),
                high: parseFloat(marketData.high),
                low: parseFloat(marketData.low),
                close: parseFloat(marketData.price),
                time: sTime
            });
            if (candles.length > 150) candles.shift();
        }
    }
    data.lastPrice = parseFloat(marketData.price);
}
/**
 * Logic: Finalizes a candle sent by the backend 'start_new_simulation' event.
 */
export function commitOfficialCandle(candle) {
    if (!candle) {
        console.error("[DEBUG] COMMIT_ERROR: No candle data provided");
        return;
    }
    const data = ensureSymbolData(candle.symbol);
    const timeMs = Number(candle.time);

    const formatted = {
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        time: timeMs
    };

    const idx = data.candles.findIndex(c => c.time === timeMs);
    if (idx !== -1) {
        data.candles[idx] = formatted;
    } else {
        console.log(`[DEBUG] NEW_CANDLE_ADDED: ${candle.symbol} @ ${timeMs}`);
        data.candles.push(formatted);
        if (data.candles.length > 150) data.candles.shift();
    }
}