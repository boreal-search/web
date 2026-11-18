// CSV for spreadsheets (RFC 4180): CRLF rows, fields quoted when they hold a quote, comma or line
// break. Text starting with = + - @ (or a tab / carriage return) gets a leading ' so a
// spreadsheet shows it rather than running it as a formula. Numbers are written as they are.

export type CsvCell = string | number | null;

/** Starts the file so Excel reads it as UTF-8. */
export const CSV_BOM = '﻿';

const FORMULA = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(value: CsvCell): string {
	if (value === null) return '';
	if (typeof value === 'number') return String(value);
	const safe = FORMULA.test(value) ? `'${value}` : value;
	return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** One row, with its line ending. */
export const csvLine = (cells: readonly CsvCell[]) => `${cells.map(csvCell).join(',')}\r\n`;
