/**
 * Utilitas untuk meng-hash kata sandi menggunakan Web Crypto API (SHA-256).
 * Berjalan sepenuhnya secara lokal dan offline di browser, tanpa library pihak ketiga.
 * 
 * @param {string} password - Kata sandi mentah dari input pengguna
 * @returns {Promise<string>} - Hasil hash representasi heksadesimal 64-karakter
 */
export async function hashPassword(password) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error('Gagal mengamankan kata sandi. Pastikan browser Anda mendukung Web Crypto API.');
  }
}
