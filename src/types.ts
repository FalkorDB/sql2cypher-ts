export interface SqlParseResult {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    tables: string[];
    columns: string[];
    where?: WhereClause[];
    orderBy?: OrderByClause[];
    limit?: number;
  }
  
  export interface WhereClause {
    field: string;
    operator: string;
    value: any;
  }
  
  export interface OrderByClause {
    field: string;
    direction: 'ASC' | 'DESC';
  }