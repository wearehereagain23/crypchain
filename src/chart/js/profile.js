/**
 * FULL FIXED FILE: profile.js
 * Logic: Fetches and monitors user profile data in Realtime
 */
import { supabase } from './chart.supabase.js';
import { USER_TABLE } from '../../config.js';
import { getUserIdFromUrl } from './utilities.js';

const DEFAULT_IMAGE = './assets/image/profile.jpg';

export async function initProfilePage() {
    const userId = getUserIdFromUrl();

    if (!userId) {
        console.error("[DEBUG] PROFILE_ERROR: No user_id in URL.");
        window.location.href = '../login.html';
        return;
    }

    const fetchAndRenderProfile = async () => {
        console.log('[DEBUG] Fetching profile for UUID:', userId);

        const { data: user, error } = await supabase
            .from(USER_TABLE)
            .select('*')
            .eq('uuid', userId)
            .single();

        if (error || !user) {
            console.error('[DEBUG] PROFILE_FETCH_FAILED:', error?.message);
            return;
        }

        // Update UI Elements
        document.getElementById('displayFullName').textContent = `${user.first_name || 'User'} ${user.last_name || ''}`;
        document.getElementById('displayEmail').textContent = user.email || 'N/A';
        document.getElementById('profileImg').src = user.profile_picture || DEFAULT_IMAGE;

        // Balance and Level
        const balance = parseFloat(user.account_balance) || 0;
        document.getElementById('displayBalance').textContent = `${user.currency || '$'}${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        document.getElementById('displayLevel').textContent = (user.account_level || 'starter').toUpperCase();

        // Detailed Info
        document.getElementById('infoFirstName').textContent = user.first_name || '—';
        document.getElementById('infoLastName').textContent = user.last_name || '—';
        document.getElementById('infoCountry').textContent = user.country || '—';
        document.getElementById('infoState').textContent = user.state || '—';
        document.getElementById('infoGender').textContent = user.gender || '—';
        document.getElementById('infoDOB').textContent = user.dataof_birth || '—';
        document.getElementById('infoPhone').textContent = user.phone_number || '—';
        document.getElementById('infoCurrency').textContent = user.currency || '—';
    };

    // Initial load
    await fetchAndRenderProfile();

    // Realtime Listener: Refresh UI if database record changes
    supabase.channel('profile_realtime')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: USER_TABLE,
            filter: `uuid=eq.${userId}`
        }, (payload) => {
            console.log('[DEBUG] Profile updated in DB. Syncing UI...');
            fetchAndRenderProfile();
        })
        .subscribe();
}

// Auto-init for profile page
if (window.location.pathname.includes('profile.html')) {
    initProfilePage();
}