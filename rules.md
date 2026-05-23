# Aturan Pengembangan Kode & Standar Kualitas

Berkas ini mendefinisikan aturan ketat untuk arsitektur, gaya penulisan kode, desain UI/UX, dan performa aplikasi POS Antigravity. Seluruh pengembangan harus tunduk pada pedoman di bawah ini.

---

## 1. Aturan Penulisan Kode (Coding Guidelines)

* **TypeScript / ES6+ Modern:** Gunakan sintaksis ES6+ yang bersih. Hindari penggunaan tipe `any` sebisa mungkin jika menggunakan TypeScript.
* **Struktur Komponen yang Fokus:** Setiap komponen UI harus berukuran kecil, terisolasi, dan hanya bertanggung jawab atas satu tugas (*Single Responsibility Principle*).
* **Manajemen State Lokal:** 
  * Gunakan React Context hanya untuk kebutuhan global (seperti tema, data user login, status keranjang global).
  * Manfaatkan hook reaktif `useLiveQuery` dari `dexie-react-hooks` agar UI kasir otomatis tersinkronisasi secara instan begitu ada perubahan pada database IndexedDB lokal.
* **Penanganan Error yang Kuat (Robust Error Handling):**
  * Selalu gunakan blok `try...catch` pada operasi database IndexedDB atau enkripsi password.
  * Sediakan *fallback UI* (pesan error yang ramah pengguna) agar aplikasi tidak mengalami *crash* total jika terjadi kesalahan.

---

## 2. Sistem Desain Visual & CSS (Premium & Modern)

* **Gaya Styling:** Gunakan **Vanilla CSS Modern** dengan sistem CSS Variables (Custom Properties) yang dinamis. **Hindari menggunakan TailwindCSS** untuk menjaga keaslian desain dan kontrol penuh atas animasi mikro serta performa pemuatan halaman.
* **Skema Warna HSL Kontemporer:** Gunakan palet warna HSL terkurasi yang harmonis dengan kontras tinggi untuk kenyamanan mata kasir dalam durasi penggunaan yang lama.

### Skema Variabel CSS Dasar (Global Tokens):
```css
:root {
  /* Mode Terang (Light Mode) */
  --bg-primary: hsl(220, 20%, 97%);
  --bg-secondary: hsl(0, 0%, 100%);
  --bg-card: hsla(0, 0%, 100%, 0.7);
  --border-color: hsl(220, 15%, 90%);
  
  --text-primary: hsl(224, 71%, 4%);
  --text-secondary: hsl(220, 9%, 46%);
  
  --accent-color: hsl(250, 84%, 54%); /* Indigo Premium */
  --accent-hover: hsl(250, 84%, 48%);
  
  --success: hsl(142, 76%, 36%); /* Hijau Segar */
  --warning: hsl(38, 92%, 50%); /* Amber */
  --danger: hsl(346, 84%, 61%); /* Merah Lembut */
  
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
  --shadow-md: 0 8px 30px rgba(0,0,0,0.08);
  
  --blur-amount: 12px;
  --border-radius: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Mode Gelap (Dark Mode) */
    --bg-primary: hsl(222, 47%, 11%);
    --bg-secondary: hsl(223, 47%, 7%);
    --bg-card: hsla(223, 47%, 7%, 0.6);
    --border-color: hsl(223, 47%, 16%);
    
    --text-primary: hsl(210, 40%, 98%);
    --text-secondary: hsl(215, 20%, 65%);
    
    --accent-color: hsl(250, 95%, 65%);
    --accent-hover: hsl(250, 95%, 58%);
  }
}
```

* **Estetika Premium (WOW Factor):**
  * Terapkan **Glassmorphism** (`backdrop-filter: blur(var(--blur-amount))`) pada kartu login, dialog detail transaksi, dan panel kasir.
  * Tambahkan **Mikro-Animasi (Micro-Animations):** Tombol kasir harus bereaksi lembut saat diarahkan (*hover*) dan ditekan (*active*). Gunakan efek `transform: scale(0.98)` pada klik tombol untuk meniru respons fisik layar sentuh.
  * Gunakan font modern, bersih, dan berbobot seimbang (misal: Outfit atau Inter dari Google Fonts) daripada font default sistem.

* **Desain Mobile-First & Responsif Seluler (Prioritas Utama):**
  * **Navigasi Bawah (Bottom Navigation Bar):** Pada resolusi layar kecil (lebar < 768px), navigasi utama harus terletak di bagian bawah layar (menggunakan ikon besar yang mudah dijangkau jempol: Kasir, Produk, Kasbon, Laporan, Pengaturan).
  * **Target Ketukan (Touch Targets):** Semua elemen interaktif (tombol, input, link) harus memiliki ukuran minimal **48px x 48px** untuk mencegah salah klik dengan ibu jari.
  * **Layout Fleksibel (Flex/Grid):** Susunan antarmuka kasir harus otomatis menyesuaikan diri. Di PC/Tablet, keranjang belanja dan daftar produk dapat tampil bersebelahan (2 kolom). Di smartphone, sistem harus bertumpuk (1 kolom) dengan tab/modal transisi yang mulus.
  * **Tabel Responsif (Card-based List):** Jangan gunakan elemen `<table>` standar yang memerlukan geser horizontal pada layar HP. Sebagai gantinya, ubah data tabel (seperti riwayat transaksi atau daftar produk) menjadi komponen kartu (*cards*) yang ringkas dan memanjang ke bawah.
  * **Floating Action Button (FAB):** Sediakan tombol melayang di pojok kanan bawah pada perangkat seluler untuk fungsi cepat yang sering digunakan, seperti **Scan Barcode** atau **Tambah Produk**.

---

## 3. Aturan Lokalisasi & Format Indonesia

Aplikasi harus 100% menggunakan setelan pasar Indonesia agar akrab dengan UMKM lokal:
* **Mata Uang Rupiah:** Seluruh tampilan nominal uang wajib menggunakan format Rupiah (contoh: `Rp 50.000` atau `Rp 1.250.000`), gunakan utilitas format angka global:
  ```javascript
  export const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(angka);
  };
  ```
* **Bahasa Indonesia:** Semua teks menu, label, instruksi tombol, modul bantuan, nama hari/bulan di laporan keuangan harus menggunakan **Bahasa Indonesia yang santun, sederhana, dan mudah dimengerti**.
* **Zona Waktu:** Gunakan waktu lokal perangkat kasir (WIB, WITA, WIT) untuk perekaman transaksi dan laporan harian.

---

## 4. Standar Performa & Keandalan Offline

* **Ukuran Bundel Ringan:** Batasi penggunaan pustaka pihak ketiga. Hanya gunakan pustaka yang sangat diperlukan (`dexie`, `lucide-react`, `html5-qrcode`).
* **Optimasi Kamera Scan Barcode:** Layar kamera scan barcode harus bisa dibuka-tutup secara bersih. Pastikan *stream* kamera langsung dihentikan (*stopped*) saat modul scan ditutup agar tidak menguras daya baterai HP kasir.
* **Pencegahan Kehilangan Data (Zero-Data Loss):** Perekaman transaksi lokal harus bersifat transaksional. Jika penulisan detail transaksi gagal, batalkan seluruh transaksi keranjang tersebut (*rollback*) agar data stok produk dan buku kasbon tidak berantakan.
