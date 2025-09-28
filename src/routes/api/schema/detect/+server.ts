import { json } from '@sveltejs/kit';

interface SchemaField {
    name: string;
    type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE';
    mode: 'REQUIRED' | 'NULLABLE' | 'REPEATED';
    description?: string;
}

export async function POST({ request }: { request: Request }) {
    try {
        const { content, type, fileName } = await request.json();

        if (!content || !type) {
            return json({ error: 'Content and type are required' }, { status: 400 });
        }

        let schema: SchemaField[] = [];

        if (type === 'csv') {
            schema = detectCSVSchema(content);
        } else if (type === 'json') {
            schema = detectJSONSchema(content);
        } else {
            return json({ error: 'Unsupported file type' }, { status: 400 });
        }

        return json({ schema });
    } catch (error) {
        console.error('Schema detection error:', error);
        return json(
            { error: error instanceof Error ? error.message : 'Failed to detect schema' },
            { status: 500 }
        );
    }
}

function detectCSVSchema(csvContent: string): SchemaField[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
    }

    // Parse CSV manually (basic implementation)
    const headers = parseCSVLine(lines[0]);
    const sampleRows = lines.slice(1, Math.min(11, lines.length)).map(line => parseCSVLine(line));

    return headers.map((header, index) => {
        const columnValues = sampleRows.map(row => row[index]).filter(val => val !== null && val !== undefined && val !== '');
        const type = inferColumnType(columnValues);

        return {
            name: sanitizeFieldName(header),
            type,
            mode: columnValues.length === sampleRows.length ? 'REQUIRED' : 'NULLABLE'
        };
    });
}

function detectJSONSchema(jsonContent: string): SchemaField[] {
    try {
        const data = JSON.parse(jsonContent);
        let records: any[] = [];

        if (Array.isArray(data)) {
            records = data.slice(0, 10); // Sample first 10 records
        } else if (typeof data === 'object' && data !== null) {
            records = [data];
        } else {
            throw new Error('JSON must be an object or array of objects');
        }

        if (records.length === 0) {
            throw new Error('No records found in JSON');
        }

        // Collect all possible field names
        const allFields = new Set<string>();
        records.forEach(record => {
            if (typeof record === 'object' && record !== null) {
                Object.keys(record).forEach(key => allFields.add(key));
            }
        });

        return Array.from(allFields).map(fieldName => {
            const values = records
                .map(record => record[fieldName])
                .filter(val => val !== null && val !== undefined);

            const type = inferColumnType(values);
            const isRequired = values.length === records.length;

            return {
                name: sanitizeFieldName(fieldName),
                type,
                mode: isRequired ? 'REQUIRED' : 'NULLABLE'
            };
        });
    } catch (error) {
        throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i += 2;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }

    result.push(current.trim());
    return result;
}

function inferColumnType(values: any[]): SchemaField['type'] {
    if (values.length === 0) return 'STRING';

    // Count type occurrences
    const typeCounts = {
        integer: 0,
        float: 0,
        boolean: 0,
        date: 0,
        timestamp: 0,
        string: 0
    };

    values.forEach(value => {
        const strValue = String(value).trim();

        if (strValue === '' || strValue.toLowerCase() === 'null') {
            return; // Skip empty/null values
        }

        // Check for boolean
        if (['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(strValue.toLowerCase())) {
            typeCounts.boolean++;
            return;
        }

        // Check for integer
        if (/^-?\d+$/.test(strValue)) {
            typeCounts.integer++;
            return;
        }

        // Check for float
        if (/^-?\d+\.\d+$/.test(strValue)) {
            typeCounts.float++;
            return;
        }

        // Check for timestamp (ISO format or common patterns)
        if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(strValue)) {
            typeCounts.timestamp++;
            return;
        }

        // Check for date
        if (/^\d{4}-\d{2}-\d{2}$/.test(strValue) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strValue)) {
            typeCounts.date++;
            return;
        }

        // Default to string
        typeCounts.string++;
    });

    // Determine the most likely type
    const total = Object.values(typeCounts).reduce((sum, count) => sum + count, 0);
    const threshold = total * 0.7; // 70% threshold

    if (typeCounts.integer >= threshold) return 'INTEGER';
    if (typeCounts.float >= threshold) return 'FLOAT';
    if (typeCounts.boolean >= threshold) return 'BOOLEAN';
    if (typeCounts.timestamp >= threshold) return 'TIMESTAMP';
    if (typeCounts.date >= threshold) return 'DATE';

    return 'STRING'; // Default fallback
}

function sanitizeFieldName(name: string): string {
    // BigQuery field names must start with letter/underscore and contain only letters, numbers, underscores
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[^a-zA-Z_]/, '_$&')
        .replace(/__+/g, '_')
        .replace(/^_+|_+$/g, '') || 'unnamed_field';
}