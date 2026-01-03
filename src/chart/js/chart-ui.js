/**
 * FULL FILE: chart-ui.js
 * Logic: Handles all visual UI overlays (Header, Axis Labels, Crosshair Tags).
 */
import * as STATE from './chart-state.js';

const PRICE_TAG_W = 75;
const TIME_TAG_W = 80;

export function drawOHLCHeader(ctx, currentCandle, candles) {
    const candleToDisplay = STATE.hoveredCandle || currentCandle || candles[candles.length - 1];
    if (!candleToDisplay) return;

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px Inter, Arial, sans-serif';
    const isBullish = candleToDisplay.close >= candleToDisplay.open;
    const color = isBullish ? '#06d6a0' : '#ff6b6b';

    let currentX = 20;
    const baselineY = 25;

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${STATE.activeSymbol} | `, currentX, baselineY);
    currentX += ctx.measureText(`${STATE.activeSymbol} | `).width;

    const parts = [
        { label: 'O:', val: candleToDisplay.open.toFixed(2), col: color },
        { label: 'H:', val: candleToDisplay.high.toFixed(2), col: '#06d6a0' },
        { label: 'L:', val: candleToDisplay.low.toFixed(2), col: '#ff6b6b' },
        { label: 'C:', val: candleToDisplay.close.toFixed(2), col: color }
    ];

    parts.forEach(p => {
        ctx.fillStyle = '#9aa4b2';
        ctx.fillText(p.label, currentX, baselineY);
        currentX += ctx.measureText(p.label).width;
        ctx.fillStyle = p.col;
        ctx.fillText(p.val, currentX, baselineY);
        currentX += ctx.measureText(p.val).width + 10;
    });
}

export function drawYAxisLabels(ctx, yMin, yMax, TAG_START_X, yOf) {
    ctx.fillStyle = '#9aa4b2';
    ctx.font = '12px "Roboto Mono", monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 6; i++) {
        const p = yMin + ((yMax - yMin) / 6) * i;
        ctx.fillText(p.toFixed(2), TAG_START_X + 5, yOf(p) + 4);
    }
}

export function drawXAxisLabels(ctx, candles, leftMargin, slot, h) {
    ctx.fillStyle = '#9aa4b2';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(candles.length / 6));
    candles.forEach((c, i) => {
        if (i % step === 0) {
            const x = leftMargin + i * slot + slot / 2;
            ctx.fillText(new Date(c.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x, h - 10);
        }
    });
}

export function drawInteraction(ctx, candles, yMin, yMax, top, bottom, leftMargin, TAG_START_X, chartHeight, slot, h) {
    if (STATE.cross.x === null || STATE.cross.y === null || STATE.cross.x >= TAG_START_X) {
        STATE.setHoveredCandle(null);
        return;
    }

    const priceAtY = yMax - ((STATE.cross.y - top) / chartHeight) * (yMax - yMin);

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(STATE.cross.x, top); ctx.lineTo(STATE.cross.x, bottom);
    ctx.moveTo(leftMargin, STATE.cross.y); ctx.lineTo(TAG_START_X, STATE.cross.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price Tag (Right)
    ctx.fillStyle = '#363c4e';
    ctx.fillRect(TAG_START_X, STATE.cross.y - 10, PRICE_TAG_W, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(priceAtY.toFixed(2), TAG_START_X + (PRICE_TAG_W / 2), STATE.cross.y + 4);

    // Time Tag (Bottom)
    const idx = Math.round((STATE.cross.x - leftMargin) / slot);
    if (idx >= 0 && idx < candles.length) {
        const timeStr = new Date(candles[idx].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        ctx.fillStyle = '#363c4e';
        ctx.fillRect(STATE.cross.x - (TIME_TAG_W / 2), bottom, TIME_TAG_W, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(timeStr, STATE.cross.x, bottom + 14);
        STATE.setHoveredCandle(candles[idx]);
    }
}