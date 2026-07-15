// ====== CAMPUSVOICE SHARED LAYOUT JS ======
// Include in every page:
// <script src="shared.js"></script>

function buildSidebar(role, activePage) {

  const navAdmin1 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin1-dashboard.html' },
    { id: 'office-mgmt', icon: '🏛', label: 'Office Management', href: 'admin1-office-mgmt.html' },
    { id: 'gen-code', icon: '📋', label: 'Generate Code', href: 'admin1-gen-code.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin1-eval-mgmt.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin1-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin1-analytics.html' },
    { id: 'settings', icon: '⚙️', label: 'Settings', href: 'admin1-settings.html' }
  ];

  const navAdmin2 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin2-dashboard.html' },
    { id: 'office-mgmt', icon: '📑', label: 'Office Management', href: 'admin2-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Mgmt', href: 'admin2-eval-mgmt.html' },
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
    <aside class="sidebar" id="sidebar">

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

      <div style="display:flex; align-items:center; gap:12px;">
        <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="page-title">
          ${pageTitle}
        </div>
      </div>

      <div class="topbar-right">
        <span class="badge ${badgeCls}">
          ${roleLabel}
        </span>
      </div>

    </div>
  `;
}


// ====== RESPONSIVE SIDEBAR TOGGLE ======

function initSidebarToggle() {
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!hamburger || !sidebar) return;

  const toggleSidebar = () => {
    hamburger.classList.toggle('active');
    sidebar.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
  };

  const closeSidebar = () => {
    hamburger.classList.remove('active');
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  };

  // Hamburger click
  hamburger.addEventListener('click', toggleSidebar);

  // Sidebar links click
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', closeSidebar);
  });

  // Overlay click
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar when window is resized to tablet/desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initSidebarToggle);


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


/* ====================================================================
   RESIZE / RESPONSIVE CHART HELPERS
   Charts on the dashboard and analytics pages are rendered as inline
   SVG using JS. SVG scales cleanly via viewBox, but the *padding* and
   *font sizes* inside a chart need to change based on how much room is
   actually available — otherwise a chart designed for a 500px-wide
   desktop card looks cramped (or overflows) at 300px on a phone.
   These helpers are shared by admin*-dashboard.html and
   admin*-analytics.html so every chart resizes the same way.
==================================================================== */

// Debounce: wait until resizing has paused before doing the (relatively
// expensive) work of recomputing chart geometry and re-rendering.
function CVDebounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Given a chart's actual rendered container width, return a small
// "profile" of geometry values (padding, font sizes) tuned for that
// width, so charts stay readable and correctly spaced at any size
// instead of just scaling everything uniformly (which makes text too
// tiny on small screens, or wastes space on large ones).
function CVChartProfile(width) {
  if (width < 340) {
    return { pad: { top: 16, right: 12, bottom: 42, left: 30 }, valueFont: 10, axisFont: 9,  labelFont: 10 };
  }
  if (width < 460) {
    return { pad: { top: 18, right: 18, bottom: 48, left: 36 }, valueFont: 11, axisFont: 10, labelFont: 11 };
  }
  return { pad: { top: 20, right: 30, bottom: 60, left: 50 }, valueFont: 12, axisFont: 11, labelFont: 12 };
}

// Re-run a set of render callbacks on resize/orientation change, but
// only after resizing has settled (debounced) so we don't thrash the
// DOM while the user is actively dragging a window edge.
function CVOnResize(renderFns) {
  const run = () => renderFns.forEach(fn => { try { fn(); } catch (e) { /* chart not ready yet */ } });
  window.addEventListener('resize', CVDebounce(run, 150));
  window.addEventListener('orientationchange', CVDebounce(run, 150));
}