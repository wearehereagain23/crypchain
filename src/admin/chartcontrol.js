/**
 * chartcontrol.js
 * Logic: Handles Global Timing (Speed/Duration) and Account Level Thresholds.
 */
import { supabase } from './supabase.js';
import { CONTROL_TABLE, CONTROL_ROW_ID } from '../config.js';

// Global Selectors
const tickInterval = document.getElementById('tickInterval');
const candleDuration = document.getElementById('candleDuration');
const saveGlobalBtn = document.getElementById('saveGlobalBtn');

// Account Level Selectors
const lvlStarter = document.getElementById('lvl_starter');
const lvlMini = document.getElementById('lvl_mini');
const lvlSilver = document.getElementById('lvl_silver');
const lvlGold = document.getElementById('lvl_gold');
const lvlPlatinum = document.getElementById('lvl_platinum');
const saveAccountBtn = document.getElementById('saveAccountBtn');

/**
 * Loads speed and duration settings into dropdowns.
 */
async function loadGlobalSettings() {
    const { data, error } = await supabase
        .from(CONTROL_TABLE)
        .select('duration, speed')
        .eq('id', CONTROL_ROW_ID)
        .single();

    if (error) {
        console.error("[DEBUG] GLOBAL_LOAD_FAIL:", error.message);
        return;
    }

    if (data) {
        tickInterval.value = data.speed;
        candleDuration.value = data.duration;
    }
}

/**
 * Loads account level percentages from the database.
 */
async function loadAccountLevels() {
    const { data, error } = await supabase
        .from('account_level')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error("[DEBUG] ACCOUNT_LEVEL_LOAD_FAIL:", error.message);
        return;
    }

    if (data) {
        lvlStarter.value = data.starter;
        lvlMini.value = data.mini;
        lvlSilver.value = data.silver;
        lvlGold.value = data.gold;
        lvlPlatinum.value = data.platinum;
    }
}

/**
 * Saves Global Speed and Duration.
 */
saveGlobalBtn.addEventListener('click', async () => {
    const { error } = await supabase.from(CONTROL_TABLE).update({
        speed: parseInt(tickInterval.value),
        duration: parseInt(candleDuration.value)
    }).eq('id', CONTROL_ROW_ID);

    if (error) {
        console.error("[DEBUG] GLOBAL_UPDATE_FAIL:", error.message);
        Swal.fire('Error', 'Update failed', 'error');
    } else {
        Swal.fire({
            icon: 'success',
            title: 'Matrix Sync Updated',
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
    }
});

/**
 * Saves Account Level Thresholds.
 */
saveAccountBtn.addEventListener('click', async () => {
    const { error } = await supabase.from('account_level').update({
        starter: lvlStarter.value,
        mini: lvlMini.value,
        silver: lvlSilver.value,
        gold: lvlGold.value,
        platinum: lvlPlatinum.value
    }).eq('id', 1);

    if (error) {
        console.error("[DEBUG] ACCOUNT_UPDATE_FAIL:", error.message);
        Swal.fire('Error', 'Update failed', 'error');
    } else {
        Swal.fire({
            icon: 'success',
            title: 'Account Tiers Updated',
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
    }
});

// Initialization
loadGlobalSettings();
loadAccountLevels();