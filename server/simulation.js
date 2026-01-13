/**
 * server/simulation.js
 * Logic: Imitating the "Realistic Walk" from your old index file.
 */
let momentums = {};

function resetMomentum() { momentums = {}; }

function runTick(market, dbRanges) {
    if (!Array.isArray(dbRanges)) return;

    Object.keys(market).forEach(sym => {
        const m = market[sym];
        const range = dbRanges.find(r => r.symbol === sym);
        if (!range || m.isTransitioning) return;

        const min = parseFloat(range.min_price);
        const max = parseFloat(range.max_price);

        // --- THE OLD PROJECT LOGIC ---
        // 1. High-frequency noise factor (from your index.html)
        const noiseStrength = 0.0018; // Increased slightly for better wicks
        const factor = 1 + (Math.random() - 0.5) * noiseStrength;

        // 2. Trend bias (replaces the old momentum)
        // This ensures it still follows the market direction but "shakes" while doing it
        if (!momentums[sym]) momentums[sym] = 0;
        momentums[sym] = (momentums[sym] * 0.8) + ((Math.random() - 0.5) * 0.5);
        const trend = 1 + (momentums[sym] * 0.0005);

        // Apply the change
        m.price = m.price * factor * trend;

        // 3. CENTER PULL (to keep it within your DB range)
        const center = (min + max) / 2;
        m.price += (center - m.price) * 0.001;

        // 4. WICK GENERATION (CRITICAL)
        // We update the peak high and peak low inside the tick
        if (m.price > m.high) m.high = m.price;
        if (m.price < m.low) m.low = m.price;

        // Range Boundaries
        if (m.price <= min) { m.price = min; momentums[sym] = Math.abs(momentums[sym]); }
        if (m.price >= max) { m.price = max; momentums[sym] = -Math.abs(momentums[sym]); }
    });
}

module.exports = { runTick, resetMomentum };