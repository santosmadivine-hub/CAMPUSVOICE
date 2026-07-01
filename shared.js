// ====== CAMPUSVOICE SHARED LAYOUT JS ======
// Include this in every admin page via: <script src="shared.js"></script>

function buildSidebar(role, activePage) {
  const isA1 = role === 'admin1';
  const navAdmin1 = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard',          href: 'admin1-dashboard.html' },
    { id: 'gen-code',  icon: '📋', label: 'Generate Code',       href: 'admin1-gen-code.html' },
    { id: 'eval-mgmt',  icon: '📋', label: 'Evaluation Mgmt',    href: 'admin1-eval-mgmt.html' },
    { id: 'reports',    icon: '📁', label: 'Reports',             href: 'admin1-reports.html' },
    { id: 'analytics',  icon: '📈', label: 'Analytics',           href: 'admin1-analytics.html' },
    { id: 'settings',   icon: '⚙️', label: 'Settings',            href: 'admin1-settings.html' },
  ];
  const navAdmin2 = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard',           href: 'admin2-dashboard.html' },
    { id: 'eval-mgmt',  icon: '🏛️', label: 'Evaluation Mgmt',    href: 'admin2-eval-mgmt.html' },
    { id: 'multimedia', icon: '🎞️', label: 'Multimedia Feedback', href: 'admin2-multimedia.html' },
    { id: 'reports',    icon: '📁', label: 'Reports',              href: 'admin2-reports.html' },
    { id: 'analytics',  icon: '📈', label: 'Analytics',            href: 'admin2-analytics.html' },
    { id: 'settings',   icon: '⚙️', label: 'Settings',             href: 'admin2-settings.html' },
  ];
  const nav = isA1 ? navAdmin1 : navAdmin2;
  const activeClass = isA1 ? 'active-a1' : 'active-a2';
  const roleLabel = isA1 ? '⚙️ Admin 1 — Services' : '🏛️ Admin 2 — Facilities';
  const roleClass = isA1 ? 'role-admin1' : 'role-admin2';
  const avatarText = isA1 ? 'A1' : 'A2';
  const userName = isA1 ? 'Admin 1' : 'Admin 2';

  return `
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="wordmark">CampusVoice</div>
        <div class="campus">ISUFST-SEC</div>
      </div>
      <div class="sidebar-role ${roleClass}">${roleLabel}</div>
      <nav class="nav">
        ${nav.map(n => `
          <a class="nav-item ${n.id === activePage ? activeClass : ''}" href="${n.href}">
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
            <div class="user-role-label">Click to logout</div>
          </div>
        </a>
      </div>
    </aside>
  `;
}

function buildTopbar(pageTitle, role) {
  const isA1 = role === 'admin1';
  const badgeCls  = isA1 ? 'badge-blue'   : 'badge-purple';
  const roleLabel = isA1 ? 'Admin 1 – Services & Overall' : 'Admin 2 – Facilities & Cleanliness';
  return `
    <div class="topbar">
      <div class="page-title">${pageTitle}</div>
      <div class="topbar-right">
        <span class="badge ${badgeCls}">${roleLabel}</span>
      </div>
    </div>
  `;
}

// Animate bar fills after DOM ready
function animateBars() {
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(b => {
      b.style.width = b.getAttribute('data-width');
    });
  }, 100);
}

// Toggle helper
document.addEventListener('click', e => {
  if (e.target.classList.contains('toggle')) {
    e.target.classList.toggle('on');
  }
});
