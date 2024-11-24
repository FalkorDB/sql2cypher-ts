export interface SqlParseResult {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    tables: string[];
    columns: string[];
    where?: WhereExpression;
    orderBy?: OrderByClause[];
    limit?: number;
  }
  
  export interface OrderByClause {
    field: string;
    direction: 'ASC' | 'DESC';
  }
  
  export type WhereExpression = 
    | WhereCondition
    | WhereGroup
    | WhereBinaryOperation;
  
  export interface WhereCondition {
    type: 'CONDITION';
    field: string;
    operator: WhereOperator;
    value: any;
  }
  
  export interface WhereGroup {
    type: 'GROUP';
    operator: 'AND' | 'OR';
    expressions: WhereExpression[];
  }
  
  export interface WhereBinaryOperation {
    type: 'BINARY';
    left: WhereExpression;
    operator: 'AND' | 'OR';
    right: WhereExpression;
  }
  
  export type WhereOperator = 
    | '=' 
    | '<>' 
    | '>' 
    | '<' 
    | '>=' 
    | '<=' 
    | 'LIKE' 
    | 'NOT LIKE'
    | 'IN'
    | 'NOT IN'
    | 'IS NULL'
    | 'IS NOT NULL';
