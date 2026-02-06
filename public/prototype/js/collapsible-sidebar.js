// Collapsible Sidebar - Expands on hover
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Store original width
        const expandedWidth = '256px'; // w-64
        const collapsedWidth = '64px'; // w-16

        // Get all nav items and text elements
        const navTexts = sidebar.querySelectorAll('.nav-text, .sidebar-text');
        const logoText = sidebar.querySelector('.logo-text');
        const profileText = sidebar.querySelector('.profile-text');
        const sidebarTitle = sidebar.querySelector('.sidebar-title');

        // Initially collapse
        collapseSidebar();

        // Expand on hover
        sidebar.addEventListener('mouseenter', expandSidebar);
        sidebar.addEventListener('mouseleave', collapseSidebar);

        function collapseSidebar() {
            sidebar.style.width = collapsedWidth;
            sidebar.style.transition = 'width 0.3s ease';

            // Hide text elements
            navTexts.forEach(el => {
                el.style.display = 'none';
            });
            if (logoText) logoText.style.display = 'none';
            if (profileText) profileText.style.display = 'none';
            if (sidebarTitle) sidebarTitle.style.display = 'none';

            // Center nav icons
            const navLinks = sidebar.querySelectorAll('nav a, nav button');
            navLinks.forEach(link => {
                link.style.justifyContent = 'center';
                link.style.paddingLeft = '0';
                link.style.paddingRight = '0';
            });

            // Center logo
            const logoContainer = sidebar.querySelector('.logo-container');
            if (logoContainer) {
                logoContainer.style.justifyContent = 'center';
            }

            // Center profile section
            const profileSection = sidebar.querySelector('.profile-section');
            if (profileSection) {
                profileSection.style.justifyContent = 'center';
            }
        }

        function expandSidebar() {
            sidebar.style.width = expandedWidth;

            // Show text elements
            navTexts.forEach(el => {
                el.style.display = 'inline';
            });
            if (logoText) logoText.style.display = 'block';
            if (profileText) profileText.style.display = 'block';
            if (sidebarTitle) sidebarTitle.style.display = 'block';

            // Reset nav alignment
            const navLinks = sidebar.querySelectorAll('nav a, nav button');
            navLinks.forEach(link => {
                link.style.justifyContent = '';
                link.style.paddingLeft = '';
                link.style.paddingRight = '';
            });

            // Reset logo
            const logoContainer = sidebar.querySelector('.logo-container');
            if (logoContainer) {
                logoContainer.style.justifyContent = '';
            }

            // Reset profile section
            const profileSection = sidebar.querySelector('.profile-section');
            if (profileSection) {
                profileSection.style.justifyContent = '';
            }
        }
    });
})();
