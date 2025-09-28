import { json } from '@sveltejs/kit';
import { BigQuery } from '@google-cloud/bigquery';
import { env } from '$env/dynamic/private';

// Initialize BigQuery client
const client = new BigQuery({
    projectId: env.GOOGLE_CLOUD_PROJECT_ID || 'computellm-468509',
    keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS || undefined
});

interface SchemaField {
    name: string;
    type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE';
    mode: 'REQUIRED' | 'NULLABLE' | 'REPEATED';
    description?: string;
}

export async function POST({ request }: { request: Request }) {
    try {
        const { datasetId, tableId, schema } = await request.json();

        if (!datasetId || !tableId || !schema || !Array.isArray(schema)) {
            return json({ error: 'datasetId, tableId, and schema are required' }, { status: 400 });
        }

        // Validate schema fields
        for (const field of schema) {
            if (!field.name || !field.type || !field.mode) {
                return json({ error: 'Each schema field must have name, type, and mode' }, { status: 400 });
            }
        }

        const projectId = env.GOOGLE_CLOUD_PROJECT_ID || 'computellm-468509';

        // Check if dataset exists, create if not
        const dataset = client.dataset(datasetId);
        const [datasetExists] = await dataset.exists();

        if (!datasetExists) {
            await dataset.create({
                location: 'US'
            });
        }

        // Check if table already exists
        const table = dataset.table(tableId);
        const [tableExists] = await table.exists();

        if (tableExists) {
            return json({ error: `Table ${datasetId}.${tableId} already exists` }, { status: 409 });
        }

        // Create BigQuery schema
        const bigQuerySchema = schema.map((field: SchemaField) => ({
            name: field.name,
            type: field.type,
            mode: field.mode,
            description: field.description || undefined
        }));

        // Create table
        const [createdTable] = await table.create({
            schema: bigQuerySchema,
            location: 'US'
        });

        return json({
            success: true,
            tableId: createdTable.id,
            fullTableName: `${projectId}.${datasetId}.${tableId}`,
            schema: bigQuerySchema
        });

    } catch (error) {
        console.error('Table creation error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return json(
            { error: `Failed to create table: ${errorMessage}` },
            { status: 500 }
        );
    }
}