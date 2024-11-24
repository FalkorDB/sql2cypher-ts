import { Parser } from 'node-sql-parser';
import { isColumnRef, isSQLValue, ASTType, TableRef, ColumnRef, SQLValue, BinaryExpression, Column, AggregateExpression, OrderByExpression, SetExpression, SelectAST, InsertAST, UpdateAST, DeleteAST } from './types';

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
    const props = columns.reduce<Record<string, any>>((acc, col, idx) => {
      acc[col] = values[0].value[idx].value;
      return acc;
    }, {});

    return `CREATE (n:${table.table}) SET n = ${JSON.stringify(props)}`;
  }

  private handleUpdate(ast: UpdateAST): string {
    const { table, set, where } = ast;
    const setClause = this.buildSetClause(set);
    const whereClause = where ? `WHERE ${this.buildWhereClause(where, table)}` : '';

    return `MATCH (n:${table[0].table})\n${whereClause}\nSET ${setClause}`;
  }

  private handleDelete(ast: DeleteAST): string {
    const { from, where } = ast;
    const whereClause = where ? `WHERE ${this.buildWhereClause(where, from)}` : '';

    return `MATCH (n:${from[0].table})\n${whereClause}\nDETACH DELETE n`;
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
      return `RETURN ${fromClause[0].table}.*`;
    }

    const returnItems = columns.map(col => {
      if (col.expr.type === 'column_ref') {
        const expr = col.expr as ColumnRef;
        return `${expr.table || fromClause[0].table}.${expr.column}`;
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
    if (isColumnRef(left)){
      leftStr = `${left.table || fromClause[0].table}.${left.column}`;
    } else if (isSQLValue(left)) {
      leftStr = typeof left.value === 'string' ? `'${left.value}'` : left.value;
    } else { 
      leftStr = this.buildWhereClause(left as BinaryExpression, fromClause);
    }

    let rightStr: string;
    if (isColumnRef(right)) {
      rightStr = `${right.table || fromClause[0].table}.${right.column}`;
    } else if (isSQLValue(right)) {
      rightStr = typeof right.value === 'string' ? `'${right.value}'` : right.value;
    } else {
      rightStr = this.buildWhereClause(right as BinaryExpression, fromClause);
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

  private buildSetClause(set: SetExpression[]): string {
    return set.map(item => {
      const value = typeof item.value === 'string' ? `'${item.value}'` : item.value;
      return `n.${item.column} = ${value}`;
    }).join(', ');
  }
}

