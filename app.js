/**
 * FULL FILE: app.js
 * Logic: VPS Simulation Engine with Real-Time Speed, Duration, and Range Sync.
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const { runTick, resetMomentum } = require('./server/simulation.js');
const processTradeLogic = require('./server/tradeEngine.js');
const { notifyTrade } = require('./server/notificationEngine.js'); // ADDED IMPORT

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.static(path.join(__dirname, 'src')));

// CONFIG & STATE
let activeSettings = { duration: 60000, speed: 1000 };
let mainLoop = null;
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'MATIC', 'ADA', 'LTC', 'TRX', 'DOT', 'AVAX'];
const LIVE_MARKET = {};
const HISTORY_CACHE = {};
let RANGE_STATE = {};

async function syncGlobalConfigs() {
    const { data: ctrl, error: ctrlErr } = await supabase.from('chart_control').select('*').eq('id', 1).single();
    if (!ctrlErr && ctrl) {
        const newSpeed = parseInt(ctrl.speed);
        const newDuration = parseInt(ctrl.duration);
        if (newSpeed !== activeSettings.speed) {
            console.log(`[DEBUG] SPEED_CHANGE: Adjusting heartbeat to ${newSpeed}ms`);
            activeSettings.speed = newSpeed;
            restartHeartbeat();
        }
        activeSettings.duration = newDuration;
    }

    const { data: allRanges, error: rangeErr } = await supabase.from('asset_range').select('*');
    if (rangeErr || !allRanges) return;

    allRanges.forEach(row => {
        if (!SYMBOLS.includes(row.symbol)) return;
        const targetMin = parseFloat(row.min_price);
        const targetMax = parseFloat(row.max_price);
        if (!RANGE_STATE[row.symbol]) {
            RANGE_STATE[row.symbol] = { currentMin: targetMin, currentMax: targetMax, targetMin, targetMax };
            const startPrice = (targetMin + targetMax) / 2;
            LIVE_MARKET[row.symbol] = {
                price: startPrice, open: startPrice, high: startPrice, low: startPrice,
                candleStartTime: Math.floor(Date.now() / activeSettings.duration) * activeSettings.duration,
                isTransitioning: false
            };
            HISTORY_CACHE[row.symbol] = [];
        } else {
            RANGE_STATE[row.symbol].targetMin = targetMin;
            RANGE_STATE[row.symbol].targetMax = targetMax;
        }
    });
}

function generateInitialHistory() {
    SYMBOLS.forEach(sym => {
        const m = LIVE_MARKET[sym];
        const range = RANGE_STATE[sym];
        if (!m || !range) return;
        HISTORY_CACHE[sym] = [];
        let virtualTime = Date.now() - (150 * activeSettings.duration);
        for (let i = 0; i < 150; i++) {
            const candleOpen = m.price;
            let candleHigh = m.price;
            let candleLow = m.price;
            for (let t = 0; t < 10; t++) {
                runTick({ [sym]: m }, [{ symbol: sym, min_price: range.currentMin, max_price: range.currentMax }]);
                candleHigh = Math.max(candleHigh, m.price);
                candleLow = Math.min(candleLow, m.price);
            }
            HISTORY_CACHE[sym].push({
                symbol: sym, open: candleOpen, high: candleHigh, low: candleLow, close: m.price,
                time: Math.floor(virtualTime / activeSettings.duration) * activeSettings.duration
            });
            virtualTime += activeSettings.duration;
        }
        m.candleStartTime = Math.floor(Date.now() / activeSettings.duration) * activeSettings.duration;
        m.open = m.high = m.low = m.price;
    });
}

function updateBoundaryDrift() {
    const driftSpeed = 0.01;
    Object.keys(RANGE_STATE).forEach(sym => {
        const r = RANGE_STATE[sym];
        r.currentMin += (r.targetMin - r.currentMin) * driftSpeed;
        r.currentMax += (r.targetMax - r.currentMax) * driftSpeed;
    });
}

function restartHeartbeat() {
    if (mainLoop) clearInterval(mainLoop);
    mainLoop = setInterval(() => {
        updateBoundaryDrift();
        const simLimits = Object.keys(RANGE_STATE).map(sym => ({
            symbol: sym,
            min_price: RANGE_STATE[sym].currentMin,
            max_price: RANGE_STATE[sym].currentMax
        }));

        // 1. RUN THE SIMULATION
        // The simulation.js now updates m.high and m.low internally
        runTick(LIVE_MARKET, simLimits);

        const now = Date.now();
        SYMBOLS.forEach((sym, i) => {
            const m = LIVE_MARKET[sym];
            if (!m || m.isTransitioning) return;

            // 2. CRITICAL CHANGE: 
            // We NO LONGER just check m.price. 
            // We trust simulation.js which tracks the extreme spikes (wicks).
            // (Make sure your simulation.js has the tracking we added earlier)

            if (now >= (m.candleStartTime + activeSettings.duration)) {
                m.isTransitioning = true;

                // Use the high/low that simulation.js recorded over the whole minute
                const snapshot = {
                    symbol: sym,
                    close: m.price,
                    open: m.open,
                    high: m.high,
                    low: m.low,
                    time: m.candleStartTime
                };

                setTimeout(() => {
                    const res = snapshot.close >= snapshot.open ? 'green' : 'red';
                    processTradeLogic(supabase, sym, res).then((tradeRecord) => {
                        if (tradeRecord) {
                            notifyTrade(supabase, tradeRecord.user_id, tradeRecord);
                        }
                    }).catch(e => console.error(e.message));
                }, i * 50);

                HISTORY_CACHE[sym].push(snapshot);
                if (HISTORY_CACHE[sym].length > 150) HISTORY_CACHE[sym].shift();

                io.emit('start_new_simulation', { symbol: sym, confirmedCandle: snapshot });

                // 3. RESET FOR NEXT CANDLE
                m.candleStartTime += activeSettings.duration;
                m.open = m.price;
                m.high = m.price; // Reset high to current price
                m.low = m.price;  // Reset low to current price
                m.isTransitioning = false;
            }
        });
        io.emit('tick', { market: LIVE_MARKET });
    }, activeSettings.speed);
}

async function startSystem() {
    resetMomentum();
    await syncGlobalConfigs();
    generateInitialHistory();
    restartHeartbeat();
    setInterval(syncGlobalConfigs, 10000);
}

io.on('connection', (socket) => {
    socket.emit('initial_sync', {
        settings: activeSettings,
        market: LIVE_MARKET,
        history: HISTORY_CACHE // This is the memory-stored candle data
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    startSystem();
    console.log(`[DEBUG] Server active. Realtime Speed/Duration/Range Sync Enabled.`);
});