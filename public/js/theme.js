/**
 * Theme Toggle Strategy
 * Ensures the correct theme is applied immediately before page renders.
 */

(function() {
    function getSavedTheme() {
        try {
            const saved = localStorage.getItem('theme');
            if (saved) return saved;
        } catch (e) {}
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const theme = getSavedTheme();
    document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    
    try {
        localStorage.setItem('theme', newTheme);
    } catch (e) {}

    // Update all theme toggle icons
    const themeIcons = document.querySelectorAll('.theme-toggle-icon');
    themeIcons.forEach(icon => {
        icon.textContent = newTheme === 'light' ? 'dark_mode' : 'light_mode';
    });
}

// On DOM Loaded: bind events and ensure icon states match initial theme
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup initial icon state
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const themeIcons = document.querySelectorAll('.theme-toggle-icon');
    themeIcons.forEach(icon => {
        icon.textContent = currentTheme === 'light' ? 'dark_mode' : 'light_mode';
    });

    // 2. Bind theme click events
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', toggleTheme);
    });

    // 3. Sidebar Collapse Logic
    function getSavedSidebarState() {
        try {
            return localStorage.getItem('sidebarState') || 'expanded';
        } catch(e) { return 'expanded'; }
    }

    const currentSidebarState = getSavedSidebarState();
    if (currentSidebarState === 'collapsed') {
        document.body.classList.add('layout-collapsed');
    }

    function toggleSidebar() {
        const isCollapsed = document.body.classList.toggle('layout-collapsed');
        const newState = isCollapsed ? 'collapsed' : 'expanded';
        try {
            localStorage.setItem('sidebarState', newState);
        } catch(e) {}
        
        // Update sidebar toggle icon if needed
        const sidebarToggleIcon = document.querySelector('.sidebar-toggle-icon');
        if (sidebarToggleIcon) {
            sidebarToggleIcon.textContent = isCollapsed ? 'chevron_right' : 'chevron_left';
        }
    }

    const sidebarToggleBtns = document.querySelectorAll('.sidebar-toggle-btn');
    sidebarToggleBtns.forEach(btn => {
        btn.addEventListener('click', toggleSidebar);
    });
});

