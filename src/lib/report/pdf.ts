import type { ReportColumn } from "@/types";

function escapePdf(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function buildTextLines(title: string, columns: ReportColumn[], rows: Array<Record<string, string>>) {
  const lines = [title, "", columns.map((column) => column.label).join(" | ")];

  for (const row of rows) {
    lines.push(columns.map((column) => row[column.key] ?? "").join(" | "));
  }

  return lines.flatMap((line) => {
    const chunks: string[] = [];
    let current = line;

    while (current.length > 105) {
      chunks.push(current.slice(0, 105));
      current = current.slice(105);
    }

    chunks.push(current);
    return chunks;
  });
}

export function generatePdf(title: string, columns: ReportColumn[], rows: Array<Record<string, string>>) {
  const lines = buildTextLines(title, columns, rows);
  const pageLines = 43;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / pageLines)) }, (_, index) =>
    lines.slice(index * pageLines, (index + 1) * pageLines)
  );

  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  pages.forEach((page, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = pageObjectNumber + 1;
    const content = [
      "BT",
      "/F1 9 Tf",
      "40 555 Td",
      "12 TL",
      ...page.map((line, lineIndex) => `${lineIndex === 0 ? "" : "T* "}(${escapePdf(line)}) Tj`)
    ].join("\n") + "\nET";

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "binary"));
}
