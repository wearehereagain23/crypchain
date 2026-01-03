/**
 * FULL FILE: range.js
 * Matches DB: asset_range (symbol, min_price, max_price)
 */
import { supabase } from './supabase.js';

const assetSelect = document.getElementById('assetSelect');
const rangeMinInput = document.getElementById('customRangeMin');
const rangeMaxInput = document.getElementById('customRangeMax');
const saveRangeBtn = document.getElementById('saveRangeBtn');
const previewCanvas = document.getElementById('previewCanvas');
const metaRange = document.getElementById('metaRange');

const axisMax = document.getElementById('axisMax');
const axisMid = document.getElementById('axisMid');
const axisMin = document.getElementById('axisMin');

let history = [];
let previewPrice = 0;

async function refreshDisplay() {
    const symbol = assetSelect.value;
    const { data, error } = await supabase.from('asset_range').select('*').eq('symbol', symbol).maybeSingle();

    if (error) {
        console.error("[DEBUG] DB_FETCH_FAIL:", error.message);
        metaRange.innerText = "[ERROR] CONNECTION_LOST";
        return;
    }

    if (data) {
        rangeMinInput.value = data.min_price;
        rangeMaxInput.value = data.max_price;
        axisMax.innerText = parseFloat(data.max_price).toLocaleString();
        axisMin.innerText = parseFloat(data.min_price).toLocaleString();
        axisMid.innerText = ((parseFloat(data.max_price) + parseFloat(data.min_price)) / 2).toLocaleString();
        metaRange.innerText = `[CONNECTED] Asset: ${symbol} Active`;
        previewPrice = (parseFloat(data.min_price) + parseFloat(data.max_price)) / 2;
    }
}

function startAnimation() {
    const ctx = previewCanvas.getContext('2d');

    function animate() {
        const min = parseFloat(rangeMinInput.value);
        const max = parseFloat(rangeMaxInput.value);
        const rect = previewCanvas.getBoundingClientRect();
        previewCanvas.width = rect.width;
        previewCanvas.height = rect.height;

        if (!isNaN(min) && !isNaN(max) && max > min) {
            const range = max - min;
            const oldPrice = previewPrice;

            // Simulation
            previewPrice += (Math.random() - 0.5) * (range * 0.015);
            if (previewPrice > max) previewPrice = max;
            if (previewPrice < min) previewPrice = min;

            const isUp = previewPrice >= oldPrice;
            const themeColor = isUp ? '#06d6a0' : '#ef4444';

            history.push({ p: previewPrice, color: themeColor });
            if (history.length > 70) history.shift();

            ctx.clearRect(0, 0, rect.width, rect.height);

            // Draw Area Glow
            const grad = ctx.createLinearGradient(0, 0, 0, rect.height);
            grad.addColorStop(0, isUp ? 'rgba(6, 214, 160, 0.2)' : 'rgba(239, 68, 68, 0.2)');
            grad.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(0, rect.height);
            history.forEach((pt, i) => {
                const x = (i / 70) * (rect.width - 80);
                const y = rect.height - ((pt.p - min) / range) * rect.height;
                ctx.lineTo(x, y);
            });
            ctx.lineTo((history.length - 1) / 70 * (rect.width - 80), rect.height);
            ctx.fillStyle = grad;
            ctx.fill();

            // Draw Neon Stroke
            ctx.beginPath();
            ctx.strokeStyle = themeColor;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = themeColor;
            history.forEach((pt, i) => {
                const x = (i / 70) * (rect.width - 80);
                const y = rect.height - ((pt.p - min) / range) * rect.height;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Tracking Head
            const lastY = rect.height - ((previewPrice - min) / range) * rect.height;
            const lastX = (history.length - 1) / 70 * (rect.width - 80);

            ctx.fillStyle = themeColor;
            ctx.beginPath();
            ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
            ctx.fill();

            // Price Terminal Box
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = themeColor;
            ctx.fillRect(rect.width - 75, lastY - 10, 70, 20);
            ctx.strokeRect(rect.width - 75, lastY - 10, 70, 20);
            ctx.fillStyle = themeColor;
            ctx.font = 'bold 10px monospace';
            ctx.fillText(previewPrice.toFixed(2), rect.width - 70, lastY + 4);
        }
        requestAnimationFrame(animate);
    }
    animate();
}

saveRangeBtn.addEventListener('click', async () => {
    const symbol = assetSelect.value;
    const min = parseFloat(rangeMinInput.value);
    const max = parseFloat(rangeMaxInput.value);

    const { error } = await supabase.from('asset_range').upsert({
        symbol,
        min_price: min,
        max_price: max
    }, { onConflict: 'symbol' });

    if (error) {
        Swal.fire({ title: 'LOCK_FAILED', text: error.message, icon: 'error', background: '#0b1120', color: '#ef4444' });
    } else {
        Swal.fire({ title: 'BOUNDARY_LOCKED', icon: 'success', background: '#0b1120', color: '#06d6a0', timer: 1500 });
        refreshDisplay();
    }
});

assetSelect.addEventListener('change', () => { history = []; refreshDisplay(); });
refreshDisplay();
startAnimation();