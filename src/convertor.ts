import { OrderByClause, SqlParseResult, WhereCondition, WhereExpression, WhereOperator } from "./types";

export class SqlToCypherConverter {
    private tokenize(sql: string): string[] {
        // Split SQL into tokens, preserving quoted strings and operators
        const regex = /('[^']*'|\b\w+\b|[<>=!]+|\(|\)|,)/g;
        return (sql.match(regex) || []).filter(token => token.trim());
    }

    private parseSQL(sql: string): SqlParseResult {
        const tokens = this.tokenize(sql.trim().toUpperCase());
        const result: SqlParseResult = {
            type: 'SELECT',
            tables: [],
            columns: []
        };

        // Determine query type
        result.type = this.determineQueryType(tokens[0]);

        let currentIndex = 1; // Skip query type token

        // Parse SELECT columns
        if (result.type === 'SELECT') {
            const fromIndex = tokens.indexOf('FROM');
            if (fromIndex === -1) throw new Error('FROM clause is required');

            result.columns = this.parseColumns(tokens.slice(currentIndex, fromIndex));
            currentIndex = fromIndex + 1;
        }

        // Parse FROM clause
        const whereIndex = tokens.indexOf('WHERE');
        const orderByIndex = tokens.indexOf('ORDER');
        const limitIndex = tokens.indexOf('LIMIT');
        const endIndex = Math.min(...[whereIndex, orderByIndex, limitIndex]
            .filter(i => i !== -1)
            .concat([tokens.length]));

        result.tables = this.parseTables(tokens.slice(currentIndex, endIndex));

        // Parse WHERE clause if exists
        if (whereIndex !== -1) {
            const whereEndIndex = Math.min(...[orderByIndex, limitIndex]
                .filter(i => i !== -1)
                .concat([tokens.length]));
            const [whereExpr] = this.parseWhereExpression(tokens, whereIndex + 1);
            result.where = whereExpr;
        }

        // Parse ORDER BY if exists
        if (orderByIndex !== -1) {
            const orderByEndIndex = limitIndex !== -1 ? limitIndex : tokens.length;
            result.orderBy = this.parseOrderByClause(tokens.slice(orderByIndex + 2, orderByEndIndex));
        }

        // Parse LIMIT if exists
        if (limitIndex !== -1) {
            result.limit = parseInt(tokens[limitIndex + 1]);
        }

        return result;
    }

    private determineQueryType(token: string): SqlParseResult['type'] {
        switch (token) {
            case 'SELECT': return 'SELECT';
            case 'INSERT': return 'INSERT';
            case 'UPDATE': return 'UPDATE';
            case 'DELETE': return 'DELETE';
            default: throw new Error(`Unsupported query type: ${token}`);
        }
    }

    private parseColumns(tokens: string[]): string[] {
        if (tokens.length === 1 && tokens[0] === '*') return ['*'];
        return tokens
            .filter(token => token !== ',')
            .map(col => col.trim());
    }

    private parseTables(tokens: string[]): string[] {
        return tokens
            .filter(token => token !== ',')
            .map(table => table.trim());
    }

    private parseWhereExpression(tokens: string[], startIndex: number): [WhereExpression, number] {
        // First collect all conditions connected by OR
        let currentIndex = startIndex;
        const orExpressions: WhereExpression[] = [];
        let currentAndGroup: WhereExpression[] = [];

        while (currentIndex < tokens.length) {
            const token = tokens[currentIndex];

            if (token === ')') {
                break;
            }

            if (token === '(') {
                const [subExpr, nextIndex] = this.parseWhereExpression(tokens, currentIndex + 1);
                currentAndGroup.push(subExpr);
                currentIndex = nextIndex;
                continue;
            }

            if (token === 'OR') {
                // If we have accumulated AND conditions, wrap them in a group
                if (currentAndGroup.length > 1) {
                    orExpressions.push({
                        type: 'GROUP',
                        operator: 'AND',
                        expressions: [...currentAndGroup]
                    });
                } else if (currentAndGroup.length === 1) {
                    orExpressions.push(currentAndGroup[0]);
                }
                currentAndGroup = [];
                currentIndex++;
                continue;
            }

            if (token === 'AND') {
                currentIndex++;
                continue;
            }

            // Parse single condition
            const condition = this.parseCondition(tokens, currentIndex);
            if (condition) {
                currentAndGroup.push(condition[0]);
                currentIndex = condition[1];
                continue;
            }

            currentIndex++;
        }

        // Handle any remaining AND conditions
        if (currentAndGroup.length > 1) {
            orExpressions.push({
                type: 'GROUP',
                operator: 'AND',
                expressions: [...currentAndGroup]
            });
        } else if (currentAndGroup.length === 1) {
            orExpressions.push(currentAndGroup[0]);
        }

        // If we have multiple OR expressions, wrap them in an OR group
        if (orExpressions.length > 1) {
            return [{
                type: 'GROUP',
                operator: 'OR',
                expressions: orExpressions
            }, currentIndex + 1];
        }

        // If we only have one expression, return it directly
        if (orExpressions.length === 1) {
            return [orExpressions[0], currentIndex + 1];
        }

        // Fallback case (should not happen with valid SQL)
        return [{
            type: 'GROUP',
            operator: 'AND',
            expressions: []
        }, currentIndex + 1];
    }

    private parseCondition(tokens: string[], startIndex: number): [WhereCondition, number] | null {
        const field = tokens[startIndex];
        const operator = this.parseOperator(tokens[startIndex + 1]);
        if (!operator) return null;

        let value: any;
        let endIndex = startIndex + 2;

        if (operator === 'IN' || operator === 'NOT IN') {
            // Parse IN clause values
            const values: string[] = [];
            endIndex++; // Skip opening parenthesis
            while (endIndex < tokens.length && tokens[endIndex] !== ')') {
                if (tokens[endIndex] !== ',') {
                    values.push(this.cleanValue(tokens[endIndex]));
                }
                endIndex++;
            }
            value = values;
            endIndex++; // Skip closing parenthesis
        } else if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
            value = null;
            endIndex++;
        } else {
            value = this.cleanValue(tokens[startIndex + 2]);
            endIndex = startIndex + 3;
        }

        return [{
            type: 'CONDITION',
            field,
            operator,
            value
        }, endIndex];
    }

    private parseOperator(token: string): WhereOperator | null {
        const operatorMap: { [key: string]: WhereOperator } = {
            '=': '=',
            '<>': '<>',
            '>': '>',
            '<': '<',
            '>=': '>=',
            '<=': '<=',
            'LIKE': 'LIKE',
            'NOT LIKE': 'NOT LIKE',
            'IN': 'IN',
            'NOT IN': 'NOT IN',
            'IS NULL': 'IS NULL',
            'IS NOT NULL': 'IS NOT NULL'
        };
        return operatorMap[token] || null;
    }

    private parseOrderByClause(tokens: string[]): OrderByClause[] {
        const clauses: OrderByClause[] = [];
        let currentField = '';

        for (const token of tokens) {
            if (token === ',') continue;
            if (token === 'ASC' || token === 'DESC') {
                clauses.push({
                    field: currentField,
                    direction: token as 'ASC' | 'DESC'
                });
                currentField = '';
            } else {
                currentField = token;
            }
        }

        // Handle case where no direction is specified (defaults to ASC)
        if (currentField) {
            clauses.push({
                field: currentField,
                direction: 'ASC'
            });
        }

        return clauses;
    }

    private cleanValue(value: string): any {
        if (value.startsWith("'") && value.endsWith("'")) {
            return value.slice(1, -1);
        }
        if (!isNaN(Number(value))) {
            return Number(value);
        }
        return value;
    }

    private buildCypherMatch(parsed: SqlParseResult): string {
        const nodeLabel = this.convertToNodeLabel(parsed.tables[0]);
        return `MATCH (n:${nodeLabel})`;
    }

    private buildCypherWhere(expr: WhereExpression | undefined): string {
        if (!expr) return '';

        const formatValue = (value: any): string => {
            if (value === null) return 'null';
            if (Array.isArray(value)) return `[${value.map(v => `'${v}'`).join(', ')}]`;
            if (typeof value === 'string') return `'${value}'`;
            return value.toString();
        };

        const buildExpr = (expr: WhereExpression): string => {
            switch (expr.type) {
                case 'CONDITION':
                    switch (expr.operator) {
                        case 'LIKE':
                            return `n.${expr.field} =~ '${expr.value.replace(/%/g, '.*')}'`;
                        case 'NOT LIKE':
                            return `NOT n.${expr.field} =~ '${expr.value.replace(/%/g, '.*')}'`;
                        case 'IN':
                            return `n.${expr.field} IN ${formatValue(expr.value)}`;
                        case 'NOT IN':
                            return `NOT n.${expr.field} IN ${formatValue(expr.value)}`;
                        case 'IS NULL':
                            return `n.${expr.field} IS NULL`;
                        case 'IS NOT NULL':
                            return `n.${expr.field} IS NOT NULL`;
                        default:
                            return `n.${expr.field} ${expr.operator} ${formatValue(expr.value)}`;
                    }
                case 'GROUP':
                    return `(${expr.expressions.map(e => buildExpr(e)).join(` ${expr.operator} `)})`;
                case 'BINARY':
                    return `${buildExpr(expr.left)} ${expr.operator} ${buildExpr(expr.right)}`;
            }
        };

        return `WHERE ${buildExpr(expr)}`;
    }

    private buildCypherReturn(columns: string[]): string {
        if (columns.includes('*') || columns.length === 0) {
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

    private convertToNodeLabel(table: string): string {
        return table.charAt(0).toUpperCase() + table.slice(1).toLowerCase();
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