// ====== CAMPUSVOICE SHARED LAYOUT JS ======
// Include in every page:
// <script src="shared.js"></script>

function buildSidebar(role, activePage) {

  const navAdmin1 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin1-dashboard.html' },
    { id: 'gen-code', icon: '📋', label: 'Generate Code', href: 'admin1-gen-code.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin1-eval-mgmt.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin1-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin1-analytics.html' },
    { id: 'settings', icon: '⚙️', label: 'Settings', href: 'admin1-settings.html' }
  ];

  const navAdmin2 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin2-dashboard.html' },
    { id: 'office-mgmt', icon: '📑', label: 'Office Management', href: 'admin2-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin2-eval-mgmt.html' },
    { id: 'multimedia', icon: '🎞️', label: 'Multimedia Feedback', href: 'admin2-multimedia.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin2-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin2-analytics.html' },
    { id: 'settings', icon: '⚙️', label: 'Settings', href: 'admin2-settings.html' }
  ];

  const navAdmin3 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin3-dashboard.html' },
    { id: 'office-mgmt', icon: '🏛', label: 'Office Management', href: 'admin3-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin3-eval-mgmt.html' },
    { id: 'multimedia', icon: '🎞️', label: 'Multimedia Feedback', href: 'admin3-multimedia.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin3-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin3-analytics.html' },
    { id: 'settings', icon: '⚙️', label: 'Settings', href: 'admin3-settings.html' }
  ];

  const nav =
    role === 'admin1'
      ? navAdmin1
      : role === 'admin2'
      ? navAdmin2
      : navAdmin3;

  const activeClass =
    role === 'admin1'
      ? 'active-a1'
      : role === 'admin2'
      ? 'active-a2'
      : 'active-a3';

  const roleLabel =
    role === 'admin1'
      ? '⚙️ Admin 1 — Services'
      : role === 'admin2'
      ? '🏛️ Admin 2 — Cleanliness'
      : '🏢 Admin 3 — Facilities';

  const roleClass =
    role === 'admin1'
      ? 'role-admin1'
      : role === 'admin2'
      ? 'role-admin2'
      : 'role-admin3';

  const avatarText =
    role === 'admin1'
      ? 'A1'
      : role === 'admin2'
      ? 'A2'
      : 'A3';

  const userName =
    role === 'admin1'
      ? 'Admin 1'
      : role === 'admin2'
      ? 'Admin 2'
      : 'Admin 3';

  return `
    <aside class="sidebar">

      <div class="sidebar-logo">
        <div class="wordmark">CampusVoice</div>
        <div class="campus">ISUFST-SEC</div>
      </div>

      <div class="sidebar-role ${roleClass}">
        ${roleLabel}
      </div>

      <nav class="nav">
        ${nav.map(n => `
          <a
            class="nav-item ${n.id === activePage ? activeClass : ''}"
            href="${n.href}"
          >
            <span class="nav-icon">${n.icon}</span>
            <span>${n.label}</span>
          </a>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <a class="user-chip" href="login.html">
          <div class="user-avatar">${avatarText}</div>

          <div>
            <div class="user-name">${userName}</div>
            <div class="user-role-label">
              Click to logout
            </div>
          </div>

        </a>
      </div>

    </aside>
  `;
}


function buildTopbar(pageTitle, role) {

  const badgeCls =
    role === 'admin1'
      ? 'badge-blue'
      : role === 'admin2'
      ? 'badge-blue'
      : 'badge-blue';

  const roleLabel =
    role === 'admin1'
      ? 'Admin 1 – Services'
      : role === 'admin2'
      ? 'Admin 2 – Cleanliness'
      : 'Admin 3 – Facilities';

  return `
    <div class="topbar">

      <div class="page-title">
        ${pageTitle}
      </div>

      <div class="topbar-right">
        <span class="badge ${badgeCls}">
          ${roleLabel}
        </span>
      </div>

    </div>
  `;
}


// Animate bars
function animateBars() {
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      bar.style.width =
        bar.getAttribute('data-width') || '0%';
    });
  }, 100);
}


// Toggle
document.addEventListener('click', function (e) {

  if (e.target.classList.contains('toggle')) {
    e.target.classList.toggle('on');
  }

});