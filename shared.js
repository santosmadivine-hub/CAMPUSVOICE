// Subtitles per role. Keys are the lowercase page titles.
const PAGE_SUBTITLES = {
  superadmin: {
    'dashboard':             'System Overview — Offices and Administrator Accounts',
    'offices overview':      'Per-Office Evaluation Performance Across All Registered Offices',
    'office management':     'Add, Edit, and Remove Campus Offices',
    'accounts':              'Create and Manage Administrator FC Accounts',
    'evaluation management': 'Review and Manage All Facilities and Cleanliness Evaluations',
    'analytics':             'Analyze Evaluation Results and Performance Trends',
    'settings':              'Your Profile and System Information'
  },
  admin1: {
    'dashboard':             'Overview of Campus Evaluation Results and Activities',
    'office management':     'Manage Campus Offices and Evaluation Areas',
    'office accounts':       'Create and Manage Login Accounts for Each Unit or Office',
    'evaluation management': 'Review and Manage Submitted Evaluations',
    'reports':               'Generate and Review Evaluation Reports',
    'report settings':       'Configure the Letterhead and Layout Used in Generated Reports',
    'analytics':             'Analyze Evaluation Results and Performance Trends',
    'summary analytics':     'Analyze Evaluation Results and Performance Trends',
    'settings':              'Your Profile and App Information'
  },
  admin2: {
    'dashboard':             'Overview of Campus Evaluation Results and Activities',
    'office management':     'Manage Campus Offices and Evaluation Areas',
    'evaluation management': 'Review and Manage Facility Evaluations',
    'reports':               'Generate and Review Facility Reports',
    'multimedia':            'View and Manage Evaluation Evidence',
    'multimedia feedback':   'View and Manage Evaluation Evidence', // old title, kept so existing pages still work
    'analytics':             'Analyze Facility Evaluation Results and Trends'
  },
  admin3: {
    'dashboard':             'Overview of Campus Evaluation Results and Activities',
    'office management':     'Manage Campus Offices and Evaluation Areas',
    'evaluation management': 'Review and Manage Facility Evaluations',
    'reports':               'Generate and Review Facility Reports',
    'multimedia':            'View and Manage Evaluation Evidence',
    'multimedia feedback':   'View and Manage Evaluation Evidence', // old title, kept so existing pages still work
    'analytics':             'Analyze Facility Evaluation Results and Trends'
  },
  fc_office: {
    'fc dashboard':          'Your Assigned Office — Facilities &amp; Cleanliness Data',
    'evaluation management': 'Review Evaluations for Your Office',
    'reports':               'Generate Reports for Your Office',
    'multimedia':            'View Evidence Photos for Your Office',
    'analytics':             'Office Performance Trends and Ratings',
    'settings':              'Profile, Password and App Information',
  },
  adminfc: {
    'dashboard':             'Overview of All Facilities and Cleanliness Evaluation Results',
    'office management':     'Manage Campus Offices and Evaluation Areas',
    'evaluation management': 'Review and Manage Facility Evaluations',
    'reports':               'Generate and Review Facility Reports',
    'multimedia':            'View and Manage Evaluation Evidence',
    'multimedia feedback':   'View and Manage Evaluation Evidence', // old title, kept so existing pages still work
    'analytics':             'Analyze Facility Evaluation Results and Trends',
    'question management':   'Manage Evaluation Questions Shown to Users'
  }
};

function buildSidebar(role, activePage) {

  const navAdmin1 = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', href: 'admin1-dashboard.html' },
    { id: 'office-mgmt', icon: '🏛', label: 'Office Management', href: 'admin1-office-mgmt.html' },
    { id: 'accounts', icon: '🔑', label: 'Office Accounts', href: 'admin1-accounts.html' },
    { id: 'eval-mgmt', icon: '📑', label: 'Evaluation Management', href: 'admin1-eval-mgmt.html' },
    { id: 'reports', icon: '📁', label: 'Reports', href: 'admin1-reports.html' },
    { id: 'report-settings', icon: '📝', label: 'Report Settings', href: 'admin1-report-settings.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin1-analytics.html' },
    { id: 'settings', icon: '⚙️', label: 'Settings', href: 'admin1-settings.html' },
  ];

  const navAdmin2 = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard', href: 'admin2-dashboard.html' },
    { id: 'office-mgmt', icon: '🏢', label: 'Office Management', href: 'admin2-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📋', label: 'Evaluation Management', href: 'admin2-eval-mgmt.html' },
    { id: 'reports', icon: '📊', label: 'Reports', href: 'admin2-reports.html' },
    { id: 'multimedia', icon: '📷', label: 'Multimedia', href: 'admin2-multimedia.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin2-analytics.html' },
  ];

  const navAdmin3 = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard', href: 'admin3-dashboard.html' },
    { id: 'office-mgmt', icon: '🏢', label: 'Office Management', href: 'admin3-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📋', label: 'Evaluation Management', href: 'admin3-eval-mgmt.html' },
    { id: 'reports', icon: '📊', label: 'Reports', href: 'admin3-reports.html' },
    { id: 'multimedia', icon: '📷', label: 'Multimedia', href: 'admin3-multimedia.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'admin3-analytics.html' },
  ];

  const navAdminFC = [
    { id: 'dashboard', icon: '🏠', label: 'Overview Dashboard', href: 'adminfc-dashboard.html' },
    { id: 'office-mgmt', icon: '🏢', label: 'Office Management', href: 'adminfc-office-mgmt.html' },
    { id: 'eval-mgmt', icon: '📋', label: 'Evaluation Management', href: 'adminfc-eval-mgmt.html' },
    { id: 'question-mgmt', icon: '❓', label: 'Question Management', href: 'adminfc-question-mgmt.html' },
    { id: 'reports', icon: '📊', label: 'Reports', href: 'adminfc-reports.html' },
    { id: 'multimedia', icon: '📷', label: 'Multimedia', href: 'adminfc-multimedia.html' },
    { id: 'analytics', icon: '📈', label: 'Analytics', href: 'adminfc-analytics.html' },
    { id: 'settings',  icon: '⚙️', label: 'Settings',  href: 'adminfc-settings.html' },
  ];

  const navFCOffice = [
    { id: 'fc-dashboard', icon: '🏠', label: 'Dashboard',           href: 'fc-office-dashboard.html' },
    { id: 'eval-mgmt',    icon: '📋', label: 'Evaluations Management',         href: 'fc-office-eval-mgmt.html' },
    { id: 'multimedia',   icon: '📷', label: 'Multimedia',          href: 'fc-office-multimedia.html' },
    { id: 'analytics',    icon: '📈', label: 'Analytics',           href: 'fc-office-analytics.html' },
    { id: 'settings',     icon: '⚙️', label: 'Settings',            href: 'fc-office-settings.html' },
  ];

  const navSuperAdmin = [
    { id: 'dashboard',       icon: '📊', label: 'Dashboard',              href: 'superadmin-dashboard.html' },
    { id: 'office-mgmt',     icon: '🏢', label: 'Office Management',      href: 'superadmin-office-mgmt.html' },
    { id: 'accounts',        icon: '🔑', label: 'Accounts',               href: 'superadmin-accounts.html' },
    { id: 'eval-mgmt',       icon: '📋', label: 'Evaluation Management',  href: 'superadmin-eval-mgmt.html' },
    { id: 'analytics',       icon: '📈', label: 'Analytics',              href: 'superadmin-analytics.html' },
    { id: 'settings',        icon: '⚙️', label: 'Settings',               href: 'superadmin-settings.html' },
  ];

  const nav =
    role === 'superadmin'
      ? navSuperAdmin
      : role === 'admin1'
      ? navAdmin1
      : role === 'adminfc'
      ? navAdminFC
      : role === 'fc_office'
      ? navFCOffice
      : role === 'admin2'
      ? navAdmin2
      : navAdmin3;

  const activeClass =
    role === 'superadmin'
      ? 'active-sa'
      : role === 'admin1'
      ? 'active-a1'
      : role === 'adminfc' || role === 'fc_office'
      ? 'active-afc'
      : role === 'admin2'
      ? 'active-a2'
      : 'active-a3';

  const roleLabel =
    role === 'superadmin'
      ? '👑 Super Administrator'
      : role === 'admin1'
      ? '⚙️ Admin 1 — Services'
      : role === 'adminfc'
      ? '🤝 Admin FC — Facilities &amp; Cleanliness'
      : role === 'fc_office'
      ? '🏢 FC Office Administrator'
      : role === 'admin2'
      ? '🏛️ Admin 2 — Cleanliness'
      : '🏢 Admin 3 — Facilities';

  const roleClass =
    role === 'superadmin'
      ? 'role-superadmin'
      : role === 'admin1'
      ? 'role-admin1'
      : role === 'adminfc' || role === 'fc_office'
      ? 'role-adminfc'
      : role === 'admin2'
      ? 'role-admin2'
      : 'role-admin3';

  const userName =
    role === 'superadmin'
      ? 'Super Admin'
      : role === 'admin1'
      ? 'Admin 1'
      : role === 'adminfc' || role === 'fc_office'
      ? 'Admin FC'
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

function buildTopbar(pageTitle, role, subtitle) {

  const badgeCls = 'badge-blue';

  const roleLabel =
    role === 'superadmin'
      ? 'Super Administrator'
      : role === 'admin1'
      ? 'Admin 1 – Services'
      : role === 'adminfc'
      ? 'Admin FC – Facilities &amp; Cleanliness'
      : role === 'fc_office'
      ? 'FC Office Administrator'
      : role === 'admin2'
      ? 'Admin 2 – Cleanliness'
      : 'Admin 3 – Facilities';

  // Use the optional 3rd argument if given, otherwise look it up by role + page title
  const roleSubtitles = PAGE_SUBTITLES[role] || PAGE_SUBTITLES.adminfc;
  const subText =
    subtitle ||
    roleSubtitles[String(pageTitle).trim().toLowerCase()] ||
    '';

  return `
    <div class="topbar">

      <div style="display:flex; align-items:center; gap:12px;">
        <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="page-heading">
          <div class="page-title">${pageTitle}</div>
          ${subText ? `<div class="page-subtitle">${subText}</div>` : ''}
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

/* Logout must end the Firebase Authentication session, not just navigate away,
   otherwise the next visitor to this browser is still signed in. Delegated so
   it works for sidebars injected after load. */
document.addEventListener('click', function (e) {
  const link = e.target.closest && e.target.closest('.logout-btn');
  if (!link || link.id === 'cv-logout') return;   // cv-logout handles itself

  e.preventDefault();

  import('./cv-core.js')
    .then(m => m.logout())
    .catch(err => {
      console.error('Could not sign out cleanly:', err);
      window.location.replace('index.html');
    });
});

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
