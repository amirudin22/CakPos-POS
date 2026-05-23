import React, { useEffect, useRef, useState } from 'react';
import { BarcodeScanner as MLKitScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { X, Camera, Image, AlertCircle, Smartphone } from 'lucide-react';

export default function BarcodeScanner({ onScanSuccess, onClose }) {
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState(null);
  const [isNative, setIsNative] = useState(true);
  const [installingModule, setInstallingModule] = useState(false);

  onScanSuccessRef.current = onScanSuccess;
  onCloseRef.current = onClose;

  useEffect(() => {
    startNativeScan();
  }, []);

  const startNativeScan = async () => {
    try {
      setInstallingModule(true);

      const supported = await MLKitScanner.isSupported();
      if (!supported.supported) {
        setError('Perangkat tidak mendukung pemindaian barcode');
        setIsNative(false);
        return;
      }

      let available = await MLKitScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available.available) {
        let listenerHandle;
        try {
          listenerHandle = await MLKitScanner.addListener('googleBarcodeScannerModuleInstallProgress', () => {});
          await MLKitScanner.installGoogleBarcodeScannerModule();
        } finally {
          if (listenerHandle) {
            listenerHandle.remove();
          }
        }
      }

      setInstallingModule(false);

      const result = await MLKitScanner.scan({
        formats: [
          BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.Code128,
          BarcodeFormat.Code39, BarcodeFormat.Code93, BarcodeFormat.Itf,
          BarcodeFormat.UpcA, BarcodeFormat.UpcE, BarcodeFormat.QrCode,
          BarcodeFormat.DataMatrix, BarcodeFormat.Pdf417, BarcodeFormat.Aztec,
          BarcodeFormat.Codabar
        ],
        autoZoom: true,
      });

      if (result.barcodes.length > 0) {
        const value = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
        onScanSuccessRef.current(value);
      }
      onCloseRef.current();
    } catch (err) {
      console.warn('Native scanner gagal, fallback ke upload foto:', err);
      setIsNative(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { BarcodeScanner: MLKitScanner } = await import('@capacitor-mlkit/barcode-scanning');
      const reader = new FileReader();
      reader.onload = async () => {
        const blob = new Blob([reader.result], { type: file.type });
        try {
          const result = await MLKitScanner.readBarcodesFromImage({ blob });
          if (result.barcodes.length > 0) {
            onScanSuccessRef.current(result.barcodes[0].rawValue || result.barcodes[0].displayValue);
            onCloseRef.current();
          } else {
            alert('Tidak ada barcode terdeteksi pada gambar tersebut.');
          }
        } catch (err) {
          alert('Gagal membaca barcode dari gambar: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert('Gagal mengakses native barcode scanner: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxHeight: '92vh', overflowY: 'auto', padding: '1.25rem' }}>

        <div className="flex-between mb-4">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <Camera size={20} className="text-primary" />
            <span>Pindai Barcode Produk</span>
          </h3>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{
              padding: '0.4rem',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {isNative ? (
          <div className="glass-panel" style={{
            padding: '1.5rem',
            textAlign: 'center',
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: '1rem'
          }}>
            <Smartphone size={48} className="text-primary" style={{ marginBottom: '12px', opacity: 0.6 }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>
              {installingModule ? 'Mempersiapkan pemindai...' : 'Membuka pemindai bawaan HP...'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              {installingModule
                ? 'Mengunduh modul pemindai Google. Harap tunggu...'
                : 'Pemindai bawaan HP akan muncul. Arahkan kamera ke barcode produk.'}
            </p>
          </div>
        ) : (
          <>
            <div className="glass-panel" style={{
              padding: '0.85rem',
              backgroundColor: 'var(--warning-light)',
              borderLeft: '4px solid var(--warning)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.8rem',
              animation: 'fadeIn var(--transition-fast)',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--warning)', fontWeight: 700, marginBottom: '6px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Pemindai native tidak tersedia</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                Gunakan tombol jepret foto di bawah untuk memindai barcode.
              </p>
            </div>

            <label htmlFor="barcode-photo-input" className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '0.75rem' }}>
              <Image size={18} className="text-primary" />
              <span>Jepret / Unggah Foto Barcode</span>
            </label>
            <input
              id="barcode-photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </>
        )}

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '12px', lineHeight: 1.3 }}>
          {isNative
            ? 'Jika pemindai tidak muncul otomatis, gunakan tombol jepret foto.'
            : 'Arahkan kamera ke barcode produk dan ambil foto.'}
        </p>
      </div>
    </div>
  );
}
