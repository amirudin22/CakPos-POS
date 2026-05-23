/**
 * Memformat angka nominal menjadi mata uang Rupiah (IDR).
 * Contoh: 50000 -> Rp 50.000
 * 
 * @param {number} nominal - Angka nominal uang
 * @returns {string} - Teks terformat Rupiah
 */
export const formatRupiah = (nominal) => {
  if (nominal === undefined || nominal === null || isNaN(nominal)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(nominal);
};

/**
 * Memformat objek Date atau string tanggal menjadi format pembacaan Indonesia.
 * Contoh: "2026-05-22T10:48:49.000Z" -> 22 Mei 2026, 17:48
 * 
 * @param {Date|string} dateInput - Objek Date atau string tanggal ISO
 * @returns {string} - Tanggal terformat Indonesia
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

/**
 * Format input angka dengan separator ribuan untuk input form.
 * Contoh: "50000" -> "50.000", "0" -> "0", "" -> ""
 * Hanya menyisakan digit, lalu diformat.
 */
export const formatInputNumber = (raw) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('id-ID');
};

/**
 * Menghasilkan invoice number unik berbasis tanggal & timestamp.
 * Contoh: INV-20260522-104849
 * 
 * @returns {string} - Nomor invoice unik
 */
export const generateInvoiceNumber = () => {
  const d = new Date();
  const dateStr = d.getFullYear().toString() + 
                  (d.getMonth() + 1).toString().padStart(2, '0') + 
                  d.getDate().toString().padStart(2, '0');
  const timeStr = d.getHours().toString().padStart(2, '0') + 
                  d.getMinutes().toString().padStart(2, '0') + 
                  d.getSeconds().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${dateStr}-${timeStr}-${rand}`;
};
