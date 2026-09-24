import {
  useEffect,
  useState,
} from 'react';

import {
  Menu,
} from 'lucide-react';

import {
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';

import {
  colors,
  font,
} from '../styles/tokens';

const roleLabels = {
  head: 'Head',
  specialist: 'Specialist',
  system_configuration:
    'System Configuration',
};

const pageTitles = [
  {
    path: '/dashboard',
    title: 'Dashboard',
  },
  {
    path: '/marketing',
    title: 'Marketing',
  },
  {
    path: '/sales',
    title: 'Sales',
  },
  {
    path: '/cdm',
    title:
      'Customer Data Management',
  },
  {
    path: '/supply-chain',
    title: 'Supply Chain',
  },
  {
    path: '/fulfillment',
    title: 'Fulfillment',
  },
  {
    path: '/crm',
    title:
      'Customer Relationship Management',
  },
  {
    path: '/reports',
    title:
      'Reports and Analytics',
  },
  {
    path: '/users',
    title: 'User Management',
  },
  {
    path: '/settings',
    title: 'Account Settings',
  },
];

function getStoredUser() {
  try {
    return (
      JSON.parse(
        localStorage.getItem('user')
      ) || {}
    );
  } catch {
    return {};
  }
}

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getPageTitle(pathname) {
  const matchedPage =
    pageTitles.find(
      (page) =>
        pathname === page.path ||
        pathname.startsWith(
          `${page.path}/`
        )
    );

  return (
    matchedPage?.title ||
    'Spartan BTY MIS'
  );
}

function getDepartmentName(user) {
  return (
    user?.departmentName ||
    user?.department?.name ||
    ''
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user] =
    useState(getStoredUser);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    logoutModalOpen,
    setLogoutModalOpen,
  ] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false);
  }, [location.pathname]);

  const role = normalizeValue(
    user?.role
  );

  const displayName =
    user?.fullName ||
    user?.name ||
    user?.username ||
    'System User';

  const departmentName =
    getDepartmentName(user);

  const currentTitle =
    getPageTitle(
      location.pathname
    );

  const confirmLogout = () => {
    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'refreshToken'
    );

    localStorage.removeItem(
      'user'
    );

    setLogoutModalOpen(false);

    navigate('/login', {
      replace: true,
    });
  };

  return (
    <div className="layout-app">
      <style>{layoutStyles}</style>

      <Sidebar
        user={user}
        open={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        onRequestLogout={() =>
          setLogoutModalOpen(true)
        }
      />

      <div className="layout-main-area">
        <header className="layout-header">
          <div className="layout-header-left">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="mobile-menu-button"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div>
              <p className="layout-header-eyebrow">
                SPARTAN BTY INC.
              </p>

              <h2 className="layout-page-title">
                {currentTitle}
              </h2>
            </div>
          </div>

          <GlobalSearch />

          <div className="layout-header-user">
            <span className="layout-status-dot" />

            <div>
              <p className="layout-header-user-name">
                {displayName}
              </p>

              <p className="layout-header-user-role">
                {roleLabels[role] ||
                  user?.role ||
                  'System User'}

                {role ===
                  'specialist' &&
                departmentName
                  ? ` • ${departmentName}`
                  : ''}
              </p>
            </div>
          </div>
        </header>

        <main className="layout-content">
          <Outlet />
        </main>
      </div>

      {logoutModalOpen && (
        <div className="logout-modal-overlay">
          <section
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <h2 id="logout-title">
              Log out?
            </h2>

            <p>
              You will need to sign in
              again to access the Spartan
              BTY.
            </p>

            <div className="logout-modal-actions">
              <button
                type="button"
                onClick={() =>
                  setLogoutModalOpen(
                    false
                  )
                }
                className="logout-cancel-button"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmLogout
                }
                className="logout-confirm-button"
              >
                Log out
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const layoutStyles = `
  * {
    box-sizing: border-box;
  }

  a:focus-visible,
  button:focus-visible,
  input:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid ${colors.rose};
    outline-offset: 2px;
    border-radius: 6px;
  }

  .layout-app {
    display: flex;
    min-height: 100vh;
    background: ${colors.cream};
    font-family: ${font.body};
  }

  /* ================= SIDEBAR ================= */

  .app-sidebar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    width: 272px;
    min-width: 272px;
    height: 100vh;
    padding: 20px 16px;
    background: ${colors.blush};
    color: ${colors.mutedInk};
    border-right: 1px solid ${colors.border};
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 58px;
    padding: 0 6px 18px;
    border-bottom: 1px solid ${colors.border};
  }

  .sidebar-logo {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    min-width: 40px;
    border-radius: 10px;
    background: ${colors.rose};
    color: #ffffff;
    font-family: ${font.display};
    font-size: 20px;
    font-weight: 600;
  }

  .sidebar-brand-text {
    flex: 1;
    min-width: 0;
  }

  .sidebar-brand-text h1 {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 1.1px;
  }

  .sidebar-brand-text p {
    margin: 3px 0 0;
    color: ${colors.roseDeep};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.4px;
    line-height: 1.35;
  }

  .sidebar-close-button {
    display: none;
    place-items: center;
    padding: 5px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: ${colors.ink};
    cursor: pointer;
  }

  .sidebar-close-button:hover {
    background: ${colors.roseTint};
  }

  .sidebar-navigation {
    flex: 1;
    overflow-y: auto;
    padding: 8px 2px 16px;
    scrollbar-width: thin;
  }

  .sidebar-section-label {
    margin: 18px 11px 8px;
    color: ${colors.mutedInk};
    opacity: 0.72;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 1.35px;
  }

  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 42px;
    margin-bottom: 4px;
    padding: 9px 11px;
    border-radius: 9px;
    color: ${colors.mutedInk};
    font-size: 12.5px;
    line-height: 1.35;
    text-decoration: none;
    transition:
      background 150ms ease,
      color 150ms ease;
  }

  .sidebar-link:hover {
    background: ${colors.roseTint};
    color: ${colors.roseDeep};
  }

  .sidebar-link-active {
    background: ${colors.rose};
    color: #ffffff;
    font-weight: 600;
  }

  .sidebar-link-active:hover {
    background: ${colors.rose};
    color: #ffffff;
  }

  .sidebar-account {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 17px 4px 0;
    border-top: 1px solid ${colors.border};
  }

  .sidebar-avatar {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    min-width: 38px;
    border-radius: 50%;
    background: ${colors.roseDeep};
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
  }

  .sidebar-account-details {
    flex: 1;
    min-width: 0;
  }

  .sidebar-account-name {
    overflow: hidden;
    margin: 0;
    color: ${colors.ink};
    font-size: 11px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-account-role,
  .sidebar-account-department {
    overflow: hidden;
    margin: 3px 0 0;
    color: ${colors.mutedInk};
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-account-department {
    color: ${colors.roseDeep};
  }

  .sidebar-logout-button {
    display: grid;
    place-items: center;
    padding: 8px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: ${colors.mutedInk};
    cursor: pointer;
  }

  .sidebar-logout-button:hover {
    background: ${colors.roseTint};
    color: ${colors.roseDeep};
  }

  .sidebar-overlay {
    display: none;
  }

  /* ================= HEADER ================= */

  .layout-main-area {
    flex: 1;
    min-width: 0;
  }

  .layout-header {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 78px;
    gap: 20px;
    padding: 15px 30px;
    border-bottom: 1px solid ${colors.border};
    background: rgba(255, 250, 247, 0.96);
    backdrop-filter: blur(10px);
  }

  .layout-header-left {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
  }

  .mobile-menu-button {
    display: none;
    place-items: center;
    padding: 9px;
    border: 1px solid ${colors.border};
    border-radius: 9px;
    background: #ffffff;
    color: ${colors.ink};
    cursor: pointer;
    transition: background 150ms ease;
  }

  .mobile-menu-button:hover {
    background: ${colors.roseTint};
  }

  .layout-header-eyebrow {
    margin: 0;
    color: ${colors.roseDeep};
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.3px;
  }

  .layout-page-title {
    overflow: hidden;
    margin: 4px 0 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 22px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layout-header-user {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .layout-status-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    background: ${colors.success};
  }

  .layout-header-user-name {
    overflow: hidden;
    max-width: 200px;
    margin: 0;
    color: ${colors.ink};
    font-size: 11px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layout-header-user-role {
    overflow: hidden;
    max-width: 240px;
    margin: 3px 0 0;
    color: ${colors.mutedInk};
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layout-content {
    padding: 28px 30px;
  }

  /* ================= LOGOUT MODAL ================= */

  .logout-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(43, 36, 32, 0.5);
  }

  .logout-modal {
    width: 100%;
    max-width: 390px;
    padding: 25px;
    border: 1px solid ${colors.border};
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 24px 60px rgba(43, 36, 32, 0.16);
  }

  .logout-modal h2 {
    margin: 0;
    color: ${colors.ink};
    font-family: ${font.display};
    font-size: 22px;
    font-weight: 500;
  }

  .logout-modal p {
    margin: 10px 0 0;
    color: ${colors.mutedInk};
    font-size: 11px;
    line-height: 1.65;
  }

  .logout-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 22px;
  }

  .logout-cancel-button,
  .logout-confirm-button {
    padding: 10px 15px;
    border-radius: 8px;
    font-family: ${font.body};
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .logout-cancel-button {
    border: 1px solid ${colors.border};
    background: #ffffff;
    color: ${colors.ink};
  }

  .logout-cancel-button:hover {
    background: ${colors.blush};
  }

  .logout-confirm-button {
    border: none;
    background: ${colors.rose};
    color: #ffffff;
  }

  .logout-confirm-button:hover {
    opacity: 0.92;
  }

  /* ================= RESPONSIVE ================= */

  @media (max-width: 950px) {
    .app-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      transform: translateX(-105%);
      transition: transform 220ms ease;
      box-shadow: 15px 0 45px rgba(156, 69, 96, 0.18);
    }

    .app-sidebar-open {
      transform: translateX(0);
    }

    .sidebar-close-button {
      display: grid;
    }

    .sidebar-overlay {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: block;
      visibility: hidden;
      border: none;
      background: rgba(43, 36, 32, 0.42);
      opacity: 0;
      transition:
        opacity 200ms ease,
        visibility 200ms ease;
    }

    .sidebar-overlay-open {
      visibility: visible;
      opacity: 1;
    }

    .mobile-menu-button {
      display: grid;
    }

    .layout-header {
      padding: 14px 20px;
    }

    .layout-content {
      padding: 22px;
    }
  }

  @media (max-width: 640px) {
    .layout-header {
      min-height: 70px;
      padding: 12px 14px;
    }

    .layout-header-user {
      display: none;
    }

    .layout-page-title {
      max-width: calc(100vw - 100px);
      font-size: 19px;
    }

    .layout-content {
      padding: 15px;
    }

    .app-sidebar {
      width: min(280px, 88vw);
      min-width: min(280px, 88vw);
    }
  }
`;