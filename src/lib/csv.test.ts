import { describe, expect, it } from 'vitest';
import { csvCell, csvLine } from './csv';

describe('csvCell', () => {
	it('leaves plain text and numbers alone', () => {
		expect(csvCell('chinook habitat')).toBe('chinook habitat');
		expect(csvCell(1234)).toBe('1234');
		expect(csvCell(-5)).toBe('-5');
		expect(csvCell(null)).toBe('');
	});
	it('quotes commas, quotes and line breaks', () => {
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
		expect(csvCell('one\r\ntwo')).toBe('"one\r\ntwo"');
	});
	it('guards text a spreadsheet would run as a formula', () => {
		expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvCell('+1')).toBe("'+1");
		expect(csvCell('-2')).toBe("'-2");
		expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
		expect(csvCell('\t=1')).toBe("'\t=1");
		expect(csvCell('a=b')).toBe('a=b');
	});
});

describe('csvLine', () => {
	it('joins the cells and ends the row with CRLF', () => {
		expect(csvLine(['a', 1, null, 'b,c'])).toBe('a,1,,"b,c"\r\n');
	});
});
