import PDFDocument from 'pdfkit';

type RegisterRow = string[];

type MushakRegisterPdfInput = {
  organizationName: string;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  title: string;
  formRef: string;
  headers: string[];
  rows: RegisterRow[];
  generatedAt: string;
};

const MARGIN = 36;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function buildMushakRegisterPdf(input: MushakRegisterPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      layout: 'landscape',
      bufferPages: true,
      info: {
        Title: input.title,
        Author: input.organizationName,
        Subject: input.formRef,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = 841.89;
    const contentW = pageW - MARGIN * 2;
    const colCount = input.headers.length;
    const colW = contentW / colCount;
    const rowH = 18;

    function drawHeader() {
      doc.fillColor('#0f3d3a').font('Helvetica-Bold').fontSize(12).text(input.organizationName, MARGIN, MARGIN);
      doc.font('Helvetica').fontSize(8).fillColor('#3d4f4c');
      const ids = [
        input.taxIdentifier ? `TIN: ${input.taxIdentifier}` : null,
        input.vatIdentifier ? `BIN: ${input.vatIdentifier}` : null,
      ]
        .filter(Boolean)
        .join('  ·  ');
      if (ids) doc.text(ids, MARGIN, doc.y + 2);
      doc
        .fillColor('#0f3d3a')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(input.title, MARGIN, doc.y + 6);
      doc.font('Helvetica').fontSize(8).fillColor('#6b7c78').text(input.formRef, MARGIN, doc.y + 2);
      doc.text(`Generated: ${input.generatedAt}`, MARGIN, doc.y + 2);
      return doc.y + 12;
    }

    function drawTableHeader(y: number) {
      doc.rect(MARGIN, y, contentW, rowH).fill('#e4efed');
      doc.fillColor('#0f3d3a').font('Helvetica-Bold').fontSize(7);
      for (let c = 0; c < colCount; c++) {
        doc.text(input.headers[c] ?? '', MARGIN + c * colW + 4, y + 5, {
          width: colW - 8,
          lineBreak: false,
        });
      }
      return y + rowH;
    }

    let y = drawHeader();
    y = drawTableHeader(y);

    doc.font('Helvetica').fontSize(7).fillColor('#14201f');
    const bottom = 555;
    for (const row of input.rows) {
      if (y + rowH > bottom) {
        doc.addPage({ layout: 'landscape', margin: MARGIN });
        y = drawHeader();
        y = drawTableHeader(y);
      }
      for (let c = 0; c < colCount; c++) {
        doc.text(row[c] ?? '', MARGIN + c * colW + 4, y + 5, {
          width: colW - 8,
          lineBreak: false,
        });
      }
      doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + contentW, y + rowH).strokeColor('#d7e0dc').stroke();
      y += rowH;
    }

    if (input.rows.length === 0) {
      doc.fillColor('#6b7c78').fontSize(9).text('No register entries yet.', MARGIN, y + 8);
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .fillColor('#6b7c78')
        .fontSize(7)
        .text(
          `${input.organizationName} — ${input.formRef} — Page ${i + 1} of ${range.count}`,
          MARGIN,
          570,
          { width: contentW, align: 'center' },
        );
    }

    doc.end();
  });
}
