import { Parser } from 'node-sql-parser';
import {
  isColumnRef,
  isSQLValue,
  ASTType,
  TableRef,
  ColumnRef,
  SQLValue,
  BinaryExpression,
  Column,
  AggregateExpression,
  OrderByExpression,
  SelectAST,
  InsertAST,
  UpdateAST,
  DeleteAST
} from './types';

export class SQL2Cypher {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  public convert(sqlQuery: string): string {
    try {
      const ast = this.parser.astify(sqlQuery) as ASTType;
      return this.astToCypher(ast);
    } catch (error) {
      throw new Error(`Failed to parse SQL query: ${(error as Error).message}`);
    }
  }

  private astToCypher(ast: ASTType): string {
    switch (ast.type) {
      case 'select':
        return this.handleSelect(ast);
      case 'insert':
        return this.handleInsert(ast);
      case 'update':
        return this.handleUpdate(ast);
      case 'delete':
        return this.handleDelete(ast);
      default:
        const exhaustiveCheck: never = ast;
        throw new Error(`Unsupported query type: ${(exhaustiveCheck as ASTType).type}`);
    }
  }

  private handleSelect(ast: SelectAST): string {
    const { columns, from, where, groupby, orderby, limit } = ast;

    const matchClause = this.buildMatchClause(from);
    const returnClause = this.buildReturnClause(columns, from);
    const whereClause = where ? `WHERE ${this.buildWhereClause(where, from)}` : '';
    const orderByClause = orderby ? `ORDER BY ${this.buildOrderByClause(orderby)}` : '';
    const limitClause = limit ? `LIMIT ${limit.value}` : '';
    const groupByClause = groupby ? `WITH ${this.buildGroupByClause(groupby)}` : '';

    return [matchClause, whereClause, groupByClause, returnClause, orderByClause, limitClause]
      .filter(Boolean)
      .join('\n');
  }

  private handleInsert(ast: InsertAST): string {
    const { table, columns, values } = ast;

    // Ensure table is correctly parsed
    const tableName = table[0].table;
    if (!tableName) {
      throw new Error(`Unable to extract table name from: ${JSON.stringify(table)}`);
    }

    // Handle multiple value sets 
    const createClauses = values.map((valueSet) => {
      return `(:${tableName} {${columns.map((col, idx) => {
        const value = typeof valueSet.value[idx].value === 'string' ? `'${valueSet.value[idx].value}'` : valueSet.value[idx].value;
        return `${col}: ${value}`
      }).join(', ')}})`;
    });

    return `CREATE ${createClauses.join(', ')}`;
  }

  private handleUpdate(ast: UpdateAST): string {
    const { table, set, where } = ast;

    // Ensure table is correctly parsed
    const tableName = table[0].table;
    if (!tableName) {
      throw new Error(`Unable to extract table name from: ${JSON.stringify(table)}`);
    }

    const alias = table[0].as || tableName;

    // Build SET clause with correct value extraction
    const setClause = set.map(item => {
      // More robust value extraction
      let value = item.value;

      // If value is an object with a 'value' property, extract it
      if (typeof value === 'object' && value !== null && 'value' in value) {
        value = (value as any).value;
      }

      return `${alias}.${item.column} = ${typeof value === 'string' ? `'${value}'` : value}`;
    }).join(', ');

    const whereClause = where ? `WHERE ${this.buildWhereClause(where, table)}\n` : '';

    return `MATCH (${alias}:${tableName})\n${whereClause}SET ${setClause}`;
  }

  private handleDelete(ast: DeleteAST): string {
    const { from, where } = ast;
    const whereClause = where ? `WHERE ${this.buildWhereClause(where, from)}\n` : '';

    const matches = from.map(table => {
      const alias = table.as || table.table;
      return `(${alias}:${table.table})`;
    }).join(', ');
    const deletes = from.map(table => table.as || table.table).join(', ');
    return `MATCH ${matches}\n${whereClause}DETACH DELETE ${deletes}`;
  }

  private buildMatchClause(fromClause: TableRef[]): string {
    if (!fromClause?.length) {
      throw new Error('FROM clause is required');
    }

    return fromClause.map(table => {
      const alias = table.as || table.table;
      return `MATCH (${alias}:${table.table})`;
    }).join('\n');
  }

  private buildReturnClause(columns: Column[] | '*', fromClause: TableRef[]): string {
    if (columns === '*') {
      return `RETURN ${fromClause[0].as || fromClause[0].table}.*`;
    }

    const returnItems = columns.map(col => {
      if (col.expr.type === 'column_ref') {
        const expr = col.expr as ColumnRef;
        return `${expr.table || fromClause[0].as || fromClause[0].table}.${expr.column}`;
      }
      if (col.expr.type === 'aggr_func') {
        const expr = col.expr as AggregateExpression;
        return `${expr.name}(${expr.args.column})`;
      }
      return (col.expr as SQLValue).value;
    });

    return `RETURN ${returnItems.join(', ')}`;
  }

  private buildWhereClause(where: BinaryExpression, fromClause: TableRef[]): string {
    const left = where.left;
    const right = where.right;

    let leftStr: string;
    if (isColumnRef(left)) {
      leftStr = `${left.table || fromClause[0].table}.${left.column}`;
    } else if (isSQLValue(left)) {
      leftStr = typeof left.value === 'string' ? `'${left.value}'` : left.value;
    } else {
      // Add parentheses for nested conditions on the left
      leftStr = this.buildWhereClause(left as BinaryExpression, fromClause);
    }

    let rightStr: string;
    if (isColumnRef(right)) {
      rightStr = `${right.table || fromClause[0].table}.${right.column}`;
    } else if (isSQLValue(right)) {
      rightStr = typeof right.value === 'string' ? `'${right.value}'` : right.value;
    } else {
      // Add parentheses for nested conditions on the right if it's an OR condition
      const rightExpr = right as BinaryExpression;
      rightStr = rightExpr.operator === 'OR' ?
        `(${this.buildWhereClause(rightExpr, fromClause)})` :
        this.buildWhereClause(rightExpr, fromClause);
    }

    return `${leftStr} ${where.operator} ${rightStr}`;
  }

  private buildOrderByClause(orderby: OrderByExpression[]): string {
    return orderby.map(order => {
      const direction = order.type === 'ASC' ? 'ASC' : 'DESC';
      return `${order.expr.column} ${direction}`;
    }).join(', ');
  }

  private buildGroupByClause(groupby: ColumnRef[]): string {
    const columns = groupby.map(group => group.column).join(', ');
    return `${columns}, count(*) as count`;
  }
}