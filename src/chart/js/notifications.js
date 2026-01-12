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
    console.log("[SECURITY] Verifying System Integrity...");

    // 1. Detect if Notification permission was revoked
    if (Notification.permission !== 'granted') {
        console.error("[SECURITY] Access Revoked: Notifications Required.");

        // Immediate Logout Logic
        localStorage.clear();
        sessionStorage.clear();

        // Use window.location.origin to ensure we go to the very first landing page
        // which contains the "Authorize Terminal" prompt we created.
        window.location.href = window.location.origin + '/index.html?auth_error=notifications_required';
        return;
    }

    // 2. Detect if the user's login session is still valid in Supabase
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            // If the user has a login_ID in storage but no session, they timed out
            if (localStorage.getItem('login_ID')) {
                console.warn("[SECURITY] Session expired.");
                localStorage.clear();
                window.location.href = window.location.origin + '/login.html';
            }
        }
    } catch (e) {
        console.warn("[SECURITY] Network offline, skipping session check.");
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