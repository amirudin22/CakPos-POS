import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { hashPassword } from '../utils/crypto';
import { Store, User, Lock, ArrowRight, ShieldCheck, Upload } from 'lucide-react';

/**
 * Tampilan Login & Registrasi Offline (Fase 2)
 * Bekerja 100% offline dengan validasi SHA-256 lokal
 * Mendukung migrasi instan dengan tombol pulihkan data sebelum masuk
 */
export default function Login({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Periksa apakah ini penggunaan pertama kali (tabel user kosong)
    const checkFirstRun = async () => {
      try {
        const userCount = await db.users.count();
        if (userCount === 0) {
          setIsRegisterMode(true);
        } else {
          setIsRegisterMode(false);
        }
      } catch (err) {
        console.error("Gagal membaca database user:", err);
      }
    };
    checkFirstRun();
  }, []);

  // Handler Masuk Aplikasi
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username dan password wajib diisi!');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const hashedPassword = await hashPassword(password);
      const user = await db.users.where('username').equals(username).first();

      if (user && user.password === hashedPassword) {
        // Ambil profil toko
        const storeProfileSetting = await db.settings.get('store_profile');
        onLoginSuccess(user, storeProfileSetting?.value);
      } else {
        setError('Username atau Password Anda salah!');
      }
    } catch (err) {
      console.error(err);
      setError('Gagal masuk. Database lokal bermasalah.');
    } finally {
      setLoading(false);
    }
  };

  // Handler Registrasi Akun Pemilik (Pertama Kali)
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username || !password || !confirmPassword || !storeName) {
      setError('Semua kolom registrasi wajib diisi!');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sesuai!');
      return;
    }

    if (password.length < 4) {
      setError('Password minimal terdiri dari 4 karakter!');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const hashedPassword = await hashPassword(password);
      
      // Simpan User Pemilik (Owner) pertama
      await db.users.add({
        username,
        password: hashedPassword,
        role: 'Owner'
      });

      // Simpan nama toko dasar
      const storeProfile = {
        name: storeName,
        address: 'Alamat Toko UMKM',
        phone: '-'
      };
      await db.settings.put({
        key: 'store_profile',
        value: storeProfile
      });

      // Registrasi sukses, dapatkan user lalu arahkan ke login sukses
      const createdUser = await db.users.where('username').equals(username).first();
      onLoginSuccess(createdUser, storeProfile);
    } catch (err) {
      console.error(err);
      setError('Gagal membuat akun pemilik toko.');
    } finally {
      setLoading(false);
    }
  };

  // HANDLER PULIHKAN DATA JSON DI LUAR LOGIN (MIGRASI DEVICE KILAT)
  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('PENTING: Seluruh data kasir di HP baru ini akan digantikan sepenuhnya oleh file cadangan ini. Lanjutkan pulihkan data?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        
        // Validasi struktur data backup
        if (imported.app !== "CakPos" || !imported.tables) {
          alert('Format file backup POS tidak valid atau rusak!');
          return;
        }

        const t = imported.tables;
        
        // Lakukan pengosongan dan penulisan ulang database secara transaksional
        await db.transaction('rw', [
          db.users, db.settings, db.products, 
          db.orders, db.customers, db.debts, db.expenses
        ], async () => {
          await db.users.clear();
          await db.settings.clear();
          await db.products.clear();
          await db.orders.clear();
          await db.customers.clear();
          await db.debts.clear();
          await db.expenses.clear();

          if (t.users) await db.users.bulkAdd(t.users);
          if (t.settings) await db.settings.bulkAdd(t.settings);
          if (t.products) await db.products.bulkAdd(t.products);
          if (t.orders) await db.orders.bulkAdd(t.orders);
          if (t.customers) await db.customers.bulkAdd(t.customers);
          if (t.debts) await db.debts.bulkAdd(t.debts);
          if (t.expenses) await db.expenses.bulkAdd(t.expenses);
        });

        alert('DATABASE BERHASIL DIPULIHKAN! Anda kini bisa masuk menggunakan username & password lama.');
        window.location.reload();

      } catch (err) {
        console.error(err);
        alert('Gagal membaca file backup. Pastikan berkas JSON Anda tidak rusak.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1.25rem',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '380px',
        padding: '1.75rem 1.5rem',
        boxShadow: 'var(--shadow-lg)'
      }}>
        
        {/* Logo Toko & Deskripsi */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent-color)',
            marginBottom: '0.75rem'
          }}>
            <Store size={26} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {isRegisterMode ? 'Setup Toko Baru' : 'Masuk Aplikasi'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
            {isRegisterMode 
              ? 'Daftarkan nama toko dan akun pemilik utama untuk memulai kasir gratis' 
              : 'Silakan masukkan username dan password untuk melayani pembeli'}
          </p>
        </div>

        {/* Notifikasi Error */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
            borderLeft: '4px solid var(--danger)'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
          
          {/* Tambahan Nama Toko Khusus Pendaftaran */}
          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Nama Toko / Warung</label>
              <div style={{ position: 'relative' }}>
                <Store size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Toko Berkah Kelontong"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{ paddingLeft: '2.5rem', fontSize: '0.9rem' }}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Input Username */}
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '2.5rem', fontSize: '0.9rem' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Input Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="form-input"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', fontSize: '0.9rem' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Tambahan Ulangi Password Khusus Pendaftaran */}
          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Konfirmasi Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-input"
                  placeholder="Masukkan ulang password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '2.5rem', fontSize: '0.9rem' }}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Tombol Aksi */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '0.8rem', 
              marginTop: '0.5rem', 
              fontSize: '0.95rem',
              boxShadow: 'var(--shadow-sm)'
            }}
            disabled={loading}
          >
            {loading ? 'Menghubungkan...' : (isRegisterMode ? 'Daftar & Buka Toko' : 'Masuk Aplikasi')}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* TOMBOL RESTORE: HANYA SAAT FIRST-RUN / PENDAFTARAN (CEGAH BACKDOOR) */}
        {isRegisterMode && (
          <div style={{ 
            marginTop: '1.25rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid var(--border-color)', 
            textAlign: 'center' 
          }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Pindahkan data dari HP lama?
            </p>
            <label 
              htmlFor="login-restore-input" 
              style={{ 
                fontSize: '0.75rem', 
                color: 'var(--accent-color)', 
                cursor: 'pointer', 
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Upload size={14} />
              <span>Pilih File Backup (.json)</span>
            </label>
            <input 
              id="login-restore-input" 
              type="file" 
              accept=".json" 
              onChange={handleImportBackup} 
              style={{ display: 'none' }} 
            />
          </div>
        )}

        {/* Keamanan lokal footer */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '6px', 
          marginTop: '1.25rem', 
          fontSize: '0.7rem', 
          color: 'var(--text-muted)' 
        }}>
          <ShieldCheck size={13} style={{ color: 'var(--success)' }} />
          <span>Enkripsi Lokal SHA-256 Aktif & Aman</span>
        </div>
        
      </div>
    </div>
  );
}
