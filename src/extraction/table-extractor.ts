import * as cheerio from 'cheerio';

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  markdown: string;
}

export function htmlTableToMarkdown(htmlTable: string): ExtractedTable {
  const $ = cheerio.load(htmlTable);

  const headers: string[] = [];
  const rows: string[][] = [];

  // Extract headers
  $('thead th, tr:first-child th').each((_, el) => {
    headers.push($(el).text().trim());
  });

  // If no headers in thead, try first row
  if (headers.length === 0) {
    $('tr:first-child td').each((_, el) => {
      headers.push($(el).text().trim());
    });
  }

  // Extract rows
  const startRow = headers.length > 0 ? 1 : 0;
  $('tbody tr, tr')
    .slice(startRow)
    .each((_, row) => {
      const cells: string[] = [];
      $(row)
        .find('td, th')
        .each((_, cell) => {
          cells.push($(cell).text().trim());
        });
      if (cells.length > 0) {
        rows.push(cells);
      }
    });

  // Generate markdown
  const markdown = generateMarkdownTable(headers, rows);

  return { headers, rows, markdown };
}

function generateMarkdownTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0 && rows.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // Header row
  if (headers.length > 0) {
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  }

  // Data rows
  for (const row of rows) {
    // Pad row to match header length
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    lines.push(`| ${paddedRow.join(' | ')} |`);
  }

  return lines.join('\n');
}

export function textToSimpleTable(
  text: string,
  delimiter: string = '\t'
): ExtractedTable {
  const lines = text.trim().split('\n');
  if (lines.length === 0) {
    return { headers: [], rows: [], markdown: '' };
  }

  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const rows = lines.slice(1).map((line) =>
    line.split(delimiter).map((cell) => cell.trim())
  );

  return {
    headers,
    rows,
    markdown: generateMarkdownTable(headers, rows),
  };
}
