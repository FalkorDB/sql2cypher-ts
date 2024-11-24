import { OrderByClause, SqlParseResult, WhereCondition, WhereExpression, WhereOperator, JoinClause, JoinType } from "./types";

export class SqlToCypherConverter {
    private tokenize(sql: string): string[] {
        // Enhanced regex to handle JOIN keywords
        const regex = /('[^']*'|\b\w+\b|[<>=!]+|\(|\)|,|\.|JOIN|ON|INNER|LEFT|RIGHT)/g;
        return (sql.match(regex) || []).filter(token => token.trim());
    }

    private parseSQL(sql: string): SqlParseResult {
        const tokens = this.tokenize(sql.trim().toUpperCase());
        const result: SqlParseResult = {
            type: 'SELECT',
            tables: [],
            columns: [],
            joins: []
        };

        result.type = this.determineQueryType(tokens[0]);
        let currentIndex = 1;

        if (result.type === 'SELECT') {
            const fromIndex = tokens.indexOf('FROM');
            if (fromIndex === -1) throw new Error('FROM clause is required');

            result.columns = this.parseColumns(tokens.slice(currentIndex, fromIndex));
            currentIndex = fromIndex + 1;
        }

        // Parse FROM clause and any subsequent JOINs
        const whereIndex = tokens.indexOf('WHERE');
        const orderByIndex = tokens.indexOf('ORDER');
        const limitIndex = tokens.indexOf('LIMIT');

        // Find the first JOIN keyword
        const joinIndex = this.findFirstJoinIndex(tokens, currentIndex);

        // Parse initial table
        const tableEndIndex = joinIndex !== -1 ? joinIndex : Math.min(...[whereIndex, orderByIndex, limitIndex]
            .filter(i => i !== -1)
            .concat([tokens.length]));

        result.tables = this.parseTables(tokens.slice(currentIndex, tableEndIndex));

        // Parse JOINs if they exist
        if (joinIndex !== -1) {
            const joinEndIndex = Math.min(...[whereIndex, orderByIndex, limitIndex]
                .filter(i => i !== -1)
                .concat([tokens.length]));
            result.joins = this.parseJoins(tokens, joinIndex, joinEndIndex);
            currentIndex = joinEndIndex;
        }

        // Parse WHERE clause if exists
        if (whereIndex !== -1) {
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

    private findFirstJoinIndex(tokens: string[], startIndex: number): number {
        const joinKeywords = ['JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN'];
        return Math.min(...joinKeywords.map(keyword => {
            const index = tokens.indexOf(keyword.split(' ')[0], startIndex);
            return index !== -1 ? index : Infinity;
        }));
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


    private parseJoins(tokens: string[], startIndex: number, endIndex: number): JoinClause[] {
        const joins: JoinClause[] = [];
        let currentIndex = startIndex;

        while (currentIndex < endIndex) {
            const joinType = this.determineJoinType(tokens, currentIndex);
            if (!joinType) break;

            // Skip join type tokens
            currentIndex += joinType.split(' ').length;

            // Get table name
            const table = tokens[currentIndex];
            currentIndex++;

            // Parse ON condition
            if (tokens[currentIndex] !== 'ON') {
                throw new Error('JOIN must have ON clause');
            }
            currentIndex++;

            // Parse join condition
            const condition = this.parseJoinCondition(tokens, currentIndex);
            currentIndex = condition.nextIndex;

            joins.push({
                type: joinType,
                table,
                condition: condition.condition
            });
        }

        return joins;
    }

    private determineJoinType(tokens: string[], index: number): JoinType | null {
        const token = tokens[index];
        const nextToken = tokens[index + 1];

        if (token === 'JOIN') return 'INNER JOIN';
        if (token === 'INNER' && nextToken === 'JOIN') return 'INNER JOIN';
        if (token === 'LEFT' && nextToken === 'JOIN') return 'LEFT JOIN';
        if (token === 'RIGHT' && nextToken === 'JOIN') return 'RIGHT JOIN';
        return null;
    }

    private parseJoinCondition(tokens: string[], startIndex: number): { condition: WhereCondition, nextIndex: number } {
        // Parse basic join condition (e.g., table1.id = table2.id)
        const leftParts = tokens[startIndex].split('.');
        const operator = tokens[startIndex + 1];
        const rightParts = tokens[startIndex + 2].split('.');

        return {
            condition: {
                type: 'CONDITION',
                field: leftParts.join('.'),
                operator: operator as WhereOperator,
                value: rightParts.join('.'),
                isJoinCondition: true
            },
            nextIndex: startIndex + 3
        };
    }

    private buildCypherMatch(parsed: SqlParseResult): string {
        const mainTable = this.convertToNodeLabel(parsed.tables[0]);
        let match = `MATCH (n:${mainTable})`;

        // Add JOIN patterns
        if (parsed.joins && parsed.joins.length > 0) {
            match = parsed.joins.reduce((acc, join) => {
                const joinTable = this.convertToNodeLabel(join.table);
                const [leftTable, leftField] = (join.condition.field as string).split('.');
                const [rightTable] = (join.condition.value as string).split('.');

                // Use relationship properties based on join fields if specified
                const relProps = leftField ? `[r {${leftField}: ${rightTable}.${leftField}}]` : '[]';

                // Convert SQL join to Cypher pattern
                switch (join.type) {
                    case 'INNER JOIN':
                        return `${acc}\nMATCH (${leftTable})-${relProps}->(${rightTable}:${joinTable})`;
                    case 'LEFT JOIN':
                        return `${acc}\nOPTIONAL MATCH (${leftTable})-${relProps}->(${rightTable}:${joinTable})`;
                    case 'RIGHT JOIN':
                        return `${acc}\nOPTIONAL MATCH (${leftTable})<-${relProps}-(${rightTable}:${joinTable})`;
                }
            }, match);
        }

        return match;
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

    private buildCypherReturn(columns: string[], joins?: JoinClause[]): string {
        if (columns.includes('*')) {
            if (!joins || joins.length === 0) {
                return 'RETURN n';
            }
            // Return all properties from all joined nodes
            const tables = ['n', ...joins.map(j => j.table.toLowerCase())];
            return `RETURN ${tables.join(', ')}`;
        }

        // If no columns specified (shouldn't happen in valid SQL), return all properties
        if (columns.length === 0) {
            return 'RETURN n';
        }

        // Handle specific columns with table prefixes
        const returnParts = columns.map(col => {
            const parts = col.split('.');
            if (parts.length === 2) {
                // Table-prefixed column
                const [table, field] = parts;
                return `${table.toLowerCase()}.${field}`;
            }
            // Non-prefixed column assumes main table
            return `n.${col}`;
        });

        return `RETURN ${returnParts.join(', ')}`;
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
                    this.buildCypherReturn(parsed.columns, parsed.joins),
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