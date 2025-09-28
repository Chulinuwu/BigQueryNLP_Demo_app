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
        const { datasetId, tableId } = await request.json();

        if (!datasetId || !tableId) {
            return json({ error: 'datasetId and tableId are required' }, { status: 400 });
        }

        // Check if dataset exists
        const dataset = client.dataset(datasetId);
        const [datasetExists] = await dataset.exists();

        if (!datasetExists) {
            return json({ exists: false });
        }

        // Check if table exists
        const table = dataset.table(tableId);
        const [tableExists] = await table.exists();

        if (tableExists) {
            // Get table metadata
            const [metadata] = await table.getMetadata();
            const rowCount = metadata.numRows ? parseInt(metadata.numRows) : 0;
            const sizeBytes = metadata.numBytes ? parseInt(metadata.numBytes) : 0;

            return json({
                exists: true,
                metadata: {
                    rowCount,
                    sizeBytes,
                    created: metadata.creationTime,
                    modified: metadata.lastModifiedTime,
                    schema: metadata.schema?.fields || []
                }
            });
        } else {
            return json({ exists: false });
        }

    } catch (error) {
        console.error('Table check error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return json(
            { error: `Failed to check table: ${errorMessage}` },
            { status: 500 }
        );
    }
}