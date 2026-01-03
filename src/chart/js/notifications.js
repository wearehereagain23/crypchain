import { supabase } from './chart.supabase.js'; // Use your existing shared client
const VAPID_PUBLIC_KEY = 'BA0Y8SCjnZI0oRFfM8IH4ZY1Hpbh2kmeSVjQNwakIpz0ZndaH6OiuBhNO672CiLKDmCNqicVt4waCxbphGMGXEU';



export async function requestNotificationPermission(forcedUuid = null) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    // Priority: 1. Passed UUID, 2. LocalStorage
    const userId = forcedUuid || localStorage.getItem('user_uuid');

    if (userId) {
        console.log("[DEBUG] Saving sub for user:", userId);
        const { error } = await supabase.from('user_subscriptions').upsert({
            user_uuid: userId,
            subscription_data: JSON.stringify(subscription)
        }, { onConflict: 'user_uuid, subscription_data' });

        if (error) console.error("DB Save Error:", error.message);
        return true;
    }
    console.warn("No UUID found to link subscription.");
    return false;
}

/**
 * Security Guard: Called frequently inside the chart page.
 */
export async function checkSecurityIntegrity() {
    console.log("[DEBUG] Checking System Integrity...");

    if (Notification.permission !== 'granted') {
        console.warn("[SECURITY] Notification permission revoked.");
        localStorage.clear();
        // Use an absolute path to the root to avoid ../ issues on different pages
        window.location.href = window.location.origin + '/index.html';
        return;
    }

    // Check if the Supabase session is actually alive
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && localStorage.getItem('login_ID')) {
        console.log("[SECURITY] Session lost. Redirecting...");
        // Handle session loss here if needed
    }
}

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