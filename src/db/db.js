import Dexie from 'dexie';

export const db = new Dexie('CakPos');

// Definisikan struktur tabel database lokal IndexedDB beserta indeksnya
db.version(1).stores({
  users: '++id, username, role',
  settings: 'key',
  products: '++id, name, barcode, category, *tags',
  orders: '++id, invoiceNumber, customerId, paymentMethod, isSynced, createdAt',
  customers: '++id, name, phone',
  debts: '++id, customerId, orderId, status, dueDate',
  expenses: '++id, category, createdAt'
});

// Seed data awal jika database baru dibuat (Optional)
db.on('populate', async () => {
  // Database masih kosong, kita bisa menambahkan kategori dasar di settings nanti
  await db.settings.put({ key: 'store_profile', value: { name: 'Warung UMKM Kita', address: 'Alamat Toko', phone: '-' } });
  await db.settings.put({ key: 'qris_static_image', value: '' });
});
