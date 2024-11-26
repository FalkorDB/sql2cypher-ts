// Define interfaces to match node-sql-parser AST structure
export interface BaseAST {
  type: string;
}

export interface TableRef {
  table: string;
  as?: string;
}

export interface ColumnRef {
  type: 'column_ref';
  table?: string;
  column?: string;
}

export interface SQLValue {
  type: 'single_quote_string' | 'string' | 'number' | 'bool';
  value: any;
}

export interface BinaryExpression {
  type: 'binary_expr';
  operator: string;
  left: ColumnRef | SQLValue | BinaryExpression;
  right: ColumnRef | SQLValue | BinaryExpression;
}

export interface Column {
  expr: ColumnRef | SQLValue | AggregateExpression;
  as?: string;
}

export interface AggregateExpression {
  type: 'aggr_func';
  name: string;
  args: {
    column: string;
  };
}

export interface OrderByExpression {
  type: string;
  expr: ColumnRef;
}

export interface LimitExpression {
  type: string;
  value: number;
}

export interface SetExpression {
  column: string;
  value: string | number | boolean;
  table?: string;
}

export interface SelectAST extends BaseAST {
  type: 'select';
  columns: Column[] | '*';
  from: TableRef[];
  where?: BinaryExpression;
  groupby?: ColumnRef[];
  orderby?: OrderByExpression[];
  limit?: LimitExpression;
}

export interface InsertAST extends BaseAST {
  type: 'insert';
  table: TableRef[];
  columns: string[];
  values: { type: 'expr_list'; value: SQLValue[] }[];
}

export interface UpdateAST extends BaseAST {
  type: 'update';
  table: TableRef[];
  set: SetExpression[];
  where?: BinaryExpression;
}

export interface DeleteAST extends BaseAST {
  type: 'delete';
  from: TableRef[];
  where?: BinaryExpression;
}

export type ASTType = SelectAST | InsertAST | UpdateAST | DeleteAST;

export function isColumnRef(expr: ColumnRef | SQLValue | BinaryExpression): expr is ColumnRef {
  return expr.type === 'column_ref';
}

export function isSQLValue(expr: ColumnRef | SQLValue | BinaryExpression): expr is SQLValue {
  return ['single_quote_string', 'string', 'number', 'bool'].includes(expr.type);
}