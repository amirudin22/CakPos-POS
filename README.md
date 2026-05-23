<div align="center">
  <h1>CakPos POS</h1>
  <p><strong>Aplikasi Kasir Offline-First untuk UMKM Indonesia</strong></p>
  <p>100% Gratis · Offline · Serverless · Tanpa Biaya Bulanan</p>
</div>

---

## 📱 Fitur

- **Kasir** — Keranjang belanja, scan barcode (native ML Kit), hold/recall cart (max 5), payment Tunai / QRIS dinamis / Kasbon, biaya lain, struk digital (WA teks + gambar)
- **Produk** — CRUD produk, kategori, barcode, harga grosir bertingkat, stok & peringatan stok minim, kompresi gambar produk (Owner only)
- **Pelanggan** — CRUD pelanggan, history belanja, saldo hutang
- **Kasbon** — Buku piutang per pelanggan, cicilan, tagihan via WA
- **Riwayat** — History transaksi, filter, detail + bukti bayar QRIS
- **Laporan** — Omzet, HPP, pengeluaran, laba bersih, best seller (Owner only)
- **Pengaturan** — Profil toko, QRIS string, backup/restore JSON, backup via WhatsApp (file .json), manajemen staf (Owner only)

## 🛠 Stack

| Lapisan | Teknologi |
|---------|-----------|
| Framework | React 18 + Vite 5 |
| Database | Dexie.js (IndexedDB) |
| Native | Capacitor v7 (Android) |
| Scanner | ML Kit Barcode Scanning |
| BLE Print | ESC/POS via Bluetooth LE |
| QRIS | EMV TLV + CRC-16/CCITT-FALSE |
| Style | Vanilla CSS (HSL, glassmorphism) |
| Icons | Lucide React |
| PWA | @vite-pwa/plugin |

## 🚀 Build & Deploy

```bash
npm run dev            # Dev server port 3000
npm run build          # Build web
npm run cap:sync       # Sync Capacitor (after build)
npm run cap:run        # Run on Android device
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## 🤝 Donasi

QRIS donasi tersedia di halaman Tentang dalam aplikasi.

## 📄 Lisensi

MIT — silakan gunakan, modifikasi, dan sebarkan.
