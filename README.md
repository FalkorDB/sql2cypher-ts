[![Tests](https://img.shields.io/github/actions/workflow/status/falkordb/sql2cypher-ts/ci.yml?branch=main)](https://github.com/falkordb/sql2cypher-ts/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/falkordb/sql2cypher-ts/branch/main/graph/badge.svg?token=nNxm2N0Xrl)](https://codecov.io/gh/falkordb/sql2cypher-ts)
[![License](https://img.shields.io/github/license/falkordb/sql2cypher-ts.svg)](https://github.com/falkordb/sql2cypher-ts/blob/main/LICENSE)
[![Discord](https://img.shields.io/discord/1146782921294884966.svg?style=social&logo=discord)](https://discord.com/invite/99y2Ubh6tg)
[![Twitter](https://img.shields.io/twitter/follow/falkordb?style=social)](https://twitter.com/falkordb)

# sql2cypher-ts

This is a TypeScript library that converts SQL queries to Cypher queries. It is based on the SQL parser library [sql-parser](https://www.npmjs.com/package/node-sql-parser)

## Installation

```bash
npm install sql2cypher-ts
```

## Usage

```typescript
import { SQL2Cypher } from 'sql2cypher-ts';

const converter = new SQL2Cypher();

const sql = 'SELECT * FROM table WHERE column = 1';
const cypher = converter.convert(sql);
console.log(cypher);
```

## Supported SQL queries

- SELECT
