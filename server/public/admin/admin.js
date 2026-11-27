/**
 * ShaadiBanao Admin Portal Client-side Application
 * Complete Administration, Moderation, Approvals & Trust & Safety Suite
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.includes('onrender.com'))
  ? '/api/v1'
  : 'https://shaadibanao.onrender.com/api/v1';

// Universal SVG fallback for broken, missing or blocked images (Safe Data URI, never makes network calls)
const FALLBACK_MEDIA_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%231e293b' rx='10'/%3E%3Cpath d='M35 78l20-25 15 18 18-24 22 31H20z' fill='%23475569'/%3E%3Ccircle cx='42' cy='40' r='9' fill='%2364748b'/%3E%3Ctext x='60' y='105' font-family='sans-serif' font-size='10' font-weight='600' fill='%2394a3b8' text-anchor='middle'%3EPhoto Unavailable%3C/text%3E%3C/svg%3E";

let authToken = localStorage.getItem('sb_admin_token') || sessionStorage.getItem('sb_admin_token') || null;
let refreshToken = localStorage.getItem('sb_admin_refresh_token') || sessionStorage.getItem('sb_admin_refresh_token') || null;
let refreshPromise = null;
let currentAdmin = null;
let activeTab = 'dashboard';

// State caches for pagination & filtering
const appState = {
  approvals: { page: 1, limit: 15, status: 'all', search: '', items: [] },
  users: { page: 1, limit: 15, status: '', approvalStatus: 'all', search: '' },
  profiles: { page: 1, limit: 15, isVerified: '', search: '' },
  reports: { page: 1, limit: 15, status: 'pending' },
  audit: { page: 1, limit: 20, action: 'all', search: '' },
  community: { items: [] },
};

// Pending target user for modal actions
let activeModalUserId = null;
let activeModalUserName = null;
let activeInspectedUserId = null;
let activeInspectedUser = null;
let genericConfirmAction = null;

// Initialize app on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupLoginForm();
  setupEventListeners();
  setupSidebarSearch();
  startLiveClock();
  startBookingPolling();
  applyAdminLanguage();

  window.addEventListener('hashchange', handleHashChange);
  document.getElementById('btn-lang-toggle')?.addEventListener('click', toggleAdminLanguage);

  if (authToken) {
    validateSessionAndInit();
  } else {
    showLoginView();
  }
});

// Live clock in topbar
function startLiveClock() {
  const clockEl = document.getElementById('live-clock');
  const update = () => {
    if (clockEl) {
      const now = new Date();
      clockEl.innerText = now.toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    }
  };
  update();
  setInterval(update, 1000);
}

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Attempt silent token refresh using saved refreshToken so admin stays logged in
async function refreshAdminSession() {
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data?.tokens?.accessToken) {
        authToken = json.data.tokens.accessToken;
        if (json.data.tokens.refreshToken) {
          refreshToken = json.data.tokens.refreshToken;
          localStorage.setItem('sb_admin_refresh_token', refreshToken);
        }
        localStorage.setItem('sb_admin_token', authToken);
        if (json.data.user) {
          currentAdmin = json.data.user;
          localStorage.setItem('sb_admin_user', JSON.stringify(currentAdmin));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Authenticated API client (with automatic token refresh on 401)
async function adminFetch(endpoint, options = {}, _retried = false) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/admin/login' && !_retried && refreshToken) {
      const refreshed = await refreshAdminSession();
      if (refreshed) {
        return adminFetch(endpoint, options, true);
      }
    }
    if (response.status === 401 || response.status === 403) {
      if (endpoint !== '/admin/login') {
        showToast(data.message || 'Session expired or unauthorized. Please log in again.', 'error');
        handleLogout();
        throw new Error(data.message || 'Unauthorized');
      }
    }
    const err = new Error(data.message || data.error?.message || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.requestId = data.error?.requestId || data.meta?.requestId || response.headers.get('x-request-id');
    throw err;
  }

  return data;
}

// Reusable UI Table Error & Retry State Helper
function renderTableError(tbody, colSpan, message, retryFnName, requestId) {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${colSpan}" class="table-empty text-red" style="padding: 28px 16px; text-align: center;">
        <div style="font-size: 14px; font-weight: 700; color: #dc2626; margin-bottom: 6px;">
          ⚠️ ${escapeHtml(message || 'An unexpected error occurred while loading data.')}
        </div>
        ${requestId ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">Request ID: <code>${escapeHtml(requestId)}</code></div>` : ''}
        <button type="button" class="btn-primary" style="padding: 6px 18px; font-size: 12px; margin: 8px auto 0; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" onclick="${retryFnName}()">
          <span>↻ Retry</span>
        </button>
      </td>
    </tr>
  `;
}

function renderContainerError(container, message, retryFnName, requestId) {
  if (!container) return;
  container.innerHTML = `
    <div class="table-empty text-red" style="padding: 28px 16px; text-align: center;">
      <div style="font-size: 14px; font-weight: 700; color: #dc2626; margin-bottom: 6px;">
        ⚠️ ${escapeHtml(message || 'An unexpected error occurred while loading data.')}
      </div>
      ${requestId ? `<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">Request ID: <code>${escapeHtml(requestId)}</code></div>` : ''}
      <button type="button" class="btn-primary" style="padding: 6px 18px; font-size: 12px; margin: 8px auto 0; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" onclick="${retryFnName}()">
        <span>↻ Retry</span>
      </button>
    </div>
  `;
}

// Setup Login Form
function setupLoginForm() {
  const form = document.getElementById('admin-login-form');
  const submitBtn = document.getElementById('btn-login-submit');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('admin-identifier').value.trim();
    const password = document.getElementById('admin-password').value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying credentials...</span>';

    try {
      const res = await adminFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrMobile: identifier, password }),
      });

      if (res.data?.tokens?.accessToken && res.data?.user) {
        authToken = res.data.tokens.accessToken;
        refreshToken = res.data.tokens.refreshToken || null;
        currentAdmin = res.data.user;
        localStorage.setItem('sb_admin_token', authToken);
        if (refreshToken) {
          localStorage.setItem('sb_admin_refresh_token', refreshToken);
        }
        localStorage.setItem('sb_admin_user', JSON.stringify(currentAdmin));

        showToast(`Welcome back, ${currentAdmin.displayName || 'Administrator'}!`);
        showAppView();
        initAdminSocket();
        const targetRoute = getRouteFromHash() || 'dashboard';
        navigateToTab(targetRoute);
      }
    } catch (err) {
      showToast(err.message || 'Authentication failed. Please check credentials.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Authenticate & Access Portal</span>';
    }
  });
}

function handleLogout() {
  authToken = null;
  refreshToken = null;
  currentAdmin = null;
  localStorage.removeItem('sb_admin_token');
  localStorage.removeItem('sb_admin_refresh_token');
  localStorage.removeItem('sb_admin_user');
  sessionStorage.removeItem('sb_admin_token');
  sessionStorage.removeItem('sb_admin_refresh_token');
  sessionStorage.removeItem('sb_admin_user');
  showLoginView();
  showToast('Logged out of Admin Portal.', 'warning');
}

function showLoginView() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('app-view').style.display = 'none';
}

function showAppView() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'flex';

  const storedUser = localStorage.getItem('sb_admin_user') || sessionStorage.getItem('sb_admin_user');
  if (storedUser) {
    try {
      currentAdmin = JSON.parse(storedUser);
      const nameEl = document.getElementById('sidebar-admin-name');
      const avatarEl = document.getElementById('sidebar-admin-avatar');
      if (nameEl) nameEl.innerText = currentAdmin.displayName || 'Administrator';
      if (avatarEl) {
        const initials = (currentAdmin.displayName || 'AD')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        avatarEl.innerText = initials;
      }
    } catch {
      // ignore parse error
    }
  }
}

async function validateSessionAndInit() {
  try {
    showAppView();
    initAdminSocket();
    const initialRoute = getRouteFromHash();
    navigateToTab(initialRoute, false);
    if (initialRoute === 'dashboard') {
      await loadDashboardStats();
    }
  } catch {
    handleLogout();
  }
}

// Navigation & Tab Switching
function setupNavigation() {
  const links = document.querySelectorAll('.menu-link');
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      if (tab) {
        navigateToTab(tab);
        // On mobile close sidebar after clicking
        document.getElementById('sidebar')?.classList.remove('open');
      }
    });
  });

  // Mobile sidebar controls
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  document.getElementById('btn-close-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
  });

  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    refreshActiveTabData();
    showToast('Refreshing live data...');
  });
}

let isHindiAdmin = localStorage.getItem('sb_admin_lang') === 'hi';

const ADMIN_I18N = {
  en: {
    groupCore: 'Core Operations',
    navDashboard: 'Dashboard Overview',
    navApprovals: 'Pending Approvals',
    navUsers: 'User Accounts',
    navProfiles: 'Profile Moderation',
    navVerifications: 'Identity & Aadhaar',
    groupPuja: 'Puja & Pandit Services',
    navBookMyPandit: 'Book My Pandit Requests',
    navBookings: 'Ceremony Bookings',
    navPandits: 'Pandit Directory',
    navServices: 'Services Catalog',
    navCategories: 'Service Categories',
    groupFinance: 'Finance & Billing',
    navPayments: 'Payments & Billing',
    navMemberships: 'Memberships & Plans',
    groupComm: 'Communication & Support',
    navHelpSupport: 'Help & Support',
    navNotifications: 'Push Notifications',
    navCommunity: 'Community Feed',
    navBanners: 'Public Banners',
    groupSystem: 'System & Trust',
    navReports: 'Trust & Safety',
    navAudit: 'Audit Trail',
    navSettings: 'Platform Settings',
    navSystemHealth: 'System Health',
    switchLangText: 'हिन्दी',
  },
  hi: {
    groupCore: 'मुख्य संचालन',
    navDashboard: 'डैशबोर्ड अवलोकन',
    navApprovals: 'लंबित स्वीकृतियां',
    navUsers: 'उपयोगकर्ता खाते',
    navProfiles: 'प्रोफाइल सत्यापन',
    navVerifications: 'पहचान व आधार',
    groupPuja: 'पूजा व पंडित सेवाएं',
    navBookMyPandit: 'पंडित बुकिंग अनुरोध',
    navBookings: 'अनुष्ठान बुकिंग',
    navPandits: 'पंडित सूची',
    navServices: 'सेवा सूची',
    navCategories: 'अनुष्ठान श्रेणियां',
    groupFinance: 'वित्त व बिलिंग',
    navPayments: 'भुगतान और बिलिंग',
    navMemberships: 'सदस्यता योजनाएं',
    groupComm: 'संचार व सहायता',
    navHelpSupport: 'सहायता और संपर्क',
    navNotifications: 'पुश सूचनाएं',
    navCommunity: 'समुदाय पोस्ट्स',
    navBanners: 'प्रचार बैनर',
    groupSystem: 'सिस्टम व सुरक्षा',
    navReports: 'सुरक्षा रिपोर्ट्स',
    navAudit: 'ऑडिट ट्रेल',
    navSettings: 'सिस्टम सेटिंग्स',
    navSystemHealth: 'सिस्टम स्थिति',
    switchLangText: 'English',
  },
};

function toggleAdminLanguage() {
  isHindiAdmin = !isHindiAdmin;
  localStorage.setItem('sb_admin_lang', isHindiAdmin ? 'hi' : 'en');
  applyAdminLanguage();
}

function applyAdminLanguage() {
  const dict = isHindiAdmin ? ADMIN_I18N.hi : ADMIN_I18N.en;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerText = dict[key];
    }
  });

  const langText = document.getElementById('lang-toggle-text');
  if (langText) langText.innerText = dict.switchLangText;

  updateBreadcrumbs(activeTab);
  const meta = tabTitles[activeTab] || { title: 'Admin Portal', desc: 'Operations' };
  const titleEl = document.getElementById('current-page-title');
  const descEl = document.getElementById('current-page-desc');
  if (titleEl) titleEl.innerText = isHindiAdmin ? (meta.titleHi || meta.title) : meta.title;
  if (descEl) descEl.innerText = isHindiAdmin ? (meta.descHi || meta.desc) : meta.desc;
}

function updateBreadcrumbs(tabName) {
  const meta = tabTitles[tabName] || { title: 'Dashboard', group: 'Home' };
  const crumbEl = document.getElementById('crumb-current');
  const groupText = isHindiAdmin ? (meta.groupHi || meta.group || 'होम') : (meta.group || 'Home');
  const pageText = isHindiAdmin ? (meta.titleHi || meta.title) : meta.title;
  if (crumbEl) {
    crumbEl.innerText = `${groupText} / ${pageText}`;
  }
}

function toggleMenuGroup(headerEl) {
  const group = headerEl.closest('.menu-group');
  if (group) {
    group.classList.toggle('expanded');
  }
}

function setupSidebarSearch() {
  const searchInput = document.getElementById('sidebar-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const menuItems = document.querySelectorAll('.menu-item');
    const menuGroups = document.querySelectorAll('.menu-group');

    if (!query) {
      menuItems.forEach((item) => (item.style.display = ''));
      menuGroups.forEach((g) => (g.style.display = ''));
      return;
    }

    menuGroups.forEach((group) => {
      let groupHasMatch = false;
      const items = group.querySelectorAll('.menu-item');
      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = '';
          groupHasMatch = true;
        } else {
          item.style.display = 'none';
        }
      });

      if (groupHasMatch) {
        group.style.display = '';
        group.classList.add('expanded');
      } else {
        group.style.display = 'none';
      }
    });
  });
}

function getRouteFromHash() {
  const hash = window.location.hash || '';
  const clean = hash.replace(/^#\/?/, '').trim();
  return clean || 'dashboard';
}

function handleHashChange() {
  const route = getRouteFromHash();
  navigateToTab(route, false);
}

const tabTitles = {
  dashboard: {
    title: 'Dashboard Overview',
    desc: 'Real-time metrics, platform status, and active operations',
    titleHi: 'डैशबोर्ड अवलोकन',
    descHi: 'वास्तविक समय आंकड़े, मंच स्थिति और सक्रिय संचालन',
    group: 'Core Operations',
    groupHi: 'मुख्य संचालन',
  },
  approvals: {
    title: 'Pending Registration Approvals',
    desc: 'Review, approve, or reject new user registrations',
    titleHi: 'लंबित पंजीकरण स्वीकृतियां',
    descHi: 'नए उपयोगकर्ता पंजीकरणों की समीक्षा, स्वीकृति या अस्वीकृति',
    group: 'Core Operations',
    groupHi: 'मुख्य संचालन',
  },
  'book-my-pandit': {
    title: 'Book My Pandit - Custom Customer Requests',
    desc: 'Incoming devotee booking requests with customer name, phone, puja, venue, and pandit assignment',
    titleHi: 'पंडित बुकिंग अनुरोध (Book My Pandit)',
    descHi: 'भक्तों द्वारा मोबाइल ऐप से किए गए पूजा और कर्मकांड अनुरोध एवं पंडित आवंटन',
    group: 'Puja & Pandit Services',
    groupHi: 'पूजा एवं पंडित सेवाएं',
  },
  bookings: {
    title: 'Ceremony Bookings Management',
    desc: 'Monitor weddings, pujas, and online video consultations',
    titleHi: 'अनुष्ठान बुकिंग प्रबंधन',
    descHi: 'विवाह, पूजा और ऑनलाइन वीडियो परामर्श का प्रबंधन',
    group: 'Puja & Pandit Services',
    groupHi: 'पूजा एवं पंडित सेवाएं',
  },
  pandits: {
    title: 'Pandit Service Providers',
    desc: 'Review pandit applications, traditional specializations, and service catalog',
    titleHi: 'वैदिक पंडित निर्देशिका',
    descHi: 'पंजीकृत पंडित, विशेषज्ञता और सेवा प्रोफाइल',
    group: 'Puja & Pandit Services',
    groupHi: 'पूजा एवं पंडित सेवाएं',
  },
  services: {
    title: 'Puja & Ceremony Services Catalog',
    desc: 'Manage available sacred Vedic rituals, base prices, duration & Samagri inclusions',
    titleHi: 'पूजा व कर्मकांड सेवा सूची',
    descHi: 'वैदिक अनुष्ठान, पूजन सामग्री, अवधि एवं दक्षिणा दरें',
    group: 'Puja & Pandit Services',
    groupHi: 'पूजा एवं पंडित सेवाएं',
  },
  categories: {
    title: 'Service & Ceremony Categories',
    desc: 'Organized categories for matrimony rituals, horoscopes, and Vedic consultations',
    titleHi: 'अनुष्ठान श्रेणियां',
    descHi: 'विवाह, हवन, शांति एवं ज्योतिष परामर्श श्रेणियां',
    group: 'Puja & Pandit Services',
    groupHi: 'पूजा एवं पंडित सेवाएं',
  },
  payments: {
    title: 'Payments & Billing Transactions',
    desc: 'Revenue, subscription upgrades, and ceremony booking fee transactions',
    titleHi: 'भुगतान और बिलिंग लेनदेन',
    descHi: 'सदस्यता योजनाएं और पूजा बुकिंग शुल्क के सुरक्षित लेनदेन',
    group: 'Finance & Billing',
    groupHi: 'वित्त एवं बिलिंग',
  },
  memberships: {
    title: 'Memberships & Subscription Plans',
    desc: 'Inspect plan distributions and manually upgrade users',
    titleHi: 'सदस्यता और योजनाएं',
    descHi: 'सिल्वर, गोल्ड, प्लैटिनम और वीआईपी योजनाएं',
    group: 'Finance & Billing',
    groupHi: 'वित्त एवं बिलिंग',
  },
  withdrawals: {
    title: 'Pandit Payouts & Withdrawals',
    desc: 'Review pandit wallet withdrawal requests, bank details, and approve payouts',
    titleHi: 'पंडित भुगतान एवं निकासी',
    descHi: 'पंडित दक्षिणा निकासी अनुरोध एवं बैंक ट्रांसफर समीक्षा',
    group: 'Finance & Billing',
    groupHi: 'वित्त एवं बिलिंग',
  },
  'help-support': {
    title: 'Customer Inquiries & Support Tickets',
    desc: 'Dedicated relationship support and inquiry resolution for ShaadiBanao users',
    titleHi: 'ग्राहक सहायता और पूछताछ',
    descHi: 'सदस्यों की पूछताछ और संपर्क अनुरोध (फोन: 8076168502, व्हाट्सएप, ईमेल)',
    group: 'Communication & Support',
    groupHi: 'संचार एवं सहायता',
  },
  notifications: {
    title: 'Broadcast & System Notifications',
    desc: 'Send announcements, muhurat alerts, and updates to all or segmented mobile app users',
    titleHi: 'सिस्टम एवं ब्रॉडकास्ट सूचनाएं',
    descHi: 'मोबाइल सदस्यों को शुभ मुहूर्त, उत्सव एवं महत्वपूर्ण सूचनाएं भेजें',
    group: 'Communication & Support',
    groupHi: 'संचार एवं सहायता',
  },
  community: {
    title: 'Community Posts Moderation',
    desc: 'Review, approve, or reject user wedding stories and photo memories',
    titleHi: 'समुदाय पोस्ट्स समीक्षा',
    descHi: 'उपयोगकर्ताओं की विवाह यादें और पारिवारिक उत्सव',
    group: 'Communication & Support',
    groupHi: 'संचार एवं सहायता',
  },
  banners: {
    title: 'Public Banners & Promotions',
    desc: 'Upload public promotional banners to Cloudinary and inspect active display',
    titleHi: 'प्रचार बैनर प्रबंधन',
    descHi: 'मोबाइल ऐप के होम स्क्रीन बैनर प्रबंधित करें',
    group: 'Communication & Support',
    groupHi: 'संचार एवं सहायता',
  },
  users: {
    title: 'User Accounts Management',
    desc: 'Manage member privileges, suspensions, and account states',
    titleHi: 'उपयोगकर्ता खाते',
    descHi: 'सदस्य अधिकार, निलंबन और खाता स्थिति प्रबंधन',
    group: 'Core Operations',
    groupHi: 'मुख्य संचालन',
  },
  profiles: {
    title: 'Profile Moderation',
    desc: 'Verify identity documents, bios, and approve member photos',
    titleHi: 'प्रोफाइल सत्यापन',
    descHi: 'बायोडाटा और फोटो सत्यापन',
    group: 'Core Operations',
    groupHi: 'मुख्य संचालन',
  },
  verifications: {
    title: 'Identity & Aadhaar Verifications',
    desc: 'Inspect masked identity proofs and issue verified badges',
    titleHi: 'पहचान व आधार सत्यापन',
    descHi: 'सरकारी पहचान पत्र और आधार की सुरक्षित समीक्षा',
    group: 'Core Operations',
    groupHi: 'मुख्य संचालन',
  },
  reports: {
    title: 'Trust & Safety Operations',
    desc: 'Review user-reported accounts and enforce community safety',
    titleHi: 'सुरक्षा और रिपोर्ट प्रबंधन',
    descHi: 'आपत्तिजनक खातों की समीक्षा और अनुशासन',
    group: 'System & Trust',
    groupHi: 'सिस्टम व सुरक्षा',
  },
  audit: {
    title: 'Administrative Audit Trail',
    desc: 'Complete verifiable logs of all staff operations and approvals',
    titleHi: 'ऑडिट ट्रेल',
    descHi: 'प्रशासक गतिविधियों का संपूर्ण रिकॉर्ड',
    group: 'System & Trust',
    groupHi: 'सिस्टम व सुरक्षा',
  },
  'chat-management': {
    title: 'Chat & Conversations Management',
    desc: 'Monitor real-time conversations, free female chat usage, male subscription plans & safety moderation',
    titleHi: 'चैट एवं वार्तालाप प्रबंधन',
    descHi: 'महिला निःशुल्क चैट, पुरुष सदस्यता अधिकार और चैट सुरक्षा नियंत्रण',
    group: 'Communication & Support',
    groupHi: 'संचार एवं सहायता',
  },
  'calls-management': {
    title: 'Audio & Video Calls Management',
    desc: 'Real-time WebRTC session oversight, duration tracking, Pandit consultation billing, and platform commission splits',
    titleHi: 'ऑडियो व वीडियो कॉल्स प्रबंधन',
    descHi: 'वेबरटीसी लाइव कॉल्स, कॉल अवधि, पंडित परामर्श शुल्क व कमीशन विभाजन',
    group: 'Communication & Support',
    groupHi: 'संचार एवं सहायता',
  },
  settings: {
    title: 'System & Official Contact Settings',
    desc: 'Official platform configuration, support hotlines, and operations mode',
    titleHi: 'सिस्टम व आधिकारिक संपर्क सेटिंग्स',
    descHi: 'आधिकारिक सहायता नंबर: 8076168502, ईमेल: shaadibanao.urbanpower@gmail.com',
    group: 'System & Trust',
    groupHi: 'सिस्टम व सुरक्षा',
  },
  system: {
    title: 'System Health & Configuration',
    desc: 'Server, database, and authentication engine diagnostics',
    titleHi: 'सिस्टम स्वास्थ्य और कॉन्फ़िगरेशन',
    descHi: 'सर्वर, डेटाबेस और प्रमाणन इंजन स्थिति',
    group: 'System & Trust',
    groupHi: 'सिस्टम व सुरक्षा',
  },
  'error-monitoring': {
    title: 'Application Error Monitoring',
    desc: 'Live tracking of backend and frontend exceptions, failed bookings, APIs, and payments',
    titleHi: 'सिस्टम त्रुटि निगरानी (Error Monitoring)',
    descHi: 'विफल एपीआई, डेटाबेस त्रुटियां और बुकिंग समस्याओं की वास्तविक समय निगरानी',
    group: 'System & Trust',
    groupHi: 'सिस्टम व सुरक्षा',
  },
  'database-monitoring': {
    title: 'Database & MongoDB Monitoring',
    desc: 'Real-time MongoDB Atlas health, latency ping, collection document counts, and indexes',
    titleHi: 'डेटाबेस लाइव निगरानी',
    descHi: 'मोंगोडीबी एटलस लाइव स्थिति, लेटेंसी पिंग और 26+ संग्रहों के वास्तविक आंकड़े',
    group: 'System & Trust',
    groupHi: 'सिस्टम व सुरक्षा',
  },
};

function navigateToTab(tabName, updateHash = true) {
  if (!tabName) tabName = 'dashboard';
  activeTab = tabName;

  if (updateHash) {
    if (window.location.hash !== '#/' + tabName) {
      window.location.hash = '#/' + tabName;
    }
  }

  // Update active links
  document.querySelectorAll('.menu-link').forEach((link) => {
    const isTarget = link.getAttribute('data-tab') === tabName;
    link.classList.toggle('active', isTarget);
    if (isTarget) {
      const parentGroup = link.closest('.menu-group');
      if (parentGroup) {
        parentGroup.classList.add('expanded');
      }
    }
  });

  // Update sections
  document.querySelectorAll('.dashboard-section').forEach((sec) => {
    sec.style.display = sec.id === `tab-${tabName}` ? 'block' : 'none';
  });

  // Update breadcrumbs
  updateBreadcrumbs(tabName);

  // Update topbar headers
  const meta = tabTitles[tabName] || { title: 'Admin Portal', desc: 'Operations' };
  const titleEl = document.getElementById('current-page-title');
  const descEl = document.getElementById('current-page-desc');
  if (titleEl) titleEl.innerText = isHindiAdmin ? (meta.titleHi || meta.title) : meta.title;
  if (descEl) descEl.innerText = isHindiAdmin ? (meta.descHi || meta.desc) : meta.desc;

  refreshActiveTabData();
}

function refreshActiveTabData() {
  switch (activeTab) {
    case 'dashboard':
      loadDashboardStats();
      break;
    case 'approvals':
      loadApprovals();
      break;
    case 'pandits':
      loadPandits();
      break;
    case 'verifications':
      loadVerifications();
      break;
    case 'book-my-pandit':
      loadBookMyPanditRequests();
      break;
    case 'bookings':
      loadBookings();
      break;
    case 'community':
      loadCommunityPosts();
      break;
    case 'banners':
      loadBanners();
      break;
    case 'users':
      loadUsers();
      break;
    case 'profiles':
      loadProfiles();
      break;
    case 'memberships':
      loadMemberships();
      break;
    case 'reports':
      loadReports();
      break;
    case 'audit':
      loadAuditLogs();
      break;
    case 'system':
      loadSystemHealth();
      break;
    case 'payments':
      loadPayments();
      break;
    case 'services':
      loadServices();
      break;
    case 'categories':
      loadCategories();
      break;
    case 'notifications':
      loadNotifications();
      break;
    case 'help-support':
      loadHelpSupport();
      break;
    case 'chat-management':
      loadChatConversations();
      break;
    case 'calls-management':
      loadCallsList();
      break;
    case 'settings':
      loadSettings();
      break;
    case 'withdrawals':
      loadWithdrawals();
      break;
    case 'error-monitoring':
      loadErrorMonitoring();
      break;
    case 'database-monitoring':
      loadDatabaseMonitoring();
      break;
  }
}

// ==========================================================================
// 1. DASHBOARD METRICS
// ==========================================================================
async function loadDashboardStats() {
  try {
    const res = await adminFetch('/admin/dashboard');
    const data = res.data || {};

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val !== undefined ? Number(val).toLocaleString() : '0';
    };

    setVal('stat-total-users', data.totalUsers);
    setVal('stat-pending-approvals', data.pendingApprovals);
    setVal('stat-approved-users', data.approvedUsers);
    setVal('stat-rejected-users', data.rejectedUsers);
    setVal('stat-suspended-users', data.suspendedUsers);
    setVal('stat-active-memberships', data.activeMemberships);
    setVal('stat-pending-verifications', data.pendingVerifications);
    setVal('stat-open-reports', data.openReports);
    setVal('stat-total-pandits', data.totalPandits);
    setVal('stat-pending-pandits', data.pendingPandits);
    setVal('stat-total-bookings', data.totalBookings);
    setVal('stat-pending-posts', data.pendingCommunityPosts);

    // Update pending badges in sidebar
    const badge = document.getElementById('badge-pending-count');
    if (badge) {
      badge.innerText = data.pendingApprovals || 0;
      badge.style.display = data.pendingApprovals > 0 ? 'inline-block' : 'none';
    }

    const badgePandits = document.getElementById('badge-pandits-count');
    if (badgePandits) {
      badgePandits.innerText = data.pendingPandits || 0;
      badgePandits.style.display = data.pendingPandits > 0 ? 'inline-block' : 'none';
    }

    const badgeVerif = document.getElementById('badge-verif-count');
    if (badgeVerif) {
      badgeVerif.innerText = data.pendingIdentityRequests || 0;
      badgeVerif.style.display = data.pendingIdentityRequests > 0 ? 'inline-block' : 'none';
    }

    const badgePosts = document.getElementById('badge-posts-count');
    if (badgePosts) {
      badgePosts.innerText = data.pendingCommunityPosts || 0;
      badgePosts.style.display = data.pendingCommunityPosts > 0 ? 'inline-block' : 'none';
    }

    // Update action banner
    const banner = document.getElementById('approval-action-banner');
    const bannerCount = document.getElementById('banner-count');
    if (banner && bannerCount) {
      if (data.pendingApprovals > 0) {
        banner.style.display = 'flex';
        bannerCount.innerText = data.pendingApprovals;
      } else {
        banner.style.display = 'none';
      }
    }

    // Render Recent Users
    const tbodyUsers = document.getElementById('tbody-recent-users');
    if (tbodyUsers) {
      if (!data.recentUsers || data.recentUsers.length === 0) {
        tbodyUsers.innerHTML = '<tr><td colspan="6" class="table-empty">No recent registrations found</td></tr>';
      } else {
        tbodyUsers.innerHTML = data.recentUsers
          .map((u) => {
            const uid = u._id || u.id;
            const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A';
            const approvalBadge = getApprovalBadgeHtml(u.approvalStatus || 'pending');
            const statusBadge = u.status === 'active' ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Suspended</span>';
            const safeName = escapeJs(u.displayName || 'User');
            return `
              <tr>
                <td><strong>${escapeHtml(u.displayName || 'New User')}</strong></td>
                <td>${escapeHtml(u.email || u.mobile || 'N/A')}</td>
                <td>${statusBadge}</td>
                <td>${approvalBadge}</td>
                <td>${dateStr}</td>
                <td>
                  <div class="action-btn-group">
                    <button class="btn-act btn-act-view" onclick="openApplicantModal('${uid}')" title="View User Data & Photos">👁️ Data</button>
                    ${
                      u.approvalStatus !== 'rejected'
                        ? `<button class="btn-act btn-act-reject" onclick="openRejectModal('${uid}', '${safeName}')" title="Reject Account">✕ Reject</button>`
                        : ''
                    }
                  </div>
                </td>
              </tr>
            `;
          })
          .join('');
      }
    }

    // Render Recent Audits
    const tbodyAudits = document.getElementById('tbody-recent-audits');
    if (tbodyAudits) {
      if (!data.recentAudits || data.recentAudits.length === 0) {
        tbodyAudits.innerHTML = '<tr><td colspan="4" class="table-empty">No recent audit logs recorded</td></tr>';
      } else {
        tbodyAudits.innerHTML = data.recentAudits
          .map((a) => {
            const dateStr = a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-IN') : 'Just now';
            return `
              <tr>
                <td><span class="badge badge-info">${formatActionName(a.action)}</span></td>
                <td>${escapeHtml(a.adminEmail || a.adminName || 'Admin')}</td>
                <td>${escapeHtml(a.targetUserEmail || a.targetUserMobile || 'Member')}</td>
                <td>${dateStr}</td>
              </tr>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    showToast(`Failed to load dashboard metrics: ${err.message}`, 'error');
  }
}

// ==========================================================================
// 2. PENDING APPROVALS MODULE
// ==========================================================================
async function loadApprovals() {
  const tbody = document.getElementById('tbody-approvals');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading registration applicants...</td></tr>';

  try {
    const { page, limit, status, search } = appState.approvals;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      approvalStatus: status,
      ...(search ? { search } : {}),
    });

    const res = await adminFetch(`/admin/approvals?${params.toString()}`);
    const data = res.data || { items: [], total: 0, totalPages: 1 };
    appState.approvals.items = data.items;

    // Update pagination
    document.getElementById('approvals-pagination-info').innerText = `Showing ${data.items.length} of ${data.total} applicants`;
    document.getElementById('approvals-current-page').innerText = `Page ${data.page} of ${data.totalPages || 1}`;
    document.getElementById('btn-approvals-prev').disabled = data.page <= 1;
    document.getElementById('btn-approvals-next').disabled = data.page >= data.totalPages;

    if (data.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No applicants found for status "${status}"</td></tr>`;
      return;
    }

    tbody.innerHTML = data.items
      .map((item) => {
        const profile = item.profile;
        const photos = profile?.photos || [];
        const mainPhoto = photos.find((p) => p.isMain)?.variants?.avatar || photos.find((p) => p.isMain)?.url || photos[0]?.variants?.avatar || photos[0]?.url;
        const initials = (item.displayName || 'NA').slice(0, 2).toUpperCase();
        const safeName = escapeJs(item.displayName || 'Applicant');

        const avatarHtml = mainPhoto
          ? `<img src="${escapeHtml(cdnThumb(mainPhoto, 96, true))}" class="user-cell-avatar clickable-avatar" alt="Photo" onclick="openApplicantModal('${item.id}')" title="Click to inspect user data & photos" onerror="this.outerHTML='<div class=\\'user-cell-initials clickable-avatar\\' onclick=\\'openApplicantModal(&quot;${item.id}&quot;)\\'>${initials}</div>'"/>`
          : `<div class="user-cell-initials clickable-avatar" onclick="openApplicantModal('${item.id}')" title="Click to inspect user data">${initials}</div>`;

        const locationStr = profile ? [profile.city, profile.state].filter(Boolean).join(', ') : 'Location not submitted';
        const ageGender = profile ? `${profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : ''}${profile.age ? ` • ${profile.age} yrs` : ''}` : 'Basic details pending';

        const completionPercent = profile?.completenessPercent || (item.hasProfile ? 60 : 20);
        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : 'N/A';
        const approvalBadge = getApprovalBadgeHtml(item.approvalStatus);
        const photoPill = photos.length > 0 ? `<span class="photo-count-pill">📷 ${photos.length}</span>` : '';
        const latestVerif = item.latestVerification;
        const idDocPill = latestVerif
          ? `<div style="margin-top: 4px;"><span class="badge badge-info">🪪 ${escapeHtml(formatDocType(latestVerif.documentType))} (${escapeHtml(latestVerif.documentReferenceMasked || '')})</span></div>`
          : '';

        return `
          <tr>
            <td>
              <div class="user-cell">
                ${avatarHtml}
                <div>
                  <div class="user-cell-title">${escapeHtml(item.displayName || 'Applicant')}${photoPill}</div>
                  <div class="user-cell-sub">${escapeHtml(ageGender)} • ${escapeHtml(locationStr)}</div>
                  ${idDocPill}
                </div>
              </div>
            </td>
            <td>
              <div><strong>📱 ${escapeHtml(item.mobile || 'N/A')}</strong></div>
              <div class="user-cell-sub">✉️ ${escapeHtml(item.email || 'N/A')}</div>
            </td>
            <td>${dateStr}</td>
            <td>
              <div class="progress-bar-wrap">
                <div class="progress-fill" style="width: ${completionPercent}%;"></div>
              </div>
              <div class="user-cell-sub">${completionPercent}% Complete</div>
            </td>
            <td>${approvalBadge}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-act btn-act-view" onclick="openApplicantModal('${item.id}')" title="View Full Biodata & Photos">👁️ Data &amp; Photos</button>
                ${
                  latestVerif
                    ? `<button class="btn-act btn-act-view" onclick="viewVerificationDocument('${latestVerif.id}')" title="View Uploaded ID Proof">🪪 View ID</button>`
                    : ''
                }
                ${
                  item.approvalStatus !== 'approved'
                    ? `<button class="btn-act btn-act-approve" onclick="promptApproveUser('${item.id}', '${safeName}')">✓ Approve</button>`
                    : ''
                }
                ${
                  item.approvalStatus !== 'rejected'
                    ? `<button class="btn-act btn-act-reject" onclick="openRejectModal('${item.id}', '${safeName}')">✕ Reject</button>`
                    : ''
                }
                <button class="btn-act btn-act-changes" onclick="openRequestChangesModal('${item.id}', '${safeName}')">💬 Changes</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 6, err.message, 'loadApprovals', err.requestId);
  }
}

// Universal Live User Details & Photos Inspection Modal (works from ANY tab!)
async function openApplicantModal(userId) {
  if (!userId) return;
  activeInspectedUserId = userId;

  const modal = document.getElementById('applicant-modal');
  const nameEl = document.getElementById('modal-applicant-name');
  const badgeEl = document.getElementById('modal-applicant-badge');
  const bodyEl = document.getElementById('modal-applicant-content');
  const actionsEl = document.getElementById('modal-applicant-actions');

  if (!modal || !bodyEl) return;

  if (nameEl) nameEl.innerText = 'Loading User Data & Photos...';
  if (badgeEl) badgeEl.innerHTML = '<span class="badge badge-info">Fetching Live Data</span>';
  bodyEl.innerHTML = '<div class="table-empty">Loading full biodata, signed images, preferences, and moderation history...</div>';
  if (actionsEl) actionsEl.innerHTML = '<button class="btn-secondary" onclick="closeApplicantModal()">Close</button>';
  modal.style.display = 'flex';

  let item = null;
  try {
    const res = await adminFetch(`/admin/users/${userId}/details`);
    item = res.data;
  } catch (err) {
    // Fallback to cached approvals item if endpoint fails
    item = appState.approvals.items.find((i) => i.id === userId) || null;
    if (!item) {
      bodyEl.innerHTML = `<div class="table-empty text-red">⚠️ Failed to load user details: ${escapeHtml(err.message)}</div>`;
      return;
    }
  }

  activeInspectedUser = item;
  renderUserDetailsModal(item);
}

function renderUserDetailsModal(item) {
  const nameEl = document.getElementById('modal-applicant-name');
  const badgeEl = document.getElementById('modal-applicant-badge');
  const bodyEl = document.getElementById('modal-applicant-content');
  const actionsEl = document.getElementById('modal-applicant-actions');

  const safeName = escapeJs(item.displayName || 'Applicant');
  if (nameEl) nameEl.innerText = `${item.displayName || 'Applicant'} — User Data & Photos`;
  if (badgeEl) badgeEl.innerHTML = getApprovalBadgeHtml(item.approvalStatus);

  const profile = item.profile;
  const preferences = item.preferences;
  const kundli = item.kundli;
  const verifications = item.verifications || [];
  const reports = item.reports || [];

  // 1. Photos Gallery with Lightbox & Per-Photo Moderation (Always Available!)
  let galleryHtml = '';
  if (profile?.photos && profile.photos.length > 0) {
    galleryHtml = `
      <div style="margin-bottom: 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div class="bio-section-title" style="margin-bottom: 0;">📷 User Uploaded Photos (${profile.photos.length}) — Click Any Photo to Zoom</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-act btn-act-approve" onclick="moderateUserPhoto('${item.id}', 'approve')">✓ Approve All</button>
            <button class="btn-act btn-act-reject" onclick="moderateUserPhoto('${item.id}', 'reject')">✕ Reject All</button>
          </div>
        </div>
        <div class="bio-gallery">
          ${profile.photos
            .map((p, idx) => {
              const photoId = p.id || p._id || p.publicId || '';
              const thumbUrl = p.variants?.card || p.variants?.avatar || (p.url ? cdnThumb(p.url, 260, true) : FALLBACK_MEDIA_SVG);
              const fullUrl = p.variants?.hero || p.url || FALLBACK_MEDIA_SVG;
              const isApproved = p.approved !== false;
              const statusText = isApproved
                ? '<strong style="color: var(--success-green);">✓ Approved</strong>'
                : '<strong style="color: var(--danger-red);">✕ Rejected</strong>';
              return `
            <div class="bio-photo-card">
              <img
                src="${escapeHtml(thumbUrl)}"
                alt="Photo ${idx + 1}"
                onclick="openPhotoLightbox('${escapeJs(fullUrl)}', '${escapeJs(item.displayName || 'User')} — Photo #${idx + 1}', '${item.id}', '${escapeJs(photoId)}', ${isApproved ? 'true' : 'false'})"
                onerror="this.onerror=null; this.src=FALLBACK_MEDIA_SVG; this.classList.add('img-load-failed');"
              />
              <div class="bio-photo-meta">
                <div>
                  ${p.isMain ? '<span style="background: var(--primary-maroon); color: #fff; padding: 2px 5px; border-radius: 3px; font-weight: 700; font-size: 9px; display: inline-block; margin-right: 4px;">MAIN</span>' : ''}
                  ${p.url?.includes('cloudinary.com') ? '<span style="background: rgba(16, 185, 129, 0.18); color: var(--success-green); padding: 2px 5px; border-radius: 3px; font-weight: 700; font-size: 9px; display: inline-block;">☁️ CLOUD</span>' : ''}
                </div>
                <div>${statusText}</div>
                <div class="bio-photo-actions">
                  ${
                    !isApproved
                      ? `<button class="btn-xs btn-act-approve" onclick="moderateUserPhoto('${item.id}', 'approve', '${escapeJs(photoId)}')" title="Approve this photo">✓ Keep</button>`
                      : ''
                  }
                  ${
                    isApproved
                      ? `<button class="btn-xs btn-act-reject" onclick="moderateUserPhoto('${item.id}', 'reject', '${escapeJs(photoId)}')" title="Reject this photo">✕ Reject</button>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `;
            })
            .join('')}
        </div>
      </div>
    `;
  } else {
    galleryHtml = `
      <div style="margin-bottom: 16px; padding: 14px; background: rgba(245, 158, 11, 0.08); border-radius: 8px; border: 1px dashed rgba(245, 158, 11, 0.4);">
        <span style="color: var(--warning-amber); font-weight: 600;">📷 No profile photo uploaded by this user yet.</span>
      </div>
    `;
  }

  // 2. Verification Status Bar
  const phoneBadge = item.phoneVerified
    ? '<span class="badge badge-success">📱 Phone OTP Verified</span>'
    : '<span class="badge badge-warning">📱 Phone Pending</span>';

  const photoBadge = item.photoApprovalStatus === 'approved'
    ? '<span class="badge badge-success">📸 Photo Approved</span>'
    : item.photoApprovalStatus === 'rejected'
    ? '<span class="badge badge-danger">📸 Photo Rejected</span>'
    : item.photoApprovalStatus === 'none'
    ? '<span class="badge badge-muted">📸 No Photos</span>'
    : '<span class="badge badge-warning">📸 Photo Pending</span>';

  const idBadge = item.identityVerificationStatus === 'verified'
    ? '<span class="badge badge-success">🛡️ ID Verified</span>'
    : item.identityVerificationStatus === 'pending'
    ? '<span class="badge badge-warning">🛡️ ID Pending</span>'
    : item.identityVerificationStatus === 'rejected'
    ? '<span class="badge badge-danger">🛡️ ID Rejected</span>'
    : '<span class="badge badge-muted">🛡️ ID None</span>';

  const accountStatusBadge = item.status === 'suspended'
    ? '<span class="badge badge-danger">🚫 Suspended</span>'
    : '<span class="badge badge-success">● Active</span>';

  const completionPercent = profile?.completenessPercent || (item.hasProfile ? 60 : 20);

  // Height formatting
  const heightCm = profile?.heightCm;
  let heightStr = 'Not specified';
  if (heightCm) {
    const totalInches = Math.round(heightCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    heightStr = `${heightCm} cm (${feet}'${inches}")`;
  }

  // Identity Documents Card (Always inspectable & rejectable)
  let verificationsHtml = '';
  if (verifications.length > 0) {
    verificationsHtml = `
      <div class="bio-section-card">
        <div class="bio-section-title">🪪 Identity Proofs — Aadhaar / PAN / Voter ID / Passport / Passbook (${verifications.length})</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${verifications
            .map((v) => {
              const vBadge =
                v.status === 'verified'
                  ? '<span class="badge badge-success">✓ Verified</span>'
                  : v.status === 'rejected'
                  ? '<span class="badge badge-danger">✕ Rejected</span>'
                  : '<span class="badge badge-warning">⏳ Pending</span>';
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                  <div>
                    <strong>${escapeHtml(formatDocType(v.documentType))}</strong>
                    <code style="margin-left: 8px; color: var(--gold-accent-light);">${escapeHtml(v.documentReferenceMasked || '')}</code>
                    <span style="margin-left: 8px;">${vBadge}</span>
                  </div>
                  <div class="action-buttons">
                    <button class="btn-secondary btn-xs" onclick="viewVerificationDocument('${v.id}')">👁️ View Doc</button>
                    ${v.status !== 'verified' ? `<button class="btn-act btn-act-approve btn-xs" onclick="approveVerification('${v.id}')">✓ Verify &amp; Unlock</button>` : ''}
                    ${v.status !== 'rejected' ? `<button class="btn-act btn-act-reject btn-xs" onclick="rejectVerification('${v.id}')">✕ Reject</button>` : ''}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // Partner Preferences Card
  let preferencesHtml = '';
  if (preferences) {
    preferencesHtml = `
      <div class="bio-section-card">
        <div class="bio-section-title">💑 Partner Preferences</div>
        <div class="bio-grid" style="margin-bottom: 0;">
          <div class="bio-item">
            <div class="bio-label">Age Range</div>
            <div class="bio-val">${preferences.minAge} to ${preferences.maxAge} years</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Height Range</div>
            <div class="bio-val">${preferences.minHeightCm} cm to ${preferences.maxHeightCm} cm</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Preferred Religions</div>
            <div class="bio-val">${escapeHtml(preferences.religions?.length ? preferences.religions.join(', ') : 'Any')}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Preferred Mother Tongues</div>
            <div class="bio-val">${escapeHtml(preferences.motherTongues?.length ? preferences.motherTongues.join(', ') : 'Any')}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Preferred Cities / Locations</div>
            <div class="bio-val">${escapeHtml(preferences.cities?.length ? preferences.cities.join(', ') : 'Any city')}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Manglik Preference</div>
            <div class="bio-val" style="text-transform: capitalize;">${escapeHtml(preferences.manglikPreference || 'Any')}</div>
          </div>
        </div>
      </div>
    `;
  }

  // Kundli / Horoscope Card
  let kundliHtml = '';
  if (kundli) {
    kundliHtml = `
      <div class="bio-section-card">
        <div class="bio-section-title">🔮 Vedic Kundli &amp; Astrology Details</div>
        <div class="bio-grid" style="margin-bottom: 0;">
          <div class="bio-item">
            <div class="bio-label">Moon Sign (Rashi)</div>
            <div class="bio-val">${escapeHtml(kundli.rashi || 'Not specified')}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Birth Nakshatra &amp; Charan</div>
            <div class="bio-val">${escapeHtml(kundli.nakshatra || 'Not specified')} (Charan ${kundli.charan || 1})</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Time of Birth</div>
            <div class="bio-val">${escapeHtml(kundli.timeOfBirth || 'Not specified')} ${kundli.isApproximateTime ? '(Approx)' : '(Exact)'}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Place of Birth</div>
            <div class="bio-val">${escapeHtml([kundli.birthPlace?.name, kundli.birthPlace?.state, kundli.birthPlace?.country].filter(Boolean).join(', ') || 'Not specified')}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Manglik Kundli Status</div>
            <div class="bio-val" style="text-transform: capitalize;">${escapeHtml(kundli.manglikStatus || 'Not specified')}</div>
          </div>
          <div class="bio-item">
            <div class="bio-label">Chart Visibility</div>
            <div class="bio-val" style="text-transform: capitalize;">${escapeHtml(kundli.visibility || 'Matches Only')}</div>
          </div>
        </div>
      </div>
    `;
  }

  // Safety Reports against this user
  let reportsHtml = '';
  if (reports.length > 0) {
    reportsHtml = `
      <div class="bio-section-card" style="border-color: rgba(239, 68, 68, 0.35);">
        <div class="bio-section-title" style="color: var(--danger-red);">⚠️ Safety Reports Against User (${reports.length})</div>
        ${reports
          .map(
            (r) => `
          <div style="font-size: 12.5px; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
            <span class="badge badge-danger">${escapeHtml(r.category || 'report')}</span>
            <span style="margin-left: 6px;">${escapeHtml(r.reason || 'No details')}</span>
            <span class="text-muted" style="margin-left: 6px;">(by ${escapeHtml(r.reporterName || 'Member')})</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  // Approval / Rejection History Banner (Checks actual current approvalStatus first!)
  let historyHtml = '';
  if (item.approvalStatus === 'rejected') {
    historyHtml = `
      <div style="margin-top: 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger-red); padding: 12px; border-radius: 6px;">
        <strong style="color: var(--danger-red);">✕ Account Currently Rejected</strong><br>
        <strong>Reason:</strong> ${escapeHtml(item.rejectionReason || 'Not specified')}<br>
        <strong>Remarks:</strong> ${escapeHtml(item.moderationRemarks || 'None')}
      </div>
    `;
  } else if (item.approvalStatus === 'changes_requested') {
    historyHtml = `
      <div style="margin-top: 14px; background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning-amber); padding: 12px; border-radius: 6px;">
        <strong style="color: var(--warning-amber);">💬 Changes Requested From User</strong><br>
        <strong>Remarks:</strong> ${escapeHtml(item.moderationRemarks || 'None')}
      </div>
    `;
  } else if (item.approvalStatus === 'approved' && item.approvedAt) {
    historyHtml = `
      <div style="margin-top: 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success-green); padding: 10px 14px; border-radius: 6px;">
        <span style="color: var(--success-green); font-weight: 700;">✓ Account Approved</span> by staff ID <code>${escapeHtml(item.approvedBy || 'Admin')}</code> on ${new Date(item.approvedAt).toLocaleString('en-IN')}
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <!-- Top Account Verification Status Bar -->
    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 16px;">
      <div>
        <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Account ID:</span>
        <code style="font-weight: 700; color: var(--gold-accent-light); margin-left: 4px;">${escapeHtml(item.id)}</code>
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
        ${accountStatusBadge}
        ${phoneBadge}
        ${photoBadge}
        ${idBadge}
        <span class="badge badge-info">${completionPercent}% Complete</span>
        <span class="badge badge-warning">${escapeHtml((item.membership?.planId || 'free').toUpperCase())}</span>
      </div>
    </div>

    <!-- Photos Gallery -->
    ${galleryHtml}

    <!-- Detailed Matrimonial Biodata -->
    <div class="bio-section-title">📋 Personal Biodata, Contact &amp; Family Background</div>
    <div class="bio-grid">
      <div class="bio-item">
        <div class="bio-label">Full Name</div>
        <div class="bio-val">${escapeHtml(profile ? `${profile.firstName} ${profile.lastName}` : item.displayName || 'N/A')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Mobile &amp; Email</div>
        <div class="bio-val">${escapeHtml(item.mobile || 'No mobile')} • ${escapeHtml(item.email || 'No email')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Gender &amp; Age</div>
        <div class="bio-val" style="text-transform: capitalize;">${escapeHtml(profile?.gender || 'N/A')} ${profile?.age ? `(${profile.age} years)` : ''}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Date of Birth</div>
        <div class="bio-val">${profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN') : 'N/A'}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Height</div>
        <div class="bio-val">${escapeHtml(heightStr)}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Marital Status</div>
        <div class="bio-val" style="text-transform: capitalize;">${escapeHtml((profile?.maritalStatus || 'never_married').replace(/_/g, ' '))}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Mother Tongue</div>
        <div class="bio-val">${escapeHtml(profile?.motherTongue || 'N/A')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Religion &amp; Community</div>
        <div class="bio-val">${escapeHtml(profile?.religion || 'Hindu')} ${profile?.caste ? `• ${escapeHtml(profile.caste)}` : ''}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Gotra &amp; Manglik</div>
        <div class="bio-val">${escapeHtml(profile?.gotra || 'Not specified')} • Manglik: ${escapeHtml(profile?.manglik || 'No')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Location (City, State)</div>
        <div class="bio-val">${escapeHtml([profile?.city, profile?.state, profile?.country].filter(Boolean).join(', ') || 'N/A')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Family Background</div>
        <div class="bio-val" style="text-transform: capitalize;">${escapeHtml(profile?.familyValues || 'Moderate')} values • ${escapeHtml(profile?.familyType || 'Nuclear')} family</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Father's Occupation</div>
        <div class="bio-val">${escapeHtml(profile?.fatherOccupation || 'Not specified')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Mother's Occupation</div>
        <div class="bio-val">${escapeHtml(profile?.motherOccupation || 'Not specified')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Highest Education</div>
        <div class="bio-val">${escapeHtml(profile?.education || 'N/A')}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Profession &amp; Employed In</div>
        <div class="bio-val">${escapeHtml(profile?.occupation || 'N/A')} (${escapeHtml(profile?.employedIn || 'private')})</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Annual Income Band</div>
        <div class="bio-val">${escapeHtml(profile?.annualIncomeBand || 'Confidential')} ${profile?.showIncomeBand ? '(Public)' : '(Hidden)'}</div>
      </div>
      <div class="bio-item">
        <div class="bio-label">Registration Date</div>
        <div class="bio-val">${item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'N/A'}</div>
      </div>
    </div>

    ${
      profile?.aboutMe
        ? `
      <div style="margin-top: 14px;">
        <div class="bio-label" style="margin-bottom: 6px;">About Applicant &amp; Partner Expectations</div>
        <div class="bio-about">${escapeHtml(profile.aboutMe)}</div>
      </div>
    `
        : ''
    }

    <!-- Identity Documents -->
    ${verificationsHtml}

    <!-- Partner Preferences Card -->
    ${preferencesHtml}

    <!-- Kundli / Astrology Card -->
    ${kundliHtml}

    <!-- Safety Reports -->
    ${reportsHtml}

    <!-- Decision / Rejection Audit History -->
    ${historyHtml}
  `;

  actionsEl.innerHTML = `
    <button class="btn-secondary" onclick="closeApplicantModal()">Close</button>
    <button class="btn-act btn-act-changes" onclick="closeApplicantModal(); openRequestChangesModal('${item.id}', '${safeName}')">💬 Request Changes</button>
    <button class="btn-act btn-act-reject" onclick="closeApplicantModal(); openRejectModal('${item.id}', '${safeName}')">✕ Reject Account</button>
    ${
      item.approvalStatus !== 'approved'
        ? `<button class="btn-act btn-act-approve" onclick="closeApplicantModal(); promptApproveUser('${item.id}', '${safeName}')">✓ Approve Account</button>`
        : ''
    }
  `;
}

function openPhotoLightbox(url, title, userId, photoId, isApproved) {
  const modal = document.getElementById('photo-lightbox-modal');
  const img = document.getElementById('lightbox-img');
  const titleEl = document.getElementById('lightbox-title');
  const badgeEl = document.getElementById('lightbox-status-badge');
  const actionsEl = document.getElementById('lightbox-actions');
  if (!modal || !img) return;

  img.src = url || FALLBACK_MEDIA_SVG;
  img.onerror = () => {
    img.src = FALLBACK_MEDIA_SVG;
  };
  if (titleEl) titleEl.innerText = title || 'User Photo';
  if (badgeEl) {
    badgeEl.className = `badge ${isApproved ? 'badge-success' : 'badge-danger'}`;
    badgeEl.innerText = isApproved ? '✓ Approved Photo' : '✕ Rejected Photo';
  }
  if (actionsEl) {
    const openOriginalBtn = url && !url.startsWith('data:')
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration: none;">Open Original ↗</a>`
      : '';
    actionsEl.innerHTML = `
      <button class="btn-secondary" onclick="closePhotoLightbox()">Close</button>
      ${openOriginalBtn}
      ${
        userId
          ? `
            <button class="btn-act btn-act-approve" onclick="moderateUserPhoto('${userId}', 'approve', '${escapeJs(photoId || '')}'); closePhotoLightbox();">✓ Approve Photo</button>
            <button class="btn-act btn-act-reject" onclick="moderateUserPhoto('${userId}', 'reject', '${escapeJs(photoId || '')}'); closePhotoLightbox();">✕ Reject Photo</button>
          `
          : ''
      }
    `;
  }
  modal.style.display = 'flex';
}

function closePhotoLightbox() {
  const modal = document.getElementById('photo-lightbox-modal');
  if (modal) modal.style.display = 'none';
}

async function moderateUserPhoto(userId, action, photoId) {
  try {
    const payload = {
      action,
      remarks: `Moderated via admin panel: ${action}`,
      ...(photoId ? { photoId } : {}),
    };
    await adminFetch(`/admin/photos/${userId}/moderate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast(`Profile photo ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
    refreshAllUserViews();
    if (activeInspectedUserId === userId && document.getElementById('applicant-modal')?.style.display === 'flex') {
      openApplicantModal(userId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function refreshAllUserViews() {
  loadDashboardStats();
  if (activeTab === 'approvals') loadApprovals();
  if (activeTab === 'users') loadUsers();
  if (activeTab === 'profiles') loadProfiles();
  if (activeTab === 'reports') loadReports();
}

function closeApplicantModal() {
  document.getElementById('applicant-modal').style.display = 'none';
  activeInspectedUserId = null;
  activeInspectedUser = null;
}

// Approval Action
function promptApproveUser(userId, name) {
  openConfirmModal(
    'Approve Registration',
    `Are you sure you want to approve "${name}"? This will unlock full access to partner search, matchmaking, and chat.`,
    async () => {
      try {
        await adminFetch(`/admin/approvals/${userId}/approve`, { method: 'POST' });
        showToast(`Account for "${name}" approved successfully!`);
        refreshAllUserViews();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// Rejection Modal
function openRejectModal(userId, name) {
  activeModalUserId = userId;
  activeModalUserName = name;
  const modal = document.getElementById('reject-modal');
  document.getElementById('reject-target-name').innerText = name;
  document.getElementById('reject-reason-select').value = '';
  document.getElementById('reject-remarks').value = '';
  modal.style.display = 'flex';
}

function closeRejectModal() {
  document.getElementById('reject-modal').style.display = 'none';
  activeModalUserId = null;
}

// Request Changes Modal
function openRequestChangesModal(userId, name) {
  activeModalUserId = userId;
  activeModalUserName = name;
  const modal = document.getElementById('request-changes-modal');
  document.getElementById('changes-target-name').innerText = name;
  document.getElementById('changes-remarks').value = '';
  modal.style.display = 'flex';
}

function closeRequestChangesModal() {
  document.getElementById('request-changes-modal').style.display = 'none';
  activeModalUserId = null;
}

// Generic Confirm Modal
function openConfirmModal(title, message, onConfirm) {
  document.getElementById('confirm-modal-title').innerText = title;
  document.getElementById('confirm-modal-message').innerText = message;
  genericConfirmAction = onConfirm;
  document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').style.display = 'none';
  genericConfirmAction = null;
}

// ==========================================================================
// 3. USER MANAGEMENT MODULE
// ==========================================================================
async function loadUsers() {
  const tbody = document.getElementById('tbody-users');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading users...</td></tr>';

  try {
    const { page, limit, status, approvalStatus, search } = appState.users;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status ? { status } : {}),
      ...(approvalStatus && approvalStatus !== 'all' ? { approvalStatus } : {}),
      ...(search ? { search } : {}),
    });

    const res = await adminFetch(`/admin/users?${params.toString()}`);
    const data = res.data || { users: [], total: 0, totalPages: 1 };

    document.getElementById('users-pagination-info').innerText = `Showing ${data.users.length} of ${data.total} users`;
    document.getElementById('users-current-page').innerText = `Page ${data.page} of ${data.totalPages || 1}`;
    document.getElementById('btn-users-prev').disabled = data.page <= 1;
    document.getElementById('btn-users-next').disabled = data.page >= data.totalPages;

    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No users match criteria</td></tr>';
      return;
    }

    tbody.innerHTML = data.users
      .map((u) => {
        const uid = u._id || u.id;
        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A';
        const roleBadge = u.role === 'admin' ? '<span class="badge badge-info">Admin</span>' : '<span class="badge badge-muted">Member</span>';
        const statusBadge = u.status === 'active' ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Suspended</span>';
        const approvalBadge = getApprovalBadgeHtml(u.approvalStatus || 'pending');
        const planName = (u.membership?.planId || 'free').toUpperCase();
        const displayName = u.displayName || (u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : 'Member');
        const safeName = escapeJs(displayName);
        const initials = (displayName || 'MB').slice(0, 2).toUpperCase();
        const photoUrl = u.mainPhotoUrl || u.profile?.mainPhotoUrl || u.avatarUrl;
        const photosCount = u.photosCount || u.profile?.photosCount || u.profile?.photos?.length || 0;

        const avatarHtml = photoUrl
          ? `<img src="${escapeHtml(cdnThumb(photoUrl, 96, true))}" class="user-cell-avatar clickable-avatar" alt="User Photo" onclick="openApplicantModal('${uid}')" title="Click to inspect user data & photos" onerror="this.outerHTML='<div class=\\'user-cell-initials clickable-avatar\\' onclick=\\'openApplicantModal(&quot;${uid}&quot;)\\'>${initials}</div>'"/>`
          : `<div class="user-cell-initials clickable-avatar" onclick="openApplicantModal('${uid}')" title="Click to inspect user data">${initials}</div>`;
        const photoPill = photosCount > 0 ? `<span class="photo-count-pill">📷 ${photosCount}</span>` : '';

        return `
          <tr>
            <td>
              <div class="user-cell">
                ${avatarHtml}
                <div>
                  <div class="user-cell-title">${escapeHtml(displayName)}${photoPill}</div>
                  <div class="user-cell-sub">${escapeHtml(u.email || u.mobile || 'N/A')}</div>
                </div>
              </div>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td>${approvalBadge}</td>
            <td><span class="badge badge-warning">${escapeHtml(planName)}</span></td>
            <td>${dateStr}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-act btn-act-view" onclick="openApplicantModal('${uid}')" title="View Full Biodata & Photos">👁️ Data &amp; Photos</button>
                ${
                  u.approvalStatus !== 'approved'
                    ? `<button class="btn-act btn-act-approve" onclick="promptApproveUser('${uid}', '${safeName}')" title="Approve Account">✓ Approve</button>`
                    : ''
                }
                ${
                  u.approvalStatus !== 'rejected'
                    ? `<button class="btn-act btn-act-reject" onclick="openRejectModal('${uid}', '${safeName}')" title="Reject Account">✕ Reject</button>`
                    : ''
                }
                ${
                  u.status === 'active'
                    ? `<button class="btn-act btn-act-changes" onclick="toggleUserStatus('${uid}', 'suspended', '${safeName}')">Suspend</button>`
                    : `<button class="btn-act btn-act-approve" onclick="toggleUserStatus('${uid}', 'active', '${safeName}')">Activate</button>`
                }
                <button class="btn-act btn-act-view" onclick="toggleUserRole('${uid}', '${u.role === 'admin' ? 'member' : 'admin'}', '${safeName}')">
                  ${u.role === 'admin' ? 'Make Member' : 'Make Admin'}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 7, err.message, 'loadUsers', err.requestId);
  }
}

function toggleUserStatus(userId, newStatus, name) {
  openConfirmModal(
    `${newStatus === 'suspended' ? 'Suspend' : 'Activate'} Account`,
    `Are you sure you want to change status of "${name}" to ${newStatus}?`,
    async () => {
      try {
        await adminFetch(`/admin/users/${userId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        });
        showToast(`User status updated to ${newStatus}.`);
        loadUsers();
        loadDashboardStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

function toggleUserRole(userId, newRole, name) {
  openConfirmModal(
    'Change User Role',
    `Are you sure you want to promote/demote "${name}" to role "${newRole}"?`,
    async () => {
      try {
        await adminFetch(`/admin/users/${userId}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: newRole }),
        });
        showToast(`User role updated to ${newRole}.`);
        loadUsers();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  );
}

// ==========================================================================
// 4. PROFILE MODERATION MODULE
// ==========================================================================
async function loadProfiles() {
  const tbody = document.getElementById('tbody-profiles');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading profiles...</td></tr>';

  try {
    const { page, limit, isVerified, search } = appState.profiles;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(isVerified !== '' ? { isVerified } : {}),
      ...(search ? { search } : {}),
    });

    const res = await adminFetch(`/admin/profiles?${params.toString()}`);
    const data = res.data || { profiles: [], total: 0, totalPages: 1 };

    document.getElementById('profiles-pagination-info').innerText = `Showing ${data.profiles.length} of ${data.total} profiles`;
    document.getElementById('profiles-current-page').innerText = `Page ${data.page} of ${data.totalPages || 1}`;
    document.getElementById('btn-profiles-prev').disabled = data.page <= 1;
    document.getElementById('btn-profiles-next').disabled = data.page >= data.totalPages;

    if (data.profiles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No matrimonial profiles found</td></tr>';
      return;
    }

    tbody.innerHTML = data.profiles
      .map((p) => {
        const userObj = p.userId && typeof p.userId === 'object' ? p.userId : null;
        const userId = userObj?._id || userObj?.id || (typeof p.userId === 'string' ? p.userId : '');
        const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || userObj?.displayName || 'Member';
        const safeName = escapeJs(fullName);
        const initials = fullName.slice(0, 2).toUpperCase();
        const locationStr = [p.city, p.state].filter(Boolean).join(', ') || 'N/A';
        const ageGender = `${p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'N/A'}${p.age ? ` • ${p.age} yrs` : ''}`;
        const approvalStatus = userObj?.approvalStatus || 'pending';
        const approvalBadge = getApprovalBadgeHtml(approvalStatus);
        const verifyBadge = p.isVerified
          ? '<span class="badge badge-success">✓ Verified Trust</span>'
          : '<span class="badge badge-warning">Unverified</span>';

        const photosCount = p.photosCount || p.photos?.length || 0;
        const thumbUrl = p.mainPhotoUrl || p.photos?.[0]?.variants?.avatar || p.photos?.[0]?.url;
        const avatarHtml = thumbUrl
          ? `<img src="${escapeHtml(cdnThumb(thumbUrl, 96, true))}" class="user-cell-avatar clickable-avatar" alt="Profile Photo" onclick="openApplicantModal('${userId}')" title="Click to view all photos & biodata" onerror="this.outerHTML='<div class=\\'user-cell-initials clickable-avatar\\' onclick=\\'openApplicantModal(&quot;${userId}&quot;)\\'>${initials}</div>'"/>`
          : `<div class="user-cell-initials clickable-avatar" onclick="openApplicantModal('${userId}')" title="Click to view biodata">${initials}</div>`;
        const photoPill = photosCount > 0 ? `<span class="photo-count-pill">📷 ${photosCount}</span>` : '';

        return `
          <tr>
            <td>
              <div class="user-cell">
                ${avatarHtml}
                <div>
                  <div class="user-cell-title">${escapeHtml(fullName)}${photoPill}</div>
                  <div class="user-cell-sub">${escapeHtml(p.education || 'Graduate')} • ${escapeHtml(p.occupation || 'Professional')}</div>
                </div>
              </div>
            </td>
            <td>${escapeHtml(ageGender)}</td>
            <td>${escapeHtml(locationStr)}</td>
            <td>
              <div class="progress-bar-wrap">
                <div class="progress-fill" style="width: ${p.completenessPercent || 0}%;"></div>
              </div>
              <div class="user-cell-sub">${p.completenessPercent || 0}% Complete</div>
            </td>
            <td>
              <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                ${approvalBadge}
                ${verifyBadge}
              </div>
            </td>
            <td>
              <div class="action-btn-group">
                ${userId ? `<button class="btn-act btn-act-view" onclick="openApplicantModal('${userId}')" title="View Full Biodata & Photos">👁️ Data &amp; Photos</button>` : ''}
                ${userId && approvalStatus !== 'approved' ? `<button class="btn-act btn-act-approve" onclick="promptApproveUser('${userId}', '${safeName}')">✓ Approve</button>` : ''}
                ${userId && approvalStatus !== 'rejected' ? `<button class="btn-act btn-act-reject" onclick="openRejectModal('${userId}', '${safeName}')">✕ Reject</button>` : ''}
                <button class="btn-act ${p.isVerified ? 'btn-act-changes' : 'btn-act-approve'}" onclick="toggleProfileVerify('${p._id}', ${!p.isVerified})">
                  ${p.isVerified ? 'Revoke Trust' : '✓ Verify Trust'}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 6, err.message, 'loadProfiles', err.requestId);
  }
}

async function toggleProfileVerify(profileId, newVerify) {
  try {
    await adminFetch(`/admin/profiles/${profileId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified: newVerify, photoChecked: true }),
    });
    showToast(`Profile verification updated to ${newVerify ? 'VERIFIED' : 'UNVERIFIED'}.`);
    loadProfiles();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 5. TRUST & SAFETY REPORTS
// ==========================================================================
async function loadReports() {
  const tbody = document.getElementById('tbody-reports');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading safety reports...</td></tr>';

  try {
    const { page, limit, status } = appState.reports;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status && status !== 'all' ? { status } : {}),
    });

    const res = await adminFetch(`/admin/reports?${params.toString()}`);
    const data = res.data || { reports: [], total: 0, totalPages: 1 };

    document.getElementById('reports-pagination-info').innerText = `Showing ${data.reports.length} of ${data.total} reports`;
    document.getElementById('reports-current-page').innerText = `Page ${data.page} of ${data.totalPages || 1}`;
    document.getElementById('btn-reports-prev').disabled = data.page <= 1;
    document.getElementById('btn-reports-next').disabled = data.page >= data.totalPages;

    if (data.reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No active reports found</td></tr>';
      return;
    }

    tbody.innerHTML = data.reports
      .map((r) => {
        const reported = r.reportedUserId && typeof r.reportedUserId === 'object' ? r.reportedUserId : {};
        const reportedId = reported._id || reported.id || (typeof r.reportedUserId === 'string' ? r.reportedUserId : '');
        const reportedName = reported.displayName || 'Reported Member';
        const safeReportedName = escapeJs(reportedName);
        const reporter = r.reporterId || {};
        const badgeClass = r.status === 'pending' ? 'badge-warning' : r.status === 'actioned' ? 'badge-danger' : 'badge-muted';

        return `
          <tr>
            <td>
              <strong>${escapeHtml(reportedName)}</strong>
              <div class="user-cell-sub">${escapeHtml(reported.email || reported.mobile || 'ID: ' + reportedId)}</div>
            </td>
            <td>
              <strong>${escapeHtml(reporter.displayName || 'Reporter')}</strong>
              <div class="user-cell-sub">${escapeHtml(reporter.email || reporter.mobile || 'Member')}</div>
            </td>
            <td><span class="badge badge-warning">${escapeHtml(r.category || 'inappropriate_behavior')}</span></td>
            <td>${escapeHtml(r.reason || r.description || 'No reason provided')}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(r.status || 'pending')}</span></td>
            <td>
              <div class="action-btn-group">
                ${reportedId ? `<button class="btn-act btn-act-view" onclick="openApplicantModal('${reportedId}')">👁️ Inspect</button>` : ''}
                ${reportedId ? `<button class="btn-act btn-act-reject" onclick="openRejectModal('${reportedId}', '${safeReportedName}')">✕ Reject</button>` : ''}
                <button class="btn-act btn-act-changes" onclick="actionReport('${r._id}', 'actioned', 'suspended')">Suspend</button>
                <button class="btn-act btn-act-approve" onclick="actionReport('${r._id}', 'dismissed', 'none')">Dismiss</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 6, err.message, 'loadReports', err.requestId);
  }
}

async function actionReport(reportId, status, actionTaken) {
  try {
    await adminFetch(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, actionTaken }),
    });
    showToast(`Report updated to ${status}. Action: ${actionTaken}.`);
    loadReports();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 6. ADMIN AUDIT LOGS
// ==========================================================================
async function loadAuditLogs() {
  const tbody = document.getElementById('tbody-audit-logs');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Loading audit logs...</td></tr>';

  try {
    const { page, limit, action, search } = appState.audit;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(action && action !== 'all' ? { action } : {}),
      ...(search ? { search } : {}),
    });

    const res = await adminFetch(`/admin/audit-logs?${params.toString()}`);
    const data = res.data || { logs: [], total: 0, totalPages: 1 };

    document.getElementById('audit-pagination-info').innerText = `Showing ${data.logs.length} of ${data.total} audit entries`;
    document.getElementById('audit-current-page').innerText = `Page ${data.page} of ${data.totalPages || 1}`;
    document.getElementById('btn-audit-prev').disabled = data.page <= 1;
    document.getElementById('btn-audit-next').disabled = data.page >= data.totalPages;

    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No audit logs recorded for filter</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs
      .map((l) => {
        const dateStr = l.createdAt ? new Date(l.createdAt).toLocaleString('en-IN') : 'N/A';
        const detailsStr = l.details ? JSON.stringify(l.details) : '-';

        return `
          <tr>
            <td>${dateStr}</td>
            <td><span class="badge badge-info">${formatActionName(l.action)}</span></td>
            <td><strong>${escapeHtml(l.adminEmail || l.adminName || 'Admin')}</strong></td>
            <td>${escapeHtml(l.targetUserEmail || l.targetUserMobile || l.targetUserId || '-')}</td>
            <td><code style="font-size: 11px; color: var(--gold-accent-light);">${escapeHtml(detailsStr)}</code></td>
            <td>${escapeHtml(l.ipAddress || '127.0.0.1')}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 6, err.message, 'loadAuditLogs', err.requestId);
  }
}

// ==========================================================================
// 7. SYSTEM CONFIG & HEALTH
// ==========================================================================
async function loadSystemHealth() {
  try {
    const res = await adminFetch('/health');
    const d = res.data || {};

    const dbHostEl = document.getElementById('sys-db-host');
    const dbStatusEl = document.getElementById('sys-db-status');
    const envEl = document.getElementById('sys-env');

    if (dbHostEl) dbHostEl.innerText = d.database?.host || 'MongoDB Atlas Connected';
    if (dbStatusEl) dbStatusEl.innerText = d.database?.status === 'connected' ? 'Online (Atlas Sharded)' : 'Connecting...';
    if (envEl) envEl.innerText = d.environment || 'development';
  } catch {
    // Non-blocking
  }
}

// Event Listeners for Filters & Modals
function setupEventListeners() {
  // Approvals Filter Pills
  document.querySelectorAll('[data-filter-approval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-approval]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appState.approvals.status = btn.getAttribute('data-filter-approval');
      appState.approvals.page = 1;
      loadApprovals();
    });
  });

  // Approvals Search
  const searchApprovals = document.getElementById('search-approvals');
  let searchTimeout = null;
  searchApprovals?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      appState.approvals.search = e.target.value.trim();
      appState.approvals.page = 1;
      loadApprovals();
    }, 350);
  });

  // Approvals Pagination
  document.getElementById('btn-approvals-prev')?.addEventListener('click', () => {
    if (appState.approvals.page > 1) {
      appState.approvals.page--;
      loadApprovals();
    }
  });

  document.getElementById('btn-approvals-next')?.addEventListener('click', () => {
    appState.approvals.page++;
    loadApprovals();
  });

  // Users Filters & Search
  document.getElementById('filter-user-status')?.addEventListener('change', (e) => {
    appState.users.status = e.target.value;
    appState.users.page = 1;
    loadUsers();
  });

  document.getElementById('filter-user-approval')?.addEventListener('change', (e) => {
    appState.users.approvalStatus = e.target.value;
    appState.users.page = 1;
    loadUsers();
  });

  const searchUsers = document.getElementById('search-users');
  searchUsers?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      appState.users.search = e.target.value.trim();
      appState.users.page = 1;
      loadUsers();
    }, 350);
  });

  document.getElementById('btn-users-prev')?.addEventListener('click', () => {
    if (appState.users.page > 1) {
      appState.users.page--;
      loadUsers();
    }
  });

  document.getElementById('btn-users-next')?.addEventListener('click', () => {
    appState.users.page++;
    loadUsers();
  });

  document.getElementById('btn-refresh-users')?.addEventListener('click', () => {
    loadUsers();
  });

  // Profile Moderation Filters, Search & Pagination
  document.getElementById('filter-profile-verified')?.addEventListener('change', (e) => {
    appState.profiles.isVerified = e.target.value;
    appState.profiles.page = 1;
    loadProfiles();
  });

  const searchProfiles = document.getElementById('search-profiles');
  searchProfiles?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      appState.profiles.search = e.target.value.trim();
      appState.profiles.page = 1;
      loadProfiles();
    }, 350);
  });

  document.getElementById('btn-profiles-prev')?.addEventListener('click', () => {
    if (appState.profiles.page > 1) {
      appState.profiles.page--;
      loadProfiles();
    }
  });

  document.getElementById('btn-profiles-next')?.addEventListener('click', () => {
    appState.profiles.page++;
    loadProfiles();
  });

  // Reports Filter & Pagination
  document.getElementById('filter-report-status')?.addEventListener('change', (e) => {
    appState.reports.status = e.target.value;
    appState.reports.page = 1;
    loadReports();
  });

  document.getElementById('btn-reports-prev')?.addEventListener('click', () => {
    if (appState.reports.page > 1) {
      appState.reports.page--;
      loadReports();
    }
  });

  document.getElementById('btn-reports-next')?.addEventListener('click', () => {
    appState.reports.page++;
    loadReports();
  });

  // Pandit, Verification, Booking, and Community status filters
  document.getElementById('filter-pandits-status')?.addEventListener('change', () => loadPandits());
  document.getElementById('filter-verif-status')?.addEventListener('change', () => loadVerifications());
  document.getElementById('filter-bookings-status')?.addEventListener('change', () => loadBookings());
  document.getElementById('filter-posts-status')?.addEventListener('change', () => loadCommunityPosts());

  // Rejection Confirm Button
  document.getElementById('btn-confirm-reject')?.addEventListener('click', async () => {
    const reason = document.getElementById('reject-reason-select').value;
    const remarks = document.getElementById('reject-remarks').value;

    if (!reason) {
      showToast('Please select a mandatory rejection reason.', 'error');
      return;
    }

    try {
      await adminFetch(`/admin/approvals/${activeModalUserId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason, remarks }),
      });
      showToast(`User account rejected with feedback recorded.`);
      closeRejectModal();
      refreshAllUserViews();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Request Changes Confirm Button
  document.getElementById('btn-confirm-changes')?.addEventListener('click', async () => {
    const remarks = document.getElementById('changes-remarks').value;

    if (!remarks.trim()) {
      showToast('Please specify the instructions for what the applicant needs to change.', 'error');
      return;
    }

    try {
      await adminFetch(`/admin/approvals/${activeModalUserId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ remarks }),
      });
      showToast(`Profile change request sent to user.`);
      closeRequestChangesModal();
      refreshAllUserViews();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Generic Confirm Modal Action
  document.getElementById('btn-confirm-generic')?.addEventListener('click', () => {
    if (genericConfirmAction) {
      genericConfirmAction();
      closeConfirmModal();
    }
  });

  // Audit Logs Filter, Search & Pagination
  document.getElementById('filter-audit-action')?.addEventListener('change', (e) => {
    appState.audit.action = e.target.value;
    appState.audit.page = 1;
    loadAuditLogs();
  });

  const searchAudit = document.getElementById('search-audit');
  searchAudit?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      appState.audit.search = e.target.value.trim();
      appState.audit.page = 1;
      loadAuditLogs();
    }, 350);
  });

  document.getElementById('btn-audit-prev')?.addEventListener('click', () => {
    if (appState.audit.page > 1) {
      appState.audit.page--;
      loadAuditLogs();
    }
  });

  document.getElementById('btn-audit-next')?.addEventListener('click', () => {
    appState.audit.page++;
    loadAuditLogs();
  });

  // Close open modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lightbox = document.getElementById('photo-lightbox-modal');
      if (lightbox && lightbox.style.display === 'flex') {
        closePhotoLightbox();
        return;
      }
      closeRejectModal();
      closeRequestChangesModal();
      closeConfirmModal();
      closeCommunityPreviewModal();
      closeApplicantModal();
    }
  });

  // Manual Upgrade Tool
  document.getElementById('btn-manual-upgrade')?.addEventListener('click', async () => {
    const userId = document.getElementById('manual-upgrade-user-id').value.trim();
    const planId = document.getElementById('manual-upgrade-plan').value;
    const durationDays = parseInt(document.getElementById('manual-upgrade-duration').value, 10) || 30;

    if (!userId) {
      showToast('Please provide a valid target User ID.', 'error');
      return;
    }

    try {
      await adminFetch(`/admin/memberships/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ planId, durationDays }),
      });
      showToast(`Successfully upgraded user to ${planId.toUpperCase()} for ${durationDays} days!`);
      loadDashboardStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Helpers
function getApprovalBadgeHtml(status) {
  switch (status) {
    case 'approved':
      return '<span class="badge badge-success">✓ Approved</span>';
    case 'rejected':
      return '<span class="badge badge-danger">✕ Rejected</span>';
    case 'changes_requested':
      return '<span class="badge badge-warning">💬 Changes Requested</span>';
    default:
      return '<span class="badge badge-warning pulse">⏳ Pending Review</span>';
  }
}

function formatActionName(action) {
  return (action || 'action').replace(/_/g, ' ').toUpperCase();
}

function formatDocType(docType) {
  switch (docType) {
    case 'aadhaar_card':
      return 'Aadhaar Card';
    case 'pan_card':
      return 'PAN Card';
    case 'voter_id':
      return 'Voter ID Card';
    case 'passport':
      return 'Passport';
    case 'bank_passbook':
      return 'Bank Passbook';
    default:
      return (docType || 'ID Proof').replace(/_/g, ' ').toUpperCase();
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ');
}

// ==========================================================================
// 9. COMPLETE PANDIT SERVICES & VERIFICATION (10 SECTIONS)
// ==========================================================================
let currentPanditSection = 'all';
let panditSearchQuery = '';
let panditsCache = [];
let activeInspectedPandit = null;

function selectPanditSection(section) {
  currentPanditSection = section;
  document.querySelectorAll('.filter-pill[data-pandit-section]').forEach((p) => {
    p.classList.toggle('active', p.getAttribute('data-pandit-section') === section);
  });
  loadPandits();
}

let panditSearchTimer = null;
function handlePanditSearch(e) {
  clearTimeout(panditSearchTimer);
  panditSearchTimer = setTimeout(() => {
    panditSearchQuery = e.target.value ? e.target.value.trim() : '';
    loadPandits();
  }, 300);
}

async function loadPandits() {
  const tbody = document.getElementById('tbody-pandits');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6">Loading pandits catalog...</td></tr>';

  try {
    const query = new URLSearchParams({
      subSection: currentPanditSection,
      search: panditSearchQuery,
      limit: '100',
    });
    const res = await adminFetch(`/admin/pandits?${query.toString()}`);
    const items = res.data?.items || [];
    panditsCache = items;

    // Update Quick Stat Tiles
    const total = items.length;
    const pendingCount = items.filter(
      (p) => p.verificationStatus === 'pending' || p.verificationStatus === 'under_review'
    ).length;
    const approvedCount = items.filter(
      (p) => (p.verificationStatus === 'approved' || p.verificationStatus === 'verified') && p.isActive !== false
    ).length;
    const assignedCount = items.filter((p) => p.isAssigned === true).length;
    const totalEarnings = items.reduce((sum, p) => sum + (p.totalEarnings || 0), 0);

    const elTotal = document.getElementById('pandit-stat-total');
    const elPending = document.getElementById('pandit-stat-pending');
    const elApproved = document.getElementById('pandit-stat-approved');
    const elAssigned = document.getElementById('pandit-stat-assigned');
    const elEarnings = document.getElementById('pandit-stat-earnings');

    if (elTotal) elTotal.innerText = total;
    if (elPending) elPending.innerText = pendingCount;
    if (elApproved) elApproved.innerText = approvedCount;
    if (elAssigned) elAssigned.innerText = assignedCount;
    if (elEarnings) elEarnings.innerText = '₹' + totalEarnings.toLocaleString('en-IN');

    const badgePandits = document.getElementById('badge-pandits-count');
    if (badgePandits) {
      badgePandits.innerText = pendingCount;
      badgePandits.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    if (items.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="table-empty">No Pandit records found matching the active filter and search</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map((p) => {
        const isApproved = p.verificationStatus === 'approved' || p.verificationStatus === 'verified';
        const isPending = p.verificationStatus === 'pending' || p.verificationStatus === 'under_review';
        const isRejected = p.verificationStatus === 'rejected';
        const isSuspended = p.verificationStatus === 'suspended';

        let statusBadge = '';
        if (isApproved) {
          statusBadge = '<span class="badge badge-success">✓ Approved</span>';
        } else if (isRejected) {
          statusBadge = '<span class="badge badge-danger">✕ Rejected</span>';
        } else if (isSuspended) {
          statusBadge = '<span class="badge badge-danger">🚫 Suspended</span>';
        } else {
          statusBadge = `<span class="badge badge-warning pulse">⏳ ${
            p.verificationStatus === 'under_review' ? 'Under Review' : 'Pending Approval'
          }</span>`;
        }

        const onlineBadge =
          p.isOnline !== false
            ? '<span style="color: #10b981; font-size: 11px; margin-left: 4px;">● Online</span>'
            : '<span style="color: #94a3b8; font-size: 11px; margin-left: 4px;">○ Offline</span>';

        const assignedBadge = p.isAssigned
          ? '<div class="text-xs text-info mt-1">🪔 Currently Assigned</div>'
          : '';

        const actions = `
          <div class="action-buttons" style="display: flex; flex-wrap: wrap; gap: 4px;">
            <button class="btn-act btn-act-view btn-xs" onclick="openPanditDetailsModal('${p.id}')" title="Inspect Full Biodata & Documents">👁️ Full Profile &amp; Docs</button>
            ${!isApproved ? `<button class="btn-primary btn-xs" onclick="approvePandit('${p.id}')">✓ Approve</button>` : ''}
            ${!isRejected ? `<button class="btn-danger btn-xs" onclick="openRejectPanditDialog('${p.id}')">✕ Reject</button>` : ''}
            <button class="btn-secondary btn-xs" onclick="openRequestPanditDocsModal('${p.id}')">📄 Request Docs</button>
            <button class="btn-secondary btn-xs" onclick="togglePanditActiveStatus('${p.id}')">${
          p.isActive !== false ? '⚡ Deactivate' : '⚡ Activate'
        }</button>
            ${!isSuspended ? `<button class="btn-danger btn-xs" onclick="suspendPanditAccount('${p.id}')">🚫 Suspend</button>` : ''}
          </div>
        `;

        const avatar = p.profilePhoto
          ? `<img src="${escapeHtml(p.profilePhoto)}" class="avatar-sm" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" onerror="this.src='${FALLBACK_MEDIA_SVG}'" />`
          : `<div class="avatar-ph" style="width: 36px; height: 36px;">${(p.name || 'P')[0]}</div>`;

        const specs = (p.specialization || ['Sanatan Rituals']).slice(0, 2).join(', ');
        const docsCount = p.documentsCount || (p.documents ? p.documents.length : 0);

        return `
          <tr>
            <td>
              <div class="user-cell">
                ${avatar}
                <div>
                  <strong>${escapeHtml(p.name)}</strong>
                  <div class="text-xs" style="color: var(--gold-accent-light); font-weight: 600;">${escapeHtml(
                    p.panditId || 'PND-NEW'
                  )}</div>
                </div>
              </div>
            </td>
            <td>
              <div>📞 ${escapeHtml(p.phone || 'N/A')}</div>
              <div class="text-muted text-xs">✉️ ${escapeHtml(p.email || 'N/A')}</div>
            </td>
            <td>
              <div>${escapeHtml(p.city || 'Delhi NCR')}</div>
              <div class="text-muted text-xs">${escapeHtml(p.state || 'Delhi')}</div>
            </td>
            <td>
              <div><strong>${p.experienceYears || 5}+ Yrs</strong>: ${escapeHtml(
          p.religiousTradition || 'Vedic Sanatan'
        )}</div>
              <div class="text-muted text-xs">${escapeHtml(specs)}</div>
            </td>
            <td>
              <div>${
                p.offersAstrology
                  ? '<span class="badge badge-info text-xs">⭐ Astrology Active</span>'
                  : '<span class="text-muted text-xs">Puja Only</span>'
              }</div>
              <div class="text-xs text-warning mt-1">₹${p.consultationCharges || 501} / consult</div>
            </td>
            <td>
              <span class="badge ${docsCount > 0 ? 'badge-success' : 'badge-warning'}">${docsCount} Uploaded</span>
              ${
                p.requestedDocuments && p.requestedDocuments.length
                  ? '<div class="text-xs text-danger mt-1">Docs Requested</div>'
                  : ''
              }
            </td>
            <td>
              <div><strong>₹${(p.totalEarnings || 0).toLocaleString('en-IN')}</strong></div>
              <div class="text-xs text-muted">Pending: ₹${(p.pendingPayout || 0).toLocaleString('en-IN')}</div>
            </td>
            <td>
              ${statusBadge}
              ${onlineBadge}
              ${assignedBadge}
            </td>
            <td>
              ${actions}
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 9, err.message, 'loadPandits', err.requestId);
  }
}

async function openPanditDetailsModal(panditId) {
  let p = panditsCache.find((x) => x.id === panditId);
  activeInspectedPandit = p;

  const modal = document.getElementById('modal-pandit-details');
  const body = document.getElementById('modal-pandit-body');
  const title = document.getElementById('modal-pandit-title');
  const badge = document.getElementById('modal-pandit-status-badge');
  const actionsWrap = document.getElementById('modal-pandit-action-buttons');
  if (!modal || !body) return;

  body.innerHTML = '<div class="text-center py-6">Loading pandit file...</div>';
  modal.style.display = 'flex';

  try {
    const res = await adminFetch(`/pandits/${panditId}`);
    if (res.data) {
      p = res.data;
      activeInspectedPandit = p;
    }
  } catch {
    // use cache
  }

  if (!p) {
    body.innerHTML = '<div class="alert alert-danger">Pandit profile could not be loaded.</div>';
    return;
  }

  if (title) title.innerText = `🕉️ Pandit Profile: ${p.name} (${p.panditId || 'PND-ID'})`;
  if (badge) {
    const isApproved = p.verificationStatus === 'approved' || p.verificationStatus === 'verified';
    badge.className = `badge ${isApproved ? 'badge-success' : p.verificationStatus === 'rejected' ? 'badge-danger' : 'badge-warning'}`;
    badge.innerText = isApproved ? 'Approved' : p.verificationStatus === 'rejected' ? 'Rejected' : 'Pending Review';
  }

  // Documents Grid
  const docsList = p.documents || [];
  let docsHtml = '';
  if (docsList.length === 0) {
    docsHtml = '<p class="text-muted text-sm">No identity verification documents uploaded yet.</p>';
  } else {
    docsHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 8px;">
        ${docsList.map((doc, i) => `
          <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; background: rgba(0,0,0,0.2);">
            <div style="font-weight: 600; font-size: 13px; color: var(--gold-accent-light); margin-bottom: 4px;">${escapeHtml(doc.docName || doc.docType || 'Document #' + (i + 1))}</div>
            <div class="text-xs text-muted mb-2">Type: ${escapeHtml(doc.docType || 'Identity Proof')}</div>
            <a href="${escapeHtml(doc.docUrl)}" target="_blank" class="btn-primary btn-xs" style="text-decoration: none; display: inline-block;">🔍 View Document</a>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Services List
  const srvList = p.services || [];
  const srvHtml = srvList.length
    ? srvList.map(s => `<span class="badge badge-info" style="margin: 2px;">${escapeHtml(s.name)} (₹${s.priceInr})</span>`).join('')
    : '<span class="text-muted text-xs">Standard Sanatan Ceremonies</span>';

  // Bank details
  const b = p.bankDetails || {};
  const bankHtml = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
      <div><strong>Account Name:</strong> ${escapeHtml(b.accountHolderName || p.name || 'N/A')}</div>
      <div><strong>Bank Name:</strong> ${escapeHtml(b.bankName || 'N/A')}</div>
      <div><strong>Account Number:</strong> ${escapeHtml(b.accountNumber ? 'XXXX' + b.accountNumber.slice(-4) : 'N/A')}</div>
      <div><strong>IFSC Code:</strong> ${escapeHtml(b.ifscCode || 'N/A')}</div>
      <div><strong>UPI ID:</strong> ${escapeHtml(b.upiId || 'N/A')}</div>
    </div>
  `;

  body.innerHTML = `
    <div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
      <div style="width: 72px; height: 72px; border-radius: 50%; overflow: hidden; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #fff;">
        ${p.profilePhoto ? `<img src="${escapeHtml(p.profilePhoto)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${FALLBACK_MEDIA_SVG}'" />` : (p.name || 'P')[0]}
      </div>
      <div>
        <h4 style="font-size: 18px; margin-bottom: 4px; color: #fff;">${escapeHtml(p.name)} <span class="badge badge-warning text-xs">${escapeHtml(p.panditId || '')}</span></h4>
        <div style="font-size: 13px; color: #94a3b8;">📞 ${escapeHtml(p.phone || 'N/A')} | ✉️ ${escapeHtml(p.email || 'N/A')}</div>
        <div style="font-size: 13px; color: #94a3b8;">📍 ${escapeHtml(p.city || 'Delhi NCR')}, ${escapeHtml(p.state || 'Delhi')} | <strong>${p.experienceYears || 5}+ Years Experience</strong></div>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <h5 style="color: var(--gold-accent-light); font-size: 14px; margin-bottom: 6px;">📖 Biography &amp; Vedic Lineage</h5>
      <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">${escapeHtml(p.bio || 'Vedic Pandit dedicated to Sanatan rituals.')}</p>
    </div>

    <div class="two-col-grid" style="gap: 16px; margin-bottom: 16px;">
      <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;">
        <h5 style="color: var(--gold-accent-light); font-size: 13px; margin-bottom: 6px;">🕉️ Specialization &amp; Languages</h5>
        <div style="font-size: 13px;"><strong>Tradition:</strong> ${escapeHtml(p.religiousTradition || 'Vedic Sanatan')}</div>
        <div style="font-size: 13px; margin-top: 4px;"><strong>Languages:</strong> ${(p.languages || ['Hindi', 'Sanskrit']).join(', ')}</div>
        <div style="font-size: 13px; margin-top: 4px;"><strong>Specialization:</strong> ${(p.specialization || ['Vivah', 'Puja']).join(', ')}</div>
      </div>
      <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;">
        <h5 style="color: var(--gold-accent-light); font-size: 13px; margin-bottom: 6px;">⭐ Astrology &amp; Consultation</h5>
        <div style="font-size: 13px;"><strong>Astrology Offered:</strong> ${p.offersAstrology ? '✓ Yes' : '✕ No'}</div>
        <div style="font-size: 13px; margin-top: 4px;"><strong>Consultation Rate:</strong> ₹${p.consultationCharges || 501} per session</div>
        <div style="font-size: 13px; margin-top: 4px;"><strong>Expertise:</strong> ${(p.astrologyExpertise || ['Kundli Milan']).join(', ')}</div>
      </div>
    </div>

    <div style="margin-bottom: 16px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;">
      <h5 style="color: var(--gold-accent-light); font-size: 13px; margin-bottom: 6px;">🪔 Ritual &amp; Puja Offerings</h5>
      <div>${srvHtml}</div>
    </div>

    <div style="margin-bottom: 16px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;">
      <h5 style="color: var(--gold-accent-light); font-size: 13px; margin-bottom: 6px;">🏦 Bank &amp; Payment Payout Details</h5>
      ${bankHtml}
    </div>

    <div style="margin-bottom: 16px; background: rgba(16, 185, 129, 0.08); padding: 12px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.25);">
      <h5 style="color: #10b981; font-size: 13px; margin-bottom: 8px;">🔐 WhatsApp Privacy, Availability &amp; Consultation Rate Control</h5>
      <div class="two-col-grid" style="gap: 10px; margin-bottom: 10px;">
        <div>
          <label class="text-xs text-muted">Verified WhatsApp Number (Private by default)</label>
          <input type="text" id="edit-pandit-whatsapp" class="form-input" value="${escapeHtml(p.whatsappNumber || '')}" placeholder="e.g. +919876543210">
        </div>
        <div>
          <label class="text-xs text-muted">Consultation Charges (₹)</label>
          <input type="number" id="edit-pandit-fee" class="form-input" value="${Number(p.consultationCharges || 501)}" min="0">
        </div>
      </div>
      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-bottom: 10px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
          <input type="checkbox" id="edit-pandit-whatsapp-enabled" ${p.whatsappEnabled !== false ? 'checked' : ''}>
          <span>WhatsApp Contact Enabled</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
          <input type="checkbox" id="edit-pandit-online" ${p.isOnline !== false ? 'checked' : ''}>
          <span>Online Status</span>
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer;">
          <input type="checkbox" id="edit-pandit-chat-available" ${p.isChatAvailable !== false ? 'checked' : ''}>
          <span>Chat Enabled</span>
        </label>
      </div>
      <button type="button" class="btn-primary btn-xs" onclick="saveAdminPanditConfig('${p.id}')">💾 Save Pandit WhatsApp &amp; Pricing</button>
    </div>

    <div style="margin-bottom: 16px;">
      <h5 style="color: var(--gold-accent-light); font-size: 14px; margin-bottom: 6px;">📄 Identity &amp; Vedic Qualification Documents (${docsList.length})</h5>
      ${docsHtml}
    </div>

    ${p.rejectionReason ? `<div class="alert alert-danger mb-4"><strong>Rejection Reason:</strong> ${escapeHtml(p.rejectionReason)}</div>` : ''}
    ${p.requestedDocuments && p.requestedDocuments.length ? `<div class="alert alert-warning mb-4"><strong>Requested Documents Pending:</strong> ${escapeHtml(p.requestedDocuments.join(', '))}</div>` : ''}
  `;

  if (actionsWrap) {
    const isApproved = p.verificationStatus === 'approved' || p.verificationStatus === 'verified';
    actionsWrap.innerHTML = `
      ${!isApproved ? `<button class="btn-primary" onclick="approvePandit('${p.id}'); closePanditDetailsModal();">✓ Approve Registration</button>` : ''}
      <button class="btn-danger" onclick="openRejectPanditDialog('${p.id}'); closePanditDetailsModal();">✕ Reject Application</button>
      <button class="btn-secondary" onclick="openRequestPanditDocsModal('${p.id}'); closePanditDetailsModal();">📄 Request Documents</button>
      <button class="btn-secondary" onclick="togglePanditActiveStatus('${p.id}'); closePanditDetailsModal();">${p.isActive !== false ? '⚡ Deactivate' : '⚡ Activate'}</button>
    `;
  }
}

function closePanditDetailsModal() {
  const modal = document.getElementById('modal-pandit-details');
  if (modal) modal.style.display = 'none';
}

async function saveAdminPanditConfig(panditId) {
  try {
    const whatsappNumber = document.getElementById('edit-pandit-whatsapp')?.value.trim() || '';
    const consultationCharges = Number(document.getElementById('edit-pandit-fee')?.value || 501);
    const whatsappEnabled = Boolean(document.getElementById('edit-pandit-whatsapp-enabled')?.checked);
    const isOnline = Boolean(document.getElementById('edit-pandit-online')?.checked);
    const isChatAvailable = Boolean(document.getElementById('edit-pandit-chat-available')?.checked);

    await adminFetch(`/admin/pandits/${panditId}`, {
      method: 'PUT',
      body: JSON.stringify({
        whatsappNumber,
        consultationCharges,
        whatsappEnabled,
        isOnline,
        isChatAvailable,
      }),
    });
    showToast('Pandit WhatsApp privacy, availability & consultation pricing updated.');
    await loadPandits();
  } catch (err) {
    showToast(err.message || 'Failed to update Pandit configuration.', 'error');
  }
}

async function approvePandit(id) {
  if (!confirm('Approve this Pandit registration? They will immediately receive an in-app approval notification and be eligible to accept puja bookings & astrology consultations.')) return;
  try {
    await adminFetch(`/admin/pandits/${id}/verify`, { method: 'POST' });
    showToast('Pandit registration approved successfully!');
    loadPandits();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openRejectPanditDialog(id) {
  document.getElementById('reject-pandit-id').value = id;
  document.getElementById('reject-pandit-reason').value = '';
  document.getElementById('modal-reject-pandit-dialog').style.display = 'flex';
}

function closeRejectPanditDialog() {
  document.getElementById('modal-reject-pandit-dialog').style.display = 'none';
}

async function submitRejectPanditDialog() {
  const id = document.getElementById('reject-pandit-id').value;
  const reason = document.getElementById('reject-pandit-reason').value;
  if (!reason || !reason.trim()) {
    showToast('Please provide a reason for rejection.', 'warning');
    return;
  }
  try {
    await adminFetch(`/admin/pandits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    showToast('Pandit application rejected.');
    closeRejectPanditDialog();
    loadPandits();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openRequestPanditDocsModal(id) {
  document.getElementById('request-docs-pandit-id').value = id;
  document.getElementById('request-docs-custom-note').value = '';
  document.getElementById('modal-request-pandit-docs').style.display = 'flex';
}

function closeRequestPanditDocsModal() {
  document.getElementById('modal-request-pandit-docs').style.display = 'none';
}

async function submitRequestPanditDocs() {
  const id = document.getElementById('request-docs-pandit-id').value;
  const checkboxes = document.querySelectorAll('#modal-request-pandit-docs .doc-req-cb:checked');
  const selectedDocs = Array.from(checkboxes).map((cb) => cb.value);
  const customNote = document.getElementById('request-docs-custom-note').value.trim();
  if (customNote) selectedDocs.push(customNote);

  if (selectedDocs.length === 0) {
    showToast('Please select at least one document to request.', 'warning');
    return;
  }

  try {
    await adminFetch(`/admin/pandits/${id}/request-docs`, {
      method: 'POST',
      body: JSON.stringify({ requestedDocuments: selectedDocs }),
    });
    showToast('Document request sent to Pandit successfully.');
    closeRequestPanditDocsModal();
    loadPandits();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function togglePanditActiveStatus(id) {
  try {
    const res = await adminFetch(`/admin/pandits/${id}/toggle-active`, { method: 'PATCH' });
    showToast(res.message || 'Pandit status toggled.');
    loadPandits();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function suspendPanditAccount(id) {
  const reason = prompt('Please enter the reason for suspending this Pandit:');
  if (!reason || !reason.trim()) return;
  try {
    await adminFetch(`/admin/pandits/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    showToast('Pandit account suspended.');
    loadPandits();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 10. IDENTITY & AADHAAR VERIFICATION QUEUE
// ==========================================================================
async function loadVerifications() {
  const tbody = document.getElementById('tbody-verifications');
  const statusFilter = document.getElementById('filter-verif-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6">Loading verification queue...</td></tr>';

  try {
    const res = await adminFetch(`/admin/verifications?status=${statusFilter}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No identity verification requests found</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map((r) => {
        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : 'N/A';
        const docBadge = `<span class="badge badge-info">🪪 ${escapeHtml(formatDocType(r.documentType))}</span>`;
        const statusBadge =
          r.status === 'verified'
            ? '<span class="badge badge-success">✓ Verified</span>'
            : r.status === 'rejected'
            ? '<span class="badge badge-danger">✕ Rejected</span>'
            : '<span class="badge badge-warning pulse">⏳ Pending</span>';

        const consentBadge = r.consentGranted
          ? '<span class="text-green text-xs">✓ Explicit Consent</span>'
          : '<span class="text-red text-xs">No Consent</span>';

        const viewDocBtn = `<button class="btn-secondary btn-xs" onclick="viewVerificationDocument('${r.id}')">👁️ View Doc</button>`;
        const actions = `
          <div class="action-buttons">
            ${viewDocBtn}
            ${r.userId ? `<button class="btn-act btn-act-view btn-xs" onclick="openApplicantModal('${r.userId}')">👤 User</button>` : ''}
            ${r.status !== 'verified' ? `<button class="btn-primary btn-xs" onclick="approveVerification('${r.id}')">✓ Approve</button>` : ''}
            ${r.status !== 'rejected' ? `<button class="btn-danger btn-xs" onclick="rejectVerification('${r.id}')">✕ Reject</button>` : ''}
          </div>
        `;

        return `
          <tr>
            <td>
              <strong>${escapeHtml(r.userDisplayName || 'Applicant')}</strong>
              <div class="text-muted text-xs">ID: ${r.userId}</div>
            </td>
            <td>
              <div>${escapeHtml(r.userMobile || 'N/A')}</div>
              <div class="text-muted text-xs">${escapeHtml(r.userEmail || '')}</div>
            </td>
            <td>${docBadge}</td>
            <td><code>${escapeHtml(r.documentReferenceMasked || 'XXXX-XXXX-XXXX')}</code></td>
            <td>${consentBadge}</td>
            <td>${dateStr}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 8, err.message, 'loadVerifications', err.requestId);
  }
}

// Cloudinary display helper: f_auto,q_auto + width (c_fill/g_face for avatars). Public images only.
function cdnThumb(url, width, face) {
  if (!url || !/^https?:\/\/res\.cloudinary\.com\//i.test(url) || !url.includes('/image/upload/')) return url;
  const t = ['f_auto', 'q_auto', `w_${width}`].concat(face ? ['h_' + width, 'c_fill', 'g_face'] : ['c_limit']);
  return url.replace('/image/upload/', `/image/upload/${t.join(',')}/`);
}

// Private identity document: short-lived (10 min) signed URL fetched on demand, audit-logged server side.
// Displays image documents directly inside the Lightbox Modal (no popup blockers!) with direct Approve/Reject buttons.
async function viewVerificationDocument(id) {
  try {
    const res = await adminFetch(`/admin/verifications/${id}/document-url`);
    const data = res?.data || {};
    const url = data.url;
    if (!url) throw new Error('Document not available.');

    const isPdf = String(data.format || '').toLowerCase() === 'pdf' || url.toLowerCase().includes('.pdf');
    if (isPdf) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    const modal = document.getElementById('photo-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const titleEl = document.getElementById('lightbox-title');
    const badgeEl = document.getElementById('lightbox-status-badge');
    const actionsEl = document.getElementById('lightbox-actions');
    if (!modal || !img) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    img.src = url;
    img.onerror = () => {
      img.src = FALLBACK_MEDIA_SVG;
    };
    const docLabel = formatDocType(data.documentType);
    if (titleEl) titleEl.innerText = `🪪 ${docLabel} ${data.documentReferenceMasked ? `(${data.documentReferenceMasked})` : ''}`;
    if (badgeEl) {
      badgeEl.className = 'badge badge-info';
      badgeEl.innerText = 'Private Vault • 10m Signed URL';
    }
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn-secondary" onclick="closePhotoLightbox()">Close</button>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration: none;">Open Full Tab ↗</a>
        <button class="btn-act btn-act-approve" onclick="closePhotoLightbox(); approveVerification('${id}');">✓ Verify &amp; Unlock Account</button>
        <button class="btn-act btn-act-reject" onclick="closePhotoLightbox(); rejectVerification('${id}');">✕ Reject Document</button>
      `;
    }
    modal.style.display = 'flex';
  } catch (err) {
    showToast(err.message || 'Could not open document.', 'error');
  }
}

async function approveVerification(id) {
  if (!confirm('Confirm approval of this identity verification? Verified badge will be issued to the profile.')) return;
  try {
    await adminFetch(`/admin/verifications/${id}/approve`, { method: 'POST' });
    showToast('Identity verification approved and badge issued!');
    loadVerifications();
    loadDashboardStats();
    if (activeInspectedUserId && document.getElementById('applicant-modal')?.style.display === 'flex') {
      openApplicantModal(activeInspectedUserId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rejectVerification(id) {
  const reason = prompt('Please enter reason for rejecting this identity document (e.g. Unclear document, name mismatch):');
  if (!reason || !reason.trim()) return;
  try {
    await adminFetch(`/admin/verifications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    showToast('Identity verification rejected.');
    loadVerifications();
    loadDashboardStats();
    if (activeInspectedUserId && document.getElementById('applicant-modal')?.style.display === 'flex') {
      openApplicantModal(activeInspectedUserId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 11. CEREMONY & CONSULTATION BOOKINGS
// ==========================================================================
async function loadBookings() {
  const tbody = document.getElementById('tbody-bookings');
  const statusFilter = document.getElementById('filter-bookings-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6">Loading ceremony bookings...</td></tr>';

  try {
    const res = await adminFetch(`/admin/bookings?status=${statusFilter}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No ceremony bookings found matching filter</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map((b) => {
        let statusBadge = '<span class="badge badge-info">Requested</span>';
        if (b.status === 'accepted' || b.status === 'confirmed') statusBadge = '<span class="badge badge-success">✓ Confirmed</span>';
        else if (b.status === 'assigned') statusBadge = '<span class="badge badge-warning" style="background:#d97706; color:#fff;">Assigned (Review)</span>';
        else if (b.status === 'completed') statusBadge = '<span class="badge badge-success">Completed</span>';
        else if (b.status === 'cancelled' || b.status === 'declined') statusBadge = '<span class="badge badge-danger">Cancelled</span>';

        const paymentBadge = b.paymentStatus === 'paid'
          ? '<div style="margin-top:3px;"><span class="badge badge-success" style="font-size:10px;">PAID ✓</span></div>'
          : '<div style="margin-top:3px;"><span class="badge" style="background:#334155; color:#94a3b8; font-size:10px;">UNPAID</span></div>';

        const communityBadge = b.isCommunityBooking
          ? '<span class="badge" style="background:#6366f1; color:#fff; font-size:10px; margin-left:4px;">Community</span>'
          : '';

        const modeBadge = b.mode === 'online'
          ? '<span class="badge badge-info">📹 Online Video</span>'
          : '<span class="badge badge-warning">🏛️ In-Person</span>';

        return `
          <tr>
            <td><strong>${escapeHtml(b.bookingReference || 'N/A')}</strong>${communityBadge}</td>
            <td>
              <div>${escapeHtml(b.userName || 'Devotee')}</div>
              <div class="text-muted text-xs">${escapeHtml(b.userMobile || '')}</div>
            </td>
            <td><strong>${escapeHtml(b.panditName || 'Assigned Pandit')}</strong></td>
            <td>${escapeHtml(b.serviceName || b.ceremonyType || 'Puja')}</td>
            <td>
              <div>${escapeHtml(b.bookingDate || '')}</div>
              <div class="text-muted text-xs">${escapeHtml(b.timeSlot || '')}</div>
            </td>
            <td>${modeBadge}</td>
            <td><strong>₹${(b.priceInr || 0).toLocaleString('en-IN')}</strong>${paymentBadge}</td>
            <td>${statusBadge}</td>
            <td>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${b.status === 'requested' ? `
                  <button class="btn-primary btn-xs" onclick="updateBookingStatus('${b.id}', 'accepted')">✓ Confirm</button>
                  <button class="btn-danger btn-xs" onclick="promptCancelBooking('${b.id}')">✕ Cancel</button>
                ` : ''}
                ${b.status === 'accepted' ? `
                  <button class="btn-primary btn-xs" onclick="updateBookingStatus('${b.id}', 'completed')">✓ Complete</button>
                  <button class="btn-danger btn-xs" onclick="promptCancelBooking('${b.id}')">✕ Cancel</button>
                ` : ''}
                ${b.status === 'completed' ? `<span class="text-muted text-xs">Completed</span>` : ''}
                ${b.status === 'cancelled' || b.status === 'declined' ? `<span class="text-muted text-xs">Closed</span>` : ''}
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 9, err.message, 'loadBookings', err.requestId);
  }
}

// ==========================================================================
// 12. COMMUNITY FEED MODERATION
// ==========================================================================
async function loadCommunityPosts() {
  const tbody = document.getElementById('tbody-community');
  const statusFilter = document.getElementById('filter-posts-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6">Loading community posts...</td></tr>';

  try {
    const res = await adminFetch(`/admin/community?status=${statusFilter}`);
    const items = res.data?.items || [];
    appState.community.items = items;

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No community posts found matching filter</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map((p) => {
        const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : 'N/A';
        const statusBadge =
          p.moderationStatus === 'approved'
            ? '<span class="badge badge-success">✓ Live / Approved</span>'
            : p.moderationStatus === 'rejected'
            ? '<span class="badge badge-danger">✕ Rejected</span>'
            : '<span class="badge badge-warning pulse">⏳ Awaiting Review</span>';

        const categoryBadge = `<span class="badge badge-info">${escapeHtml((p.category || 'story').replace('_', ' '))}</span>`;
        const reportsText = p.reportsCount > 0 ? `<span class="text-red font-bold">⚠️ ${p.reportsCount}</span>` : '0';
        const mediaSrc = p.mediaUrl || FALLBACK_MEDIA_SVG;
        const isCloudinary = p.mediaUrl && p.mediaUrl.includes('cloudinary.com');

        const actions =
          p.moderationStatus === 'pending'
            ? `
              <div class="action-buttons">
                <button class="btn-primary btn-xs" id="btn-pub-${p.id}" onclick="moderateCommunityPost('${p.id}', 'approve', this)">✓ Publish</button>
                <button class="btn-danger btn-xs" id="btn-rej-${p.id}" onclick="moderateCommunityPost('${p.id}', 'reject', this)">✕ Reject</button>
                <button class="btn-act btn-xs" style="background: rgba(255,255,255,0.08); color: var(--text-main);" onclick="openCommunityPreviewModal('${p.id}')">👁️ Inspect</button>
              </div>
            `
            : `
              <div class="action-buttons">
                <button class="btn-act btn-xs" style="background: rgba(255,255,255,0.08); color: var(--text-main);" onclick="openCommunityPreviewModal('${p.id}')">👁️ Inspect</button>
                <button class="btn-danger btn-xs" onclick="moderateCommunityPost('${p.id}', 'reject', this)">Remove</button>
              </div>
            `;

        return `
          <tr>
            <td>
              <strong>${escapeHtml(p.authorName || 'Member')}</strong>
              <div class="text-muted text-xs">Likes: ${p.likesCount || 0}</div>
            </td>
            <td>
              <div class="community-thumb-wrap" style="position: relative; width: 56px; height: 56px; display: inline-block; cursor: pointer;" onclick="openCommunityPreviewModal('${p.id}')" title="Click to view full photo & post">
                <img src="${escapeHtml(mediaSrc)}" 
                     alt="Story Media" 
                     loading="lazy" 
                     style="width: 56px; height: 56px; border-radius: 8px; object-fit: cover; display: block; border: 1px solid var(--border-color); background: var(--bg-input);" 
                     onerror="this.onerror=null; this.src=FALLBACK_MEDIA_SVG; this.classList.add('img-load-failed');" 
                />
                ${isCloudinary ? '<span style="position: absolute; bottom: 2px; right: 2px; font-size: 8px; background: rgba(16, 185, 129, 0.9); color: #fff; padding: 1px 3px; border-radius: 3px; font-weight: 700;">☁️</span>' : ''}
              </div>
            </td>
            <td>
              <div style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;" title="${escapeHtml(p.caption || '')}">
                ${escapeHtml(p.caption || '')}
              </div>
            </td>
            <td>${categoryBadge}</td>
            <td>${reportsText}</td>
            <td>${dateStr}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 8, err.message, 'loadCommunityPosts', err.requestId);
  }
}

async function moderateCommunityPost(id, action, btnElement) {
  let reason = '';
  if (action === 'reject') {
    reason = prompt('Reason for rejecting or removing this community post:');
    if (reason === null) return; // User cancelled prompt
    if (!reason.trim()) {
      showToast('A rejection reason is required.', 'error');
      return;
    }
  } else if (action === 'approve') {
    if (!confirm('Publish this community story to the live public matrimonial feed?')) {
      return;
    }
  }

  const originalText = btnElement ? btnElement.innerHTML : '';
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerText = action === 'approve' ? 'Publishing...' : 'Rejecting...';
  }

  try {
    const res = await adminFetch(`/admin/community/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });

    showToast(res.message || `Post ${action === 'approve' ? 'published' : 'removed'} successfully!`);
    closeCommunityPreviewModal();
    loadCommunityPosts();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = originalText;
    }
  }
}

function openCommunityPreviewModal(id) {
  const p = (appState.community?.items || []).find((item) => item.id === id);
  if (!p) return;

  const modal = document.getElementById('community-post-modal');
  const titleEl = document.getElementById('community-modal-title');
  const contentEl = document.getElementById('community-modal-content');
  const actionsEl = document.getElementById('community-modal-actions');
  if (!modal || !contentEl) return;

  if (titleEl) {
    titleEl.innerText = `📸 Community Story Review — ${p.authorName || 'Member'}`;
  }

  const isCloudinary = p.mediaUrl && p.mediaUrl.includes('cloudinary.com');
  const mediaSrc = p.mediaUrl || FALLBACK_MEDIA_SVG;

  contentEl.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Main Media Display -->
      <div style="text-align: center; background: #000; border-radius: 8px; padding: 8px; border: 1px solid var(--border-color); overflow: hidden;">
        <img src="${escapeHtml(mediaSrc)}" 
             alt="Community story full image" 
             style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 4px; display: inline-block;" 
             onerror="this.onerror=null; this.src=FALLBACK_MEDIA_SVG; this.classList.add('img-load-failed');" 
        />
      </div>

      <!-- Cloudinary Storage & Status Badges -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          ${isCloudinary ? '<span class="badge badge-success">☁️ Verified Cloudinary Storage</span>' : '<span class="badge badge-warning">Local / Fallback Storage</span>'}
          <span class="badge badge-info">${escapeHtml((p.category || 'story').replace('_', ' '))}</span>
          ${p.moderationStatus === 'approved' ? '<span class="badge badge-success">✓ Live / Published</span>' : p.moderationStatus === 'rejected' ? '<span class="badge badge-danger">✕ Rejected</span>' : '<span class="badge badge-warning">⏳ Pending Moderation</span>'}
        </div>
        ${isCloudinary ? `<a href="${escapeHtml(p.mediaUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--gold-accent); text-decoration: underline;">Open Asset ↗</a>` : ''}
      </div>

      <!-- Story Details Grid -->
      <div class="bio-grid">
        <div class="bio-item">
          <div class="bio-label">Author Name</div>
          <div class="bio-val">${escapeHtml(p.authorName || 'Community Member')}</div>
        </div>
        <div class="bio-item">
          <div class="bio-label">Submission Date</div>
          <div class="bio-val">${p.createdAt ? new Date(p.createdAt).toLocaleString('en-IN') : 'N/A'}</div>
        </div>
        <div class="bio-item">
          <div class="bio-label">Community Likes</div>
          <div class="bio-val">${p.likesCount || 0} Devotees</div>
        </div>
        <div class="bio-item">
          <div class="bio-label">User Flags / Reports</div>
          <div class="bio-val">${p.reportsCount > 0 ? `<span style="color: var(--danger-red); font-weight: 700;">⚠️ ${p.reportsCount} Reports</span>` : '0 (Clean)'}</div>
        </div>
      </div>

      <!-- Story Caption -->
      <div style="padding: 12px 14px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
        <div class="bio-label" style="margin-bottom: 6px;">Story Caption & Rituals Description</div>
        <div style="color: var(--text-main); font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(p.caption || 'No caption provided.')}</div>
      </div>
    </div>
  `;

  if (actionsEl) {
    actionsEl.innerHTML = `
      <button class="btn-secondary" onclick="closeCommunityPreviewModal()">Close</button>
      ${
        p.moderationStatus === 'pending'
          ? `
            <button class="btn-danger" onclick="moderateCommunityPost('${p.id}', 'reject', this)">✕ Reject Post</button>
            <button class="btn-primary" onclick="moderateCommunityPost('${p.id}', 'approve', this)">✓ Publish to Live Feed</button>
          `
          : p.moderationStatus === 'approved'
          ? `<button class="btn-danger" onclick="moderateCommunityPost('${p.id}', 'reject', this)">Remove from Public Feed</button>`
          : `<button class="btn-primary" onclick="moderateCommunityPost('${p.id}', 'approve', this)">Re-Publish to Live Feed</button>`
      }
    `;
  }

  modal.style.display = 'flex';
}

function closeCommunityPreviewModal() {
  const modal = document.getElementById('community-post-modal');
  if (modal) modal.style.display = 'none';
}

// ==========================================================================
// 13. PUBLIC MATRIMONIAL BANNERS (CLOUDINARY)
// ==========================================================================
let selectedBannerBase64 = null;

function handleBannerFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Banner file size exceeds 5 MB limit.', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    selectedBannerBase64 = e.target.result;
    const previewBox = document.getElementById('banner-preview-box');
    const previewImg = document.getElementById('banner-preview-img');
    const fileName = document.getElementById('banner-file-name');
    if (previewImg) previewImg.src = selectedBannerBase64;
    if (fileName) fileName.innerText = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    if (previewBox) previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitBannerUpload() {
  const title = document.getElementById('banner-title')?.value.trim();
  const linkUrl = document.getElementById('banner-link')?.value.trim();
  const priority = document.getElementById('banner-priority')?.value || 10;
  const msgEl = document.getElementById('banner-upload-msg');
  const btn = document.getElementById('btn-submit-banner');

  // Title is optional (the server stores a neutral default and the app shows only the image).
  if (!selectedBannerBase64) {
    showToast('Please select a banner image file.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Uploading to Cloudinary...</span>';
  if (msgEl) {
    msgEl.innerText = 'Transmitting to Cloudinary SDK...';
    msgEl.style.color = 'var(--text-muted)';
  }

  try {
    const res = await adminFetch('/admin/banners/upload', {
      method: 'POST',
      body: JSON.stringify({
        base64: selectedBannerBase64,
        title,
        linkUrl,
        priority: Number(priority),
      }),
    });

    showToast('Banner successfully uploaded and published to Cloudinary!');
    if (msgEl) {
      msgEl.innerText = '✓ Published successfully!';
      msgEl.style.color = '#10b981';
    }

    // Reset form
    document.getElementById('form-upload-banner')?.reset();
    selectedBannerBase64 = null;
    const previewBox = document.getElementById('banner-preview-box');
    if (previewBox) previewBox.style.display = 'none';

    loadBanners();
  } catch (err) {
    showToast(err.message || 'Banner upload failed.', 'error');
    if (msgEl) {
      msgEl.innerText = `Error: ${err.message}`;
      msgEl.style.color = '#ef4444';
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>☁️ Upload to Cloudinary & Publish</span>';
  }
}

async function loadBanners() {
  const container = document.getElementById('banners-grid');
  if (!container) return;

  container.innerHTML = '<div class="table-empty">Loading active banners...</div>';

  try {
    const res = await adminFetch('/admin/banners?all=true');
    const banners = res.data?.items || [];

    if (banners.length === 0) {
      container.innerHTML = '<div class="table-empty">No active banners registered. Use the upload form above to add a Cloudinary banner.</div>';
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${banners.map((b) => `
          <div style="background: #fff; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
            <div style="position: relative;">
              <img src="${escapeHtml(b.imageUrl || FALLBACK_MEDIA_SVG)}" alt="${escapeHtml(b.title)}" style="width: 100%; height: 160px; object-fit: cover; display: block;" onerror="this.onerror=null; this.src=FALLBACK_MEDIA_SVG; this.classList.add('img-load-failed');"/>
              <span class="badge badge-success" style="position: absolute; top: 8px; right: 8px; font-size: 10px;">☁️ CLOUDINARY</span>
            </div>
            <div style="padding: 12px;">
              <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">${escapeHtml(b.title)}</div>
              ${b.linkUrl ? `<div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">🔗 Link: <code>${escapeHtml(b.linkUrl)}</code></div>` : ''}
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
                Public ID: <code style="word-break: break-all;">${escapeHtml(b.publicId || 'N/A')}</code>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f0f0f0; padding-top: 8px;">
                <span style="font-size: 11px; color: var(--text-muted);">Priority: ${b.priority || 0} &middot; <strong style="color: ${b.isActive === false ? '#b91c1c' : '#059669'};">${b.isActive === false ? 'DISABLED' : 'ACTIVE'}</strong></span>
                <span style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button class="btn-act" onclick="toggleBannerItem('${b._id || b.id}', ${b.isActive === false ? 'true' : 'false'})">${b.isActive === false ? 'Enable' : 'Disable'}</button>
                  <button class="btn-act" onclick="replaceBannerItem('${b._id || b.id}')">Replace image</button>
                <button class="btn-act btn-act-reject" onclick="deleteBannerItem('${b._id || b.id}')">✕ Delete</button>
                </span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    renderContainerError(container, err.message, 'loadBanners', err.requestId);
  }
}

async function toggleBannerItem(bannerId, makeActive) {
  try {
    await adminFetch(`/admin/banners/${bannerId}`, { method: 'PATCH', body: JSON.stringify({ isActive: !!makeActive }) });
    showToast(makeActive ? 'Banner enabled.' : 'Banner disabled.');
    loadBanners();
  } catch (err) {
    showToast(err.message || 'Could not update banner.', 'error');
  }
}

function replaceBannerItem(bannerId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Banner file size exceeds 5 MB limit.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        showToast('Uploading new image...');
        await adminFetch(`/admin/banners/${bannerId}`, { method: 'PATCH', body: JSON.stringify({ base64: e.target.result }) });
        showToast('Banner image replaced.');
        loadBanners();
      } catch (err) {
        showToast(err.message || 'Could not replace image.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function deleteBannerItem(bannerId) {
  if (!confirm('Are you sure you want to remove this banner? The asset will also be destroyed on Cloudinary.')) {
    return;
  }

  try {
    await adminFetch(`/admin/banners/${bannerId}`, { method: 'DELETE' });
    showToast('Banner deleted successfully.');
    loadBanners();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Explicit window bindings to guarantee event handler access under CSP
window.moderateCommunityPost = moderateCommunityPost;
window.openCommunityPreviewModal = openCommunityPreviewModal;
window.closeCommunityPreviewModal = closeCommunityPreviewModal;
window.loadCommunityPosts = loadCommunityPosts;
window.loadBanners = loadBanners;
window.toggleBannerItem = toggleBannerItem;
window.replaceBannerItem = replaceBannerItem;
window.deleteBannerItem = deleteBannerItem;
window.handleBannerFileSelected = handleBannerFileSelected;
window.submitBannerUpload = submitBannerUpload;
window.openApplicantModal = openApplicantModal;
window.closeApplicantModal = closeApplicantModal;
window.openPhotoLightbox = openPhotoLightbox;
window.closePhotoLightbox = closePhotoLightbox;
window.promptApproveUser = promptApproveUser;
window.openRejectModal = openRejectModal;
window.closeRejectModal = closeRejectModal;
window.openRequestChangesModal = openRequestChangesModal;
window.closeRequestChangesModal = closeRequestChangesModal;
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.moderateUserPhoto = moderateUserPhoto;
window.viewVerificationDocument = viewVerificationDocument;
window.approveVerification = approveVerification;
window.rejectVerification = rejectVerification;
window.verifyPandit = approvePandit;
window.rejectPandit = openRejectPanditDialog;
window.actionReport = actionReport;
window.loadApprovals = loadApprovals;
window.loadUsers = loadUsers;
window.loadProfiles = loadProfiles;
window.loadPandits = loadPandits;
window.loadVerifications = loadVerifications;
window.loadBookings = loadBookings;
window.loadReports = loadReports;
window.loadAuditLogs = loadAuditLogs;
window.loadSystemHealth = loadSystemHealth;
window.loadDashboardStats = loadDashboardStats;
window.toggleUserStatus = toggleUserStatus;
window.toggleUserRole = toggleUserRole;
window.toggleProfileVerify = toggleProfileVerify;
window.refreshActiveTabData = refreshActiveTabData;
window.navigateToTab = navigateToTab;
window.handleLogout = handleLogout;





async function updateBookingStatus(bookingId, newStatus) {
  const label = newStatus === 'accepted' ? 'confirm' : newStatus;
  if (!confirm(`Are you sure you want to ${label} this booking?`)) return;
  try {
    const res = await adminFetch(`/admin/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(res.message || 'Status updated successfully', 'success');
    loadBookings();
    loadBookMyPanditRequests();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message || 'Failed to update status', 'error');
  }
}

async function promptCancelBooking(bookingId) {
  const reason = prompt('Please enter cancellation reason:', 'Cancelled by Admin');
  if (reason === null) return;
  try {
    const res = await adminFetch(`/admin/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', reason: reason.trim() || 'Cancelled by Admin' }),
    });
    showToast(res.message || 'Booking cancelled', 'success');
    loadBookings();
    loadBookMyPanditRequests();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message || 'Failed to cancel booking', 'error');
  }
}

window.updateBookingStatus = updateBookingStatus;
window.promptCancelBooking = promptCancelBooking;


// ==========================================================================
// 13. BOOK MY PANDIT - CUSTOM REQUESTS & REAL-TIME DISPATCH
// ==========================================================================
let allBookMyPanditItems = [];
let panditsListCache = [];
let lastKnownBookingCount = 0;

async function loadBookMyPanditRequests() {
  const tbody = document.getElementById('tbody-book-my-pandit');
  const statusFilter = document.getElementById('filter-pandit-requests-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6">Loading devotee booking requests...</td></tr>';

  try {
    const res = await adminFetch(`/admin/bookings?status=${statusFilter}`);
    const items = res.data?.items || [];
    allBookMyPanditItems = items;

    // Compute live mini-stats
    const totalCount = items.length;
    const pendingCount = items.filter(b => b.status === 'pending' || b.status === 'requested').length;
    const confirmedCount = items.filter(b => b.status === 'confirmed' || b.status === 'accepted').length;
    const assignedCount = items.filter(b => b.status === 'assigned').length;
    const completedCount = items.filter(b => b.status === 'completed').length;

    const elTotal = document.getElementById('stat-bmp-total');
    const elPending = document.getElementById('stat-bmp-pending');
    const elConfirmed = document.getElementById('stat-bmp-confirmed');
    const elAssigned = document.getElementById('stat-bmp-assigned');
    const elCompleted = document.getElementById('stat-bmp-completed');
    const badgeReq = document.getElementById('badge-bmp-requests');

    if (elTotal) elTotal.innerText = totalCount;
    if (elPending) elPending.innerText = pendingCount;
    if (elConfirmed) elConfirmed.innerText = confirmedCount;
    if (elAssigned) elAssigned.innerText = assignedCount;
    if (elCompleted) elCompleted.innerText = completedCount;

    if (badgeReq) {
      badgeReq.innerText = pendingCount;
      badgeReq.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    renderBookMyPanditTable(items);
  } catch (err) {
    renderTableError(tbody, 9, err.message, 'loadBookMyPanditRequests', err.requestId);
  }
}

function filterPanditRequests() {
  const query = document.getElementById('search-pandit-requests')?.value.toLowerCase().trim() || '';
  if (!query) {
    renderBookMyPanditTable(allBookMyPanditItems);
    return;
  }
  const filtered = allBookMyPanditItems.filter(b => {
    return (
      (b.bookingReference || '').toLowerCase().includes(query) ||
      (b.userName || '').toLowerCase().includes(query) ||
      (b.userMobile || '').toLowerCase().includes(query) ||
      (b.serviceName || '').toLowerCase().includes(query) ||
      (b.ceremonyType || '').toLowerCase().includes(query) ||
      (b.city || '').toLowerCase().includes(query)
    );
  });
  renderBookMyPanditTable(filtered);
}

function renderBookMyPanditTable(items) {
  const tbody = document.getElementById('tbody-book-my-pandit');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No booking requests found matching filter</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((b) => {
    let statusBadge = '<span class="badge badge-warning">⏳ Pending</span>';
    if (b.status === 'assigned' || (b.panditName && b.status === 'accepted')) {
      statusBadge = `<span class="badge badge-success" style="background:#7c3aed;color:#fff;">🕉️ Assigned (${escapeHtml(b.panditName || 'Pandit Ji')})</span>`;
    } else if (b.status === 'confirmed' || b.status === 'accepted') {
      statusBadge = '<span class="badge badge-info">✓ Confirmed</span>';
    } else if (b.status === 'completed') {
      statusBadge = '<span class="badge badge-success">✓ Completed</span>';
    } else if (b.status === 'cancelled' || b.status === 'declined') {
      statusBadge = '<span class="badge badge-danger">✕ Cancelled</span>';
    }

    const customerDisplay = b.userName ? escapeHtml(b.userName) : 'Devotee';
    const mobileDisplay = b.userMobile ? escapeHtml(b.userMobile) : ((b.userId && typeof b.userId === 'object' && b.userId.mobile) || 'N/A');
    const serviceDisplay = escapeHtml(b.serviceName || b.ceremonyType || 'Puja Service');
    const locationDisplay = escapeHtml(b.venueAddress || b.address || b.city || (b.mode === 'online' ? 'Online Consultation' : 'In-Person'));
    const budgetDisplay = b.budgetRangeInr ? `₹${escapeHtml(b.budgetRangeInr)}` : (b.priceInr ? `₹${b.priceInr.toLocaleString('en-IN')}` : 'Standard');
    const guestsDisplay = b.guestCount ? `${b.guestCount} guests` : 'Family';

    return `
      <tr>
        <td>
          <strong>${escapeHtml(b.bookingReference || 'N/A')}</strong>
          <div class="text-muted text-xs">${new Date(b.createdAt || Date.now()).toLocaleDateString('en-IN')}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #fff;">${customerDisplay}</div>
          <div style="font-size: 11px; color: var(--gold-accent-light); display: flex; align-items: center; gap: 4px; margin-top: 2px;">
            📞 <a href="tel:${escapeHtml(mobileDisplay)}" style="color: inherit; text-decoration: none;">${mobileDisplay}</a>
            ${mobileDisplay && mobileDisplay !== 'N/A' ? `<a href="https://wa.me/91${mobileDisplay.replace(/\D/g, '')}" target="_blank" title="WhatsApp" style="margin-left: 4px;">💬</a>` : ''}
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--gold-accent);">${serviceDisplay}</div>
          <div class="text-muted text-xs">${escapeHtml(b.ceremonyType || 'puja')}</div>
        </td>
        <td>
          <div>${escapeHtml(b.bookingDate || 'TBD')}</div>
          <div class="text-muted text-xs">${escapeHtml(b.timeSlot || 'Shubh Muhurat')}</div>
        </td>
        <td>
          <div style="max-width: 140px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(b.address || '')}">
            ${locationDisplay}
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: #fff;">${budgetDisplay}</div>
          <div class="text-muted text-xs">${guestsDisplay}</div>
        </td>
        <td>
          ${b.panditName ? `<span style="font-weight: 600; color: var(--gold-accent-light);">🙏 ${escapeHtml(b.panditName)}</span>` : '<span class="text-muted text-xs">Unassigned</span>'}
        </td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button class="btn-primary btn-xs" onclick="openAssignPanditModal('${b.id}', '${escapeHtml(customerDisplay)}', '${escapeHtml(serviceDisplay)}', '${escapeHtml(b.bookingDate || '')}')">
              🕉️ Assign
            </button>
            <button class="btn-secondary btn-xs" onclick="viewBookingDetails('${b.id}')">
              👁️ Details
            </button>
            ${b.status !== 'completed' && b.status !== 'cancelled' ? `
              <button class="btn-success btn-xs" onclick="updateBookingStatus('${b.id}', 'completed')" title="Mark as Completed">✓ Done</button>
              <button class="btn-danger btn-xs" onclick="promptCancelBooking('${b.id}')" title="Cancel Booking">✕</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function openAssignPanditModal(bookingId, customerName, serviceName, bookingDate) {
  document.getElementById('assign-booking-id').value = bookingId;
  const summaryEl = document.getElementById('assign-booking-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `<strong>Customer:</strong> ${customerName} | <strong>Puja:</strong> ${serviceName} | <strong>Date:</strong> ${bookingDate}`;
  }

  const select = document.getElementById('assign-pandit-select');
  select.innerHTML = '<option value="">Loading approved pandits...</option>';
  document.getElementById('modal-assign-pandit').style.display = 'flex';

  try {
    if (panditsListCache.length === 0) {
      const res = await adminFetch('/admin/pandits?status=approved');
      panditsListCache = res.data?.items || [];
    }

    if (panditsListCache.length === 0) {
      select.innerHTML = '<option value="">No approved pandits found</option>';
      return;
    }

    select.innerHTML = '<option value="">-- Choose Approved Pandit --</option>' +
      panditsListCache.map(p => {
        const name = p.name || p.userId?.displayName || 'Pandit Ji';
        const phone = p.phone || p.userId?.mobile || '';
        const specs = (p.specializations || []).slice(0, 2).join(', ');
        return `<option value="${p.id}">${escapeHtml(name)} (${escapeHtml(specs)}) - ${escapeHtml(phone)}</option>`;
      }).join('');
  } catch (err) {
    select.innerHTML = `<option value="">Error loading pandits: ${escapeHtml(err.message)}</option>`;
  }
}

function closeAssignPanditModal() {
  document.getElementById('modal-assign-pandit').style.display = 'none';
  document.getElementById('assign-pandit-notes').value = '';
}

async function submitPanditAssignment() {
  const bookingId = document.getElementById('assign-booking-id').value;
  const panditId = document.getElementById('assign-pandit-select').value;
  const notes = document.getElementById('assign-pandit-notes').value;
  const btn = document.getElementById('btn-confirm-assign-pandit');

  if (!panditId) {
    showToast('Please select a pandit to assign.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Assigning...';

  try {
    await adminFetch(`/admin/bookings/${bookingId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ panditId, notes }),
    });

    showToast('Pandit successfully assigned to booking!');
    closeAssignPanditModal();
    loadBookMyPanditRequests();
    loadBookings();
  } catch (err) {
    showToast(err.message || 'Failed to assign pandit.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Assign & Notify Devotee';
  }
}

function viewBookingDetails(bookingId) {
  const booking = allBookMyPanditItems.find(b => b.id === bookingId);
  if (!booking) return;

  const content = document.getElementById('booking-details-modal-content');
  const title = document.getElementById('booking-details-modal-title');
  if (title) title.innerText = `Puja Booking: ${booking.bookingReference || 'Details'}`;

  const mobileDisplay = booking.userMobile || ((booking.userId && typeof booking.userId === 'object' && booking.userId.mobile) || 'N/A');
  const addressDisplay = booking.venueAddress || booking.address || 'Address not specified';
  const notesDisplay = booking.specialRequests || booking.devoteeNotes || '';

  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
      <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-size: 11px; text-transform: uppercase; color: var(--gold-accent); margin-bottom: 6px;">Devotee Information</div>
        <div style="font-size: 15px; font-weight: 700; color: #fff;">${escapeHtml(booking.userName || 'Devotee')}</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Phone: <strong>${escapeHtml(mobileDisplay)}</strong></div>
        <div style="margin-top: 10px; display: flex; gap: 8px;">
          <a href="tel:${escapeHtml(mobileDisplay)}" class="btn-primary btn-xs" style="text-decoration: none;">📞 Call Devotee</a>
          ${mobileDisplay && mobileDisplay !== 'N/A' ? `<a href="https://wa.me/91${mobileDisplay.replace(/\D/g, '')}" target="_blank" class="btn-success btn-xs" style="text-decoration: none;">💬 WhatsApp</a>` : ''}
        </div>
      </div>

      <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-size: 11px; text-transform: uppercase; color: var(--gold-accent); margin-bottom: 6px;">Ritual & Ceremony</div>
        <div style="font-size: 15px; font-weight: 700; color: #fff;">${escapeHtml(booking.serviceName || booking.ceremonyType || 'Puja Service')}</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Mode: <strong>${escapeHtml(booking.mode === 'online' ? 'Online Consultation' : 'In-Person at Venue')}</strong></div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">Date: <strong>${escapeHtml(booking.bookingDate || 'TBD')}</strong> (${escapeHtml(booking.timeSlot || 'Shubh Muhurat')})</div>
      </div>
    </div>

    <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 16px;">
      <div style="font-size: 11px; text-transform: uppercase; color: var(--gold-accent); margin-bottom: 6px;">Venue & Ceremony Address</div>
      <div style="font-size: 13px; color: #fff;">${escapeHtml(addressDisplay)}</div>
      ${booking.city ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">City: ${escapeHtml(booking.city)}, State: ${escapeHtml(booking.state || 'N/A')}</div>` : ''}
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
      <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-size: 11px; color: var(--text-muted);">Estimated Guests</div>
        <div style="font-size: 14px; font-weight: 700; color: #fff; margin-top: 2px;">${booking.guestCount || 'Family'}</div>
      </div>
      <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-size: 11px; color: var(--text-muted);">Budget Range</div>
        <div style="font-size: 14px; font-weight: 700; color: var(--gold-accent); margin-top: 2px;">${booking.budgetRangeInr ? `₹${escapeHtml(booking.budgetRangeInr)}` : (booking.priceInr ? `₹${booking.priceInr}` : 'Standard')}</div>
      </div>
      <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div style="font-size: 11px; color: var(--text-muted);">Language Preference</div>
        <div style="font-size: 14px; font-weight: 700; color: #fff; margin-top: 2px;">${escapeHtml(booking.languagePref || 'Hindi / Sanskrit')}</div>
      </div>
    </div>

    ${notesDisplay ? `
      <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 16px;">
        <div style="font-size: 11px; color: var(--gold-accent); margin-bottom: 4px;">Devotee Notes / Gotra Details</div>
        <div style="font-size: 13px; color: #fff;">${escapeHtml(notesDisplay)}</div>
      </div>
    ` : ''}
  `;

  document.getElementById('modal-booking-details').style.display = 'flex';
}

function closeBookingDetailsModal() {
  document.getElementById('modal-booking-details').style.display = 'none';
}

function startBookingPolling() {
  setInterval(async () => {
    if (!authToken) return;
    try {
      const res = await adminFetch('/admin/bookings?status=all');
      const items = res.data?.items || [];
      const pendingCount = items.filter(b => b.status === 'pending' || b.status === 'requested').length;

      const badgeReq = document.getElementById('badge-bmp-requests');
      if (badgeReq) {
        badgeReq.innerText = pendingCount;
        badgeReq.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }

      if (lastKnownBookingCount > 0 && items.length > lastKnownBookingCount) {
        const latest = items[0];
        const devoteeName = latest?.userName || 'A customer';
        showToast(`🔔 New Book My Pandit request received from ${devoteeName}!`, 'info');
        if (activeTab === 'book-my-pandit') {
          loadBookMyPanditRequests();
        } else if (activeTab === 'bookings') {
          loadBookings();
        }
        loadDashboardStats();
      }
      lastKnownBookingCount = items.length;
    } catch {
      // background poll error is silent
    }
  }, 10000);
}

function initAdminSocket() {
  if (typeof io === 'undefined' || !authToken || window.adminSocket) return;
  try {
    const socket = io({
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('⚡ Admin real-time WebSocket connected');
    });

    socket.on('new_booking_request', (data) => {
      const name = data?.userName || 'A devotee';
      const ceremony = data?.serviceName || 'Puja';
      showToast(`🔔 New Booking: ${name} requested ${ceremony}!`, 'info');
      const badgeReq = document.getElementById('badge-bmp-requests');
      if (badgeReq) {
        const cur = parseInt(badgeReq.innerText, 10) || 0;
        badgeReq.innerText = cur + 1;
        badgeReq.style.display = 'inline-block';
      }
      if (activeTab === 'book-my-pandit') {
        loadBookMyPanditRequests();
      } else if (activeTab === 'bookings') {
        loadBookings();
      }
      loadDashboardStats();
    });

    socket.on('new_pandit_registration', (data) => {
      showToast(`🙏 New Pandit Registration: ${data?.name || 'Pandit Ji'} applied!`, 'info');
      if (activeTab === 'pandits') {
        loadPandits();
      }
      loadDashboardStats();
    });

    window.adminSocket = socket;
  } catch (err) {
    console.warn('Socket init error:', err);
  }
}

// ==========================================================================
// 14. PAYMENTS & TRANSACTIONS
// ==========================================================================
async function loadPayments() {
  const tbody = document.getElementById('tbody-payments');
  const statusFilter = document.getElementById('filter-payments-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6">Loading payments data...</td></tr>';

  try {
    const res = await adminFetch(`/admin/payments?status=${statusFilter}`);
    const items = res.data?.items || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No payments recorded matching filter</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(p => {
      let statusBadge = '<span class="badge badge-success">✓ Captured</span>';
      if (p.status === 'created') statusBadge = '<span class="badge badge-warning">⏳ Initiated</span>';
      else if (p.status === 'failed') statusBadge = '<span class="badge badge-danger">✕ Failed</span>';

      return `
        <tr>
          <td><code>${escapeHtml(p.id)}</code></td>
          <td>${escapeHtml(p.userName || p.userId?.displayName || 'User')}</td>
          <td><strong>₹${(p.amountInr || 0).toLocaleString('en-IN')}</strong></td>
          <td>${escapeHtml(p.plan || p.purpose || 'VIP Membership')}</td>
          <td>${escapeHtml(p.method || 'Razorpay / UPI')}</td>
          <td>${statusBadge}</td>
          <td>${new Date(p.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    renderTableError(tbody, 7, err.message, 'loadPayments', err.requestId);
  }
}

// ==========================================================================
// 15. SERVICES CATALOG
// ==========================================================================
async function loadServices() {
  const tbody = document.getElementById('tbody-services');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6">Loading services catalog...</td></tr>';

  try {
    const res = await adminFetch('/admin/services');
    const items = res.data?.items || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No services found</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(s => {
      return `
        <tr>
          <td><code>${escapeHtml(s.code)}</code></td>
          <td><strong>${escapeHtml(s.name)}</strong></td>
          <td>${escapeHtml(s.category)}</td>
          <td><strong>₹${(s.basePriceInr || 0).toLocaleString('en-IN')}</strong></td>
          <td>${escapeHtml(s.duration || '2-3 Hours')}</td>
          <td>${s.samagriIncluded ? '✅ Included' : '❌ Devotee Brings'}</td>
          <td><span class="badge badge-success">Active</span></td>
          <td>
            <button class="btn-secondary btn-xs" onclick="editService('${escapeHtml(s.code)}')">✏️ Edit</button>
            <button class="btn-danger btn-xs" onclick="deleteService('${escapeHtml(s.code)}')">✕ Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    renderTableError(tbody, 8, err.message, 'loadServices', err.requestId);
  }
}

function openCreateServiceModal() {
  document.getElementById('service-form-id').value = '';
  document.getElementById('service-form-code').value = '';
  document.getElementById('service-form-name').value = '';
  document.getElementById('service-form-name-hi').value = '';
  document.getElementById('service-form-price').value = '5100';
  document.getElementById('service-form-desc').value = '';
  document.getElementById('modal-service-form').style.display = 'flex';
}

function closeServiceFormModal() {
  document.getElementById('modal-service-form').style.display = 'none';
}

async function saveServiceForm() {
  const code = document.getElementById('service-form-code').value.trim();
  const name = document.getElementById('service-form-name').value.trim();
  const nameHi = document.getElementById('service-form-name-hi').value.trim();
  const category = document.getElementById('service-form-category').value;
  const basePriceInr = Number(document.getElementById('service-form-price').value) || 5100;
  const duration = document.getElementById('service-form-duration').value.trim() || '2-3 Hours';
  const samagriIncluded = document.getElementById('service-form-samagri').value === 'true';
  const description = document.getElementById('service-form-desc').value.trim();

  if (!code || !name) {
    showToast('Please provide service code and name.', 'warning');
    return;
  }

  try {
    await adminFetch('/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        code,
        name,
        nameHi,
        category,
        basePriceInr,
        duration,
        samagriIncluded,
        description,
        isActive: true,
      }),
    });
    showToast('Service saved successfully!');
    closeServiceFormModal();
    loadServices();
  } catch (err) {
    showToast(err.message || 'Failed to save service.', 'error');
  }
}

async function deleteService(code) {
  if (!confirm(`Are you sure you want to remove service "${code}"?`)) return;
  try {
    await adminFetch(`/admin/services/${code}`, { method: 'DELETE' });
    showToast('Service deleted.');
    loadServices();
  } catch (err) {
    showToast(err.message || 'Failed to delete service.', 'error');
  }
}

function editService(code) {
  openCreateServiceModal();
  document.getElementById('service-form-code').value = code;
  document.getElementById('service-form-name').value = code;
}

// ==========================================================================
// 16. CATEGORIES
// ==========================================================================
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="table-empty">Loading service categories...</div>';

  try {
    const res = await adminFetch('/admin/categories');
    const items = res.data?.items || [];
    if (items.length === 0) {
      grid.innerHTML = '<div class="table-empty">No categories found</div>';
      return;
    }

    grid.innerHTML = items.map(c => `
      <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 16px;">
        <div style="font-size: 28px; margin-bottom: 8px;">${escapeHtml(c.icon || '🕉️')}</div>
        <div style="font-size: 16px; font-weight: 700; color: #fff;">${escapeHtml(c.name)}</div>
        <div style="font-size: 13px; color: var(--gold-accent-light); margin-top: 2px;">${escapeHtml(c.nameHi || '')}</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">${escapeHtml(c.desc || '')}</div>
        <div style="margin-top: 12px; font-size: 12px; font-weight: 600; color: var(--gold-accent);">${c.serviceCount || 0} Available Rituals</div>
      </div>
    `).join('');
  } catch (err) {
    renderContainerError(grid, err.message, 'loadCategories', err.requestId);
  }
}

// ==========================================================================
// 17. NOTIFICATIONS BROADCAST
// ==========================================================================
async function loadNotifications() {
  const tbody = document.getElementById('tbody-notifications');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6">Loading notification logs...</td></tr>';

  try {
    const res = await adminFetch('/admin/notifications');
    const items = res.data?.items || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No broadcast notifications sent yet</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(n => `
      <tr>
        <td><strong>${escapeHtml(n.title)}</strong></td>
        <td><div style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(n.message)}</div></td>
        <td><span class="badge badge-info">${escapeHtml(n.targetAudience || 'all')}</span></td>
        <td>${escapeHtml(n.senderName || 'Admin')}</td>
        <td>${new Date(n.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
        <td><span class="badge badge-success">Delivered</span></td>
      </tr>
    `).join('');
  } catch (err) {
    renderTableError(tbody, 6, err.message, 'loadNotifications', err.requestId);
  }
}

function openSendNotificationModal() {
  document.getElementById('modal-send-notification').style.display = 'flex';
}

function closeSendNotificationModal() {
  document.getElementById('modal-send-notification').style.display = 'none';
  document.getElementById('notif-title').value = '';
  document.getElementById('notif-message').value = '';
}

async function submitBroadcastNotification() {
  const title = document.getElementById('notif-title').value.trim();
  const message = document.getElementById('notif-message').value.trim();
  const targetAudience = document.getElementById('notif-target').value;
  const actionUrl = document.getElementById('notif-action-url').value.trim();

  if (!title || !message) {
    showToast('Please enter notification title and message.', 'warning');
    return;
  }

  try {
    await adminFetch('/admin/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({ title, message, targetAudience, actionUrl }),
    });
    showToast('Broadcast notification sent successfully!');
    closeSendNotificationModal();
    loadNotifications();
  } catch (err) {
    showToast(err.message || 'Failed to send broadcast.', 'error');
  }
}

// ==========================================================================
// 18. HELP & SUPPORT INQUIRIES
// ==========================================================================
async function loadHelpSupport() {
  const tbody = document.getElementById('tbody-help-support');
  const statusFilter = document.getElementById('filter-support-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6">Loading support inquiries...</td></tr>';

  try {
    const res = await adminFetch(`/admin/support/inquiries?status=${statusFilter}`);
    const items = res.data?.items || [];
    const badgeSupport = document.getElementById('badge-support-count');
    const openCount = items.filter(i => i.status === 'open' || i.status === 'pending').length;
    if (badgeSupport) {
      badgeSupport.innerText = openCount;
      badgeSupport.style.display = openCount > 0 ? 'inline-block' : 'none';
    }

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No support inquiries found matching filter</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(inq => {
      let statusBadge = '<span class="badge badge-warning">⏳ Open</span>';
      if (inq.status === 'in_progress') statusBadge = '<span class="badge badge-info">⚙️ In Progress</span>';
      else if (inq.status === 'resolved') statusBadge = '<span class="badge badge-success">✓ Resolved</span>';
      else if (inq.status === 'closed') statusBadge = '<span class="badge badge-muted">Closed</span>';

      const phone = inq.phone || inq.mobile || inq.userId?.mobile || '';
      const email = inq.email || inq.userId?.email || '';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(inq.name || inq.userId?.displayName || 'User')}</strong>
            <div style="font-size: 11px; color: var(--gold-accent-light); margin-top: 2px;">
              📞 <a href="tel:${escapeHtml(phone)}" style="color: inherit; text-decoration: none;">${escapeHtml(phone || 'N/A')}</a>
            </div>
            <div class="text-muted text-xs">${escapeHtml(email)}</div>
          </td>
          <td><span class="badge badge-info">${escapeHtml(inq.category || 'General')}</span></td>
          <td><strong>${escapeHtml(inq.subject || 'Support Request')}</strong></td>
          <td><div style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(inq.message || '')}">${escapeHtml(inq.message || '')}</div></td>
          <td>${statusBadge}</td>
          <td>${new Date(inq.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              ${phone ? `<a href="tel:${escapeHtml(phone)}" class="btn-primary btn-xs" style="text-decoration: none;" title="Call">📞 Call</a>` : ''}
              ${phone ? `<a href="https://wa.me/91${phone.replace(/\D/g, '')}" target="_blank" class="btn-success btn-xs" style="text-decoration: none;" title="WhatsApp">💬 WhatsApp</a>` : ''}
              ${email ? `<a href="mailto:${escapeHtml(email)}" class="btn-secondary btn-xs" style="text-decoration: none;" title="Email">✉️ Email</a>` : ''}
              ${inq.status !== 'resolved' ? `<button class="btn-success btn-xs" onclick="updateInquiryStatus('${inq.id}', 'resolved')">✓ Resolve</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    renderTableError(tbody, 7, err.message, 'loadHelpSupport', err.requestId);
  }
}

async function updateInquiryStatus(inquiryId, status) {
  try {
    await adminFetch(`/admin/support/inquiries/${inquiryId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    showToast(`Inquiry marked as ${status}!`);
    loadHelpSupport();
  } catch (err) {
    showToast(err.message || 'Failed to update inquiry status.', 'error');
  }
}

// ==========================================================================
// 20. CHAT CONVERSATIONS & ABUSE MODERATION (SECTION 9)
// ==========================================================================
let chatSearchQuery = '';
let chatSearchTimer = null;

function handleChatSearch(e) {
  clearTimeout(chatSearchTimer);
  chatSearchTimer = setTimeout(() => {
    chatSearchQuery = e.target.value ? e.target.value.trim() : '';
    loadChatConversations();
  }, 300);
}

async function loadChatConversations() {
  const tbody = document.getElementById('tbody-chat-conversations');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6">Loading conversations...</td></tr>';

  try {
    const res = await adminFetch(`/admin/chat/conversations?search=${encodeURIComponent(chatSearchQuery)}`);
    const convs = res.data?.conversations || [];

    if (convs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No conversation records found</td></tr>';
      return;
    }

    tbody.innerHTML = convs
      .map((c) => {
        const u1 = c.user1 || {};
        const u2 = c.user2 || {};
        const entitlementBadge = c.isFreeChat
          ? '<span class="badge badge-success">✨ Free Female Chat</span>'
          : '<span class="badge badge-info">💳 Paid Male Plan</span>';

        const lastActive = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString('en-IN') : 'N/A';

        return `
          <tr>
            <td>
              <div><strong>${escapeHtml(u1.name || 'User 1')}</strong></div>
              <div class="text-xs text-muted">Gender: ${escapeHtml(u1.gender || 'N/A')} | 📞 ${escapeHtml(u1.mobile || 'N/A')}</div>
              ${u1.isChatBlocked ? '<span class="badge badge-danger text-xs mt-1">Chat Blocked</span>' : ''}
            </td>
            <td>
              <div><strong>${escapeHtml(u2.name || 'User 2')}</strong></div>
              <div class="text-xs text-muted">Gender: ${escapeHtml(u2.gender || 'N/A')} | 📞 ${escapeHtml(u2.mobile || 'N/A')}</div>
              ${u2.isChatBlocked ? '<span class="badge badge-danger text-xs mt-1">Chat Blocked</span>' : ''}
            </td>
            <td>${entitlementBadge}</td>
            <td><span class="badge badge-purple">${c.messageCount || 0} msgs</span></td>
            <td>
              <div class="text-xs" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(c.lastMessagePreview || 'No messages yet')}
              </div>
            </td>
            <td><div class="text-xs text-muted">${lastActive}</div></td>
            <td>
              <div class="action-buttons" style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button class="btn-primary btn-xs" onclick="openChatTranscript('${c.id}', '${escapeHtml(u1.name)}', '${escapeHtml(u2.name)}')">👁️ Messages</button>
                ${
                  u1.id
                    ? `<button class="btn-${u1.isChatBlocked ? 'success' : 'danger'} btn-xs" onclick="toggleBlockChatUser('${u1.id}', ${u1.isChatBlocked})">${
                        u1.isChatBlocked ? 'Unblock ' + escapeHtml(u1.name.slice(0, 8)) : 'Block ' + escapeHtml(u1.name.slice(0, 8))
                      }</button>`
                    : ''
                }
                ${
                  u2.id
                    ? `<button class="btn-${u2.isChatBlocked ? 'success' : 'danger'} btn-xs" onclick="toggleBlockChatUser('${u2.id}', ${u2.isChatBlocked})">${
                        u2.isChatBlocked ? 'Unblock ' + escapeHtml(u2.name.slice(0, 8)) : 'Block ' + escapeHtml(u2.name.slice(0, 8))
                      }</button>`
                    : ''
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 7, err.message, 'loadChatConversations', err.requestId);
  }
}

async function openChatTranscript(conversationId, user1Name, user2Name) {
  const modal = document.getElementById('modal-chat-transcript');
  const body = document.getElementById('chat-transcript-messages');
  const title = document.getElementById('chat-transcript-title');
  const subtitle = document.getElementById('chat-transcript-subtitle');
  if (!modal || !body) return;

  if (title) title.innerText = `💬 Chat: ${user1Name} & ${user2Name}`;
  if (subtitle) subtitle.innerText = `Conversation ID: ${conversationId}`;
  body.innerHTML = '<div class="text-center py-6">Loading conversation transcript...</div>';
  modal.style.display = 'flex';

  try {
    const res = await adminFetch(`/conversations/${conversationId}/messages?limit=100`);
    const msgs = res.data?.items || [];

    if (msgs.length === 0) {
      body.innerHTML = '<div class="text-center text-muted py-6">No messages found in this conversation yet.</div>';
      return;
    }

    body.innerHTML = msgs
      .reverse()
      .map((m) => {
        const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div style="margin-bottom: 12px; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 8px; border-left: 3px solid var(--gold-accent-light);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <strong style="font-size: 13px; color: var(--gold-accent-light);">${escapeHtml(m.senderId || 'Participant')}</strong>
              <span class="text-muted text-xs">${time}</span>
            </div>
            <div style="font-size: 13px; color: #fff; line-height: 1.4;">${escapeHtml(m.text || '')}</div>
            ${m.attachmentUrl ? `<div class="mt-2"><a href="${escapeHtml(m.attachmentUrl)}" target="_blank" class="btn-xs btn-primary">📎 View Attachment</a></div>` : ''}
          </div>
        `;
      })
      .join('');
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

function closeChatTranscriptModal() {
  const modal = document.getElementById('modal-chat-transcript');
  if (modal) modal.style.display = 'none';
}

async function toggleBlockChatUser(userId, isCurrentlyBlocked) {
  if (isCurrentlyBlocked) {
    if (!confirm('Unblock this user from sending messages?')) return;
    try {
      await adminFetch(`/admin/chat/users/${userId}/block-chat`, {
        method: 'POST',
        body: JSON.stringify({ isBlocked: false }),
      });
      showToast('User chat privileges restored.');
      loadChatConversations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else {
    const reason = prompt('Please enter reason for blocking this user from chatting:');
    if (!reason || !reason.trim()) return;
    try {
      await adminFetch(`/admin/chat/users/${userId}/block-chat`, {
        method: 'POST',
        body: JSON.stringify({ isBlocked: true, reason: reason.trim() }),
      });
      showToast('User has been blocked from sending messages.');
      loadChatConversations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

// ==========================================================================
// 18.5 AUDIO & VIDEO CALLS MANAGEMENT
// ==========================================================================
async function loadCallsList() {
  const tbody = document.getElementById('tbody-calls-list');
  const filterType = document.getElementById('call-filter-type')?.value || 'all';
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-muted">Loading call records...</td></tr>`;

  try {
    const res = await adminFetch(`/admin/calls?filter=${encodeURIComponent(filterType)}&limit=50`);
    const data = res.data || {};
    const calls = data.items || [];
    const stats = data.stats || {};

    const statCalls = document.getElementById('stat-total-calls');
    const statDuration = document.getElementById('stat-total-call-duration');
    const statRev = document.getElementById('stat-total-call-revenue');
    const statPandit = document.getElementById('stat-total-pandit-call-earnings');
    const badgeCalls = document.getElementById('badge-calls-count');

    const totalCalls = stats.totalCalls || (data.pagination ? data.pagination.totalCount : calls.length);
    const totalDurationSec = stats.totalDuration || 0;
    const totalDurationMin = Math.round(totalDurationSec / 60);
    const totalRev = stats.totalRevenue || 0;
    const totalPanditEarnings = stats.totalPanditEarnings || 0;

    if (statCalls) statCalls.innerText = totalCalls.toLocaleString();
    if (statDuration) statDuration.innerText = `${totalDurationMin} min`;
    if (statRev) statRev.innerText = `₹${totalRev.toLocaleString()}`;
    if (statPandit) statPandit.innerText = `₹${totalPanditEarnings.toLocaleString()}`;
    if (badgeCalls) {
      badgeCalls.innerText = totalCalls;
      badgeCalls.style.display = totalCalls > 0 ? 'inline-block' : 'none';
    }

    if (!calls.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-muted">No call records found for selected filter (${filterType}).</td></tr>`;
      return;
    }

    let html = '';
    calls.forEach((c) => {
      const typeBadge = c.callType === 'video'
        ? `<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">📹 Video</span>`
        : `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">📞 Audio</span>`;

      let statusBadge = `<span class="badge badge-secondary">${c.status || 'unknown'}</span>`;
      if (c.status === 'accepted' || c.status === 'in_progress') {
        statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">● Connected</span>`;
      } else if (c.status === 'ended') {
        statusBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">✓ Completed</span>`;
      } else if (c.status === 'missed') {
        statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">✕ Missed</span>`;
      } else if (c.status === 'rejected') {
        statusBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">⊘ Declined</span>`;
      }

      const durMin = Math.floor((c.durationSeconds || 0) / 60);
      const durSec = (c.durationSeconds || 0) % 60;
      const durText = `${durMin}m ${durSec < 10 ? '0' : ''}${durSec}s`;

      const callerName = escapeHtml(c.callerName || (c.callerId ? String(c.callerId).slice(-6) : 'User'));
      const receiverName = escapeHtml(c.receiverName || (c.receiverId ? String(c.receiverId).slice(-6) : 'Pandit/User'));
      const panditLabel = c.panditId
        ? `<span style="color: #D4AF37; font-weight: 600;">🕉️ Pandit: ${escapeHtml(String(c.panditId).slice(-6))}</span>`
        : `<span class="text-muted">User-to-User</span>`;

      const amountPaid = c.amountPaid ? `₹${c.amountPaid}` : 'Free / Included';
      const dateText = c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';

      html += `<tr>
        <td style="font-family: monospace; font-size: 11px;">${escapeHtml(c.sessionId || (c._id ? String(c._id).slice(-8) : 'N/A'))}</td>
        <td><strong>${callerName}</strong></td>
        <td><strong>${receiverName}</strong></td>
        <td>${panditLabel}</td>
        <td>${typeBadge}</td>
        <td>${durText}</td>
        <td style="font-weight: 600; color: #10b981;">${amountPaid}</td>
        <td>${statusBadge}</td>
        <td class="text-muted text-xs">${dateText}</td>
      </tr>`;
    });

    if (tbody) tbody.innerHTML = html;
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-danger">Failed to load call sessions: ${escapeHtml(err.message || 'Error')}</td></tr>`;
  }
}

// ==========================================================================
// 19. SETTINGS & CHAT RULES CONTROL (SECTION 10)
// ==========================================================================
async function loadSettings() {
  try {
    const res = await adminFetch('/admin/system/settings');
    const s = res.data || {};

    if (document.getElementById('setting-phone')) document.getElementById('setting-phone').value = s.supportPhone || s.contactPhone || '8076168502';
    if (document.getElementById('setting-whatsapp')) document.getElementById('setting-whatsapp').value = s.whatsappPhone || s.contactWhatsApp || '8076168502';
    if (document.getElementById('setting-email')) document.getElementById('setting-email').value = s.supportEmail || s.contactEmail || 'shaadibanao.urbanpower@gmail.com';

    if (document.getElementById('setting-female-free-chat')) document.getElementById('setting-female-free-chat').checked = s.femaleFreeChatEnabled !== false;
    if (document.getElementById('setting-male-paid-chat')) document.getElementById('setting-male-paid-chat').checked = s.malePaidChatRequired !== false;
    if (document.getElementById('setting-male-free-reply')) document.getElementById('setting-male-free-reply').checked = s.maleFreeReplyToFemale !== false;
    if (document.getElementById('setting-male-free-limit')) document.getElementById('setting-male-free-limit').value = s.maleFreeMessageLimit ?? 1;
    if (document.getElementById('setting-pandit-free-chat')) document.getElementById('setting-pandit-free-chat').checked = s.panditFreeChatEnabled !== false;
    if (document.getElementById('setting-pandit-free-limit')) document.getElementById('setting-pandit-free-limit').value = s.panditFreeMessageLimit ?? 1;
    if (document.getElementById('setting-pandit-paid-chat')) document.getElementById('setting-pandit-paid-chat').checked = s.panditPaidChatRequired !== false;
    if (document.getElementById('setting-female-free-pandit-chat')) document.getElementById('setting-female-free-pandit-chat').checked = s.femaleFreePanditChat === true;
    if (document.getElementById('setting-pandit-whatsapp-enabled')) document.getElementById('setting-pandit-whatsapp-enabled').checked = s.panditWhatsappEnabled !== false;
    if (document.getElementById('setting-pandit-whatsapp-rule')) document.getElementById('setting-pandit-whatsapp-rule').value = s.panditWhatsappRule || 'paid_booking_or_subscription';
    if (document.getElementById('setting-max-message-length')) document.getElementById('setting-max-message-length').value = s.maxMessageLength || 1000;

    if (document.getElementById('setting-plus-price')) document.getElementById('setting-plus-price').value = s.plusPlanPriceInr || 2999;
    if (document.getElementById('setting-premium-price')) document.getElementById('setting-premium-price').value = s.premiumPlanPriceInr || 4999;
    if (document.getElementById('setting-audio-call-price')) document.getElementById('setting-audio-call-price').value = s.audioConsultationPriceInr || 501;
    if (document.getElementById('setting-video-call-price')) document.getElementById('setting-video-call-price').value = s.videoConsultationPriceInr || 1100;
    if (document.getElementById('setting-call-commission')) document.getElementById('setting-call-commission').value = s.callCommissionRate || 15;
    if (document.getElementById('setting-pandit-fee')) document.getElementById('setting-pandit-fee').value = s.defaultPanditConsultationFee || 501;
    if (document.getElementById('setting-astrology-fee')) document.getElementById('setting-astrology-fee').value = s.defaultAstrologyFee || 501;

    if (document.getElementById('setting-banned-keywords')) {
      const keywords = s.bannedKeywords || ['abuse', 'fraud', 'scam', 'money transfer'];
      document.getElementById('setting-banned-keywords').value = keywords.join(', ');
    }

    showToast('System configuration & rules loaded.');
  } catch (err) {
    showToast('Loaded verified fallback settings.', 'info');
  }
}

async function saveSystemSettings() {
  try {
    const phone = document.getElementById('setting-phone')?.value.trim() || '8076168502';
    const whatsapp = document.getElementById('setting-whatsapp')?.value.trim() || '8076168502';
    const email = document.getElementById('setting-email')?.value.trim() || 'shaadibanao.urbanpower@gmail.com';

    const femaleFreeChat = document.getElementById('setting-female-free-chat')?.checked;
    const malePaidChat = document.getElementById('setting-male-paid-chat')?.checked;
    const maleFreeReply = document.getElementById('setting-male-free-reply')?.checked;
    const maleFreeLimitRaw = document.getElementById('setting-male-free-limit')?.value;
    const maleFreeLimit = maleFreeLimitRaw === '' || maleFreeLimitRaw === undefined ? 1 : Number(maleFreeLimitRaw);
    const panditFreeChatEnabled = document.getElementById('setting-pandit-free-chat')?.checked;
    const panditFreeLimitRaw = document.getElementById('setting-pandit-free-limit')?.value;
    const panditFreeMessageLimit = panditFreeLimitRaw === '' || panditFreeLimitRaw === undefined ? 1 : Number(panditFreeLimitRaw);
    const panditPaidChatRequired = document.getElementById('setting-pandit-paid-chat')?.checked;
    const femaleFreePanditChat = document.getElementById('setting-female-free-pandit-chat')?.checked;
    const panditWhatsappEnabled = document.getElementById('setting-pandit-whatsapp-enabled')?.checked;
    const panditWhatsappRule = document.getElementById('setting-pandit-whatsapp-rule')?.value || 'paid_booking_or_subscription';
    const maxMsgLength = Number(document.getElementById('setting-max-message-length')?.value) || 1000;

    const plusPrice = Number(document.getElementById('setting-plus-price')?.value) || 2999;
    const premiumPrice = Number(document.getElementById('setting-premium-price')?.value) || 4999;
    const audioCallPrice = Number(document.getElementById('setting-audio-call-price')?.value) || 501;
    const videoCallPrice = Number(document.getElementById('setting-video-call-price')?.value) || 1100;
    const callCommission = Number(document.getElementById('setting-call-commission')?.value) || 15;
    const panditFee = Number(document.getElementById('setting-pandit-fee')?.value) || 501;
    const astrologyFee = Number(document.getElementById('setting-astrology-fee')?.value) || 501;

    const bannedKeywordsRaw = document.getElementById('setting-banned-keywords')?.value || '';
    const bannedKeywords = bannedKeywordsRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const payload = {
      supportPhone: phone,
      contactPhone: phone,
      whatsappPhone: whatsapp,
      contactWhatsApp: whatsapp,
      supportEmail: email,
      contactEmail: email,
      femaleFreeChatEnabled: femaleFreeChat,
      malePaidChatRequired: malePaidChat,
      maleFreeReplyToFemale: maleFreeReply,
      maleFreeMessageLimit: maleFreeLimit,
      panditFreeChatEnabled,
      panditFreeMessageLimit,
      panditPaidChatRequired,
      femaleFreePanditChat,
      panditWhatsappEnabled,
      panditWhatsappRule,
      maxMessageLength: maxMsgLength,
      plusPlanPriceInr: plusPrice,
      premiumPlanPriceInr: premiumPrice,
      audioConsultationPriceInr: audioCallPrice,
      videoConsultationPriceInr: videoCallPrice,
      callCommissionRate: callCommission,
      defaultPanditConsultationFee: panditFee,
      defaultAstrologyFee: astrologyFee,
      bannedKeywords,
    };

    const res = await adminFetch('/admin/system/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    showToast('All system settings & chat rules saved and applied immediately without restart!');
  } catch (err) {
    showToast(err.message || 'Failed to save settings.', 'error');
  }
}

// Expose modal and tab functions to global window scope
window.navigateToTab = navigateToTab;
window.toggleMenuGroup = toggleMenuGroup;
window.selectPanditSection = selectPanditSection;
window.handlePanditSearch = handlePanditSearch;
window.loadPandits = loadPandits;
window.openPanditDetailsModal = openPanditDetailsModal;
window.closePanditDetailsModal = closePanditDetailsModal;
window.saveAdminPanditConfig = saveAdminPanditConfig;
window.approvePandit = approvePandit;
window.openRejectPanditDialog = openRejectPanditDialog;
window.closeRejectPanditDialog = closeRejectPanditDialog;
window.submitRejectPanditDialog = submitRejectPanditDialog;
window.openRequestPanditDocsModal = openRequestPanditDocsModal;
window.closeRequestPanditDocsModal = closeRequestPanditDocsModal;
window.submitRequestPanditDocs = submitRequestPanditDocs;
window.togglePanditActiveStatus = togglePanditActiveStatus;
window.suspendPanditAccount = suspendPanditAccount;

window.handleChatSearch = handleChatSearch;
window.loadChatConversations = loadChatConversations;
window.openChatTranscript = openChatTranscript;
window.closeChatTranscriptModal = closeChatTranscriptModal;
window.toggleBlockChatUser = toggleBlockChatUser;

window.loadBookMyPanditRequests = loadBookMyPanditRequests;
window.filterPanditRequests = filterPanditRequests;
window.openAssignPanditModal = openAssignPanditModal;
window.closeAssignPanditModal = closeAssignPanditModal;
window.submitPanditAssignment = submitPanditAssignment;
window.viewBookingDetails = viewBookingDetails;
window.closeBookingDetailsModal = closeBookingDetailsModal;
window.loadPayments = loadPayments;
window.loadServices = loadServices;
window.openCreateServiceModal = openCreateServiceModal;
window.closeServiceFormModal = closeServiceFormModal;
window.saveServiceForm = saveServiceForm;
window.deleteService = deleteService;
window.editService = editService;
window.loadCategories = loadCategories;
window.loadNotifications = loadNotifications;
window.openSendNotificationModal = openSendNotificationModal;
window.closeSendNotificationModal = closeSendNotificationModal;
window.submitBroadcastNotification = submitBroadcastNotification;
window.loadHelpSupport = loadHelpSupport;
window.updateInquiryStatus = updateInquiryStatus;
window.loadSettings = loadSettings;
window.saveSystemSettings = saveSystemSettings;
window.saveSettings = saveSystemSettings;
window.loadCallsList = loadCallsList;
window.toggleAdminLanguage = toggleAdminLanguage;

function loadMemberships() {
  // Static tier display in tab-memberships
}
window.loadMemberships = loadMemberships;

// ==========================================================================
// 21. PANDIT WITHDRAWALS & PAYOUTS
// ==========================================================================
let currentWithdrawalFilter = 'all';

async function loadWithdrawals(status = currentWithdrawalFilter) {
  currentWithdrawalFilter = status;
  const tbody = document.getElementById('withdrawals-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">Fetching withdrawals...</td></tr>';

  try {
    const res = await apiRequest(`/admin/withdrawals?status=${status}&limit=50`);
    const items = res?.data?.items || [];
    
    // Update badge count
    const pendingCount = items.filter(w => w.status === 'pending').length;
    const badge = document.getElementById('badge-withdrawals-count');
    if (badge) {
      badge.innerText = pendingCount;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No withdrawal requests found.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(w => {
      const bankInfo = w.bankDetails?.upiId 
        ? `UPI: <strong>${escapeHtml(w.bankDetails.upiId)}</strong>` 
        : `A/C: ${escapeHtml(w.bankDetails?.accountNumber || 'N/A')} (${escapeHtml(w.bankDetails?.ifscCode || '')})<br><small>${escapeHtml(w.bankDetails?.bankName || '')}</small>`;

      const statusBadge = w.status === 'paid' 
        ? '<span class="badge badge-success">PAID</span>'
        : w.status === 'rejected'
        ? '<span class="badge badge-danger">REJECTED</span>'
        : '<span class="badge badge-warning">PENDING</span>';

      const actions = w.status === 'pending'
        ? `<div style="display:flex; gap:6px;">
             <button class="btn-sm btn-success" onclick="approveWithdrawal('${w.id}')">✓ Pay</button>
             <button class="btn-sm btn-danger" onclick="rejectWithdrawal('${w.id}')">✕ Reject</button>
           </div>`
        : `<small class="text-muted">${w.referenceNumber || w.rejectionReason || 'Processed'}</small>`;

      return `
        <tr>
          <td><strong style="color:var(--gold-accent-light);">${w.withdrawalId}</strong></td>
          <td><strong>${escapeHtml(w.panditName)}</strong><br><small class="text-muted">${escapeHtml(w.panditCode)}</small></td>
          <td>${escapeHtml(w.panditPhone || 'N/A')}</td>
          <td><strong style="color:#10b981; font-size:15px;">₹${(w.amount || 0).toLocaleString('en-IN')}</strong></td>
          <td>${bankInfo}</td>
          <td>${w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'N/A'}</td>
          <td>${statusBadge}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:30px;">Failed to load withdrawals: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function filterWithdrawals(status, btn) {
  if (btn) {
    btn.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
  loadWithdrawals(status);
}

async function approveWithdrawal(id) {
  const ref = prompt('Enter Bank UTR / IMPS Reference Number for this payout:');
  if (ref === null) return;
  try {
    const res = await apiRequest(`/admin/withdrawals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ referenceNumber: ref || undefined }),
    });
    showToast('Withdrawal marked as PAID successfully.');
    loadWithdrawals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rejectWithdrawal(id) {
  const reason = prompt('Enter reason for rejecting this payout request:');
  if (reason === null) return;
  try {
    const res = await apiRequest(`/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Bank details could not be verified' }),
    });
    showToast('Withdrawal rejected.');
    loadWithdrawals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 22. ERROR MONITORING
// ==========================================================================
async function loadErrorMonitoring() {
  const tbody = document.getElementById('errors-tbody');
  if (!tbody) return;
  const modFilter = document.getElementById('error-module-filter')?.value || 'all';
  const sevFilter = document.getElementById('error-severity-filter')?.value || 'all';

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">Fetching error logs...</td></tr>';

  try {
    const res = await apiRequest(`/admin/errors?module=${modFilter}&severity=${sevFilter}&limit=50`);
    const items = res?.data?.items || [];

    const openCount = items.filter(e => !e.resolved).length;
    const badge = document.getElementById('badge-errors-count');
    if (badge) {
      badge.innerText = openCount;
      badge.style.display = openCount > 0 ? 'inline-block' : 'none';
    }

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#10b981;">✓ No error incidents recorded. System running smoothly!</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(e => {
      const sevBadge = e.severity === 'critical'
        ? '<span class="badge badge-danger">CRITICAL</span>'
        : e.severity === 'high'
        ? '<span class="badge badge-danger" style="background:#ea580c;">HIGH</span>'
        : '<span class="badge badge-warning">MEDIUM</span>';

      const statusBadge = e.resolved
        ? '<span class="badge badge-success">RESOLVED</span>'
        : '<span class="badge badge-danger">OPEN</span>';

      const actionBtn = !e.resolved
        ? `<button class="btn-sm btn-primary" onclick="resolveErrorLog('${e.id}')">✓ Resolve</button>`
        : `<small class="text-muted">Resolved by ${escapeHtml(e.resolvedBy || 'Admin')}</small>`;

      return `
        <tr>
          <td><strong style="color:#ef4444;">${e.errorId}</strong></td>
          <td><span class="badge" style="background:#334155; color:#cbd5e1;">${(e.module || 'SYSTEM').toUpperCase()}</span></td>
          <td><span style="font-size:13px; font-weight:600;">${escapeHtml(e.errorMessage)}</span></td>
          <td><code>${escapeHtml(e.httpMethod || 'API')} ${escapeHtml(e.apiEndpoint || '/')}</code></td>
          <td>${sevBadge}</td>
          <td><small>${e.createdAt ? new Date(e.createdAt).toLocaleString() : 'Recent'}</small></td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:30px;">Failed to load errors: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function resolveErrorLog(id) {
  const notes = prompt('Enter resolution notes (optional):');
  if (notes === null) return;
  try {
    await apiRequest(`/admin/errors/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolutionNotes: notes || 'Verified and resolved by administrator' }),
    });
    showToast('Error incident marked as resolved.');
    loadErrorMonitoring();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// 23. DATABASE LIVE MONITORING
// ==========================================================================
async function loadDatabaseMonitoring() {
  const grid = document.getElementById('db-collections-grid');
  if (grid) grid.innerHTML = '<div style="color:var(--text-muted); padding:20px;">Pinging database cluster...</div>';

  try {
    const res = await apiRequest('/admin/database/monitoring');
    const data = res?.data || {};

    const hostEl = document.getElementById('db-mon-host');
    const nameEl = document.getElementById('db-mon-name');
    const latencyEl = document.getElementById('db-mon-latency');
    const colCountEl = document.getElementById('db-mon-col-count');
    const badgeEl = document.getElementById('db-mon-badge');

    if (hostEl) hostEl.innerText = data.host || 'cluster0.kx9qipw.mongodb.net';
    if (nameEl) nameEl.innerText = data.databaseName || 'bandhansetu';
    if (latencyEl) latencyEl.innerText = `${data.pingLatencyMs || 0} ms (Excellent)`;
    if (colCountEl) colCountEl.innerText = `${data.collectionsCount || 0} collections`;
    if (badgeEl) {
      badgeEl.innerText = data.status === 'connected' ? 'CONNECTED (ONLINE)' : data.status.toUpperCase();
      badgeEl.className = data.status === 'connected' ? 'badge badge-success' : 'badge badge-danger';
    }

    if (grid) {
      const cols = data.collections || [];
      if (cols.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted);">No collections found.</div>';
        return;
      }
      grid.innerHTML = cols.map(c => `
        <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600; color:#cbd5e1; font-size:13px;">${escapeHtml(c.name)}</span>
          <span class="badge" style="background:#1e293b; color:var(--gold-accent-light); font-weight:bold; font-size:12px;">${c.count} docs</span>
        </div>
      `).join('');
    }
  } catch (err) {
    if (grid) grid.innerHTML = `<div style="color:#ef4444; padding:20px;">Failed to ping database: ${escapeHtml(err.message)}</div>`;
  }
}

window.loadWithdrawals = loadWithdrawals;
window.filterWithdrawals = filterWithdrawals;
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.loadErrorMonitoring = loadErrorMonitoring;
window.resolveErrorLog = resolveErrorLog;
window.loadDatabaseMonitoring = loadDatabaseMonitoring;

// ==========================================================================
// 20. ACCESSIBLE ANIMATIONS, STAGGER OBSERVER & KEYBOARD ESCAPE HANDLING
// ==========================================================================
(function initAdminAnimationsAndA11y() {
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Escape key & backdrop-click closes any open modal and restores previous focus cleanly
  let lastFocusedEl = null;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openModals = Array.from(document.querySelectorAll('.modal-backdrop')).filter(
      (el) => el.style.display && el.style.display !== 'none'
    );
    if (openModals.length > 0) {
      const topModal = openModals[openModals.length - 1];
      topModal.style.display = 'none';
      if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
      }
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('modal-backdrop')) {
      target.style.display = 'none';
      if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
      }
    } else if (target && target.closest && target.closest('button, .menu-link')) {
      lastFocusedEl = target.closest('button, .menu-link');
    }
  });

  if (prefersReducedMotion) return;

  // Trigger clean 300ms ease-out entrance when switching Admin tabs
  if (typeof window.navigateToTab === 'function') {
    const origNav = window.navigateToTab;
    window.navigateToTab = function wrappedNavigateToTab(tab, pushHash) {
      origNav.call(this, tab, pushHash);
      const sec = document.getElementById(`tab-${tab}`);
      if (sec) {
        sec.classList.remove('sb-tab-enter');
        void sec.offsetWidth;
        sec.classList.add('sb-tab-enter');
      }
    };
  }

  // Cap staggered table row animations at 9 rows (~50ms each) to prevent heavy DOM reflows
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target && m.target.tagName === 'TBODY') {
        const rows = Array.from(m.target.children);
        rows.forEach((row, idx) => {
          if (idx < 10 && !row.classList.contains('sb-stagger-row')) {
            row.style.setProperty('--sb-idx', String(idx));
            row.classList.add('sb-stagger-row');
          }
        });
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.data-table tbody').forEach((tbody) => {
      observer.observe(tbody, { childList: true });
    });

    // Scroll-into-view animation via IntersectionObserver (animates each card once, zero scroll jank)
    if (typeof IntersectionObserver === 'function') {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('sb-tab-enter');
              revealObserver.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.08 }
      );
      document.querySelectorAll('.kpi-card, .card').forEach((el) => {
        revealObserver.observe(el);
      });
    }
  });
})();

