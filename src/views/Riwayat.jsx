import React, { useState } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../components/Toast';
import { Search, X, ChevronRight, RotateCcw, ShoppingCart, User, CreditCard, Clock, Printer, Share2 } from 'lucide-react';
import { formatRupiah, formatDate } from '../utils/format';

export default function Riwayat({ user }) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);

  const orders = useLiveQuery(() =>
    db.orders.orderBy('createdAt').reverse().toArray()
  ) || [];

  const filtered = orders.filter(o =>
    o.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVoidOrder = async (order) => {
    if (!confirm(`Batalkan transaksi ${order.invoiceNumber}? Stok akan dikembalikan.`)) return;

    try {
      await db.transaction('rw', [db.orders, db.products, db.debts], async () => {
        // Kembalikan stok
        for (const item of order.items) {
          const product = await db.products.get(item.id);
          if (product) {
            await db.products.update(item.id, {
              stock: (product.stock || 0) + item.qty
            });
          }
        }

        // Hapus hutang terkait jika ada
        const debts = await db.debts.where('orderId').equals(order.id).toArray();
        for (const debt of debts) {
          await db.debts.delete(debt.id);
        }

        // Hapus pesanan
        await db.orders.delete(order.id);
      });

      showToast(`Transaksi ${order.invoiceNumber} berhasil dibatalkan`, 'warning');
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      showToast('Gagal membatalkan transaksi', 'error');
    }
  };

  const handleShareReceipt = (order) => {
    const customer = order.customerName ? `\nPelanggan: ${order.customerName}` : '';
    const items = order.items.map(i =>
      `  ${i.name} x${i.qty} = ${formatRupiah(i.sellingPrice * i.qty)}`
    ).join('\n');
    let msg = `🛒 *STRUK BELANJA*\n${order.invoiceNumber}\n${formatDate(order.createdAt)}${customer}\n\n${items}\n`;
    if (order.additionalFee > 0) {
      msg += `Biaya Lain: ${formatRupiah(order.additionalFee)}\n`;
    }
    msg += `\nTotal: ${formatRupiah(order.totalAmount)}\nBayar: ${formatRupiah(order.amountPaid || 0)}\nKembali: ${formatRupiah(Math.max(0, (order.amountPaid || 0) - order.totalAmount))}\n\nTerima kasih!`;

    const phone = order.customerPhone;
    const cleaned = phone ? phone.replace(/[^0-9]/g, '') : '';
    const intlPhone = cleaned.startsWith('0') ? '62' + cleaned.slice(1) : cleaned;
    const url = intlPhone
      ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Riwayat Transaksi</h1>
          <p className="page-subtitle">{orders.length} transaksi tercatat</p>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Cari invoice atau nama pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '5rem' }}>
        {filtered.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ShoppingCart size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
            <p>{searchTerm ? 'Transaksi tidak ditemukan' : 'Belum ada transaksi'}</p>
          </div>
        ) : (
          filtered.map(order => (
            <div
              key={order.id}
              className="glass-card"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex-between" style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{order.invoiceNumber}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  {formatDate(order.createdAt)}
                </span>
              </div>
              <div className="flex-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {order.customerName ? (
                    <><User size={12} /><span>{order.customerName}</span></>
                  ) : (
                    <span>Umum</span>
                  )}
                  <CreditCard size={12} />
                  <span>{order.paymentMethod}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--accent-color)' }}>
                    {formatRupiah(order.totalAmount)}
                  </strong>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content glass-panel" style={{ padding: '1.5rem', maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Detail Transaksi</h3>
              <button onClick={() => setSelectedOrder(null)} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              <p><strong>Invoice:</strong> {selectedOrder.invoiceNumber}</p>
              <p><strong>Tanggal:</strong> {formatDate(selectedOrder.createdAt)}</p>
              <p><strong>Pelanggan:</strong> {selectedOrder.customerName || 'Umum'}</p>
              <p><strong>Pembayaran:</strong> {selectedOrder.paymentMethod}</p>
              {selectedOrder.paymentProof && (
                <div style={{ marginTop: '8px' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Bukti Pembayaran:</p>
                  <img
                    src={selectedOrder.paymentProof}
                    alt="Bukti Pembayaran QRIS"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'var(--bg-secondary)' }}
                    onClick={() => setZoomImage(selectedOrder.paymentProof)}
                  />
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 0', marginBottom: '1rem' }}>
              {(selectedOrder.items || []).map((item, idx) => (
                <div key={idx} className="flex-between" style={{ fontSize: '0.8rem', padding: '4px 0' }}>
                  <span>{item.name} <strong>x{item.qty}</strong></span>
                  <span>{formatRupiah(item.sellingPrice * item.qty)}</span>
                </div>
              ))}
            </div>

            <div className="flex-between" style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem' }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent-color)' }}>{formatRupiah(selectedOrder.totalAmount)}</span>
            </div>

            {selectedOrder.amountPaid > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                <div className="flex-between"><span>Dibayar</span><span>{formatRupiah(selectedOrder.amountPaid)}</span></div>
                <div className="flex-between"><span>Kembali</span><span>{formatRupiah(Math.max(0, selectedOrder.amountPaid - selectedOrder.totalAmount))}</span></div>
              </div>
            )}

            {selectedOrder.additionalFee > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                <div className="flex-between"><span>Biaya Lain</span><span>{formatRupiah(selectedOrder.additionalFee)}</span></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleShareReceipt(selectedOrder)}>
                <Share2 size={14} />
                <span>WA</span>
              </button>
              {user?.role === 'Owner' && (
                <button className="btn btn-danger" style={{ flex: 2 }} onClick={() => handleVoidOrder(selectedOrder)}>
                  <RotateCcw size={14} />
                  <span>Batalkan Transaksi</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {zoomImage && (
        <div className="modal-overlay" onClick={() => setZoomImage(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <img
            src={zoomImage}
            alt="Bukti Pembayaran"
            style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}
    </div>
  );
}
