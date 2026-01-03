/**
 * Navigation Logic
 * Handles active states, global logout, and UUID persistence
 */

export function initNavigation() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    if (!userId) {
        console.error("DEBUG: [Navigation] No user_id found in URL parameters. Current URL is:", window.location.href);
    }

    persistUserId(userId);
    highlightActiveNav();
    setupLogoutListeners();
}

/**
 * Appends the current user_id to all internal navigation links
 */
function persistUserId(userId) {
    if (!userId) return;

    const navLinks = document.querySelectorAll('.nav-item');

    if (navLinks.length === 0) {
        console.error("DEBUG: [Navigation] No .nav-item elements found in the DOM to patch.");
        return;
    }

    navLinks.forEach(link => {
        const baseHref = link.getAttribute('href');

        if (baseHref && baseHref.includes('.html')) {
            const separator = baseHref.includes('?') ? '&' : '?';
            const newHref = `${baseHref}${separator}user_id=${userId}`;
            link.setAttribute('href', newHref);
        }
    });
}

/**
 * Handles highlighting the active navigation tab
 */
function highlightActiveNav() {
    const path = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        const cleanHref = href.split('?')[0];

        if (path.includes(cleanHref)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Global Logout handler - Attached to window for HTML access
 */
function setupLogoutListeners() {
    window.handleLogout = function () {
        if (typeof Swal === 'undefined') {
            console.error("DEBUG: [Navigation] SweetAlert2 (Swal) is not loaded on this page.");
            // Basic fallback if Swal fails to load
            if (confirm("Are you sure you want to sign out?")) {
                performLogout();
            }
            return;
        }

        Swal.fire({
            title: 'Confirm Logout',
            text: "Are you sure you want to sign out?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#7c5cff',
            cancelButtonColor: '#ff6b6b',
            background: '#0e1620',
            color: '#d7e6f3'
        }).then((res) => {
            if (res.isConfirmed) {
                performLogout();
            }
        });
    };
}

function performLogout() {
    console.log("DEBUG: [Navigation] Clearing session and redirecting to login.");
    localStorage.clear();
    // Path adjusted to move up one level from /chart/ to reach login.html
    window.location.href = '../login.html';
}