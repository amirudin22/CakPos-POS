import QRCode from 'qrcode';

export function parseQRIS(str) {
  const fields = [];
  let i = 0;
  while (i < str.length - 3) {
    const tag = str.slice(i, i + 2);
    i += 2;
    if (isNaN(parseInt(tag, 10))) break;
    const len = parseInt(str.slice(i, i + 2), 10);
    i += 2;
    if (isNaN(len)) break;
    const val = str.slice(i, i + len);
    i += len;
    fields.push({ tag: parseInt(tag, 10), length: len, value: val });
  }
  return fields;
}

export function crc16CCITT(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc;
}

export function setQRISAmount(qrisString, amount) {
  const amountInt = Math.round(Number(amount));
  if (amountInt <= 0) return qrisString;

  const crcIdx = qrisString.lastIndexOf('6304');
  const baseStr = crcIdx >= 0 ? qrisString.slice(0, crcIdx) : qrisString;

  const fields = parseQRIS(baseStr);

  const amountStr = amountInt.toString();
  let rebuilt = '';
  let amountInserted = false;

  for (const f of fields) {
    if (f.tag === 54) {
      rebuilt += `54${String(amountStr.length).padStart(2, '0')}${amountStr}`;
      amountInserted = true;
    } else if (f.tag === 63) {
      break;
    } else {
      rebuilt += `${String(f.tag).padStart(2, '0')}${String(f.length).padStart(2, '0')}${f.value}`;
    }
  }

  if (!amountInserted) {
    const insertBefore = rebuilt.indexOf('58');
    const idx = insertBefore >= 0 ? insertBefore : rebuilt.length;
    const amountTlv = `54${String(amountStr.length).padStart(2, '0')}${amountStr}`;
    rebuilt = rebuilt.slice(0, idx) + amountTlv + rebuilt.slice(idx);
  }

  const crcVal = crc16CCITT(rebuilt + '6304');
  const crcHex = crcVal.toString(16).toUpperCase().padStart(4, '0');
  return rebuilt + '6304' + crcHex;
}

export async function generateQRISImage(qrisString, size = 400) {
  try {
    const dataUrl = await QRCode.toDataURL(qrisString, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return dataUrl;
  } catch {
    return null;
  }
}

export function formatQRISAmount(amount) {
  return 'Rp ' + (Number(amount) || 0).toLocaleString('id-ID');
}
