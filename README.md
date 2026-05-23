# Antigravity POS - Aplikasi Kasir Offline-First & Serverless untuk UMKM

Aplikasi Point of Sale (POS) yang dirancang khusus untuk memenuhi kebutuhan Usaha Mikro, Kecil, dan Menengah (UMKM) di Indonesia. Aplikasi ini dibangun dengan pendekatan **Offline-First** dan **Serverless**, menjamin keandalan 100% tanpa internet, keamanan data mandiri, dan **Nol Biaya Operasional (100% Gratis Selamanya)**.

---

## 🌟 Pilar Utama Arsitektur

1. **Mobile-First Design (Ramah Smartphone):** Dirancang dengan prioritas utama untuk layar ponsel. Memiliki antarmuka responsif yang meniru aplikasi seluler *native* (Bottom Tab Navigation, tombol ramah jempol, layout kartu tanpa tabel horizontal, dan performa super ringan).
2. **100% Offline-First (PWA):** Dapat diakses dan dijalankan tanpa koneksi internet sama sekali. Seluruh aset web disimpan dalam cache perangkat kasir.
3. **Nol Biaya Operasional (Zero-Cost):** Tidak memerlukan biaya server atau database bulanan. Aplikasi statis di-host gratis di platform seperti Vercel, Netlify, atau GitHub Pages.
4. **Database Klien Mandiri:** Seluruh data transaksi, stok produk, kasbon, dan laporan disimpan secara lokal dan aman di browser menggunakan **IndexedDB (via Dexie.js)**.
5. **Cadangan Data Mandiri (Backup/Restore):** Fitur ekspor/impor data manual berbentuk file JSON/Excel untuk dipindahkan antarperangkat atau dicadangkan ke Google Drive pribadi.
6. **Opsi Sinkronisasi Cloud Gratis (BYOD - Bring Your Own Database):** Dukungan opsional untuk terhubung ke database cloud gratis milik UMKM sendiri melalui **Supabase Free Tier**.

---

## 🚀 Fitur Unggulan

### 1. Keamanan Akses Offline (Login System)
* Layanan login dengan **Username & Password** yang diproses 100% lokal dan terenkripsi menggunakan Web Crypto API.
* Pengaturan multi-user:
  * **Role Pemilik (Owner):** Akses penuh ke Laba Bersih, Buku Hutang, manajemen produk, harga modal, dan pengaturan sistem.
  * **Role Staf (Kasir):** Hanya memiliki akses ke terminal transaksi kasir (tidak bisa melihat keuntungan bersih toko atau mengubah harga dasar).

### 2. Terminal Kasir & Sistem Pembayaran
* Sistem keranjang belanja dinamis dan cepat.
* **Scan Barcode** produk menggunakan kamera bawaan HP/Laptop secara langsung.
* **Tahan Keranjang (Hold & Recall Cart):** Menyimpan antrean transaksi sementara untuk melayani pelanggan berikutnya.
* Kalkulator uang kembalian cepat dengan tombol pintas nominal mata uang Rupiah pecahan besar (Rp2.000 s/d Rp100.000) dan tombol "Uang Pas".
* Integrasi **QRIS Statis Toko** yang muncul langsung di layar untuk dipindai pelanggan.

### 3. Struk Pembelian Hemat Kertas
* **Struk Digital WhatsApp:** Secara otomatis men-generate struk belanja berformat teks yang rapi dan estetik untuk langsung dikirim via WhatsApp pelanggan.
* **Cetak Printer Thermal:** Layout cetak struk khusus yang optimal untuk ukuran kertas thermal kasir standar (58mm / 80mm).

### 4. Buku Hutang / Kasbon Pelanggan
* Sistem pencatatan hutang terintegrasi langsung dari layar kasir.
* Melacak detail hutang per pelanggan, pencatatan pembayaran cicilan, dan status pelunasan terperinci.

### 5. Manajemen Inventaris & Harga Grosir
* Pengelolaan data produk: Nama, Kategori, Barcode (SKU), Harga Modal (HPP), Harga Jual, Stok, dan Batas Stok Minim.
* **Harga Grosir (Tiered Pricing):** Perubahan harga satuan otomatis berdasarkan kuantitas produk yang dibeli.
* **Daftar Belanja Kebutuhan Grosir (Shopping List):** Sistem otomatis mendeteksi produk yang stoknya menipis untuk panduan pemilik saat kulakan/belanja grosir.

### 6. Pengeluaran Toko & Laporan Laba/Rugi Bersih
* **Catatan Pengeluaran Kas (Expense Tracker):** Pencatatan uang keluar dari kasir (misal: beli es batu, iuran sampah) secara cepat.
* **Dashboard Profit & Loss:** Laporan omzet penjualan, pengeluaran kas kecil, modal produk (HPP), serta **Laba Bersih** aktual secara harian, mingguan, dan bulanan.

---

## 🛠️ Tech Stack yang Digunakan

* **Core Framework:** React 18+ dengan Vite
* **Database Lokal:** Dexie.js (Wrapper IndexedDB berkinerja tinggi)
* **PWA Engine:** `@vite-pwa/plugin` dengan Service Worker kustom
* **Styling & UI:** Vanilla CSS Modern (Variabel HSL, Glassmorphism, Micro-Animations, Elegan Light/Dark Mode)
* **Ikonografi:** Lucide React
* **Kamera Scan Barcode:** Html5-qrcode
