import { SqlParseResult, WhereClause, OrderByClause} from './types';

// converter.ts
export class SqlToCypherConverter {
    private parseSQL(sql: string): SqlParseResult {
        // Basic SQL parsing - this is a simplified version
        sql = sql.trim().toUpperCase();
        const result: SqlParseResult = {
            type: 'SELECT',
            tables: [],
            columns: []
        };

        // Determine query type
        if (sql.startsWith('SELECT')) {
            result.type = 'SELECT';
        } else if (sql.startsWith('INSERT')) {
            result.type = 'INSERT';
        } else if (sql.startsWith('UPDATE')) {
            result.type = 'UPDATE';
        } else if (sql.startsWith('DELETE')) {
            result.type = 'DELETE';
        }

        // Parse FROM clause
        const fromMatch = sql.match(/FROM\s+([^\s]+)/);
        if (fromMatch) {
            result.tables = [fromMatch[1]];
        }

        // Parse SELECT columns
        if (result.type === 'SELECT') {
            const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/);
            if (selectMatch) {
                result.columns = selectMatch[1].split(',').map(col => col.trim());
            }
        }

        // Parse WHERE clause
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s*$)/i);
        if (whereMatch) {
            result.where = this.parseWhereClause(whereMatch[1]);
        }

        // Parse ORDER BY
        const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s*$)/i);
        if (orderMatch) {
            result.orderBy = this.parseOrderByClause(orderMatch[1]);
        }

        // Parse LIMIT
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
            result.limit = parseInt(limitMatch[1]);
        }

        return result;
    }

    private parseWhereClause(whereStr: string): WhereClause[] {
        const conditions = whereStr.split('AND').map(condition => {
            const parts = condition.trim().split(/\s+/);
            return {
                field: parts[0],
                operator: parts[1],
                value: parts[2].replace(/'/g, '')
            };
        });
        return conditions;
    }

    private parseOrderByClause(orderStr: string): OrderByClause[] {
        return orderStr.split(',').map(part => {
            const [field, direction = 'ASC'] = part.trim().split(/\s+/);
            return {
                field,
                direction: direction as 'ASC' | 'DESC'
            };
        });
    }

    private convertToNodeLabel(table: string): string {
        return table.charAt(0).toUpperCase() + table.slice(1).toLowerCase();
    }

    private buildCypherMatch(parsed: SqlParseResult): string {
        const nodeLabel = this.convertToNodeLabel(parsed.tables[0]);
        return `MATCH (n:${nodeLabel})`;
    }

    private buildCypherWhere(whereClauses?: WhereClause[]): string {
        if (!whereClauses || whereClauses.length === 0) return '';

        const conditions = whereClauses.map(clause => {
            let operator = clause.operator;
            switch (operator) {
                case '=': operator = '='; break;
                case '<>': operator = '<>'; break;
                case 'LIKE': return `n.${clause.field} =~ '${clause.value.replace(/%/g, '.*')}'`;
                default: operator = clause.operator;
            }
            return `n.${clause.field} ${operator} '${clause.value}'`;
        });

        return `WHERE ${conditions.join(' AND ')}`;
    }

    private buildCypherReturn(columns: string[]): string {
        if (columns.includes('*')) {
            return 'RETURN n';
        }
        const props = columns.map(col => `n.${col}`).join(', ');
        return `RETURN ${props}`;
    }

    private buildCypherOrderBy(orderBy?: OrderByClause[]): string {
        if (!orderBy || orderBy.length === 0) return '';
        const parts = orderBy.map(clause => `n.${clause.field} ${clause.direction}`);
        return `ORDER BY ${parts.join(', ')}`;
    }

    private buildCypherLimit(limit?: number): string {
        return limit ? `LIMIT ${limit}` : '';
    }

    public convert(sql: string): string {
        const parsed = this.parseSQL(sql);
        let cypher = '';

        switch (parsed.type) {
            case 'SELECT':
                cypher = [
                    this.buildCypherMatch(parsed),
                    this.buildCypherWhere(parsed.where),
                    this.buildCypherReturn(parsed.columns),
                    this.buildCypherOrderBy(parsed.orderBy),
                    this.buildCypherLimit(parsed.limit)
                ].filter(part => part).join('\n');
                break;

            default:
                throw new Error(`Query type ${parsed.type} not supported yet`);
        }

        return cypher;
    }
}

