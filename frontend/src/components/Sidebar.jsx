import {
  BarChart3,
  Boxes,
  Database,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PackageCheck,
  Settings,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';

import {
  NavLink,
} from 'react-router-dom';

const operationalModules = [
  {
    label: 'Marketing',
    path: '/marketing',
    departmentCode:
      'marketing',
    icon: Megaphone,
  },
  {
    label: 'Sales',
    path: '/sales',
    departmentCode: 'sales',
    icon: ShoppingBag,
  },
  {
    label:
      'Customer Data Management',
    path: '/cdm',
    departmentCode: 'cdm',
    icon: Database,
  },
  {
    label: 'Supply Chain',
    path: '/supply-chain',
    departmentCode:
      'supply_chain',
    icon: Boxes,
  },
  {
    label: 'Fulfillment',
    path: '/fulfillment',
    departmentCode:
      'fulfillment',
    icon: PackageCheck,
  },
  {
    label:
      'Customer Relationship Management',
    path: '/crm',
    departmentCode: 'crm',
    icon: HeartHandshake,
  },
];

const roleLabels = {
  head: 'Head',
  specialist: 'Specialist',
  system_configuration:
    'System Configuration',
};

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getDepartmentCode(user) {
  return normalizeValue(
    user?.departmentCode ||
      user?.department?.code
  );
}

function getDepartmentName(user) {
  return (
    user?.departmentName ||
    user?.department?.name ||
    ''
  );
}

function getMenuItems(user) {
  const role = normalizeValue(
    user?.role
  );

  const departmentCode =
    getDepartmentCode(user);

  const dashboardItem = {
    label: 'Dashboard',
    path: '/dashboard',
    section: 'MAIN',
    icon: LayoutDashboard,
  };

  const reportsItem = {
    label: 'Reports and Analytics',
    path: '/reports',
    section: 'REPORTS',
    icon: BarChart3,
  };

  const settingsItem = {
    label: 'Account Settings',
    path: '/settings',
    section: 'ACCOUNT',
    icon: Settings,
  };

  if (role === 'head') {
    return [
      dashboardItem,

      ...operationalModules.map(
        (module) => ({
          ...module,
          section: 'MODULES',
        })
      ),

      reportsItem,
      settingsItem,
    ];
  }

  if (role === 'specialist') {
    const assignedModule =
      operationalModules.find(
        (module) =>
          module.departmentCode ===
          departmentCode
      );

    return [
      dashboardItem,

      ...(assignedModule
        ? [
            {
              ...assignedModule,
              section:
                'ASSIGNED MODULE',
            },
          ]
        : []),

      {
        ...reportsItem,
        section:
          'ASSIGNED MODULE',
      },

      settingsItem,
    ];
  }

  if (
    role ===
    'system_configuration'
  ) {
    return [
      dashboardItem,

      {
        label: 'User Management',
        path: '/users',
        section:
          'SYSTEM CONFIGURATION',
        icon: Users,
      },

      settingsItem,
    ];
  }

  return [
    dashboardItem,
    settingsItem,
  ];
}

export default function Sidebar({
  user,
  open,
  onClose,
  onRequestLogout,
}) {
  const role = normalizeValue(
    user?.role
  );

  const menuItems =
    getMenuItems(user);

  const displayName =
    user?.fullName ||
    user?.name ||
    user?.username ||
    'System User';

  const departmentName =
    getDepartmentName(user);

  let previousSection = '';

  return (
    <>
      <button
        type="button"
        className={
          open
            ? 'sidebar-overlay sidebar-overlay-open'
            : 'sidebar-overlay'
        }
        onClick={onClose}
        aria-label="Close navigation"
      />

      <aside
        className={
          open
            ? 'app-sidebar app-sidebar-open'
            : 'app-sidebar'
        }
      >
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            S
          </div>

          <div className="sidebar-brand-text">
            <h1>
              SPARTAN BTY
            </h1>

            <p>
              MIS
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="sidebar-close-button"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar-navigation">
          {menuItems.map((item) => {
            const showSection =
              item.section !==
              previousSection;

            previousSection =
              item.section;

            const Icon = item.icon;

            return (
              <div key={item.path}>
                {showSection && (
                  <p className="sidebar-section-label">
                    {item.section}
                  </p>
                )}

                <NavLink
                  to={item.path}
                  end={
                    item.path ===
                    '/dashboard'
                  }
                  onClick={onClose}
                  className={({
                    isActive,
                  }) =>
                    isActive
                      ? 'sidebar-link sidebar-link-active'
                      : 'sidebar-link'
                  }
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                  />

                  <span>
                    {item.label}
                  </span>
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-avatar">
            {displayName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="sidebar-account-details">
            <p className="sidebar-account-name">
              {displayName}
            </p>

            <p className="sidebar-account-role">
              {roleLabels[role] ||
                user?.role ||
                'System User'}
            </p>

            {role ===
              'specialist' &&
              departmentName && (
                <p className="sidebar-account-department">
                  {departmentName}
                </p>
              )}
          </div>

          <button
            type="button"
            onClick={onRequestLogout}
            className="sidebar-logout-button"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}