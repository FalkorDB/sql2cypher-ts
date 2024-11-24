export type SqlParseResult = {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    tables: string[];
    columns: string[];
    where?: WhereExpression;
    orderBy?: OrderByClause[];
    limit?: number;
    joins?: JoinClause[];
};

export type JoinType = 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN';

export type JoinClause = {
    type: JoinType;
    table: string;
    condition: WhereCondition;
};

export type WhereOperator = '=' | '<>' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';

export type WhereCondition = {
    type: 'CONDITION';
    field: string;
    operator: WhereOperator;
    value: any;
    isJoinCondition?: boolean;
};

export type WhereExpression = WhereCondition | {
    type: 'GROUP';
    operator: 'AND' | 'OR';
    expressions: WhereExpression[];
} | {
    type: 'BINARY';
    operator: string;
    left: WhereExpression;
    right: WhereExpression;
};

export type OrderByClause = {
    field: string;
    direction: 'ASC' | 'DESC';
};