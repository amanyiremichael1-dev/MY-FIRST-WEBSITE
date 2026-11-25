import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function formatUgx(amount: number | undefined | null): string {
  const val = Number(amount || 0);
  return `UGX ${val.toLocaleString('en-UG')}`;
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const normalized = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export interface ReportExportOptions {
  reportTitle: string;
  filterSummary: string;
  generatedAt: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  filenameBase: string;
}

export function exportReportToPdf(opts: ReportExportOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 74, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ALLIANCE VOCATIONAL SCHOOL – IBANDA', 36, 30);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`UVTAB STUDENT REGISTRATION REPORT — ${opts.reportTitle.toUpperCase()}`, 36, 50);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date(opts.generatedAt).toLocaleString('en-UG')}`, 36, 94);
  doc.text(`Filters: ${opts.filterSummary}`, 36, 108);

  autoTable(doc, {
    startY: 122,
    head: [opts.columns],
    body: opts.rows,
    styles: {
      fontSize: 8,
      cellPadding: 5,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [19, 52, 94],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 36, right: 36 },
  });

  doc.save(`${opts.filenameBase}.pdf`);
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportReportToExcel(opts: ReportExportOptions): void {
  const headerRows = `
    <Row>
      <Cell ss:StyleID="Title"><Data ss:Type="String">ALLIANCE VOCATIONAL SCHOOL - IBANDA</Data></Cell>
    </Row>
    <Row>
      <Cell ss:StyleID="Subtitle"><Data ss:Type="String">UVTAB STUDENT REGISTRATION REPORT: ${xmlEscape(opts.reportTitle)}</Data></Cell>
    </Row>
    <Row>
      <Cell><Data ss:Type="String">Generated: ${xmlEscape(new Date(opts.generatedAt).toLocaleString('en-UG'))} | Filters: ${xmlEscape(opts.filterSummary)}</Data></Cell>
    </Row>
    <Row></Row>
  `;

  const tableHead = `<Row>${opts.columns
    .map(
      (col) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(col)}</Data></Cell>`
    )
    .join('')}</Row>`;

  const tableBody = opts.rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const isNum = typeof cell === 'number' && !Number.isNaN(cell);
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(
              cell
            )}</Data></Cell>`;
          })
          .join('')}</Row>`
    )
    .join('\n');

  const workbookXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#0B1F3A"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:Bold="1" ss:Size="11" ss:Color="#1D4ED8"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#13345E" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="UVTAB Report">
    <Table>
      ${headerRows}
      ${tableHead}
      ${tableBody}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([workbookXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${opts.filenameBase}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportRecordsToCsv(
  columns: string[],
  rows: Array<Array<string | number>>,
  filenameBase: string
): void {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvContent = [
    columns.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameBase}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
