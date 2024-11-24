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

test('converts SELECT table.column FROM table', () => {
  const result = converter.convert('SELECT column FROM table');
  expect(result).toBe('MATCH (n:Table)\nRETURN n.COLUMN');
});

test('converts SELECT column1, column2 FROM table', () => {
    const result = converter.convert('SELECT column1, column2 FROM table');
    expect(result).toBe('MATCH (n:Table)\nRETURN n.COLUMN1, n.COLUMN2');
});

test('converts SELECT column1, column2 FROM table WHERE column1 = 1', () => {
    const result = converter.convert('SELECT column1, column2 FROM table WHERE column1 = 1');
    expect(result).toBe('MATCH (n:Table)\nWHERE n.COLUMN1 = 1\nRETURN n.COLUMN1, n.COLUMN2');
});

test('converts SELECT column1, column2 FROM table WHERE column1 = 1 AND column2 = 2', () => {
    const result = converter.convert('SELECT column1, column2 FROM table WHERE column1 = 1 AND column2 = 2');
    expect(result).toBe('MATCH (n:Table)\nWHERE (n.COLUMN1 = 1 AND n.COLUMN2 = 2)\nRETURN n.COLUMN1, n.COLUMN2');
});

test('converts SELECT column1, column2 FROM table WHERE column1 = 1 OR column2 = 2', () => {
    const result = converter.convert('SELECT column1, column2 FROM table WHERE column1 = 1 OR column2 = 2');
    expect(result).toBe('MATCH (n:Table)\nWHERE (n.COLUMN1 = 1 OR n.COLUMN2 = 2)\nRETURN n.COLUMN1, n.COLUMN2');
});

test('converts SELECT column1, column2 FROM table WHERE column1 = 1 OR column2 = 2 AND column3 = 3', () => {
    const result = converter.convert('SELECT column1, column2 FROM table WHERE column1 = 1 OR column2 = 2 AND column3 = 3');
    expect(result).toBe('MATCH (n:Table)\nWHERE (n.COLUMN1 = 1 OR (n.COLUMN2 = 2 AND n.COLUMN3 = 3))\nRETURN n.COLUMN1, n.COLUMN2');
});

test('converts SELECT column1, column2 FROM table WHERE column1 = 1 AND column2 = 2 OR column3 = 3', () => {
    const result = converter.convert('SELECT column1, column2 FROM table WHERE column1 = 1 AND column2 = 2 OR column3 = 3');
    expect(result).toBe('MATCH (n:Table)\nWHERE ((n.COLUMN1 = 1 AND n.COLUMN2 = 2) OR n.COLUMN3 = 3)\nRETURN n.COLUMN1, n.COLUMN2');
});

// Test Join 2 tables with INNER JOIN
// test('converts SELECT column1, column2 FROM table1 INNER JOIN table2 ON table1.column1 = table2.column1', () => {
//     const result = converter.convert('SELECT table1.column1, table1.column2 FROM table1 INNER JOIN table2 ON table1.column1 = table2.column1');
//     expect(result).toBe('MATCH (n:Table1)-[]->(m:Table2)\nRETURN n.COLUMN1, n.COLUMN2');
// });
