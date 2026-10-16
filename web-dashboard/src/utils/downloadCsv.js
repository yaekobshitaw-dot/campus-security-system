export function downloadCsv(filename, headers, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('There is no data available to export.');
  }

  const escapeCell = (value) => {
    const text = String(value ?? '');
    const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\r\n');
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}