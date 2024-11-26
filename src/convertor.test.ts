import { SQL2Cypher } from './convertor';

const converter = new SQL2Cypher();

test('converts SELECT * FROM t1', () => {
    const result = converter.convert('SELECT * FROM t1');
    expect(result).toBe('MATCH (t1:t1)\nRETURN t1.*');
});

test('converts SELECT * FROM t1 as n', () => {
    const result = converter.convert('SELECT * FROM t1 as n');
    expect(result).toBe('MATCH (n:t1)\nRETURN n.*');
});

test('converts SELECT column FROM t1', () => {
    const result = converter.convert('SELECT column FROM t1');
    expect(result).toBe('MATCH (t1:t1)\nRETURN t1.column');
});

test('converts SELECT column FROM t1 as n', () => {
    const result = converter.convert('SELECT column FROM t1 as n');
    expect(result).toBe('MATCH (n:t1)\nRETURN n.column');
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

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 AND (column2 = 2 OR column3 = 3)', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 AND (column2 = 2 OR column3 = 3)');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND (t1.column2 = 2 OR t1.column3 = 3)\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 AND (column2 = 2 OR column3 = 3) AND column4 = 4', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 AND (column2 = 2 OR column3 = 3) AND column4 = 4');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND (t1.column2 = 2 OR t1.column3 = 3) AND t1.column4 = 4\nRETURN t1.column1, t1.column2');
});

test('converts SELECT column1, column2 FROM t1 WHERE column1 = 1 AND (column2 = 2 OR column3 = 3) AND column4 = 4 OR column5 = 5', () => {
    const result = converter.convert('SELECT column1, column2 FROM t1 WHERE column1 = 1 AND (column2 = 2 OR column3 = 3) AND (column4 = 4 OR column5 = 5)');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND (t1.column2 = 2 OR t1.column3 = 3) AND (t1.column4 = 4 OR t1.column5 = 5)\nRETURN t1.column1, t1.column2');
});

/**  Test cases for DELETE */
test('converts DELETE FROM t1', () => {
    const result = converter.convert('DELETE FROM t1');
    expect(result).toBe('MATCH (t1:t1)\nDETACH DELETE t1');
});

test('converts DELETE FROM t1 as n', () => {
    const result = converter.convert('DELETE FROM t1 as n');
    expect(result).toBe('MATCH (n:t1)\nDETACH DELETE n');
});

test('converts DELETE FROM t1 WHERE column1 = 1', () => {
    const result = converter.convert('DELETE FROM t1 WHERE column1 = 1');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1\nDETACH DELETE t1');
});

test('converts DELETE FROM t1 WHERE column1 = 1 AND column2 = 2', () => {
    const result = converter.convert('DELETE FROM t1 WHERE column1 = 1 AND column2 = 2');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND t1.column2 = 2\nDETACH DELETE t1');
});

test('converts DELETE FROM t1 WHERE column1 = 1 OR column2 = 2', () => {
    const result = converter.convert('DELETE FROM t1 WHERE column1 = 1 OR column2 = 2');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 OR t1.column2 = 2\nDETACH DELETE t1');
});

test('converts DELETE FROM t1 WHERE column1 = 1 OR column2 = 2 AND column3 = 3', () => {
    const result = converter.convert('DELETE FROM t1 WHERE column1 = 1 OR column2 = 2 AND column3 = 3');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 OR t1.column2 = 2 AND t1.column3 = 3\nDETACH DELETE t1');
});

test('converts DELETE FROM t1 WHERE column1 = 1 AND column2 = 2 OR column3 = 3', () => {
    const result = converter.convert('DELETE FROM t1 WHERE column1 = 1 AND column2 = 2 OR column3 = 3');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column1 = 1 AND t1.column2 = 2 OR t1.column3 = 3\nDETACH DELETE t1');
});

/** Test cases for INSERT */
test('converts INSERT INTO t1 (column1, column2) VALUES (1, 2)', () => {
    const result = converter.convert('INSERT INTO t1 (column1, column2) VALUES (1, 2)');
    expect(result).toBe('CREATE (:t1 {column1: 1, column2: 2})');
});

test('converts INSERT INTO t1 (column1, column2) VALUES (1, 2), (3, 4)', () => {
    const result = converter.convert('INSERT INTO t1 (column1, column2) VALUES (1, 2), (3, 4)');
    expect(result).toBe('CREATE (:t1 {column1: 1, column2: 2}), (:t1 {column1: 3, column2: 4})');
});


/**  Test cases for UPDATE */
test('converts UPDATE t1 SET column1 = 1, column2 = 2', () => {
    const result = converter.convert('UPDATE t1 SET column1 = 1, column2 = 2');
    expect(result).toBe('MATCH (t1:t1)\nSET t1.column1 = 1, t1.column2 = 2');
});

test('converts UPDATE t1 SET column1 = 1, column2 = 2 WHERE column3 = 3', () => {
    const result = converter.convert('UPDATE t1 SET column1 = 1, column2 = 2 WHERE column3 = 3');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column3 = 3\nSET t1.column1 = 1, t1.column2 = 2');
});

test('converts UPDATE t1 SET column1 = 1, column2 = 2 WHERE column3 = 3 AND column4 = 4', () => {
    const result = converter.convert('UPDATE t1 SET column1 = 1, column2 = 2 WHERE column3 = 3 AND column4 = 4');
    expect(result).toBe('MATCH (t1:t1)\nWHERE t1.column3 = 3 AND t1.column4 = 4\nSET t1.column1 = 1, t1.column2 = 2');
});