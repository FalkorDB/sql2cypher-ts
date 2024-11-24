import { SQL2Cypher } from './convertor';

const converter = new SQL2Cypher();

test('converts SELECT * FROM t', () => {
    const result = converter.convert('SELECT * FROM t1');
    expect(result).toBe('MATCH (t1:t1)\nRETURN t1.*');
});

test('converts SELECT column FROM t1', () => {
    const result = converter.convert('SELECT column FROM t1');
    expect(result).toBe('MATCH (t1:t1)\nRETURN t1.column');
});

test('converts SELECT t1.column FROM t1', () => {
  const result = converter.convert('SELECT t1.column FROM t1');
  expect(result).toBe('MATCH (t1:t1)\nRETURN t1.column');
});

test('converts SELECT column1, column2 FROM t1', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1');
    expect(result).toBe('MATCH (t1:t1)\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 AND column2 = 2', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 AND column2 = 2');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND t1.column2 = 2\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 OR column2 = 2', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 OR column2 = 2');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 OR t1.column2 = 2\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 OR column2 = 2 AND column3 = 3', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 OR column2 = 2 AND column3 = 3');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 OR t1.column2 = 2 AND t1.column3 = 3\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 AND column2 = 2 OR column3 = 3', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 AND column2 = 2 OR column3 = 3');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND t1.column2 = 2 OR t1.column3 = 3\nRETURN t1.column1, t1.column2');
});

// Test Join 2 tables with INNER JOIN
// test('converts SELECT column1, column2 FROM t1 INNER JOIN t2 ON t1.column1 = t2.column1', () => {
//     const result = converter.convert('SELECT t1.column1, t1.column2 FROM t1 INNER JOIN t2 ON t1.column1 = t2.column1');
//     expect(result).toBe('MATCH (t1:t1)-[]->(m:t2)\nRETURN t1.column1, t1.column2');
// });
