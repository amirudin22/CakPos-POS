# AGENTS.md — CakPos POS (formerly Antigravity POS)

This is a **fully built offline-first POS** for Indonesian UMKM. All 7 phases from `agent.md` are complete. This file documents what exists, architecture decisions, next steps, and conventions.

## Stack & Conventions

- **React 18 + Vite 5** — no Next.js, no Remix
- **Vanilla CSS only** — no TailwindCSS. HSL custom properties in `index.css`. Glassmorphism (`backdrop-filter: blur`) on cards/dialogs.
- **Dexie.js** for IndexedDB — all state in DB tables. `useLiveQuery` from `dexie-react-hooks` for reactive UI.
- **Lucide React** for icons
- **@capacitor-mlkit/barcode-scanning** (native ML Kit) — replaced `html5-qrcode`
- **@capacitor/core + @capacitor/android** — native Android app via Capacitor v7
- **@capacitor-community/bluetooth-le** — ESC/POS Bluetooth printing
- **@capacitor/filesystem + @capacitor/share** — native file export/sharing
- **@capacitor/splash-screen** — native splash screen
- **qrcode** npm package — QRIS QR code generation
- **@vite-pwa/plugin** — PWA/Service Worker
- **No React Router** — navigation is a custom bottom tab bar (state-based)

## Mobile-First Rules

- Bottom tab navigation on screens < 768px (icons: Kasir, Produk, Pelanggan, Kasbon, Riwayat, Laporan, Pengaturan)
- All touch targets >= 48x48px
- No `<table>` elements — card-based list components
- Floating Action Button (FAB) for barcode scan / add product on mobile

## Indonesian Localization

- All UI text in **Bahasa Indonesia**
- Currency: `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })`
- Timezone: local device time (WIB/WITA/WIT)

## Security

- **Username + password** (not email/phone). Password hashed via Web Crypto API SHA-256.
- Two roles: `Owner` (full access) and `Kasir` (cashier-only, no profit/margin visibility)

## Database Schema (Dexie.js)

Database name: `CakPos`

| Table | Key indices |
|-------|-------------|
| `users` | `++id, username, role` |
| `settings` | `key` |
| `products` | `++id, name, barcode, category, *tags` |
| `orders` | `++id, invoiceNumber, customerId, paymentMethod, isSynced, createdAt` |
| `customers` | `++id, name, phone` |
| `debts` | `++id, customerId, orderId, status, dueDate` |
| `expenses` | `++id, category, createdAt` |

## Views (all in `src/views/`)

### Login.jsx
- First-run registration (Owner) or login
- Restore from JSON only visible during first-run registration
- SHA-256 password hashing
- Backup validation key: `"CakPos"`

### Kasir.jsx
- Product grid with category filter, search, barcode scan
- Cart with quantity +/- , remove, hold/recall (max 5 carts)
- Payment: Tunai (cash with change), QRIS (dynamic QR from string only + amount injection + proof of payment upload), Kasbon (debt)
- Biaya Lain (additional fee) input — included in total, shown on receipt
- Customer selection for Kasbon
- Receipt modal: WhatsApp share (wa.me/628xx...), Bluetooth print, digital receipt text
- Saves customerName/customerPhone in order
- FAB for barcode scan on mobile
- QRIS zoom on click (modal fullscreen)
- All alert() calls (12 remaining)

### Produk.jsx
- CRUD products with tiered wholesale pricing (min qty + price)
- Image upload compressed via Canvas (max 400px, JPEG q0.7, limit 200KB after base64)
- Stock tracking, low stock warning
- Owner-only

### Pelanggan.jsx
- CRUD customers with search
- Shows debt balance + total spent per customer
- Uses Toast (converted from alert)

### Kasbon.jsx
- Debt ledger showing all active debts grouped by customer
- Partial payment (cicilan) recording
- WhatsApp share with wa.me/628xx format
- alert() calls remaining (5)

### Riwayat.jsx
- Order history with filters (date, payment method)
- Invoice detail modal
- WhatsApp share with wa.me/628xx format

### Laporan.jsx
- Profit/loss dashboard: Omzet, HPP, Pengeluaran, Laba Bersih
- Expense recording by category
- Best seller product list
- Owner-only
- alert() calls remaining (3)

### Pengaturan.jsx
- Store profile form
- QRIS image upload (static, for preview only — not used in Kasir)
- QRIS string textarea (dynamic QR generation for checkout)
- Staff account management (Owner-only)
- Backup/Restore JSON (native file export via Capacitor Share)
- Supabase sync (BYOD — URL + Anon Key)
- Google Drive backup (BYOD — OAuth Client ID + token)
- Copy SQL button for Supabase pos_backups table
- Contact Us section (WhatsApp + Email)
- About section (freeware license, donation QRIS from /donate-qris.png)
- Logout button
- alert() calls remaining (38)

## Components

### BarcodeScanner.jsx
- Uses `@capacitor-mlkit/barcode-scanning` native full-screen scanner
- Installs Google ML Kit module if needed
- Falls back to image upload if native not available
- Handles scanner cleanup safely (synchronous stop before unmount)

### Navigation.jsx
- Bottom bar (mobile) + Sidebar (desktop/tablet >= 768px)
- Role-based filtering: Produk & Laporan tabs are Owner-only

### ErrorBoundary.jsx
- Class component, catches React errors, shows reload button with error details

### Toast.jsx
- Toast notification system via React Context
- Types: success, error, warning, info
- Auto-dismiss, positioned fixed top-center

## Utils

### db.js — Dexie database initialization
### crypto.js — SHA-256 password hashing
### format.js — formatRupiah, formatDate, generateInvoiceNumber
### qris.js — QRIS TLV parser, CRC-16/CCITT-FALSE, amount injector, QR code image generator
### bluetoothPrinter.js — ESC/POS receipt builder, BLE device discovery, data chunked write

## Build & Deployment

- `npm run dev` — Vite dev server on port 3000
- `npm run build` — Vite production build
- `npm run cap:sync` — `npx cap sync` (needs `npm run build` first)
- `npm run cap:build` — `npm run build && npx cap sync`
- `npm run cap:open` — `npx cap open android`
- `npm run cap:run` — `npx cap run android`
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Next Steps (Priority Order)

- Replace remaining 63 `alert()` calls with Toast (`useToast().showToast`) — highest priority for professional UX
  - Kasir.jsx: 12 calls
  - Pengaturan.jsx: 38 calls
  - Kasbon.jsx: 5 calls
  - BarcodeScanner.jsx: 3 calls
  - Login.jsx: 3 calls
  - Laporan.jsx: 2 calls
- Create `public/` directory for static assets (donate-qris.png needs to be served from there)
- Add product image compression in edit modal (currently only on create)
- Donation QRIS is hardcoded as base64 data URL in About section (resized to max 400px, JPEG q0.7, ~35KB base64)
- Delete old `Kasir` staff test accounts via Pengaturan
- Run `npx cap sync android` after rebuild to update native project
- Deploy PWA to Vercel: `npx vercel --prod`

## Gotchas

- **Camera cleanup**: Scanner stops synchronously in `handleClose()` before calling `onClose()`, not in useEffect cleanup. This fixed `Node.removeChild` DOM error.
- **Transactional writes**: Order save uses `db.transaction('rw', ...)` — if order detail save fails, entire cart rolls back.
- **No Tailwind**: enforced by design. All styling via HSL CSS variables in `index.css` and `rules.md`.
- **`agent.md`** contains the original implementation roadmap (now complete).
- **`rules.md`** contains the design system tokens and coding guidelines (slightly outdated — references html5-qrcode).
- **Capacitor v7** instead of v8 because Node 20 doesn't support v8.
- **BarcodeScanner.scan()** native full-screen used instead of custom UI with `capacitor-barcode-scanner-view`.
- **Backup validation key** is `"CakPos"` (changed from `"AntigravityPOS"`). Old backups from before the rename cannot be restored without modifying the key check.
- **CRC-16/CCITT-FALSE** (poly 0x1021, init 0xFFFF) used for QRIS checksum.
- **Bluetooth LE only** — Classic SPP printers need `cordova-plugin-bluetooth-serial`.
- **Donation QRIS** is served from `public/donate-qris.png` (resized to 300px, JPEG q0.7, ~62KB). Click to zoom. Merchant QRIS string remains flexible via Settings.
- **QRIS payment in Kasir** uses only the QRIS string (not the static image). The string MUST be configured in Settings for dynamic amount injection to work. Static image upload is for preview only.
- **APK build requires JDK 21** (not 17). JDK downloaded to `/tmp/jdk-21.0.11+10`.
