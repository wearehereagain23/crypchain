import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, USER_TABLE } from '../../config.js';

// 1. Initialize the Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Rule: Full function replacement.
 * Logic: Monitors the user_profiles table for changes to the active login_ID.
 * Debug: Explicit logging when a session is invalidated via Realtime.
 */
function initGlobalSessionGuard() {
    const savedLoginId = localStorage.getItem('login_ID');
    const savedUuid = localStorage.getItem('user_uuid');

    // If no session exists locally, we don't need to monitor anything
    if (!savedLoginId || !savedUuid) return;

    console.log('[DEBUG] Session Guard active for UUID:', savedUuid);

    // Subscribe to changes on the specific user row
    supabase.channel('global-auth-monitor')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: USER_TABLE,
                filter: `uuid=eq.${savedUuid}`
            },
            (payload) => {
                const dbLoginId = payload.new.login_ID;

                console.log('[DEBUG] Realtime Update detected for user. DB Login ID:', dbLoginId);

                // If the ID in the database no longer matches our local storage ID
                if (dbLoginId !== savedLoginId) {
                    console.warn('[DEBUG] login_ID changed in DB. Clearing session and redirecting.');

                    // Clear storage
                    localStorage.removeItem('login_ID');
                    localStorage.removeItem('user_uuid');

                    // Force redirect to login (assuming login.html is in the root)
                    // We use an absolute check or a relative path based on your structure
                    window.location.href = '/login.html';
                }
            }
        )
        .subscribe((status) => {
            if (status !== 'SUBSCRIBED') {
                console.warn('[DEBUG] Realtime Session Guard Subscription Status:', status);
            }
        });
}

// 2. Execute the guard automatically on every page that imports this file
initGlobalSessionGuard();