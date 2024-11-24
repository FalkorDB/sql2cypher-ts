import { SqlToCypherConverter } from './convertor';

const converter = new SqlToCypherConverter();

test('converts SELECT * FROM table', () => {
    const result = converter.convert('SELECT * FROM table');
    expect(result).toBe('MATCH (n:Table)\nRETURN n');
});

test('converts SELECT column FROM table', () => {
    const result = converter.convert('SELECT column FROM table');
    expect(result).toBe('MATCH (n:Table)\nRETURN n.COLUMN');
});

test('converts SELECT column1, column2 FROM table', () => {
    const result = converter.convert('SELECT column1, column2 FROM table');
    expect(result).toBe('MATCH (n:Table)\nRETURN n.COLUMN1, n.COLUMN2');
});
