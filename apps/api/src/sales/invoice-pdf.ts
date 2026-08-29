import PDFDocument from 'pdfkit';

type InvoicePdfInput = {
  organizationName: string;
  legalName?: string | null;
  legalType?: string | null;
  organizationAddress?: string | null;
  organizationPhone?: string | null;
  organizationEmail?: string | null;
  organizationWebsite?: string | null;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  tradeLicenseNumber?: string | null;
  logo?: Buffer | null;
  invoiceFooter?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  template?: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  customerName: string;
  customerLegalName?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerCountry?: string | null;
  customerTaxId?: string | null;
  customerVatId?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: Array<{ description: string; quantity: string; unitPrice: string; lineTotal: string }>;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  amountPaid: string;
  amountDue: string;
  status: string;
  /** When 'quote', renders as a quote document instead of an invoice. */
  documentKind?: 'invoice' | 'quote';
};

/** Avyro brand tokens (match apps/web globals.css) */
const BRAND = {
  primary: '#0f3d3a',
  primaryDark: '#0a2e2c',
  soft: '#e4efed',
  softAlt: '#f4f7f5',
  accent: '#c45c26',
  ink: '#14201f',
  inkSoft: '#3d4f4c',
  muted: '#6b7c78',
  line: '#d7e0dc',
  white: '#ffffff',
  paper: '#ffffff',
};

const MARGIN = 48;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;
const RIGHT = PAGE_W - MARGIN;

function money(currency: string, value: string | number) {
  const n = typeof value === 'string' ? Number(value) : value;
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
  if (currency === 'BDT') return `BDT ${formatted}`;
  return `${currency} ${formatted}`;
}

function formatDateBd(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  const tens = TENS[t] ?? '';
  const ones = ONES[o] ?? '';
  return o ? `${tens} ${ones}` : tens;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hundreds = ONES[h] ?? '';
  if (h && r) return `${hundreds} Hundred ${twoDigits(r)}`;
  if (h) return `${hundreds} Hundred`;
  return twoDigits(r);
}

function amountInWords(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const paisa = Math.round((abs - whole) * 100);
  if (whole === 0 && paisa === 0) {
    return currency === 'BDT' ? 'Taka Zero Only' : `${currency} Zero Only`;
  }
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const rest = whole % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  const major = currency === 'BDT' ? 'Taka' : currency;
  const minor = currency === 'BDT' ? 'Paisa' : 'Cents';
  let words = `${parts.join(' ')} ${major}`;
  if (paisa) words += ` and ${twoDigits(paisa)} ${minor}`;
  words += ' Only';
  return negative ? `Minus ${words}` : words;
}

function linesOf(...vals: Array<string | null | undefined>) {
  return vals.map((v) => (v ?? '').trim()).filter(Boolean);
}

function normalizeHex(color: string | null | undefined, fallback: string) {
  const raw = (color ?? fallback).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const h = raw.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fallback;
}

function darkenHex(hex: string, amount = 0.12) {
  const h = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function mixWithWhite(hex: string, ratio = 0.88) {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) + (255 - parseInt(h.slice(0, 2), 16)) * ratio);
  const g = Math.round(parseInt(h.slice(2, 4), 16) + (255 - parseInt(h.slice(2, 4), 16)) * ratio);
  const b = Math.round(parseInt(h.slice(4, 6), 16) + (255 - parseInt(h.slice(4, 6), 16)) * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const isQuote = input.documentKind === 'quote';
  const docLabel = isQuote ? 'Quote' : 'Invoice';
  const template = (input.template ?? 'wave').toLowerCase();
  const primary = normalizeHex(input.primaryColor, BRAND.primary);
  const accent = normalizeHex(input.accentColor, BRAND.accent);
  const brand = {
    primary,
    primaryDark: darkenHex(primary),
    soft: mixWithWhite(primary, 0.9),
    softAlt: mixWithWhite(primary, 0.95),
    accent,
    ink: BRAND.ink,
    inkSoft: BRAND.inkSoft,
    muted: BRAND.muted,
    line: BRAND.line,
    white: BRAND.white,
    paper: BRAND.paper,
  };
  const isMinimal = template === 'minimal';
  const isClassic = template === 'classic';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: `${docLabel} ${input.invoiceNumber}`,
        Author: input.organizationName,
        Subject: docLabel,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const tax = Number(input.taxTotal);
    const hasTax = Number.isFinite(tax) && tax > 0;
    const paid = Number(input.amountPaid);
    const due = Number(input.amountDue);

    // ── Brand header ──────────────────────────────────
    const headerH = isMinimal ? 88 : isClassic ? 96 : 112;
    if (!isMinimal) {
      doc.save();
      doc.rect(0, 0, PAGE_W, headerH).fill(isClassic ? brand.white : brand.primary);
      if (!isClassic) {
        doc.rect(0, headerH - 6, PAGE_W, 6).fill(brand.accent);
      } else {
        doc.rect(0, headerH - 2, PAGE_W, 2).fill(brand.primary);
      }
      doc.restore();
    }

    const headerInk = isClassic ? brand.primary : brand.white;
    const headerMuted = isClassic ? brand.muted : '#b7cbc8';

    // Logo or monogram
    let brandTextX = MARGIN;
    if (input.logo) {
      try {
        doc.image(input.logo, MARGIN, isMinimal ? 24 : 28, {
          fit: [64, 56],
          align: 'center',
          valign: 'center',
        });
        brandTextX = MARGIN + 76;
      } catch {
        // text-only brand
      }
    } else if (!isMinimal) {
      doc.save();
      doc.roundedRect(MARGIN, 32, 44, 44, 8).fill(isClassic ? brand.soft : brand.primaryDark);
      doc
        .fillColor(isClassic ? brand.primary : brand.white)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(input.organizationName.slice(0, 1).toUpperCase(), MARGIN, 44, {
          width: 44,
          align: 'center',
        });
      doc.restore();
      brandTextX = MARGIN + 56;
    }

    const titleY = isMinimal ? 28 : 34;
    doc
      .fillColor(isMinimal ? brand.primary : headerInk)
      .font('Helvetica-Bold')
      .fontSize(isMinimal ? 14 : 16)
      .text(input.organizationName, brandTextX, titleY, { width: 260 });
    doc.font('Helvetica').fontSize(8).fillColor(isMinimal ? brand.muted : headerMuted);
    const sellerBits = linesOf(
      input.legalType,
      input.organizationPhone,
      input.organizationEmail,
    );
    if (sellerBits.length) {
      doc.text(sellerBits.join('  ·  '), brandTextX, doc.y + 2, { width: 260 });
    }

    // INVOICE title
    doc
      .fillColor(isMinimal ? brand.primary : headerInk)
      .font('Helvetica-Bold')
      .fontSize(isMinimal ? 22 : isClassic ? 24 : 28)
      .text(
        isQuote ? 'QUOTE' : hasTax ? 'TAX INVOICE' : 'INVOICE',
        MARGIN,
        isMinimal ? 24 : 36,
        {
        width: CONTENT_W,
        align: 'right',
      });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(isMinimal ? brand.muted : headerMuted)
      .text(`# ${input.invoiceNumber}`, MARGIN, isMinimal ? 52 : 70, {
        width: CONTENT_W,
        align: 'right',
      });

    // ── Amount due pill ──────────────────────────
    let y = (isMinimal ? 72 : headerH) + 22;
    const dueLabel = isQuote
      ? 'QUOTE TOTAL'
      : paid > 0 && due <= 0
        ? 'PAID IN FULL'
        : 'AMOUNT DUE';
    const dueBoxW = 210;
    const dueBoxX = RIGHT - dueBoxW;
    doc.save();
    doc.roundedRect(dueBoxX, y, dueBoxW, 52, 8).fill(brand.soft);
    doc.roundedRect(dueBoxX, y, 5, 52, 2).fill(brand.accent);
    doc.restore();
    doc
      .fillColor(brand.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(dueLabel, dueBoxX + 16, y + 10, { width: dueBoxW - 24 });
    doc
      .fillColor(brand.primary)
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(money(input.currency, input.amountDue), dueBoxX + 16, y + 24, {
        width: dueBoxW - 24,
      });

    // Meta dates (left of amount due)
    const meta = [
      ['Issue date', formatDateBd(input.issueDate)],
      [isQuote ? 'Valid until' : 'Due date', formatDateBd(input.dueDate)],
      ['Currency', input.currency === 'BDT' ? 'Bangladeshi Taka (BDT)' : input.currency],
      ['Status', input.status.replaceAll('_', ' ')],
    ] as const;
    let metaY = y;
    for (const [k, v] of meta) {
      doc.fillColor(brand.muted).font('Helvetica').fontSize(8).text(k, MARGIN, metaY, { width: 90 });
      doc
        .fillColor(brand.ink)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(v, MARGIN + 90, metaY, { width: 180 });
      metaY += 14;
    }

    y = Math.max(metaY, y + 52) + 18;

    // ── From / Bill to (Wave two-column) ──────────────────────────
    const colW = (CONTENT_W - 24) / 2;
    doc.fillColor(brand.accent).font('Helvetica-Bold').fontSize(8).text('FROM', MARGIN, y);
    doc.fillColor(brand.accent).text('BILL TO', MARGIN + colW + 24, y);
    y += 14;

    doc.fillColor(brand.ink).font('Helvetica-Bold').fontSize(11).text(input.organizationName, MARGIN, y, {
      width: colW,
    });
    const fromStart = doc.y;
    doc
      .fillColor(brand.ink)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(input.customerName, MARGIN + colW + 24, y, { width: colW });
    const toStart = doc.y;

    doc.font('Helvetica').fontSize(9).fillColor(brand.inkSoft);
    const fromLines = linesOf(
      input.legalName && input.legalName !== input.organizationName ? input.legalName : null,
      input.organizationAddress,
      input.organizationPhone ? `Tel ${input.organizationPhone}` : null,
      input.organizationEmail,
      input.organizationWebsite,
      input.taxIdentifier ? `TIN ${input.taxIdentifier}` : null,
      input.vatIdentifier ? `BIN ${input.vatIdentifier}` : null,
      input.tradeLicenseNumber ? `Trade licence ${input.tradeLicenseNumber}` : null,
    );
    let fy = fromStart + 2;
    for (const line of fromLines) {
      doc.text(line, MARGIN, fy, { width: colW });
      fy = doc.y;
    }

    const toLines = linesOf(
      input.customerLegalName && input.customerLegalName !== input.customerName
        ? input.customerLegalName
        : null,
      input.customerAddress,
      [input.customerPhone, input.customerEmail].filter(Boolean).join(' · ') || null,
      input.customerTaxId ? `TIN ${input.customerTaxId}` : null,
      input.customerVatId ? `BIN ${input.customerVatId}` : null,
      input.customerCountry && input.customerCountry !== 'BD'
        ? `Country ${input.customerCountry}`
        : null,
    );
    let ty = toStart + 2;
    for (const line of toLines) {
      doc.text(line, MARGIN + colW + 24, ty, { width: colW });
      ty = doc.y;
    }

    y = Math.max(fy, ty) + 20;

    // ── Items table ──────────────────────────────────────────────
    const cols = {
      desc: { x: MARGIN, w: 250 },
      qty: { x: MARGIN + 250, w: 55 },
      rate: { x: MARGIN + 305, w: 95 },
      amt: { x: MARGIN + 400, w: CONTENT_W - 400 },
    };

    function paintTableHead(at: number) {
      doc.save();
      doc.roundedRect(MARGIN, at, CONTENT_W, 28, 6).fill(brand.primary);
      doc.restore();
      doc.fillColor(brand.white).font('Helvetica-Bold').fontSize(8);
      doc.text('Description', cols.desc.x + 12, at + 10, { width: cols.desc.w - 16 });
      doc.text('Qty', cols.qty.x, at + 10, { width: cols.qty.w - 4, align: 'right' });
      doc.text('Rate', cols.rate.x, at + 10, { width: cols.rate.w - 4, align: 'right' });
      doc.text('Amount', cols.amt.x, at + 10, { width: cols.amt.w - 12, align: 'right' });
      return at + 28;
    }

    if (y > 700) {
      doc.addPage();
      y = MARGIN;
    }
    y = paintTableHead(y);

    input.items.forEach((item, index) => {
      const qty = Number(item.quantity);
      const qtyLabel = Number.isFinite(qty)
        ? qty.toLocaleString('en-BD', { maximumFractionDigits: 4 })
        : item.quantity;

      doc.font('Helvetica').fontSize(9);
      const descH = doc.heightOfString(item.description, { width: cols.desc.w - 16 });
      const rowH = Math.max(32, descH + 16);

      if (y + rowH > 760) {
        doc.addPage();
        y = paintTableHead(MARGIN);
      }

      if (index % 2 === 0) {
        doc.save();
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill(brand.softAlt);
        doc.restore();
      }

      doc.fillColor(brand.ink).font('Helvetica').fontSize(9);
      doc.text(item.description, cols.desc.x + 12, y + 10, { width: cols.desc.w - 16 });
      doc.fillColor(brand.inkSoft).fontSize(9);
      doc.text(qtyLabel, cols.qty.x, y + 10, { width: cols.qty.w - 4, align: 'right' });
      doc.text(money(input.currency, item.unitPrice), cols.rate.x, y + 10, {
        width: cols.rate.w - 4,
        align: 'right',
      });
      doc
        .fillColor(brand.ink)
        .font('Helvetica-Bold')
        .text(money(input.currency, item.lineTotal), cols.amt.x, y + 10, {
          width: cols.amt.w - 12,
          align: 'right',
        });

      y += rowH;
    });

    // soft bottom rule
    doc.save();
    doc.strokeColor(brand.line).lineWidth(1).moveTo(MARGIN, y).lineTo(RIGHT, y).stroke();
    doc.restore();
    y += 16;

    // ── Totals (Wave right stack) ─────────────────────────────────
    if (y > 680) {
      doc.addPage();
      y = MARGIN;
    }

    const totalsX = RIGHT - 220;
    const addTotal = (label: string, value: string, opts?: { strong?: boolean; accent?: boolean }) => {
      if (opts?.accent) {
        doc.save();
        doc.roundedRect(totalsX - 8, y - 4, 228, 28, 6).fill(brand.primary);
        doc.restore();
        doc.fillColor(brand.white).font('Helvetica-Bold').fontSize(10);
        doc.text(label, totalsX, y + 4, { width: 90 });
        doc.text(value, totalsX + 90, y + 4, { width: 122, align: 'right' });
        y += 34;
        return;
      }
      doc
        .fillColor(brand.muted)
        .font(opts?.strong ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .text(label, totalsX, y, { width: 90 });
      doc
        .fillColor(brand.ink)
        .font(opts?.strong ? 'Helvetica-Bold' : 'Helvetica')
        .text(value, totalsX + 90, y, { width: 122, align: 'right' });
      y += 16;
    };

    const totalsTop = y;
    addTotal('Subtotal', money(input.currency, input.subtotal));
    if (hasTax) addTotal('VAT', money(input.currency, input.taxTotal));
    addTotal('Total', money(input.currency, input.grandTotal), { strong: true });
    if (paid > 0) addTotal('Amount paid', money(input.currency, input.amountPaid));
    addTotal('Amount due', money(input.currency, input.amountDue), { accent: true });

    // Amount in words (BD) — left of totals
    doc
      .fillColor(brand.muted)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Amount in words', MARGIN, totalsTop);
    doc
      .fillColor(brand.ink)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(amountInWords(due, input.currency), MARGIN, totalsTop + 12, {
        width: CONTENT_W - 240,
      });

    y = Math.max(y, doc.y) + 18;

    // ── Notes / terms / bank (Wave footer blocks) ────────────────
    const blocks: Array<{ title: string; body: string }> = [];
    if (input.notes?.trim()) blocks.push({ title: 'Notes', body: input.notes.trim() });
    if (input.terms?.trim()) blocks.push({ title: 'Terms', body: input.terms.trim() });
    if (input.invoiceFooter?.trim()) {
      blocks.push({ title: 'Payment details', body: input.invoiceFooter.trim() });
    }

    for (const block of blocks) {
      if (y > 740) {
        doc.addPage();
        y = MARGIN;
      }
      doc.save();
      doc.roundedRect(MARGIN, y, CONTENT_W, 8, 4).fill(brand.soft);
      doc.restore();
      // measure content
      doc.font('Helvetica').fontSize(9);
      const bodyH = doc.heightOfString(block.body, { width: CONTENT_W - 24 });
      const boxH = bodyH + 28;
      doc.save();
      doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8).fill(brand.softAlt);
      doc.roundedRect(MARGIN, y, 4, boxH, 2).fill(brand.primary);
      doc.restore();
      doc
        .fillColor(brand.primary)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(block.title.toUpperCase(), MARGIN + 14, y + 8);
      doc
        .fillColor(brand.inkSoft)
        .font('Helvetica')
        .fontSize(9)
        .text(block.body, MARGIN + 14, y + 20, { width: CONTENT_W - 28 });
      y += boxH + 12;
    }

    // Signature row
    if (y > 720) {
      doc.addPage();
      y = MARGIN;
    }
    y += 10;
    doc.strokeColor(brand.line).lineWidth(1);
    doc
      .moveTo(MARGIN, y + 28)
      .lineTo(MARGIN + 160, y + 28)
      .stroke();
    doc
      .moveTo(RIGHT - 160, y + 28)
      .lineTo(RIGHT, y + 28)
      .stroke();
    doc.fillColor(brand.muted).font('Helvetica').fontSize(8);
    doc.text('Customer signature', MARGIN, y + 34, { width: 160 });
    doc.text('Authorised signature', RIGHT - 160, y + 34, { width: 160, align: 'right' });

    // Page footers with brand
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.save();
      doc.rect(0, 826, PAGE_W, 16).fill(brand.primary);
      doc.restore();
      doc
        .fillColor('#b7cbc8')
        .font('Helvetica')
        .fontSize(7)
        .text(
          `${input.organizationName}  ·  ${docLabel} ${input.invoiceNumber}  ·  Page ${i + 1} of ${range.count}`,
          MARGIN,
          830,
          { width: CONTENT_W, align: 'center' },
        );
    }

    doc.end();
  });
}
