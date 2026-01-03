/**
 * Reads the 'user_id' parameter from the current URL.
 * @returns {string | null} The user ID UUID or null if not found/invalid.
 */
export function getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');

    if (!userId) return null;

    // Strict UUID validation
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    if (!isUUID) {
        console.error("[DEBUG] UTILITIES: Invalid UUID format in URL.");
        return null;
    }

    return userId;
}