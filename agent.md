# Cetak Biru Implementasi Agent AI (Antigravity)

Dokumen ini adalah panduan kerja internal bagi Agent AI dalam merealisasikan aplikasi POS Antigravity secara bertahap. Pembangunan aplikasi harus mengikuti urutan fase di bawah ini secara disiplin, melakukan pengujian fungsionalitas di setiap langkah sebelum beranjak ke langkah berikutnya.

> [!IMPORTANT]
> **Fokus Utama: Desain Mobile-First & Responsif Seluler**
> Setiap komponen UI yang dikembangkan wajib dirancang dengan mengutamakan layar smartphone (lebar 360px - 480px) terlebih dahulu. Navigasi utama untuk seluler harus menggunakan **Bottom Tab Navigation Bar**, semua interaksi data tabular harus dikonversi menjadi layout **Kartu (Cards)** yang ramah sentuhan, dan tombol pemindai barcode kamera harus mudah diakses dengan jempol melalui *Floating Action Button (FAB)*.

---

## 📅 Rencana Pengembangan Bertahap (Development Roadmap)

```mermaid
gantt
    title Peta Jalan Pembangunan POS
    dateFormat  YYYY-MM-DD
    section Fase Dasar
    Fase 1: Inisialisasi Proyek & DB      :active, f1, 2026-05-22, 1d
    Fase 2: Sistem Login & Lock Screen  : f2, after f1, 1d
    section Fitur Utama
    Fase 3: Katalog Produk & Grosir       : f3, after f2, 1d
    Fase 4: Terminal Kasir & Cetak Struk  : f4, after f3, 2d
    Fase 5: Buku Hutang & Kasbon          : f5, after f4, 1d
    section Operasional
    Fase 6: Pengeluaran & Laba Rugi       : f6, after f5, 1d
    Fase 7: PWA, Backup & Sinkronisasi    : f7, after f6, 1d
```

---

## 🗄️ Skema Database Lokal (IndexedDB Schema - Dexie.js)

Kita akan menetapkan struktur tabel database lokal berikut dalam inisialisasi:

1. **`users`**: Menyimpan akun pengguna (Owner/Kasir)
   * Indeks: `++id, username, role`
2. **`settings`**: Menyimpan konfigurasi toko dan QRIS statis
   * Indeks: `key`
3. **`products`**: Menyimpan katalog produk
   * Indeks: `++id, name, barcode, category, *tags`
4. **`orders`**: Menyimpan transaksi penjualan
   * Indeks: `++id, invoiceNumber, customerId, paymentMethod, isSynced, createdAt`
5. **`customers`**: Menyimpan data pelanggan (terutama untuk kasbon)
   * Indeks: `++id, name, phone`
6. **`debts`**: Menyimpan buku piutang pelanggan
   * Indeks: `++id, customerId, orderId, status, dueDate`
7. **`expenses`**: Menyimpan catatan pengeluaran kas kecil
   * Indeks: `++id, category, createdAt`

---

## 🚶‍♂️ Rincian Langkah Kerja per Fase

### Fase 1: Inisialisasi Proyek & Struktur Database
* **Tujuan:** Membuat proyek React PWA berbasis Vite dan mendefinisikan database Dexie.js.
* **Langkah Kerja:**
  1. Jalankan inisialisasi React + Vite di direktori kerja.
  2. Pasang dependensi utama (`dexie`, `dexie-react-hooks`, `lucide-react`).
  3. Buat berkas konfigurasi database `src/db/db.js` dengan skema tabel di atas.
  4. Siapkan struktur CSS Variables global sesuai dengan panduan `rules.md`.

### Fase 2: Sistem Registrasi & Login Offline (Owner vs Staff)
* **Tujuan:** Membuat alur pengamanan aplikasi dengan Username dan Password secara 100% offline.
* **Langkah Kerja:**
  1. Deteksi apakah sudah ada pengguna di tabel `users`. Jika belum, tampilkan halaman registrasi pemilik (*Store Setup Screen*).
  2. Implementasikan layar login modern bergaya *glassmorphism* dengan input Username & Password.
  3. Terapkan verifikasi keamanan lokal menggunakan Web Crypto API (SHA-256) untuk verifikasi password.
  4. Sediakan fitur "Ingat Saya" (Remember Me) untuk kemudahan UX kasir.

### Fase 3: Katalog Produk & Harga Grosir
* **Tujuan:** Membangun manajemen inventaris produk yang dinamis dan mendukung grosir.
* **Langkah Kerja:**
  1. Halaman kelola produk: Tambah, edit, hapus, dan cari produk dengan cepat.
  2. Terapkan input Harga Modal (HPP), Harga Jual, Stok Aktual, dan batas minimal stok untuk notifikasi.
  3. Implementasikan aturan **Harga Grosir Bertingkat** (Contoh: "Jika beli >= 12, harga menjadi Rp X").
  4. Tampilkan daftar **"Kebutuhan Belanja Grosir"** secara otomatis berdasarkan produk yang stoknya hampir habis.

### Fase 4: Terminal Kasir, Scan Barcode & Cetak Struk
* **Tujuan:** Membuat jantung aplikasi tempat kasir melakukan transaksi harian secara cepat.
* **Langkah Kerja:**
  1. Antarmuka Kasir: Pencarian produk, filter kategori cepat, dan daftar keranjang belanja.
  2. Integrasikan modul kamera scan barcode menggunakan `html5-qrcode` yang bisa diaktifkan/dinonaktifkan secara bersih.
  3. Buat fitur **Tahan & Panggil Keranjang** (Hold & Recall Cart).
  4. Implementasikan panel kalkulator pembayaran tunai dengan nominal pecahan uang Rupiah, pembayaran non-tunai (QRIS), dan struk kasbon.
  5. Sediakan fitur pembuatan format struk digital teks untuk dibagikan ke WhatsApp dan tampilan cetak struk thermal CSS 58mm/80mm.

### Fase 5: Buku Piutang & Kasbon Pelanggan
* **Tujuan:** Menyelesaikan kendala "catat hutang" kasbon khas warung kelontong.
* **Langkah Kerja:**
  1. Integrasikan pilihan data pelanggan di kasir saat melakukan pembayaran dengan metode "Kasbon".
  2. Buat halaman khusus **"Buku Hutang"** untuk melacak total piutang toko.
  3. Implementasikan fungsi pencatatan pembayaran cicilan hutang dan pelunasan bertahap.

### Fase 6: Pengeluaran Toko & Laporan Keuangan Laba/Rugi
* **Tujuan:** Memberikan wawasan keuangan bersih yang akurat kepada pemilik toko.
* **Langkah Kerja:**
  1. Buat tombol pencatatan pengeluaran kas toko dengan kategori (Operasional, Kebersihan, dll).
  2. Buat Dashboard Finansial yang menyajikan: **Total Omzet**, **Total HPP (Modal Produk terjual)**, **Total Pengeluaran**, dan kalkulasi akhir **Laba Bersih Toko**.
  3. Tampilkan metrik sederhana seperti 5 produk paling laris (*Best Seller*).

### Fase 7: Optimalisasi PWA, Ekspor JSON & Opsional Cloud Sync
* **Tujuan:** Menyelesaikan sentuhan akhir aplikasi, memastikannya dapat di-install secara offline, dan menyediakan fitur backup data.
* **Langkah Kerja:**
  1. Konfigurasi `vite-plugin-pwa` untuk caching offline seluruh file statis secara sempurna.
  2. Buat fungsi ekspor data IndexedDB lokal menjadi file JSON terenkripsi sederhana untuk cadangan manual, dan impor data untuk pemulihan.
  3. Sediakan kolom input Supabase URL dan Anon Key di menu pengaturan untuk sinkronisasi cloud otomatis gratis secara opsional bagi pemilik toko yang melek teknologi.
