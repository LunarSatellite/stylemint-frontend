import { describe, expect, it, vi } from 'vitest';
import { csvCell, csvFileName, downloadCsv, toCsv } from './csv';

/** The raw bytes: a text read would swallow the BOM. */
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

describe('csv', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(true)).toBe('yes');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+977 search')).toBe("'+977 search");
    expect(csvCell('-dress')).toBe("'-dress");
    expect(csvCell('@me')).toBe("'@me");
  });

  it('writes a header and one line per row', () => {
    const csv = toCsv(
      [
        { header: 'Product', value: (r: { n: string; v: number }) => r.n },
        { header: 'Revenue', value: (r: { n: string; v: number }) => r.v },
      ],
      [
        { n: 'Kurta, red', v: 1200 },
        { n: 'Shawl', v: 800 },
      ],
    );
    expect(csv).toBe('Product,Revenue\r\n"Kurta, red",1200\r\nShawl,800\r\n');
  });

  it('names files after the table and period', () => {
    expect(csvFileName('Best sellers', '2026-09-14', '2026-10-13')).toBe('best-sellers_2026-09-14_2026-10-13.csv');
    expect(csvFileName('***')).toBe('export.csv');
  });

  it('downloads as UTF-8 with a BOM', async () => {
    let blob: Blob | null = null;
    const create = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:csv';
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadCsv('x.csv', 'a,b\r\n');
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(blob!.type).toContain('text/csv');
    const bytes = await readBytes(blob!);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('a,b\r\n');
  });
});
