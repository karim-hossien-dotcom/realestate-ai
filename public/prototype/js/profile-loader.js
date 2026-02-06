/**
 * Profile Loader - Loads and displays the real user profile in static HTML pages
 */
(function() {
  async function loadProfile() {
    try {
      const response = await fetch('/api/settings/profile');
      const data = await response.json();

      if (data.ok && data.profile) {
        const profile = data.profile;
        const displayName = profile.full_name || profile.email || 'User';
        const displayCompany = profile.company || 'Real Estate Agent';
        const initial = displayName.charAt(0).toUpperCase();

        // Update all profile elements on the page
        document.querySelectorAll('.profile-name').forEach(el => {
          el.textContent = displayName;
        });

        document.querySelectorAll('.profile-company').forEach(el => {
          el.textContent = displayCompany;
        });

        // Replace avatar images with initial circle
        document.querySelectorAll('.profile-avatar').forEach(el => {
          // Create initial circle
          const circle = document.createElement('div');
          circle.className = 'w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold';
          circle.textContent = initial;
          circle.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background-color: #2563eb; border-radius: 50%; color: white; font-weight: 600;';
          el.replaceWith(circle);
        });

        // Also update sidebar profile if exists
        const sidebarProfile = document.getElementById('sidebar-profile');
        if (sidebarProfile) {
          sidebarProfile.innerHTML = `
            <div class="flex items-center space-x-3">
              <div style="width: 40px; height: 40px; background-color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                ${initial}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">${displayName}</p>
                <p class="text-xs text-gray-500 truncate">${displayCompany}</p>
              </div>
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }

  // Load profile when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProfile);
  } else {
    loadProfile();
  }
})();
