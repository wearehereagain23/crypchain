// /chart/js/notifications.js
import { supabase } from './chart.supabase.js';
const VAPID_PUBLIC_KEY = 'BA0Y8SCjnZI0oRFfM8IH4ZY1Hpbh2kmeSVjQNwakIpz0ZndaH6OiuBhNO672CiLKDmCNqicVt4waCxbphGMGXEU';

/**
 * Main Authorization: Requests permission and saves the unique device token.
 */
export async function requestNotificationPermission(forcedUuid = null) {
    const permission = await Notification.requestPermission();

    // If they deny it here, they can't enter the app
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const userId = forcedUuid || localStorage.getItem('user_uuid');

    if (userId) {
        console.log("[DEBUG] Registering device for:", userId);
        const { error } = await supabase.from('user_subscriptions').upsert({
            user_uuid: userId,
            subscription_data: JSON.stringify(subscription)
        }, {
            // CRITICAL: Allows multi-device support
            onConflict: 'subscription_data'
        });

        if (error) console.error("DB Save Error:", error.message);
        return true;
    }
    return false;
}

/**
 * FULL SECURITY GUARD: Detects if notifications are turned off.
 * This runs every time a page loads and on a loop while the user is active.
 */
export async function checkSecurityIntegrity() {
    // 1. SAFETY: Don't run the check if we are already on the index/login page
    // This prevents the "Logout Loop"
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        return;
    }

    console.log("[SECURITY] Verifying System Integrity...");

    // 2. Permission Check
    if (Notification.permission !== 'granted') {
        console.warn("[SECURITY] Access Revoked.");
        localStorage.clear();
        // Redirect back to the authorization page
        window.location.href = window.location.origin + '/index.html';
        return;
    }

    // 3. Session Check with Network Safety
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && localStorage.getItem('login_ID')) {
            localStorage.clear();
            window.location.href = window.location.origin + '/login.html';
        }
    } catch (e) {
        // Ignore network glitches so we don't log out users on weak Wi-Fi
    }
}
/**
 * Helper: Converts VAPID key for the browser
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}