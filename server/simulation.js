/**
 * FULL FIXED FILE: server/simulation.js
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

        if (!momentums[sym]) momentums[sym] = 0;

        const vol = m.price * 0.0015;
        momentums[sym] = (momentums[sym] * 0.85) + ((Math.random() - 0.5) * 0.4);
        let change = momentums[sym] * vol;

        const center = (min + max) / 2;
        change += (center - m.price) * 0.002;

        m.price += change;

        if (m.price <= min) { m.price = min; momentums[sym] = Math.abs(momentums[sym]); }
        if (m.price >= max) { m.price = max; momentums[sym] = -Math.abs(momentums[sym]); }
    });
}

module.exports = { runTick, resetMomentum };