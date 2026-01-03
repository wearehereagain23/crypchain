/**
 * FULL FIXED FILE: chart-drawing.js
 * Logic: Drawing Engine. Uses strict STATE exports.
 */
import * as STATE from './chart-state.js';
import * as UI from './chart-ui.js';

let canvas = null;
let ctx = null;
let rafId = null;
let scheduled = false;

const PRICE_TAG_W = 75;

export function fitCanvas(c) {
    if (!c) {
        console.error("[DEBUG] DRAW_ERROR: Canvas element is missing.");
        return;
    }
    canvas = c;
    ctx = canvas.getContext('2d');

    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    scheduleDraw();
}

export function scheduleDraw() {
    if (scheduled) return;
    scheduled = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
        scheduled = false;
        drawChart();
    });
}

function drawChart() {
    if (!canvas || !ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const candles = STATE.getAllCandles();
    const currentCandle = STATE.getCurrentCandle(); // Now correctly exported
    const stateData = STATE.getActiveData();

    if (!candles || candles.length === 0) {
        // No debug log here to avoid console spamming before data arrives
        return;
    }

    const top = 50;
    const bottom = h - 40;
    const leftMargin = 20;
    const TAG_START_X = w - PRICE_TAG_W;
    const chartHeight = bottom - top;

    const prices = candles.flatMap(c => [c.high, c.low]).filter(p => isFinite(p) && p > 0);
    if (prices.length === 0) return;

    const maxP = Math.max(...prices);
    const minP = Math.min(...prices);
    const range = maxP - minP;
    const padding = range === 0 ? maxP * 0.05 : range * 0.15;
    const yMax = maxP + padding;
    const yMin = minP - padding;

    const yOf = (p) => top + ((yMax - p) / (yMax - yMin)) * chartHeight;

    // 1. Header
    UI.drawOHLCHeader(ctx, currentCandle, candles);

    // 2. Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = top; y <= bottom; y += 60) {
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(TAG_START_X, y);
        ctx.stroke();
    }

    // 3. Y Axis Labels
    UI.drawYAxisLabels(ctx, yMin, yMax, TAG_START_X, yOf);

    // 4. Candles
    const count = candles.length;
    const availableWidth = TAG_START_X - leftMargin - 10;
    const slot = availableWidth / Math.max(count, 20);
    const candleW = Math.max(2, slot * 0.7);

    candles.forEach((c, i) => {
        const x = leftMargin + i * slot + (slot - candleW) / 2;
        const color = c.close >= c.open ? '#06d6a0' : '#ff6b6b';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        ctx.beginPath();
        ctx.moveTo(x + candleW / 2, yOf(c.high));
        ctx.lineTo(x + candleW / 2, yOf(c.low));
        ctx.stroke();

        const bTop = yOf(Math.max(c.open, c.close));
        const bBottom = yOf(Math.min(c.open, c.close));
        ctx.fillRect(x, bTop, candleW, Math.max(1, bBottom - bTop));
    });

    // 5. Live Price Line
    const lastPrice = stateData?.lastPrice;
    if (lastPrice && currentCandle) {
        const yLast = yOf(lastPrice);
        const color = currentCandle.close >= currentCandle.open ? '#06d6a0' : '#ff6b6b';

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(leftMargin, yLast);
        ctx.lineTo(TAG_START_X, yLast);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.fillRect(TAG_START_X, yLast - 10, PRICE_TAG_W, 20);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(lastPrice.toFixed(2), TAG_START_X + PRICE_TAG_W / 2, yLast + 4);
    }

    // 6. X Axis & Interaction
    UI.drawXAxisLabels(ctx, candles, leftMargin, slot, h);
    UI.drawInteraction(ctx, candles, yMin, yMax, top, bottom, leftMargin, TAG_START_X, chartHeight, slot, h);
}

export function setupCanvasEvents(c) {
    if (!c) {
        console.error("[DEBUG] EVENT_SETUP_FAIL: Canvas missing");
        return;
    }
    canvas = c;
    canvas.addEventListener('mousemove', e => {
        const r = canvas.getBoundingClientRect();
        STATE.setCrosshair(e.clientX - r.left, e.clientY - r.top, true);
        scheduleDraw();
    });
    canvas.addEventListener('mouseleave', () => {
        STATE.setCrosshair(null, null, false);
        scheduleDraw();
    });
}