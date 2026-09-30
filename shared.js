function buildSidebar(role, activePage) {

  const navAdmin1 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin1-dashboard.html' },
    { id: 'office-mgmt', icon: '🏛', label: 'Office Management', href: 'admin1-office-mgmt.html' },
    { id: 'gen-code', icon: '📋', label: 'Generate Code', href: 'admin1-gen-code.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin1-eval-mgmt.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin1-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin1-analytics.html' },
 
  ];

  const navAdmin2 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin2-dashboard.html' },
    { id: 'office-mgmt', icon: '📑', label: 'Office Management', href: 'admin2-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin2-eval-mgmt.html' },
    { id: 'multimedia', icon: '🎞️', label: 'Multimedia Feedback', href: 'admin2-multimedia.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin2-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin2-analytics.html' },
   
  ];

  const navAdmin3 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin3-dashboard.html' },
    { id: 'office-mgmt', icon: '🏛', label: 'Office Management', href: 'admin3-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin3-eval-mgmt.html' },
    { id: 'multimedia', icon: '🎞️', label: 'Multimedia Feedback', href: 'admin3-multimedia.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin3-reports.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin3-analytics.html' },
  
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
        <a class="logout-btn" href="index.html" aria-label="Logout ${userName}" title="Logout">
          <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="logout-text">Logout</span>
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

  hamburger.addEventListener('click', toggleSidebar);

  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', closeSidebar);
  });

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });
}

document.addEventListener('DOMContentLoaded', initSidebarToggle);

function animateBars() {
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(bar => {
      bar.style.width =
        bar.getAttribute('data-width') || '0%';
    });
  }, 100);
}

document.addEventListener('click', function (e) {

  if (e.target.classList.contains('toggle')) {
    e.target.classList.toggle('on');
  }

});

function CVDebounce(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function CVChartProfile(width) {
  if (width < 340) {
    return { pad: { top: 16, right: 12, bottom: 42, left: 30 }, valueFont: 10, axisFont: 9,  labelFont: 10 };
  }
  if (width < 460) {
    return { pad: { top: 18, right: 18, bottom: 48, left: 36 }, valueFont: 11, axisFont: 10, labelFont: 11 };
  }
  return { pad: { top: 20, right: 30, bottom: 60, left: 50 }, valueFont: 12, axisFont: 11, labelFont: 12 };
}

function CVOnResize(renderFns) {
  const run = () => renderFns.forEach(fn => { try { fn(); } catch (e) {  } });
  window.addEventListener('resize', CVDebounce(run, 150));
  window.addEventListener('orientationchange', CVDebounce(run, 150));
}
