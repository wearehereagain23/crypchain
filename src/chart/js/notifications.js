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
    if (Notification.permission !== 'granted') {
        const subData = localStorage.getItem('last_subscription');
        if (subData) {
            // Delete sub from DB if they revoked permission
            await supabase.from('user_subscriptions').delete().eq('subscription_data', subData);
        }
        localStorage.clear();
        window.location.href = '../index.html';
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