const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cellText = (cell: HTMLTableCellElement) => cell.innerText.replace(/\s*\n\s*/g, ' ').trim();

function readRows(table: HTMLTableElement) {
  return [...table.rows].map((row) => ({
    header: [...row.cells].every((c) => c.tagName === 'TH'),
    cells: [...row.cells].map(cellText),
  }));
}

/**
 * Copie le tableau dans le presse-papier : en HTML (collage dans Confluence, Word, Teams, mail…)
 * et en texte tabulé (collage dans Excel ou un éditeur).
 */
export async function copyTable(table: HTMLTableElement) {
  const rows = readRows(table);

  const text = rows.map((r) => r.cells.map((c) => c.replace(/\t/g, ' ')).join('\t')).join('\n');

  const border = 'border:1px solid #cbd5e1;padding:6px 10px;text-align:left;vertical-align:top';
  const html =
    '<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px">' +
    rows
      .map((r) => {
        const tag = r.header ? 'th' : 'td';
        const bg = r.header ? ';background:#f1f5f9;font-weight:600' : '';
        return `<tr>${r.cells.map((c) => `<${tag} style="${border}${bg}">${escapeHtml(c)}</${tag}>`).join('')}</tr>`;
      })
      .join('') +
    '</table>';

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
  } else {
    await navigator.clipboard.writeText(text);
  }
}
