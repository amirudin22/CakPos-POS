import React from 'react';
import { ShoppingCart, Package, BookOpen, BarChart3, Settings, LogOut, Store, Users, ClipboardList } from 'lucide-react';

export default function Navigation({ currentTab, setCurrentTab, user, onLogout, storeProfile }) {
  const menuItems = [
    { id: 'kasir', label: 'Kasir', icon: ShoppingCart },
    { id: 'produk', label: 'Produk', icon: Package, adminOnly: true },
    { id: 'pelanggan', label: 'Pelanggan', icon: Users },
    { id: 'kasbon', label: 'Kasbon', icon: BookOpen },
    { id: 'riwayat', label: 'Riwayat', icon: ClipboardList },
    { id: 'laporan', label: 'Laporan', icon: BarChart3, adminOnly: true },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings }
  ];

  const visibleMenuItems = menuItems.filter(item => {
    if (item.adminOnly && user?.role !== 'Owner') {
      return false;
    }
    return true;
  });

  return (
    <>
      <nav className="bottom-nav glass-panel">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setCurrentTab(item.id)}
              aria-label={item.label}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <aside className="sidebar glass-panel">
        <div className="sidebar-logo">
          <Store size={22} />
          <span>{storeProfile?.name || 'Kasir Kita'}</span>
        </div>

        <ul className="sidebar-menu">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <li key={item.id}>
                <button
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setCurrentTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Akses: {user?.role === 'Owner' ? 'Pemilik Toko' : 'Staf Kasir'}
            </span>
          </div>
          <button
            className="sidebar-link btn-danger"
            onClick={onLogout}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--danger)',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
            <span>Keluar Aplikasi</span>
          </button>
        </div>
      </aside>
    </>
  );
}
