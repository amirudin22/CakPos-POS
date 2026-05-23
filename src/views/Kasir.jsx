import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ShoppingCart, Search, Camera, CreditCard, ChevronRight, 
  Trash2, Plus, Minus, UserPlus, ArrowRight, Share2, Printer, 
  X, Check, Clock, Bluetooth, Loader2 as Spinner,
  Image
} from 'lucide-react';
import { formatRupiah, generateInvoiceNumber, formatInputNumber } from '../utils/format';
import BarcodeScanner from '../components/BarcodeScanner';
import { requestBluetoothPrinter, printToBluetooth, buildReceiptContent } from '../utils/bluetoothPrinter';
import { setQRISAmount, generateQRISImage } from '../utils/qris';
import { toPng } from 'html-to-image';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Terminal Kasir POS (Fase 4)
 * Bekerja 100% offline, mendukung grosir, hold/recall cart, QRIS, kasbon, dan struk WA
 */
export default function Kasir({ user }) {
  // State Keranjang & Kasir
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [showScanner, setShowScanner] = useState(false);
  
  // State Tahan/Hold Keranjang
  const [heldCarts, setHeldCarts] = useState([]);
  
  // State Pembayaran & Pelanggan
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState('Tunai'); // Tunai, QRIS, Kasbon
  const [amountPaid, setAmountPaid] = useState('');
  const [qrisImage, setQrisImage] = useState('');
  const [qrisString, setQrisString] = useState('');
  const [qrisDynamicQr, setQrisDynamicQr] = useState('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [paymentProof, setPaymentProof] = useState('');
  const [additionalFee, setAdditionalFee] = useState('');
  const [zoomImage, setZoomImage] = useState(null);
  const [dueDate, setDueDate] = useState('');

  // State Hasil Akhir & Cetak Struk
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [storeProfile, setStoreProfile] = useState(null);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);

  // Ambil data produk & pelanggan secara live
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const dbCustomers = useLiveQuery(() => db.customers.toArray()) || [];

  useEffect(() => {
    const loadSettings = async () => {
      const qrisStrSetting = await db.settings.get('qris_string');
      if (qrisStrSetting) setQrisString(qrisStrSetting.value);
      
      const profileSetting = await db.settings.get('store_profile');
      if (profileSetting) setStoreProfile(profileSetting.value);
    };
    loadSettings();
  }, []);

  // Generate QR dinamis saat metode QRIS dipilih
  useEffect(() => {
    if (paymentMethod === 'QRIS' && qrisString) {
      const generate = async () => {
        setIsGeneratingQr(true);
        try {
          const itemTotal = cart.reduce((sum, item) => sum + (item.sellingPrice || 0) * (item.qty || 1), 0);
          const total = itemTotal + Number(additionalFee || 0);
          const qrisWithAmount = setQRISAmount(qrisString, total);
          const dataUrl = await generateQRISImage(qrisWithAmount);
          setQrisDynamicQr(dataUrl || '');
        } catch {
          setQrisDynamicQr('');
        } finally {
          setIsGeneratingQr(false);
        }
      };
      generate();
    } else {
      setQrisDynamicQr('');
    }
  }, [paymentMethod, qrisString, cart, additionalFee]);

  // Filter Kategori
  const categories = ['Semua', ...new Set(products.map(p => p.category))];

  // Cari produk
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // LOGIKA UTAMA: Tambah ke Keranjang
  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert(`Stok produk ${product.name} habis!`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.id === product.id);
    let newCart = [...cart];

    if (existingIndex > -1) {
      const currentQty = newCart[existingIndex].qty;
      if (currentQty + 1 > product.stock) {
        alert(`Tidak dapat membeli melebihi stok yang tersedia (${product.stock} pcs)`);
        return;
      }
      newCart[existingIndex].qty += 1;
    } else {
      newCart.push({
        id: product.id,
        name: product.name,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        basePrice: product.sellingPrice, // Simpan harga normal awal
        wholesaleRules: product.wholesaleRules || [],
        qty: 1,
        maxStock: product.stock
      });
    }

    // Evaluasi aturan harga grosir setelah update kuantitas
    newCart = evaluateWholesalePricing(newCart);
    setCart(newCart);
  };

  // LOGIKA UTAMA: Kurangi Kuantitas Keranjang
  const decreaseQty = (productId) => {
    let newCart = [...cart];
    const index = newCart.findIndex(item => item.id === productId);
    if (index === -1) return;

    if (newCart[index].qty > 1) {
      newCart[index].qty -= 1;
    } else {
      newCart.splice(index, 1);
    }

    newCart = evaluateWholesalePricing(newCart);
    setCart(newCart);
  };

  // Logika pembagian harga grosir dinamis
  const evaluateWholesalePricing = (currentCart) => {
    return currentCart.map(item => {
      let activePrice = item.basePrice;
      
      // Temukan aturan grosir yang kuantitasnya terpenuhi
      if (item.wholesaleRules && item.wholesaleRules.length > 0) {
        const metRules = item.wholesaleRules.filter(rule => item.qty >= rule.minQty);
        if (metRules.length > 0) {
          // Cari diskon harga termurah (paling menguntungkan pembeli)
          const bestPriceRule = metRules.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
          activePrice = bestPriceRule.price;
        }
      }
      
      return {
        ...item,
        sellingPrice: activePrice
      };
    });
  };

  // Hapus item dari keranjang
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  // Hitung total belanjaan
  const getSubtotal = () => {
    return cart.reduce((acc, item) => acc + (item.sellingPrice * item.qty), 0);
  };
  const getTotal = () => {
    return getSubtotal() + Number(additionalFee || 0);
  };

  // Pindai Barcode Sukses
  const handleBarcodeScanned = (code) => {
    const product = products.find(p => p.barcode === code);
    if (product) {
      addToCart(product);
    } else {
      alert(`Produk dengan Barcode "${code}" tidak ditemukan!`);
    }
    setShowScanner(false);
  };

  // LOGIKA TAHAN KERANJANG (Hold Cart)
  const holdCart = () => {
    if (cart.length === 0) return;
    if (heldCarts.length >= 5) {
      alert('Maksimal antrean keranjang yang ditahan adalah 5!');
      return;
    }

    const newHeldCart = {
      id: Date.now(),
      time: new Date(),
      items: cart
    };

    setHeldCarts([...heldCarts, newHeldCart]);
    setCart([]);
    alert('Keranjang belanja berhasil ditahan sementara.');
  };

  // LOGIKA PANGGIL KERANJANG (Recall Cart)
  const recallCart = (heldCartId) => {
    if (cart.length > 0 && !confirm('Keranjang aktif saat ini akan digantikan. Lanjutkan?')) {
      return;
    }
    const target = heldCarts.find(c => c.id === heldCartId);
    if (target) {
      setCart(target.items);
      setHeldCarts(heldCarts.filter(c => c.id !== heldCartId));
    }
  };

  // TAMBAH PELANGGAN BARU KILAT
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName) return;

    try {
      const newId = await db.customers.add({
        name: newCustomerName,
        phone: newCustomerPhone
      });
      setSelectedCustomerId(newId.toString());
      setNewCustomerName('');
      setNewCustomerPhone('');
      setShowAddCustomer(false);
    } catch (err) {
      alert('Gagal menambahkan pelanggan baru.');
    }
  };

  // LOGIKA CHECKOUT & BAYAR (Transactional Rollback Integrasi)
  const handleCheckout = async () => {
    const totalAmount = getTotal();
    
    // Validasi input bayar tunai
    if (paymentMethod === 'Tunai') {
      const cash = parseInt(amountPaid) || 0;
      if (cash < totalAmount) {
        alert('Uang pembayaran tunai kurang!');
        return;
      }
    }

    // Validasi input kasbon wajib pilih pelanggan
    if (paymentMethod === 'Kasbon') {
      if (!selectedCustomerId) {
        alert('Metode KASBON wajib memilih pelanggan/anggota!');
        return;
      }
      if (!dueDate) {
        alert('Harap pilih tanggal jatuh tempo kasbon!');
        return;
      }
    }

    try {
      // Jalankan transaksi Dexie.js terjamin aman & rollback otomatis jika gagal
      await db.transaction('rw', [db.products, db.orders, db.debts], async () => {
        const invoiceNumber = generateInvoiceNumber();
        const dateNow = new Date();

        // 1. Kurangi stok produk secara transaksional
        for (const item of cart) {
          const dbProduct = await db.products.get(item.id);
          if (!dbProduct || dbProduct.stock < item.qty) {
            throw new Error(`Stok produk "${item.name}" tidak mencukupi di database!`);
          }
          await db.products.update(item.id, {
            stock: dbProduct.stock - item.qty
          });
        }

        // 2. Simpan record transaksi ke tabel orders
        const customerObj = dbCustomers.find(c => c.id === Number(selectedCustomerId));
        const orderId = await db.orders.add({
          invoiceNumber,
          customerId: selectedCustomerId ? Number(selectedCustomerId) : null,
          customerName: customerObj ? customerObj.name : 'Pelanggan Umum',
          customerPhone: customerObj ? customerObj.phone : '',
          items: cart.map(i => ({
            id: i.id,
            name: i.name,
            costPrice: i.costPrice,
            sellingPrice: i.sellingPrice,
            qty: i.qty
          })),
          subtotal: getSubtotal(),
          additionalFee: Number(additionalFee || 0),
          totalAmount,
          amountPaid: paymentMethod === 'Tunai' ? Number(amountPaid) : (paymentMethod === 'QRIS' ? totalAmount : 0),
          paymentMethod,
          paymentProof: paymentMethod === 'QRIS' ? (paymentProof || '') : '',
          isSynced: false,
          createdAt: dateNow
        });

        // 3. Catat di Buku Hutang jika metode bayar Kasbon
        if (paymentMethod === 'Kasbon') {
          await db.debts.add({
            customerId: Number(selectedCustomerId),
            orderId: orderId,
            amount: totalAmount,
            amountPaid: 0,
            status: 'Belum Lunas',
            dueDate: new Date(dueDate),
            createdAt: dateNow
          });
        }

        // Simpan data order sukses ke state struk
        setCompletedOrder({
          invoiceNumber,
          createdAt: dateNow,
          items: cart,
          subtotal: getSubtotal(),
          additionalFee: Number(additionalFee || 0),
          totalAmount,
          paymentMethod,
          amountPaid: paymentMethod === 'Tunai' ? Number(amountPaid) : totalAmount,
          customerName: customerObj ? customerObj.name : 'Pelanggan Umum',
          customerPhone: customerObj ? customerObj.phone : '',
          paymentProof: paymentMethod === 'QRIS' ? (paymentProof || '') : ''
        });
      });

      // Sukses checkout
      setCart([]);
      setAmountPaid('');
      setAdditionalFee('');
      setSelectedCustomerId('');
      setDueDate('');
      setPaymentProof('');
      setShowPaymentModal(false);
      setShowReceiptModal(true);

    } catch (error) {
      console.error(error);
      alert(`Transaksi gagal: ${error.message}`);
    }
  };

  // LAYOUT STRUK DIGITAL WHATSAPP
  const handleShareWhatsApp = () => {
    if (!completedOrder) return;
    
    const storeName = storeProfile?.name || 'Warung Kita';
    const storePhone = storeProfile?.phone || '-';
    let text = `*${storeName.toUpperCase()}*\n`;
    text += `Telp: ${storePhone}\n`;
    text += `--------------------------------\n`;
    text += `No: ${completedOrder.invoiceNumber}\n`;
    text += `Tgl: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(completedOrder.createdAt)}\n`;
    text += `Pelanggan: ${completedOrder.customerName}\n`;
    text += `--------------------------------\n`;
    
    completedOrder.items.forEach(item => {
      text += `${item.name}\n`;
      text += `  ${item.qty} x ${formatRupiah(item.sellingPrice)} = ${formatRupiah(item.sellingPrice * item.qty)}\n`;
    });
    
    if (completedOrder.additionalFee) {
      text += `Biaya Lain: ${formatRupiah(completedOrder.additionalFee)}\n`;
    }
    text += `--------------------------------\n`;
    text += `*TOTAL: ${formatRupiah(completedOrder.totalAmount)}*\n`;
    text += `Bayar: ${formatRupiah(completedOrder.amountPaid)}\n`;
    
    if (completedOrder.paymentMethod === 'Tunai') {
      const change = completedOrder.amountPaid - completedOrder.totalAmount;
      text += `Kembalian: ${formatRupiah(Math.max(0, change))}\n`;
    }
    
    text += `Metode: ${completedOrder.paymentMethod}\n`;
    text += `--------------------------------\n`;
    text += `*Terima kasih atas kunjungan Anda!*\n`;
    text += `Struk digital ini sah dikirim otomatis.`;

    const encodedText = encodeURIComponent(text);
    const phone = completedOrder.customerPhone;
    const cleaned = phone ? phone.replace(/[^0-9]/g, '') : '';
    const intlPhone = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    const waUrl = intlPhone
      ? `https://wa.me/${intlPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;
    
    window.open(waUrl, '_blank');
  };

  // PRINT STRUK THERMAL LAYOUT BROWSER PRINT API
  const handlePrintReceipt = () => {
    window.print();
  };

  // GENERATE NOTA SEBAGAI GAMBAR + SIMPAN KE SHARED FOLDER
  const handleSaveReceiptImage = async () => {
    if (!completedOrder) return;
    try {
      const node = document.getElementById('thermal-receipt-view');
      if (!node) return;

      const dataUrl = await toPng(node, { quality: 0.95, pixelRatio: 2 });
      const base64 = dataUrl.split(',')[1];
      const fileName = `nota-${completedOrder.invoiceNumber || 'struk'}.png`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });

      alert(`Nota tersimpan di folder Documents/${fileName}`);
    } catch (err) {
      console.error('Gagal menyimpan nota:', err);
      alert('Gagal menyimpan nota.');
    }
  };

  const handleBluetoothPrint = async () => {
    if (!completedOrder) return;
    setIsBluetoothPrinting(true);
    try {
      const device = await requestBluetoothPrinter();
      const data = buildReceiptContent(
        completedOrder,
        storeProfile?.storeName || 'Toko Anda',
        storeProfile?.storeAddress || ''
      );
      await printToBluetooth(device.deviceId, data);
      alert('Struk berhasil dicetak ke printer Bluetooth!');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const subtotal = getSubtotal();

  return (
    <div className="main-content">
      
      {/* HEADER KASIR */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">Mesin Kasir</h1>
          <p className="page-subtitle">Pindai atau pilih produk belanjaan pelanggan</p>
        </div>
        
        {/* Antrean Ditahan (Hold / Recall Button) */}
        {heldCarts.length > 0 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {heldCarts.map((hc, idx) => (
              <button 
                key={hc.id} 
                className="btn btn-secondary" 
                onClick={() => recallCart(hc.id)}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem', display: 'flex', gap: '4px', alignItems: 'center', borderColor: 'var(--warning)', color: 'var(--warning)' }}
              >
                <Clock size={12} />
                <span>Recall {idx + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* POS LAYOUT (1 Kolom Mobile, 2 Kolom Tablet/Desktop) */}
      <div className="pos-layout">
        
        {/* KOLOM 1: Katalog & Pilihan Produk */}
        <div>
          {/* Bar pencarian & scan tombol melayang */}
          <div className="glass-panel mb-4" style={{ padding: '0.75rem', display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Cari produk / scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingTop: '0.6rem', paddingBottom: '0.6rem' }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setShowScanner(true)} style={{ padding: '0.6rem' }}>
              <Camera size={18} />
            </button>
          </div>

          {/* Kategori Horizontal Scrollbar */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', webkitOverflowScrolling: 'touch', marginBottom: '12px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="btn"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '20px',
                  background: selectedCategory === cat ? 'var(--accent-color)' : 'var(--bg-secondary)',
                  color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                  border: selectedCategory === cat ? 'none' : '1px solid var(--border-color)',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat || 'Lainnya'}
              </button>
            ))}
          </div>

          {/* Grid produk yang mudah disentuh */}
          <div className="product-grid" style={{ maxHeight: 'calc(100vh - 290px)', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredProducts.map(product => (
              <button 
                key={product.id}
                className="glass-card product-card" 
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                style={{ 
                  textAlign: 'left', 
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  opacity: product.stock <= 0 ? 0.6 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <h4 className="product-name" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{product.name}</h4>
                  <span className="product-price" style={{ fontSize: '0.85rem' }}>{formatRupiah(product.sellingPrice)}</span>
                </div>
                <span className={`product-stock ${product.stock <= product.minStock ? 'low' : ''}`} style={{ fontSize: '0.7rem', display: 'block', marginTop: '6px' }}>
                  Stok: {product.stock}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* KOLOM 2: Keranjang Belanja Dinamis & Tombol Bayar */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          <div className="flex-between mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
              <ShoppingCart size={18} className="text-primary" />
              <span>Keranjang ({cart.reduce((a, b) => a + b.qty, 0)} item)</span>
            </h3>
            {cart.length > 0 && (
              <button className="btn btn-secondary" onClick={holdCart} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                Tahan
              </button>
            )}
          </div>

          {/* List item di keranjang */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', marginBottom: '1.25rem' }}>
            {cart.length === 0 ? (
              <div className="text-center" style={{ padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                <ShoppingCart size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: '0.8rem' }}>Keranjang masih kosong</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cart.map(item => (
                  <div key={item.id} className="flex-between" style={{ paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block' }}>{item.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 700 }}>
                        {formatRupiah(item.sellingPrice)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => decreaseQty(item.id)}
                        aria-label="Kurangi jumlah"
                        style={{ border: 'none', background: 'var(--bg-primary)', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                        {item.qty}
                      </span>
                      <button 
                        onClick={() => addToCart({ id: item.id, name: item.name, stock: item.maxStock })}
                        aria-label="Tambah jumlah"
                        style={{ border: 'none', background: 'var(--bg-primary)', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Plus size={12} />
                      </button>
                      
                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        aria-label="Hapus item"
                        style={{ border: 'none', background: 'transparent', color: 'var(--danger)', padding: '4px', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtotal & Tombol Bayar */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div className="flex-between mb-4">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Belanja</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                {formatRupiah(subtotal)}
              </span>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <span>Bayar Transaksi</span>
              <ArrowRight size={18} />
            </button>
          </div>

        </div>

      </div>

      {/* MODAL PEMBAYARAN */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxHeight: '92vh', overflowY: 'auto', padding: '1.25rem' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Pilih Metode Pembayaran</h3>
              <button className="btn btn-secondary" onClick={() => { setShowPaymentModal(false); setPaymentProof(''); }} style={{ padding: '0.3rem', borderRadius: '50%' }}>
                <X size={16} />
              </button>
            </div>

            {/* Bagian Total Harga */}
            <div style={{ padding: '0.75rem', background: 'var(--accent-light)', borderRadius: 'var(--border-radius-sm)', textAlign: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total yang Harus Dibayar:</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-color)' }}>{formatRupiah(subtotal)}</h2>
            </div>

            {/* PILIH PELANGGAN (Untuk Kasbon Pelanggan) */}
            <div className="form-group">
              <div className="flex-between mb-2">
                <label className="form-label" style={{ margin: 0 }}>Nama Pelanggan / Anggota (Opsional)</label>
                <button 
                  type="button" 
                  onClick={() => setShowAddCustomer(!showAddCustomer)} 
                  style={{ border: 'none', background: 'transparent', color: 'var(--accent-color)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <UserPlus size={12} />
                  <span>Tambah Cepat</span>
                </button>
              </div>

              {/* Form Tambah Pelanggan Kilat */}
              {showAddCustomer && (
                <div className="glass-panel p-3 mb-2" style={{ padding: '0.75rem', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Nama Pelanggan" 
                      value={newCustomerName} 
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="No HP WA (62...)" 
                      value={newCustomerPhone} 
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    />
                    <button type="button" className="btn btn-primary" onClick={handleCreateCustomer} style={{ padding: '0.4rem 0.6rem' }}>
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              )}

              <select
                className="form-input"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">-- Umum / Tanpa Nama --</option>
                {dbCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </select>
            </div>

            {/* TAB METODE PEMBAYARAN */}
            <div className="form-group">
              <label className="form-label">Metode Pembayaran</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {['Tunai', 'QRIS', 'Kasbon'].map(method => (
                  <button
                    key={method}
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPaymentMethod(method);
                      setAmountPaid('');
                    }}
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.8rem',
                      borderRadius: 'var(--border-radius-sm)',
                      background: paymentMethod === method ? 'var(--accent-color)' : 'var(--bg-secondary)',
                      color: paymentMethod === method ? 'white' : 'var(--text-secondary)',
                      border: paymentMethod === method ? 'none' : '1px solid var(--border-color)'
                    }}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* BIAYA LAIN (Service/Lainnya) */}
            <div className="form-group" style={{ animation: 'fadeIn var(--transition-fast)' }}>
              <label className="form-label">Biaya Lain <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(jasa service, dll)</span></label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                placeholder="0"
                value={formatInputNumber(additionalFee)}
                onChange={(e) => setAdditionalFee(e.target.value.replace(/\D/g, ''))}
                style={{ fontSize: '0.95rem', fontWeight: 600 }}
              />
            </div>

            {/* TOTAL */}
            <div className="flex-between" style={{ marginBottom: '1rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Total Tagihan:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-color)' }}>{formatRupiah(getTotal())}</span>
            </div>

            {/* DYNAMIC FORM BAGIAN PEMBAYARAN */}
            {paymentMethod === 'Tunai' && (
              <div className="form-group" style={{ animation: 'fadeIn var(--transition-fast)' }}>
                <label className="form-label">Uang Diterima (Tunai)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="Rp Nominal Diterima"
                    value={formatInputNumber(amountPaid)}
                    onChange={(e) => setAmountPaid(e.target.value.replace(/\D/g, ''))}
                    style={{ fontSize: '1.1rem', fontWeight: 700 }}
                    required
                    autoFocus
                  />
                
                {/* Kalkulator Cepat Pecahan Rupiah */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '10px' }}>
                  {[getTotal(), 5000, 10000, 20000, 50000, 100000].map(cashVal => (
                    <button
                      key={cashVal}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAmountPaid(cashVal.toString())}
                      style={{ padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      {cashVal === getTotal() ? 'Uang Pas' : formatRupiah(cashVal)}
                    </button>
                  ))}
                </div>

                {/* Kembalian */}
                {parseInt(amountPaid) >= getTotal() && (
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>
                    <span>Uang Kembalian:</span>
                    <span>{formatRupiah(parseInt(amountPaid) - getTotal())}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div className="form-group text-center" style={{ animation: 'fadeIn var(--transition-fast)' }}>
                <label className="form-label" style={{ textAlign: 'left' }}>Pembayaran QRIS</label>
                
                {isGeneratingQr ? (
                  <div className="glass-panel" style={{ padding: '2rem', marginTop: '8px' }}>
                    <Spinner size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-color)' }} />
                    <p style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-secondary)' }}>Mengenerate kode QR...</p>
                  </div>
                ) : qrisDynamicQr ? (
                  <div style={{ padding: '10px', background: 'white', display: 'inline-block', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '8px', cursor: 'pointer' }}>
                    <img src={qrisDynamicQr} alt="QRIS Dinamis" onClick={() => setZoomImage(qrisDynamicQr)} style={{ maxWidth: '200px', maxHeight: '200px', display: 'block' }} />
                  </div>
                ) : (
                  <div className="glass-panel" style={{ padding: '1.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '8px' }}>
                    <p>QRIS string belum dikonfigurasi.</p>
                    <p style={{ fontSize: '0.7rem', marginTop: '4px' }}>Silakan atur QRIS string di menu Pengaturan agar nominal otomatis termasuk dalam QR.</p>
                  </div>
                )}
                
                <p style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '10px', color: 'var(--accent-color)' }}>
                  Nominal: {formatRupiah(getTotal())}
                </p>
                {qrisDynamicQr && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Jumlah sudah termasuk dalam QR • Klik QR untuk memperbesar
                  </p>
                )}

                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <label className="form-label" style={{ textAlign: 'left', fontSize: '0.8rem' }}>
                    Upload Bukti Bayar <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(foto struk transfer)</span>
                  </label>
                  {paymentProof ? (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ padding: '6px', background: 'white', display: 'inline-block', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <img src={paymentProof} alt="Bukti Bayar" style={{ maxWidth: '160px', maxHeight: '160px', display: 'block', borderRadius: '4px' }} />
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setPaymentProof('')}
                        style={{ marginTop: '6px', padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                      >
                        <Trash2 size={12} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="payment-proof-input"
                      className="btn btn-secondary"
                      style={{
                        width: '100%', cursor: 'pointer', marginTop: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.6rem'
                      }}
                    >
                      <Image size={16} />
                      <span>Pilih Foto / Screenshot Bukti Bayar</span>
                    </label>
                  )}
                  <input
                    id="payment-proof-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => setPaymentProof(reader.result);
                      reader.readAsDataURL(file);
                    }}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'Kasbon' && (
              <div className="form-group" style={{ animation: 'fadeIn var(--transition-fast)' }}>
                <label className="form-label">Tanggal Jatuh Tempo Kasbon</label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
                
                <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '10px', fontWeight: 600 }}>
                  * Transaksi akan dicatat sebagai piutang toko atas nama pelanggan yang dipilih.
                </p>
              </div>
            )}

            {/* Tombol Simpan Checkout */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowPaymentModal(false); setPaymentProof(''); }}>
                Batal
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 2 }} 
                onClick={handleCheckout}
                disabled={paymentMethod === 'Tunai' && (parseInt(amountPaid) < getTotal() || !amountPaid)}
              >
                Proses Selesai
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL STRUK DIGITAL (Fase 4 Receipt View) */}
      {showReceiptModal && completedOrder && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: '1.25rem', maxHeight: '95vh', overflowY: 'auto' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Transaksi Sukses!</h3>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowReceiptModal(false)}
                style={{ padding: '0.3rem', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* LAYOUT STRUK FISIK (Bisa dicetak / disalin) */}
            <div 
              id="thermal-receipt-view"
              style={{
                background: '#fff',
                color: '#000',
                padding: '20px 15px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                lineHeight: '1.4',
                userSelect: 'text'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{storeProfile?.name || 'KASIR KITA'}</h4>
                <p style={{ margin: '2px 0 0', fontSize: '10px' }}>{storeProfile?.address || 'Alamat Toko'}</p>
                <p style={{ margin: '2px 0 0', fontSize: '10px' }}>Telp: {storeProfile?.phone || '-'}</p>
              </div>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', marginBottom: '6px' }}>
                <p style={{ margin: 0 }}>No: {completedOrder.invoiceNumber}</p>
                <p style={{ margin: 0 }}>Tgl: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(completedOrder.createdAt)}</p>
                <p style={{ margin: 0 }}>Kasir: {user?.username}</p>
                <p style={{ margin: 0 }}>Plg: {completedOrder.customerName}</p>
              </div>

              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: '6px' }}>
                {completedOrder.items.map((item, idx) => (
                  <div key={item.id + '-' + idx} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10px' }}>
                      <span>{item.qty} x {formatRupiah(item.sellingPrice)}</span>
                      <span>{formatRupiah(item.sellingPrice * item.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>{formatRupiah(completedOrder.subtotal || completedOrder.totalAmount)}</span>
              </div>
              {completedOrder.additionalFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Biaya Lain:</span>
                  <span>{formatRupiah(completedOrder.additionalFee)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
                <span>TOTAL:</span>
                <span>{formatRupiah(completedOrder.totalAmount)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Bayar ({completedOrder.paymentMethod}):</span>
                <span>{formatRupiah(completedOrder.amountPaid)}</span>
              </div>

              {completedOrder.paymentMethod === 'Tunai' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kembalian:</span>
                  <span>{formatRupiah(Math.max(0, completedOrder.amountPaid - completedOrder.totalAmount))}</span>
                </div>
              )}

              <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px', textAlign: 'center', fontSize: '10px' }}>
                <p style={{ margin: 0 }}>* Terima Kasih Banyak *</p>
                <p style={{ margin: 0 }}>Selamat Belanja Kembali!</p>
              </div>
            </div>

            {/* PANEL TOMBOL TRANSFER STRUK */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handlePrintReceipt}
                style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
              >
                <Printer size={16} />
                <span>Cetak</span>
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleBluetoothPrint}
                disabled={isBluetoothPrinting}
                style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
              >
                {isBluetoothPrinting ? <Spinner size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Bluetooth size={16} />}
                <span>{isBluetoothPrinting ? 'Cetak...' : 'BT'}</span>
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleSaveReceiptImage}
                style={{ flex: 1.5, padding: '0.6rem', fontSize: '0.85rem' }}
              >
                <Share2 size={16} />
                <span>Simpan Nota</span>
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleShareWhatsApp}
                style={{ flex: 1.5, padding: '0.6rem', fontSize: '0.85rem' }}
              >
                <Share2 size={16} />
                <span>WA Teks</span>
              </button>
            </div>
            
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={() => setShowReceiptModal(false)}
              style={{ width: '100%', marginTop: '8px', padding: '0.6rem' }}
            >
              Kembali ke Kasir
            </button>
          </div>
        </div>
      )}

      {zoomImage && (
        <div
          className="modal-overlay"
          onClick={() => setZoomImage(null)}
          style={{ cursor: 'zoom-out', zIndex: 9999 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              maxWidth: '90vw',
              maxHeight: '90vh',
            }}
          >
            <img
              src={zoomImage}
              alt="QRIS"
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}
            />
          </div>
        </div>
      )}

      {/* SCANNER OVERLAY */}
      {showScanner && (
        <BarcodeScanner 
          onScanSuccess={handleBarcodeScanned} 
          onClose={() => setShowScanner(false)} 
        />
      )}

    </div>
  );
}
