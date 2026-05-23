import { BluetoothLe } from '@capacitor-community/bluetooth-le';

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';

function textEncoder() {
  return new TextEncoder();
}

function escposBytes(data) {
  if (typeof data === 'string') {
    return textEncoder().encode(data);
  }
  return new Uint8Array(data);
}

function escposText(text) {
  return escposBytes(text);
}

function escposCommand(...bytes) {
  return new Uint8Array(bytes);
}

function escposNewLine() {
  return new Uint8Array([LF]);
}

function escposBold(enable) {
  return escposCommand(ESC, 0x45, enable ? 0x01 : 0x00);
}

function escposFontSize(width, height) {
  return escposCommand(GS, 0x21, ((height - 1) << 4) | (width - 1));
}

function escposAlign(align) {
  const modes = { left: 0x00, center: 0x01, right: 0x02 };
  return escposCommand(ESC, 0x61, modes[align] || 0x00);
}

function escposCut() {
  return escposCommand(GS, 0x56, 0x00);
}

function escposLineFeed(n = 3) {
  return escposCommand(ESC, 0x64, n);
}

export function buildReceiptContent(order, storeName = 'Toko Anda', storeAddress = '') {
  const line = '================================';
  const thin = '--------------------------------';
  const price = (amount) => 'Rp ' + (amount || 0).toLocaleString('id-ID');
  const dateFormatted = order.createdAt
    ? new Date(order.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    : new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const parts = [];

  parts.push(escposAlign('center'));
  parts.push(escposBold(true));
  parts.push(escposFontSize(2, 2));
  parts.push(escposText(storeName + '\n'));
  parts.push(escposFontSize(1, 1));
  parts.push(escposBold(false));

  if (storeAddress) {
    parts.push(escposText(storeAddress + '\n'));
  }

  parts.push(escposText(line + '\n'));
  parts.push(escposText('No. Invoice: ' + (order.invoiceNumber || '') + '\n'));
  parts.push(escposText('Tanggal: ' + dateFormatted + '\n'));
  if (order.customerName) {
    parts.push(escposText('Pelanggan: ' + order.customerName + '\n'));
  }
  parts.push(escposText(line + '\n\n'));

  parts.push(escposAlign('left'));

  const items = order.items || [];
  for (const item of items) {
    const name = item.name || 'Produk';
    const qty = item.qty || 1;
    const unitPrice = item.sellingPrice || 0;
    const subtotal = qty * unitPrice;

    parts.push(escposBold(true));
    parts.push(escposText(name + '\n'));
    parts.push(escposBold(false));
    parts.push(escposText(`${qty} x ${price(unitPrice)}`));
    const subStr = price(subtotal);
    const padding = Math.max(0, 32 - subStr.length);
    parts.push(escposText(' '.repeat(padding) + subStr + '\n'));
  }

  parts.push(escposText('\n' + thin + '\n'));

  if (order.additionalFee) {
    parts.push(escposAlign('left'));
    parts.push(escposText('Biaya Lain: ' + price(order.additionalFee) + '\n'));
  }

  parts.push(escposAlign('right'));
  parts.push(escposBold(true));
  parts.push(escposFontSize(2, 2));
  const totalStr = price(order.totalAmount);
  parts.push(escposText('TOTAL: ' + totalStr + '\n'));
  parts.push(escposFontSize(1, 1));
  parts.push(escposBold(false));

  parts.push(escposAlign('left'));
  if (order.paymentMethod === 'Kasbon') {
    parts.push(escposText('Status: KASBON\n'));
  } else if (order.paymentMethod) {
    parts.push(escposText('Bayar: ' + order.paymentMethod.toUpperCase() + '\n'));
  }
  if (order.amountPaid && order.amountPaid > (order.totalAmount || 0)) {
    const change = order.amountPaid - (order.totalAmount || 0);
    parts.push(escposText('Kembali: ' + price(change) + '\n'));
  }

  parts.push(escposText('\n'));
  parts.push(escposAlign('center'));
  parts.push(escposText('Terima kasih telah berbelanja\n'));
  parts.push(escposText('Barang yang sudah dibeli\n'));
  parts.push(escposText('tidak dapat dikembalikan\n\n'));

  parts.push(escposLineFeed(5));
  parts.push(escposCut());

  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

export async function requestBluetoothPrinter() {
  try {
    await BluetoothLe.initialize();
    const device = await BluetoothLe.requestDevice({
      services: [],
      scanMode: 1,
    });
    return device;
  } catch (err) {
    throw new Error('Gagal menemukan printer: ' + (err.message || ''));
  }
}

export async function printToBluetooth(deviceId, data) {
  try {
    await BluetoothLe.connect({ deviceId, timeout: 10000 });

    try {
      const services = await BluetoothLe.discoverServices({ deviceId });

      let characteristic = null;
      for (const service of services.services || services.bleServices || []) {
        for (const char of (service.characteristics || [])) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            characteristic = { service: service.uuid, characteristic: char.uuid };
            break;
          }
        }
        if (characteristic) break;
      }

      if (!characteristic) {
        throw new Error('Tidak ditemukan karakteristik write pada printer');
      }

      const mtu = 512;
      for (let i = 0; i < data.length; i += mtu) {
        const chunk = data.slice(i, i + mtu);
        try {
          await BluetoothLe.write({
            deviceId,
            service: characteristic.service,
            characteristic: characteristic.characteristic,
            value: Array.from(chunk),
            type: 'withoutResponse',
            timeout: 5000,
          });
        } catch (_) {
          await BluetoothLe.write({
            deviceId,
            service: characteristic.service,
            characteristic: characteristic.characteristic,
            value: Array.from(chunk),
            type: null,
            timeout: 5000,
          });
        }
      }
    } finally {
      await BluetoothLe.disconnect({ deviceId }).catch(() => {});
    }
  } catch (err) {
    throw new Error('Gagal mencetak: ' + (err.message || ''));
  }
}
