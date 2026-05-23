import React, { useState, useMemo } from 'react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../components/Toast';
import { Users, Plus, Edit2, Trash2, Phone, Search, X, Check, Wallet, ShoppingBag } from 'lucide-react';
import { formatRupiah } from '../utils/format';

export default function Pelanggan() {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.toArray()) || [];

  const debtMap = useMemo(() => {
    const map = {};
    debts.forEach(d => {
      if (d.status !== 'Lunas') {
        map[d.customerId] = (map[d.customerId] || 0) + (d.amount - (d.amountPaid || 0));
      }
    });
    return map;
  }, [debts]);

  const totalSpentMap = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      const key = o.customerId || 'umum';
      map[key] = (map[key] || 0) + (o.totalAmount || 0);
    });
    return map;
  }, [orders]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setShowModal(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone || '');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        await db.customers.update(editingId, { name: name.trim(), phone: phone.trim() });
        showToast('Data pelanggan diperbarui', 'success');
      } else {
        await db.customers.add({ name: name.trim(), phone: phone.trim() });
        showToast('Pelanggan baru ditambahkan', 'success');
      }
      setShowModal(false);
    } catch (err) {
      showToast('Gagal menyimpan data pelanggan', 'error');
    }
  };

  const handleDelete = async (id, customerName) => {
    const outstanding = debtMap[id] || 0;
    if (outstanding > 0) {
      if (!confirm(`"${customerName}" masih memiliki hutang ${formatRupiah(outstanding)}. Hapus tetap?`)) return;
    } else {
      if (!confirm(`Hapus pelanggan "${customerName}"?`)) return;
    }
    await db.customers.delete(id);
    showToast('Pelanggan dihapus', 'info');
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pelanggan</h1>
          <p className="page-subtitle">{customers.length} pelanggan terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd} style={{ padding: '0.5rem 1rem' }}>
          <Plus size={16} />
          <span>Tambah</span>
        </button>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Cari nama atau nomor HP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '5rem' }}>
        {filtered.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Users size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
            <p>{searchTerm ? 'Pelanggan tidak ditemukan' : 'Belum ada data pelanggan'}</p>
          </div>
        ) : (
          filtered.map(customer => {
            const debtBalance = debtMap[customer.id] || 0;
            return (
              <div key={customer.id} className="glass-card" style={{ padding: '1rem' }}>
                <div className="flex-between">
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{customer.name}</p>
                    {customer.phone && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} />
                        <span>{customer.phone}</span>
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {debtBalance > 0 && (
                        <p style={{
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--danger-light)',
                          color: 'var(--danger)',
                          fontWeight: 700,
                        }}>
                          <Wallet size={12} />
                          Hutang: {formatRupiah(debtBalance)}
                        </p>
                      )}
                      {debtBalance === 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Tidak ada hutang
                        </p>
                      )}
                      {totalSpentMap[customer.id] > 0 && (
                        <p style={{
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--accent-light)',
                          color: 'var(--accent-color)',
                          fontWeight: 600,
                        }}>
                          <ShoppingBag size={12} />
                          Belanja: {formatRupiah(totalSpentMap[customer.id])}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <button
                      onClick={() => handleOpenEdit(customer)}
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id, customer.name)}
                      className="btn btn-danger"
                      style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content glass-panel" style={{ padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {editingId ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nama Pelanggan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Bu Sari"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">No. HP / WhatsApp</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: 0812-xxxx-xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Check size={16} />
                <span>{editingId ? 'Simpan Perubahan' : 'Tambah Pelanggan'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
