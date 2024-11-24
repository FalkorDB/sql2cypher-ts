// Define interfaces to match node-sql-parser AST structure
interface BaseAST {
  type: string;
}

interface TableRef {
  table: string;
  as?: string;
}

interface ColumnRef {
  type: 'column_ref';
  table?: string;
  column?: string;
}

interface SQLValue {
  type: 'string' | 'number' | 'bool';
  value: any;
}

interface BinaryExpression {
  type: 'binary_expr';
  operator: string;
  left: ColumnRef | SQLValue | BinaryExpression;
  right: ColumnRef | SQLValue | BinaryExpression;
}

interface Column {
  expr: ColumnRef | SQLValue | AggregateExpression;
  as?: string;
}

interface AggregateExpression {
  type: 'aggr_func';
  name: string;
  args: {
    column: string;
  };
}

interface OrderByExpression {
  type: string;
  expr: ColumnRef;
}

interface LimitExpression {
  type: string;
  value: number;
}

interface SetExpression {
  column: string;
  value: string | number | boolean;
  table?: string;
}

interface SelectAST extends BaseAST {
  type: 'select';
  columns: Column[] | '*';
  from: TableRef[];
  where?: BinaryExpression;
  groupby?: ColumnRef[];
  orderby?: OrderByExpression[];
  limit?: LimitExpression;
}

interface InsertAST extends BaseAST {
  type: 'insert';
  table: TableRef;
  columns: string[];
  values: { type: 'expr_list'; value: SQLValue[] }[];
}

interface UpdateAST extends BaseAST {
  type: 'update';
  table: TableRef[];
  set: SetExpression[];
  where?: BinaryExpression;
}

interface DeleteAST extends BaseAST {
  type: 'delete';
  from: TableRef[];
  where?: BinaryExpression;
}

type ASTType = SelectAST | InsertAST | UpdateAST | DeleteAST;

function isColumnRef(expr: ColumnRef | SQLValue | BinaryExpression): expr is ColumnRef {
  return expr.type === 'column_ref';
}

function isSQLValue(expr: ColumnRef | SQLValue | BinaryExpression): expr is SQLValue {
  return ['string', 'number', 'bool'].includes(expr.type);
}