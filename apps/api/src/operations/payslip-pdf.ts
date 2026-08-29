import PDFDocument from 'pdfkit';

type PayslipPdfInput = {
  organizationName: string;
  legalName?: string | null;
  organizationAddress?: string | null;
  organizationPhone?: string | null;
  organizationEmail?: string | null;
  taxIdentifier?: string | null;
  logo?: Buffer | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  runDate: string;
  employeeName: string;
  employeeTitle?: string | null;
  nationalId?: string | null;
  taxIdentifierEmployee?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  grossPay: string;
  deductions: string;
  netPay: string;
  currency?: string;
};

const MARGIN = 48;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;
const RIGHT = PAGE_W - MARGIN;

function money(value: string | number, currency = 'BDT') {
  const n = typeof value === 'string' ? Number(value) : value;
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
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

function normalizeHex(color: string | null | undefined, fallback: string) {
  const raw = (color ?? fallback).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

export async function buildPayslipPdf(input: PayslipPdfInput): Promise<Buffer> {
  const primary = normalizeHex(input.primaryColor, '#0f3d3a');
  const accent = normalizeHex(input.accentColor, '#c45c26');
  const currency = input.currency ?? 'BDT';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      info: {
        Title: `Payslip — ${input.employeeName} — ${input.periodName}`,
        Author: input.organizationName,
        Subject: 'Payslip',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const headerH = 88;
    doc.rect(0, 0, PAGE_W, headerH).fill(primary);
    doc.rect(0, headerH - 4, PAGE_W, 4).fill(accent);

    let textX = MARGIN;
    if (input.logo) {
      try {
        doc.image(input.logo, MARGIN, 16, { width: 56, height: 56, fit: [56, 56] });
        textX = MARGIN + 68;
      } catch {
        /* ignore bad logo */
      }
    }

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(input.organizationName, textX, 20, { width: 280 });
    doc.font('Helvetica').fontSize(8);
    const orgLines = [
      input.legalName && input.legalName !== input.organizationName ? input.legalName : null,
      input.organizationAddress,
      input.organizationPhone,
      input.organizationEmail,
      input.taxIdentifier ? `TIN ${input.taxIdentifier}` : null,
    ].filter(Boolean) as string[];
    let oy = doc.y + 2;
    for (const line of orgLines) {
      doc.text(line, textX, oy, { width: 280 });
      oy += 10;
    }

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('PAYSLIP', MARGIN, 28, { width: CONTENT_W, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(input.periodName, MARGIN, 56, { width: CONTENT_W, align: 'right' });

    let y = headerH + 28;

    doc.fillColor('#14201f').font('Helvetica-Bold').fontSize(11).text('Employee', MARGIN, y);
    y += 18;
    doc.font('Helvetica').fontSize(10);
    doc.text(input.employeeName, MARGIN, y);
    y += 14;
    if (input.employeeTitle) {
      doc.fillColor('#3d4f4c').text(input.employeeTitle, MARGIN, y);
      y += 14;
    }
    doc.fillColor('#3d4f4c').fontSize(9);
    if (input.nationalId) {
      doc.text(`NID: ${input.nationalId}`, MARGIN, y);
      y += 12;
    }
    if (input.taxIdentifierEmployee) {
      doc.text(`e-TIN: ${input.taxIdentifierEmployee}`, MARGIN, y);
      y += 12;
    }
    if (input.bankName || input.bankAccountNumber) {
      doc.text(
        `Bank: ${[input.bankName, input.bankAccountNumber].filter(Boolean).join(' — ')}`,
        MARGIN,
        y,
      );
      y += 12;
    }

    y += 8;
    doc.fillColor('#14201f').font('Helvetica-Bold').fontSize(10).text('Pay period', MARGIN, y);
    y += 16;
    doc.font('Helvetica').fontSize(9).fillColor('#3d4f4c');
    doc.text(
      `${formatDateBd(input.periodStart)} — ${formatDateBd(input.periodEnd)}  ·  Run date: ${formatDateBd(input.runDate)}`,
      MARGIN,
      y,
    );
    y += 28;

    const tableW = CONTENT_W;
    const rowH = 28;
    const rows: Array<[string, string]> = [
      ['Gross pay', money(input.grossPay, currency)],
      ['TDS / deductions', money(input.deductions, currency)],
      ['Net pay', money(input.netPay, currency)],
    ];

    doc.rect(MARGIN, y, tableW, rowH).fill('#e4efed');
    doc.fillColor(primary).font('Helvetica-Bold').fontSize(9);
    doc.text('Description', MARGIN + 12, y + 9);
    doc.text('Amount', MARGIN, y + 9, { width: tableW - 12, align: 'right' });
    y += rowH;

    for (let i = 0; i < rows.length; i++) {
      const [label, amount] = rows[i]!;
      const isNet = i === rows.length - 1;
      if (isNet) doc.rect(MARGIN, y, tableW, rowH + 4).fill('#f4f7f5');
      doc.fillColor(isNet ? primary : '#14201f')
        .font(isNet ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isNet ? 11 : 9);
      doc.text(label, MARGIN + 12, y + 9);
      doc.text(amount, MARGIN, y + 9, { width: tableW - 12, align: 'right' });
      doc.moveTo(MARGIN, y + rowH).lineTo(RIGHT, y + rowH).strokeColor('#d7e0dc').stroke();
      y += rowH + (isNet ? 4 : 0);
    }

    y += 24;
    doc
      .fillColor('#6b7c78')
      .font('Helvetica')
      .fontSize(8)
      .text(
        'This payslip is generated for your records. TDS withheld is remitted per applicable Bangladesh tax rules.',
        MARGIN,
        y,
        { width: CONTENT_W },
      );

    doc.end();
  });
}
