/**
 * FULL FIXED FILE: app.js
 * Logic: Permanent Authoritative Host.
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const { runTick } = require('./server/simulation.js');
const processTradeLogic = require('./server/tradeEngine.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.static(path.join(__dirname, 'src')));

let activeSettings = { duration: 60000, speed: 1000 };
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'MATIC', 'ADA', 'LTC', 'TRX', 'DOT', 'AVAX'];
const LIVE_MARKET = {};
const SYMBOL_LIMITS = {};
const HISTORY_CACHE = {};

async function startSystem() {
    const { data: ctrl } = await supabase.from('chart_control').select('*').eq('id', 1).single();
    if (ctrl) activeSettings = { duration: parseInt(ctrl.duration), speed: parseInt(ctrl.speed) };

    for (const sym of SYMBOLS) {
        const { data: candles } = await supabase.from('asset_candles').select('*').eq('symbol', sym).order('time', { ascending: false }).limit(60);
        const { data: range } = await supabase.from('asset_range').select('*').eq('symbol', sym).single();

        if (range) SYMBOL_LIMITS[sym] = { min: parseFloat(range.min_price), max: parseFloat(range.max_price) };
        if (candles && candles.length > 0) {
            HISTORY_CACHE[sym] = candles.reverse().map(c => ({
                open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close), time: new Date(c.time).getTime()
            }));
            const last = HISTORY_CACHE[sym][HISTORY_CACHE[sym].length - 1];
            LIVE_MARKET[sym] = {
                price: last.close, open: last.close, high: last.close, low: last.close,
                candleStartTime: Math.floor(Date.now() / activeSettings.duration) * activeSettings.duration,
                isTransitioning: false
            };
        }
    }

    startPermanentSimulation();

    io.on('connection', (socket) => {
        socket.emit('initial_sync', { history: HISTORY_CACHE, settings: activeSettings, market: LIVE_MARKET });
    });

    server.listen(process.env.PORT || 3000, () => console.log("Authoritative VPS Server Running..."));
}

function startPermanentSimulation() {
    setInterval(async () => {
        const now = Date.now();
        for (const sym of SYMBOLS) {
            const m = LIVE_MARKET[sym];
            if (!m || m.isTransitioning) continue;

            runTick(LIVE_MARKET, SYMBOL_LIMITS);

            if (now >= m.candleStartTime + activeSettings.duration) {
                m.isTransitioning = true;
                const finalCandle = {
                    symbol: sym, open: m.open, high: m.high, low: m.low, close: m.price,
                    time: new Date(m.candleStartTime).toISOString()
                };

                const { error } = await supabase.from('asset_candles').insert([finalCandle]);
                if (!error) {
                    await processTradeLogic(supabase, sym, (m.price >= m.open ? 'green' : 'red'));
                    const nextTime = Math.floor(now / activeSettings.duration) * activeSettings.duration;
                    m.candleStartTime = nextTime;
                    m.open = m.price; m.high = m.price; m.low = m.price;

                    io.emit('start_new_simulation', { symbol: sym, nextOpen: m.price, nextTime: nextTime, confirmedCandle: finalCandle });
                }
                m.isTransitioning = false;
            }
        }
        io.emit('tick', { market: LIVE_MARKET });
    }, activeSettings.speed);
}
startSystem();