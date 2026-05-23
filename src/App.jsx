import React, { useState, useEffect } from 'react';
import { db } from './db/db';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import Login from './views/Login';
import Kasir from './views/Kasir';
import Produk from './views/Produk';
import Pelanggan from './views/Pelanggan';
import Kasbon from './views/Kasbon';
import Laporan from './views/Laporan';
import Riwayat from './views/Riwayat';
import Pengaturan from './views/Pengaturan';

export default function App() {
  const [user, setUser] = useState(null);
  const [storeProfile, setStoreProfile] = useState({ name: 'Warung UMKM', address: 'Alamat Toko', phone: '-' });
  const [currentTab, setCurrentTab] = useState('kasir');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedUser = localStorage.getItem('pos_active_session');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        const profileSetting = await db.settings.get('store_profile');
        if (profileSetting?.value) {
          setStoreProfile(profileSetting.value);
        }
      } catch (err) {
        console.error("Gagal memuat sesi awal:", err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleLoginSuccess = (loggedInUser, storeInfo) => {
    const sessionData = { ...loggedInUser };
    delete sessionData.password;
    setUser(loggedInUser);
    localStorage.setItem('pos_active_session', JSON.stringify(sessionData));
    if (storeInfo) {
      setStoreProfile(storeInfo);
    }
    setCurrentTab('kasir');
  };

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar dari aplikasi kasir?')) {
      localStorage.removeItem('pos_active_session');
      setUser(null);
    }
  };

  const renderActiveView = () => {
    switch (currentTab) {
      case 'kasir':
        return <Kasir user={user} />;
      case 'produk':
        return user?.role === 'Owner' ? <Produk /> : <Kasir user={user} />;
      case 'pelanggan':
        return <Pelanggan />;
      case 'kasbon':
        return <Kasbon />;
      case 'riwayat':
        return <Riwayat user={user} />;
      case 'laporan':
        return user?.role === 'Owner' ? <Laporan /> : <Kasir user={user} />;
      case 'pengaturan':
        return <Pengaturan user={user} onStoreProfileUpdate={setStoreProfile} onLogout={handleLogout} />;
      default:
        return <Kasir user={user} />;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'monospace'
      }}>
        <span>Menginisialisasi Database POS...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Login onLoginSuccess={handleLoginSuccess} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="app-container">
          <Navigation
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            user={user}
            onLogout={handleLogout}
            storeProfile={storeProfile}
          />
          {renderActiveView()}
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
