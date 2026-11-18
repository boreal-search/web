// CSV for spreadsheets (RFC 4180): CRLF rows, fields quoted when they hold a quote, comma or line
// break. Text starting with = + - @ (or a tab / carriage return) gets a leading ' so a
// spreadsheet shows it rather than running it as a formula. Numbers are written as they are.

export type CsvCell = string | number | null;

const FORMULA = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(value: CsvCell): string {
	if (value === null) return '';
	if (typeof value === 'number') return String(value);
	const safe = FORMULA.test(value) ? `'${value}` : value;
	return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The whole file, header first, with a byte-order mark so Excel reads it as UTF-8. */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
	return `\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
