import React, { useState } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../components/Toast';
import { Plus, Search, Edit2, Trash2, Camera, AlertTriangle, ShoppingBag, X, Check, Upload, PackagePlus } from 'lucide-react';
import { formatRupiah, formatInputNumber } from '../utils/format';
import BarcodeScanner from '../components/BarcodeScanner';

export default function Produk() {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockAddQty, setStockAddQty] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(5);
  const [imageData, setImageData] = useState('');

  const [wholesaleRules, setWholesaleRules] = useState([]);
  const [newMinQty, setNewMinQty] = useState('');
  const [newWholesalePrice, setNewWholesalePrice] = useState('');

  const products = useLiveQuery(async () => {
    return await db.products.toArray();
  }) || [];

  const categories = ['Semua', ...new Set(products.map(p => p.category || 'Lainnya'))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product.barcode && product.barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setBarcode('');
    setCategory('Makanan');
    setCostPrice(0);
    setSellingPrice(0);
    setStock(0);
    setMinStock(5);
    setWholesaleRules([]);
    setImageData('');
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingId(product.id);
    setName(product.name);
    setBarcode(product.barcode || '');
    setCategory(product.category || 'Makanan');
    setCostPrice(product.costPrice || 0);
    setSellingPrice(product.sellingPrice || 0);
    setStock(product.stock || 0);
    setMinStock(product.minStock || 5);
    setWholesaleRules(product.wholesaleRules || []);
    setImageData(product.image || '');
    setShowModal(true);
  };

  const handleOpenStockIn = (product) => {
    setStockProduct(product);
    setStockAddQty('');
    setShowStockModal(true);
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    const qty = parseInt(stockAddQty);
    if (isNaN(qty) || qty <= 0) {
      showToast('Masukkan jumlah stok yang valid', 'error');
      return;
    }
    try {
      await db.products.update(stockProduct.id, {
        stock: (stockProduct.stock || 0) + qty
      });
      showToast(`Stok ${stockProduct.name} bertambah ${qty}`, 'success');
      setShowStockModal(false);
    } catch (err) {
      showToast('Gagal menambah stok', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
      try {
        await db.products.delete(id);
        showToast('Produk dihapus', 'info');
      } catch (err) {
        showToast('Gagal menghapus produk', 'error');
      }
    }
  };

  const addWholesaleRule = () => {
    const qty = parseInt(newMinQty);
    const price = parseInt(newWholesalePrice);
    if (isNaN(qty) || isNaN(price) || qty <= 1 || price <= 0) {
      showToast('Masukkan jumlah minimal dan harga grosir yang valid!', 'error');
      return;
    }
    if (wholesaleRules.some(r => r.minQty === qty)) {
      showToast('Aturan untuk kuantitas ini sudah ada!', 'error');
      return;
    }
    setWholesaleRules([...wholesaleRules, { minQty: qty, price }].sort((a, b) => a.minQty - b.minQty));
    setNewMinQty('');
    setNewWholesalePrice('');
  };

  const removeWholesaleRule = (index) => {
    setWholesaleRules(wholesaleRules.filter((_, i) => i !== index));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const MAX = 400;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      if (dataUrl.length > 200 * 1024) {
        showToast('Gagal mengompres gambar, coba pilih foto yang lebih kecil', 'error');
        return;
      }
      setImageData(dataUrl);
    };
    img.onerror = () => showToast('Gagal membaca gambar', 'error');
    img.src = URL.createObjectURL(file);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || costPrice < 0 || sellingPrice <= 0) {
      showToast('Harap isi Nama Produk, Harga Modal dan Harga Jual dengan benar!', 'error');
      return;
    }

    const productData = {
      name,
      barcode: barcode.trim(),
      category,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      stock: Number(stock),
      minStock: Number(minStock),
      wholesaleRules,
      image: imageData || undefined,
    };

    try {
      if (editingId) {
        await db.products.update(editingId, productData);
        showToast('Produk diperbarui', 'success');
      } else {
        await db.products.add(productData);
        showToast('Produk baru ditambahkan', 'success');
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data produk', 'error');
    }
  };

  const handleBarcodeScanned = (code) => {
    setBarcode(code);
    setShowScanner(false);
  };

  return (
    <div className="main-content">
      
      <div className="page-header">
        <div>
          <h1 className="page-title">Katalog Produk</h1>
          <p className="page-subtitle">Kelola daftar barang dagangan, stok, dan harga grosir</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={18} />
          <span>Tambah Produk</span>
        </button>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="glass-panel mb-4" style={{ 
          padding: '1rem', 
          backgroundColor: 'var(--warning-light)', 
          borderLeft: '4px solid var(--warning)',
          borderRadius: 'var(--border-radius-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--warning)', fontWeight: 700 }}>
            <AlertTriangle size={18} />
            <span>Peringatan Stok Menipis ({lowStockProducts.length} Produk)</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Barang berikut sudah hampir habis. Segera siapkan daftar belanja grosir untuk kulakan:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {lowStockProducts.map(p => (
              <span key={p.id} className="badge badge-warning" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {p.name} (Stok: {p.stock})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel mb-4" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Cari nama produk atau ketik barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', webkitOverflowScrolling: 'touch' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="btn"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '20px',
                background: selectedCategory === cat ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                border: selectedCategory === cat ? 'none' : '1px solid var(--border-color)',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding: '3rem 1.5rem', color: 'var(--text-secondary)' }}>
          <ShoppingBag size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p>Belum ada produk terdaftar</p>
          <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Silakan tambah produk baru menggunakan tombol di atas</p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map(product => {
            const isLow = product.stock <= product.minStock;
            return (
              <div key={product.id} className="glass-card product-card" style={{ borderTop: isLow ? '3px solid var(--danger)' : '1px solid var(--border-color)' }}>
                <div>
                  {product.image && (
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <img src={product.image} alt={product.name} style={{ width: '100%', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }} />
                    </div>
                  )}
                  <span className="badge badge-success" style={{ fontSize: '0.65rem', marginBottom: '6px' }}>{product.category}</span>
                  <h4 className="product-name">{product.name}</h4>
                  
                  {product.barcode && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                      Barcode: {product.barcode}
                    </span>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Modal: {formatRupiah(product.costPrice)}
                    </span>
                    <span className="product-price">{formatRupiah(product.sellingPrice)}</span>
                  </div>

                  {product.wholesaleRules && product.wholesaleRules.length > 0 && (
                    <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-color)', display: 'block', marginBottom: '2px' }}>
                        Promo Grosir Aktif:
                      </span>
                      {product.wholesaleRules.map((rule, idx) => (
                        <span key={'rule-' + idx} style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>
                          • Min {rule.minQty} pcs → {formatRupiah(rule.price)}/item
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <div className="flex-between">
                    <span className={`product-stock ${isLow ? 'low' : ''}`} style={{ fontSize: '0.8rem' }}>
                      Stok: {product.stock}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleOpenStockIn(product)}
                        style={{ padding: '0.4rem', borderRadius: '4px', minWidth: '32px', minHeight: '32px', color: 'var(--success)' }}
                        title="Tambah Stok"
                        aria-label="Tambah Stok"
                      >
                        <PackagePlus size={12} />
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleOpenEdit(product)}
                        style={{ padding: '0.4rem', borderRadius: '4px', minWidth: '32px', minHeight: '32px' }}
                        aria-label="Edit Produk"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDelete(product.id)}
                        style={{ padding: '0.4rem', borderRadius: '4px', minWidth: '32px', minHeight: '32px' }}
                        aria-label="Hapus Produk"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {editingId ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowModal(false)}
                style={{ padding: '0.3rem', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              
              {imageData && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <img src={imageData} alt="Preview" style={{ maxWidth: '120px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Foto Produk (Opsional)</label>
                <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  <Upload size={16} />
                  <span>{imageData ? 'Ganti Gambar' : 'Unggah Foto'}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Barang</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Indomie Goreng"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Kode Barcode / SKU (Opsional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Pindai atau ketik barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowScanner(true)}
                    style={{ padding: '0.75rem 1rem' }}
                  >
                    <Camera size={18} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select
                  className="form-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Sembako">Sembako</option>
                  <option value="Rokok">Rokok / Tembakau</option>
                  <option value="Kebutuhan Mandi">Kebutuhan Mandi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Harga Modal (HPP)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="Rp Modal"
                    value={formatInputNumber(costPrice.toString())}
                    onChange={(e) => setCostPrice(Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Jual</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="Rp Jual"
                    value={formatInputNumber(sellingPrice.toString())}
                    onChange={(e) => setSellingPrice(Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Stok Awal</label>
                  <input
                    type="number"
                    className="form-input"
                    value={stock}
                    onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Batas Stok Minimum</label>
                  <input
                    type="number"
                    className="form-input"
                    value={minStock}
                    onChange={(e) => setMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                <span className="form-label" style={{ color: 'var(--accent-color)', fontWeight: 700 }}>Kelola Harga Grosir</span>
                
                {wholesaleRules.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    {wholesaleRules.map((rule, index) => (
                      <div key={'edit-rule-' + index} className="flex-between" style={{ padding: '0.4rem 0.6rem', background: 'var(--bg-primary)', borderRadius: '4px', fontSize: '0.8rem' }}>
                        <span>Beli &ge; <strong>{rule.minQty}</strong> pcs &rarr; <strong>{formatRupiah(rule.price)}</strong> /pcs</span>
                        <button type="button" onClick={() => removeWholesaleRule(index)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}>
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Belum ada diskon grosir bertingkat yang diatur.</p>
                )}

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Min Beli"
                    value={newMinQty}
                    onChange={(e) => setNewMinQty(e.target.value)}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="Harga Satuan"
                    value={formatInputNumber(newWholesalePrice)}
                    onChange={(e) => setNewWholesalePrice(e.target.value.replace(/\D/g, ''))}
                    style={{ flex: 2, fontSize: '0.8rem', padding: '0.5rem' }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={addWholesaleRule} style={{ padding: '0.5rem 0.75rem' }}>
                    <Check size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  Simpan Produk
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {showStockModal && (
        <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
          <div className="modal-content glass-panel" style={{ padding: '1.5rem', maxWidth: '360px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tambah Stok Masuk</h3>
              <button onClick={() => setShowStockModal(false)} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              <strong>{stockProduct?.name}</strong> — Stok saat ini: <strong>{stockProduct?.stock}</strong>
            </p>
            <form onSubmit={handleStockIn}>
              <div className="form-group">
                <label className="form-label">Jumlah Stok Masuk</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Contoh: 50"
                  value={stockAddQty}
                  onChange={(e) => setStockAddQty(e.target.value)}
                  min="1"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <PackagePlus size={16} />
                <span>Konfirmasi Stok Masuk</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner 
          onScanSuccess={handleBarcodeScanned} 
          onClose={() => setShowScanner(false)} 
        />
      )}

    </div>
  );
}
