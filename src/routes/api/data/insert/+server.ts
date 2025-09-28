import { json } from '@sveltejs/kit';
import { BigQuery } from '@google-cloud/bigquery';
import { env } from '$env/dynamic/private';

// Initialize BigQuery client
const client = new BigQuery({
    projectId: env.GOOGLE_CLOUD_PROJECT_ID || 'computellm-468509',
    keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS || undefined
});

export async function POST({ request }: { request: Request }) {
    try {
        const { datasetId, tableId, content, type, mode = 'append' } = await request.json();

        if (!datasetId || !tableId || !content || !type) {
            return json({ error: 'datasetId, tableId, content, and type are required' }, { status: 400 });
        }

        // Parse the content based on type
        let rows: any[] = [];

        if (type === 'csv') {
            rows = parseCSV(content);
        } else if (type === 'json') {
            rows = parseJSON(content);
        } else {
            return json({ error: 'Unsupported data type' }, { status: 400 });
        }

        if (rows.length === 0) {
            return json({ error: 'No data rows found to insert' }, { status: 400 });
        }

        // Get table reference
        const dataset = client.dataset(datasetId);
        const table = dataset.table(tableId);

        // Check if table exists
        const [tableExists] = await table.exists();
        if (!tableExists) {
            return json({ error: `Table ${datasetId}.${tableId} does not exist` }, { status: 404 });
        }

        // Handle replace mode - delete all existing data first
        if (mode === 'replace') {
            try {
                const deleteQuery = `DELETE FROM \`${env.GOOGLE_CLOUD_PROJECT_ID || 'computellm-468509'}\`.\`${datasetId}\`.\`${tableId}\` WHERE TRUE`;
                const [deleteJob] = await client.createQueryJob({
                    query: deleteQuery,
                    location: 'US'
                });
                await deleteJob.getQueryResults();
                console.log('Existing data deleted for replace mode');
            } catch (deleteError) {
                console.warn('Could not delete existing data:', deleteError);
                // Continue anyway - BigQuery insert might still work
            }
        }

        // Insert data in batches to avoid memory issues
        const batchSize = 1000;
        let totalInserted = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);

            try {
                await table.insert(batch, {
                    ignoreUnknownValues: false,
                    skipInvalidRows: false,
                    raw: false
                });
                totalInserted += batch.length;
            } catch (insertError) {
                console.error('Batch insert error:', insertError);
                // Continue with remaining batches, but log the error
                const errorDetails = insertError instanceof Error ? insertError.message : 'Unknown error';
                console.warn(`Failed to insert batch ${i}-${i + batch.length}: ${errorDetails}`);
            }
        }

        return json({
            success: true,
            rowsInserted: totalInserted,
            totalRows: rows.length,
            tableId: `${datasetId}.${tableId}`,
            mode: mode
        });

    } catch (error) {
        console.error('Data insertion error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return json(
            { error: `Failed to insert data: ${errorMessage}` },
            { status: 500 }
        );
    }
}

function parseCSV(csvContent: string): any[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
    }

    const headers = parseCSVLine(lines[0]);
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
            console.warn(`Row ${i} has ${values.length} values but expected ${headers.length}, skipping`);
            continue;
        }

        const row: any = {};
        headers.forEach((header, index) => {
            let value = values[index];

            // Clean up the field name (same logic as schema detection)
            const fieldName = header
                .trim()
                .toLowerCase()
                .replace(/[^a-zA-Z0-9_]/g, '_')
                .replace(/^[^a-zA-Z_]/, '_$&')
                .replace(/__+/g, '_')
                .replace(/^_+|_+$/g, '') || 'unnamed_field';

            // Convert values to appropriate types
            if (value === null || value === undefined || value.trim() === '') {
                row[fieldName] = null;
            } else {
                row[fieldName] = convertValue(value);
            }
        });

        rows.push(row);
    }

    return rows;
}

function parseJSON(jsonContent: string): any[] {
    try {
        const data = JSON.parse(jsonContent);
        let records: any[] = [];

        if (Array.isArray(data)) {
            records = data;
        } else if (typeof data === 'object' && data !== null) {
            records = [data];
        } else {
            throw new Error('JSON must be an object or array of objects');
        }

        // Clean up field names for BigQuery compatibility
        return records.map(record => {
            if (typeof record !== 'object' || record === null) {
                throw new Error('Each record must be an object');
            }

            const cleanRecord: any = {};
            Object.keys(record).forEach(key => {
                const cleanKey = key
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-zA-Z0-9_]/g, '_')
                    .replace(/^[^a-zA-Z_]/, '_$&')
                    .replace(/__+/g, '_')
                    .replace(/^_+|_+$/g, '') || 'unnamed_field';

                cleanRecord[cleanKey] = convertValue(record[key]);
            });

            return cleanRecord;
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

function convertValue(value: any): any {
    if (value === null || value === undefined) {
        return null;
    }

    const strValue = String(value).trim();

    if (strValue === '' || strValue.toLowerCase() === 'null') {
        return null;
    }

    // Boolean conversion
    const lowerStr = strValue.toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(lowerStr)) {
        return true;
    }
    if (['false', 'no', 'n', '0'].includes(lowerStr)) {
        return false;
    }

    // Number conversion
    if (/^-?\d+$/.test(strValue)) {
        const intValue = parseInt(strValue, 10);
        if (!isNaN(intValue)) {
            return intValue;
        }
    }

    if (/^-?\d+\.\d+$/.test(strValue)) {
        const floatValue = parseFloat(strValue);
        if (!isNaN(floatValue)) {
            return floatValue;
        }
    }

    // Return as string
    return strValue;
}