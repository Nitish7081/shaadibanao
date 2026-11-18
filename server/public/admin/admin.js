/**
 * ShaadiBanao Admin Portal Client-side Application
 * Complete Administration, Moderation, Approvals & Trust & Safety Suite
 */

const API_BASE = '/api/v1';

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
  startLiveClock();

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
        navigateToTab('dashboard');
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
    await loadDashboardStats();
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

const tabTitles = {
  dashboard: { title: 'Dashboard Overview', desc: 'Real-time metrics, platform status, and active operations' },
  approvals: { title: 'Pending Registration Approvals', desc: 'Review, approve, or reject new user registrations' },
  pandits: { title: 'Pandit Service Providers', desc: 'Review pandit applications, traditional specializations, and service catalog' },
  verifications: { title: 'Identity & Aadhaar Verifications', desc: 'Inspect masked identity proofs and issue verified badges' },
  bookings: { title: 'Ceremony Bookings Management', desc: 'Monitor weddings, pujas, and online video consultations' },
  community: { title: 'Community Posts Moderation', desc: 'Review, approve, or reject user wedding stories and photo memories' },
  users: { title: 'User Accounts Management', desc: 'Manage member privileges, suspensions, and account states' },
  profiles: { title: 'Profile Moderation', desc: 'Verify identity documents, bios, and approve member photos' },
  memberships: { title: 'Memberships & Subscription Plans', desc: 'Inspect plan distributions and manually upgrade users' },
  reports: { title: 'Trust & Safety Operations', desc: 'Review user-reported accounts and enforce community safety' },
  audit: { title: 'Administrative Audit Trail', desc: 'Complete verifiable logs of all staff operations and approvals' },
  banners: { title: 'Public Banners & Promotions', desc: 'Upload public promotional banners to Cloudinary and inspect active display' },
  system: { title: 'System Health & Configuration', desc: 'Server, database, and authentication engine diagnostics' },
};

function navigateToTab(tabName) {
  activeTab = tabName;

  // Update active links
  document.querySelectorAll('.menu-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('data-tab') === tabName);
  });

  // Update sections
  document.querySelectorAll('.dashboard-section').forEach((sec) => {
    sec.style.display = sec.id === `tab-${tabName}` ? 'block' : 'none';
  });

  // Update topbar headers
  const meta = tabTitles[tabName] || { title: 'Admin Portal', desc: 'Operations' };
  const titleEl = document.getElementById('current-page-title');
  const descEl = document.getElementById('current-page-desc');
  if (titleEl) titleEl.innerText = meta.title;
  if (descEl) descEl.innerText = meta.desc;

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
// 9. PANDIT SERVICES & VERIFICATION
// ==========================================================================
async function loadPandits() {
  const tbody = document.getElementById('tbody-pandits');
  const statusFilter = document.getElementById('filter-pandits-status')?.value || 'all';
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6">Loading pandit catalog...</td></tr>';

  try {
    const res = await adminFetch(`/admin/pandits?status=${statusFilter}`);
    const items = res.data?.items || [];

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No Pandit records found matching selected filter</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map((p) => {
        const statusBadge =
          p.verificationStatus === 'verified'
            ? '<span class="badge badge-success">✓ Verified</span>'
            : p.verificationStatus === 'rejected'
            ? '<span class="badge badge-danger">✕ Rejected</span>'
            : '<span class="badge badge-warning pulse">⏳ Pending</span>';

        const actions = `
          <div class="action-buttons">
            ${p.userId ? `<button class="btn-act btn-act-view btn-xs" onclick="openApplicantModal('${p.userId}')">👁️ Profile</button>` : ''}
            ${p.verificationStatus !== 'verified' ? `<button class="btn-primary btn-xs" onclick="verifyPandit('${p.id}')">✓ Verify</button>` : ''}
            ${p.verificationStatus !== 'rejected' ? `<button class="btn-danger btn-xs" onclick="rejectPandit('${p.id}')">✕ Reject</button>` : ''}
          </div>
        `;

        return `
          <tr>
            <td>
              <div class="user-cell">
                <div class="avatar-ph">${(p.name || 'P')[0]}</div>
                <div>
                  <strong>${escapeHtml(p.name)}</strong>
                  <div class="text-muted text-xs">${escapeHtml(p.religiousTradition || 'Sanatan')}</div>
                </div>
              </div>
            </td>
            <td>
              <div>${escapeHtml(p.phone || 'N/A')}</div>
              <div class="text-muted text-xs">${escapeHtml(p.email || '')}</div>
            </td>
            <td>
              <div>${escapeHtml(p.religiousTradition || 'Vedic')}</div>
              <div class="text-muted text-xs">${p.experienceYears} Years Exp</div>
            </td>
            <td>${(p.serviceLocations || ['Delhi NCR']).slice(0, 2).join(', ')}</td>
            <td><span class="badge badge-info">${p.servicesCount || 0} Listed</span></td>
            <td>⭐ ${p.rating ? p.rating.toFixed(1) : '5.0'}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    renderTableError(tbody, 8, err.message, 'loadPandits', err.requestId);
  }
}

async function verifyPandit(id) {
  if (!confirm('Are you sure you want to verify this Pandit? They will immediately appear in public search and accept ceremony bookings.')) return;
  try {
    await adminFetch(`/admin/pandits/${id}/verify`, { method: 'POST' });
    showToast('Pandit verified successfully!');
    loadPandits();
    loadDashboardStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rejectPandit(id) {
  const reason = prompt('Please enter the reason for rejecting this Pandit application:');
  if (!reason || !reason.trim()) return;
  try {
    await adminFetch(`/admin/pandits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    showToast('Pandit application rejected.');
    loadPandits();
    loadDashboardStats();
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
        if (b.status === 'accepted') statusBadge = '<span class="badge badge-success">✓ Confirmed</span>';
        else if (b.status === 'completed') statusBadge = '<span class="badge badge-success">Completed</span>';
        else if (b.status === 'cancelled' || b.status === 'declined') statusBadge = '<span class="badge badge-danger">Cancelled</span>';

        const modeBadge = b.mode === 'online'
          ? '<span class="badge badge-info">📹 Online Video</span>'
          : '<span class="badge badge-warning">🏛️ In-Person</span>';

        return `
          <tr>
            <td><strong>${escapeHtml(b.bookingReference || 'N/A')}</strong></td>
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
            <td><strong>₹${(b.priceInr || 0).toLocaleString('en-IN')}</strong></td>
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
window.verifyPandit = verifyPandit;
window.rejectPandit = rejectPandit;
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
    loadDashboardStats();
  } catch (err) {
    showToast(err.message || 'Failed to cancel booking', 'error');
  }
}

window.updateBookingStatus = updateBookingStatus;
window.promptCancelBooking = promptCancelBooking;
