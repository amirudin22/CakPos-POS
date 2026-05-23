import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { hashPassword } from '../utils/crypto';
import { useLiveQuery } from 'dexie-react-hooks';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share as CapacitorShare } from '@capacitor/share';

import { 
  Store, CreditCard, UserPlus, Database, 
  Download, Upload, Trash2, LogOut, Check,
  MessageCircle, Mail, Heart
} from 'lucide-react';

/**
 * Halaman Pengaturan Toko
 * Mengelola Profil Toko, QRIS Base64, Akun Kasir Baru, Backup JSON, & Backup WhatsApp
 */
export default function Pengaturan({ user, onStoreProfileUpdate, onLogout }) {
  // State Profil Toko
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  
  // State Unggah QRIS Statis
  const [qrisPreview, setQrisPreview] = useState('');
  const [qrisString, setQrisString] = useState('');

  // State Zoom QRIS
  const [zoomImage, setZoomImage] = useState(null);

  // State Buat Akun Kasir
  const [newStaffUser, setNewStaffUser] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('');

  // Live query data akun kasir untuk ditampilkan (Hanya untuk Owner)
  const staffAccounts = useLiveQuery(() => 
    db.users.where('role').equals('Kasir').toArray()
  ) || [];

  useEffect(() => {
    const loadSettings = async () => {
      const profile = await db.settings.get('store_profile');
      if (profile?.value) {
        setStoreName(profile.value.name || '');
        setStoreAddress(profile.value.address || '');
        setStorePhone(profile.value.phone || '');
      }

      const qris = await db.settings.get('qris_static_image');
      if (qris?.value) {
        setQrisPreview(qris.value);
      }

      const qrisStr = await db.settings.get('qris_string');
      if (qrisStr?.value) {
        setQrisString(qrisStr.value);
      }
    };
    loadSettings();
  }, []);

  // SIMPAN PROFIL TOKO
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!storeName) return;

    try {
      const updatedProfile = {
        name: storeName,
        address: storeAddress,
        phone: storePhone
      };
      
      await db.settings.put({
        key: 'store_profile',
        value: updatedProfile
      });

      onStoreProfileUpdate(updatedProfile);
      alert('Profil toko berhasil diperbarui!');
    } catch (err) {
      alert('Gagal memperbarui profil toko.');
    }
  };

  // UNGGAH QRIS DAN KONVERSI KE BASE64 OFFLINE
  const handleQrisUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      alert('Ukuran gambar terlalu besar! Pilih gambar di bawah 800KB agar aplikasi tetap cepat.');
      return;
    }

    // Baca sebagai ArrayBuffer untuk ML Kit scan
    const arrayReader = new FileReader();
    arrayReader.onloadend = async () => {
      const blob = new Blob([arrayReader.result], { type: file.type });

      // Baca sebagai Data URL untuk preview
      const dataReader = new FileReader();
      dataReader.onloadend = async () => {
        const base64Data = dataReader.result;
        setQrisPreview(base64Data);
        await db.settings.put({ key: 'qris_static_image', value: base64Data });

        // Coba baca QR code dari gambar untuk auto-fill QRIS string
        try {
          const { BarcodeScanner: MLKitScanner } = await import('@capacitor-mlkit/barcode-scanning');
          const result = await MLKitScanner.readBarcodesFromImage({ blob });
          if (result.barcodes.length > 0) {
            const code = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
            if (code && code.length > 20) {
              setQrisString(code);
              await db.settings.put({ key: 'qris_string', value: code });
              alert('Gambar QRIS berhasil disimpan! QRIS string juga terdeteksi otomatis dan siap digunakan di Kasir.');
              return;
            }
          }
        } catch (_) {
          // Gagal membaca QR dari gambar — tidak masalah, string tetap bisa diisi manual
        }

        alert('Kode QRIS Toko berhasil disimpan! Untuk nominal otomatis, paste QRIS string di kolom di bawah.');
      };
      dataReader.readAsDataURL(file);
    };
    arrayReader.readAsArrayBuffer(file);
  };

  // HAPUS QRIS
  const handleRemoveQris = async () => {
    if (confirm('Hapus gambar QRIS Toko saat ini?')) {
      setQrisPreview('');
      await db.settings.delete('qris_static_image');
    }
  };

  // SIMPAN QRIS STRING
  const handleSaveQrisString = async () => {
    await db.settings.put({ key: 'qris_string', value: qrisString.trim() });
    alert('QRIS string berhasil disimpan!');
  };

  // HAPUS QRIS STRING
  const handleRemoveQrisString = async () => {
    if (confirm('Hapus QRIS string?')) {
      setQrisString('');
      await db.settings.delete('qris_string');
    }
  };

  // BUAT AKUN KASIR BARU (Hanya Owner)
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaffUser || !newStaffPass) return;

    try {
      const exist = await db.users.where('username').equals(newStaffUser).first();
      if (exist) {
        alert('Username sudah terdaftar! Pilih username lain.');
        return;
      }

      const hashed = await hashPassword(newStaffPass);
      await db.users.add({
        username: newStaffUser,
        password: hashed,
        role: 'Kasir'
      });

      alert(`Akun Staf Kasir "${newStaffUser}" berhasil dibuat!`);
      setNewStaffUser('');
      setNewStaffPass('');
    } catch (err) {
      alert('Gagal membuat akun kasir.');
    }
  };

  // HAPUS AKUN KASIR
  const handleDeleteStaff = async (id) => {
    if (confirm('Hapus akun kasir ini? Dia tidak akan bisa masuk lagi ke POS.')) {
      await db.users.delete(id);
    }
  };

  // LOGIKA BACKUP: EKSPOR SELURUH INDEXEDDB KE BERKAS JSON
  const handleExportBackup = async () => {
    try {
      const backupData = {
        app: "CakPos",
        backupDate: new Date().toISOString(),
        tables: {
          users: await db.users.toArray(),
          settings: await db.settings.toArray(),
          products: await db.products.toArray(),
          orders: await db.orders.toArray(),
          customers: await db.customers.toArray(),
          debts: await db.debts.toArray(),
          expenses: await db.expenses.toArray()
        }
      };

      const dateString = new Date().toISOString().slice(0,10);
      const filename = `backup_pos_umkm_${dateString}.json`;
      const content = JSON.stringify(backupData, null, 2);

      try {
        const saved = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Cache,
          encoding: 'utf-8',
        });
        await CapacitorShare.share({
          title: 'Backup POS UMKM',
          text: `File cadangan ${filename}`,
          url: saved.uri,
        });
      } catch (_) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(content);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal membuat file cadangan backup.');
    }
  };

  // LOGIKA RESTORE: IMPOR BERKAS JSON KE DATABASE LOKAL
  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('PENTING: Seluruh data kasir saat ini akan dihapus dan digantikan sepenuhnya oleh file cadangan ini. Lanjutkan pulihkan data?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        
        if (imported.app !== "CakPos" || !imported.tables) {
          alert('Format berkas backup tidak valid atau rusak!');
          return;
        }

        const t = imported.tables;
        
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

        alert('DATABASE BERHASIL DIPULIHKAN! Aplikasi akan disegarkan otomatis.');
        window.location.reload();

      } catch (err) {
        console.error(err);
        alert('Gagal mengimpor file. Pastikan file JSON cadangan Anda tidak rusak.');
      }
    };
    reader.readAsText(file);
  };

  // BACKUP OTOMATIS VIA WHATSAPP (SEBAGAI FILE .json)
  const handleWhatsAppBackup = async () => {
    const phone = storePhone.replace(/[^0-9]/g, '');
    if (!phone || phone === '-') {
      alert('Isi nomor WhatsApp toko di Profil Toko terlebih dahulu!');
      return;
    }

    try {
      const backupData = {
        app: "CakPos",
        exportedAt: new Date().toISOString(),
        tables: {
          users: await db.users.toArray(),
          settings: await db.settings.toArray(),
          products: await db.products.toArray(),
          orders: await db.orders.toArray(),
          customers: await db.customers.toArray(),
          debts: await db.debts.toArray(),
          expenses: await db.expenses.toArray()
        }
      };

      const jsonText = JSON.stringify(backupData);
      const base64 = btoa(unescape(encodeURIComponent(jsonText)));
      const fileName = `CakPos-backup-${new Date().toISOString().slice(0, 10)}.json`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });

      const fileUri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;

      await CapacitorShare.share({
        title: `Backup CakPos ${new Date().toISOString().slice(0, 10)}`,
        files: [fileUri],
        dialogTitle: 'Kirim Backup ke WhatsApp',
      });
    } catch (err) {
      console.error(err);
      alert('Gagal membuat file backup.');
    }
  };

  const handleWhatsAppGuide = () => {
    alert('📲 Cara Pindah ke HP Baru:\n\n1. Di HP lama, buka Pengaturan → Backup WA\n2. Ketuk "Kirim Backup", pilih WhatsApp\n3. Kirim file ke chat "Diri Sendiri" / nomor toko sendiri\n4. Di HP baru, install CakPos\n5. Di halaman registrasi, ketuk "Pilih File Backup"\n6. Pilih file .json yang sudah dikirim di chat WA\n7. Database akan pulih otomatis!');
  };

  const isOwner = user?.role === 'Owner';

  return (
    <div className="main-content">
      
      {/* HEADER HALAMAN */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan Sistem</h1>
          <p className="page-subtitle">Atur profil toko, cadangan database, dan hak akses pengguna</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3.5rem' }}>
        
        {/* SEKSI 1: PROFIL TOKO & ALAMAT */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <Store size={18} className="text-primary" />
            <span>Profil Toko UMKM</span>
          </h3>

          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label className="form-label">Nama Toko</label>
              <input 
                type="text" 
                className="form-input" 
                value={storeName} 
                onChange={(e) => setStoreName(e.target.value)} 
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Alamat Toko (Tampil di Struk)</label>
              <input 
                type="text" 
                className="form-input" 
                value={storeAddress} 
                onChange={(e) => setStoreAddress(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">No Telepon / WhatsApp Toko</label>
              <input 
                type="text" 
                className="form-input" 
                value={storePhone} 
                onChange={(e) => setStorePhone(e.target.value)} 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Perbarui Informasi Toko
            </button>
          </form>
        </div>

        {/* SEKSI 2: UNGGAH QRIS OFFLINE */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <CreditCard size={18} className="text-primary" />
            <span>Metode QRIS Offline (Base64)</span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {qrisPreview ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ padding: '8px', background: 'white', display: 'inline-block', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <img src={qrisPreview} alt="QRIS preview" style={{ maxWidth: '140px', maxHeight: '140px', display: 'block' }} />
                </div>
                <button type="button" className="btn btn-danger mt-2" onClick={handleRemoveQris} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                  <Trash2 size={12} />
                  <span>Hapus QRIS</span>
                </button>
              </div>
            ) : (
              <div className="text-center" style={{ padding: '1rem', border: '2px dashed var(--border-color)', borderRadius: 'var(--border-radius-sm)', width: '100%', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '0.8rem' }}>Belum ada kode QRIS yang diunggah.</p>
                <p style={{ fontSize: '0.7rem', marginTop: '2px' }}>Unggah kode QRIS statis dari bank/e-wallet Anda.</p>
              </div>
            )}

            <div style={{ width: '100%' }}>
              <label htmlFor="qris-file-input" className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer' }}>
                <Upload size={16} />
                <span>Unggah Gambar QRIS (.png / .jpg)</span>
              </label>
              <input 
                id="qris-file-input" 
                type="file" 
                accept="image/*" 
                onChange={handleQrisUpload} 
                style={{ display: 'none' }} 
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>QRIS String (untuk generate QR dinamis dengan nominal)</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.3 }}>
              Paste QRIS string dari bank/merchant Anda. Saat checkout, nominal akan ditambahkan otomatis.
            </p>
            <textarea
              className="form-input"
              value={qrisString}
              onChange={(e) => setQrisString(e.target.value)}
              placeholder="00020101021126690021ID.CO.BANK..."
              rows={3}
              style={{ width: '100%', fontSize: '0.7rem', fontFamily: 'monospace', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" className="btn btn-primary" onClick={handleSaveQrisString} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
                <Check size={14} />
                <span>Simpan QRIS String</span>
              </button>
              {qrisString && (
                <button type="button" className="btn btn-danger" onClick={handleRemoveQrisString} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SEKSI 3: KEDAULATAN DATA (BACKUP & RESTORE JSON OFFLINE) */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <Database size={18} className="text-primary" />
            <span>Manajemen Data (Backup & Restore)</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
            Seluruh data Anda disimpan aman secara lokal. Lakukan backup secara rutin ke memori HP/Laptop Anda untuk mengamankan riwayat toko.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            
            {/* Tombol Backup */}
            <button className="btn btn-primary" onClick={handleExportBackup} style={{ padding: '0.65rem' }}>
              <Download size={16} />
              <span>Cadangkan (Backup)</span>
            </button>

            {/* Tombol Restore */}
            <div>
              <label htmlFor="restore-file-input" className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', padding: '0.65rem' }}>
                <Upload size={16} />
                <span>Pulihkan (Restore)</span>
              </label>
              <input 
                id="restore-file-input" 
                type="file" 
                accept=".json" 
                onChange={handleImportBackup} 
                style={{ display: 'none' }} 
              />
            </div>

          </div>
        </div>

        {/* SEKSI 4: BACKUP OTOMATIS VIA WHATSAPP */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <MessageCircle size={18} className="text-primary" />
            <span>Backup Otomatis via WhatsApp</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
            Kirim file backup database ke nomor WhatsApp toko sendiri. Simpan chat WA sebagai cadangan untuk pindah HP nanti.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleWhatsAppBackup}
              style={{ width: '100%', padding: '0.65rem' }}
            >
              <span>📤 Kirim Backup ke WhatsApp</span>
            </button>

            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleWhatsAppGuide}
              style={{ width: '100%', padding: '0.65rem' }}
            >
              <span>📲 Panduan: Cara Pindah ke HP Baru</span>
            </button>
          </div>
        </div>

        {/* SEKSI 5: HAK AKSES MULTI-USER KASIR (HANYA UNTUK OWNER) */}
        {isOwner && (
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <UserPlus size={18} className="text-primary" />
              <span>Pendaftaran Akun Staf Kasir</span>
            </h3>

            <form onSubmit={handleCreateStaff} className="mb-4">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Username Kasir" 
                  value={newStaffUser}
                  onChange={(e) => setNewStaffUser(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  style={{ fontSize: '0.85rem' }}
                  required
                />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Password Kasir" 
                  value={newStaffPass}
                  onChange={(e) => setNewStaffPass(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.6rem' }}>
                Tambah Akun Kasir Baru
              </button>
            </form>

            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
              <span className="form-label">Daftar Staf Aktif</span>
              
              {staffAccounts.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Belum ada akun kasir tambahan yang terdaftar.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {staffAccounts.map(account => (
                    <div key={account.id} className="flex-between" style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-primary)', borderRadius: '4px', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 600 }}>{account.username}</span>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteStaff(account.id)} 
                        style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        Hapus Akses
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEKSI 7: TOMBOL KELUAR APLIKASI (MOBILE-FIRST LOGOUT TRIGER) */}
        <div style={{ marginTop: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={onLogout} 
            style={{ 
              width: '100%', 
              padding: '0.9rem', 
              borderRadius: 'var(--border-radius-sm)', 
              color: 'white',
              backgroundColor: 'var(--danger)',
              boxShadow: 'var(--shadow-sm)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <LogOut size={18} />
            <span>Keluar dari Aplikasi</span>
          </button>
        </div>

        {/* SEKSI 8: KONTAK DEVELOPER */}
        <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
            Butuh bantuan atau ada saran? Hubungi kami:
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <a
              href="https://wa.me/6285850800914"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-success"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem', fontSize: '0.8rem', color: 'white', textDecoration: 'none' }}
            >
              <MessageCircle size={16} />
              <span>WhatsApp</span>
            </a>
            <a
              href="mailto:amirudin22@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem', fontSize: '0.8rem', color: 'white', textDecoration: 'none' }}
            >
              <Mail size={16} />
              <span>Email</span>
            </a>
          </div>
        </div>

        {/* SEKSI 9: TENTANG APLIKASI */}
        <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
            <Heart size={16} style={{ color: 'var(--danger)' }} />
            <span>Tentang CakPos</span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '10px' }}>
            CakPos adalah perangkat lunak kasir <strong>freeware</strong> untuk UMKM Indonesia. 
            Dikembangkan dengan semangat open-source, aplikasi ini <strong>100% gratis</strong> dan 
            bebas digunakan oleh siapa pun tanpa biaya lisensi.
          </p>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
            Jika aplikasi ini bermanfaat dan Anda ingin berkontribusi (misalnya bantu bayar listrik PC 😄), 
            Anda dapat mengirimkan apresiasi melalui QRIS di bawah ini:
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <img
              src="/donate-qris.png"
              alt="QRIS Donasi"
              onClick={() => setZoomImage('/donate-qris.png')}
              style={{ width: '160px', height: '160px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', padding: '4px', objectFit: 'contain', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            CakPos v1.0 — Dibuat dengan ❤️ untuk UMKM Indonesia
          </p>
        </div>

      </div>

      {zoomImage && (
        <div
          className="modal-overlay"
          onClick={() => setZoomImage(null)}
          style={{ cursor: 'zoom-out', zIndex: 9999 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              maxWidth: '90vw',
              maxHeight: '90vh',
            }}
          >
            <img
              src={zoomImage}
              alt="QRIS"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

