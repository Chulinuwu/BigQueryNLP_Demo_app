import { json } from '@sveltejs/kit';
import { BigQuery } from '@google-cloud/bigquery';
import { env } from '$env/dynamic/private';

// Initialize BigQuery client with service account credentials
const client = new BigQuery({
    projectId: env.GOOGLE_CLOUD_PROJECT_ID || 'computellm-468509',
    keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS || undefined
});

// System prompt that defines the AI's behavior
const SYSTEM_PROMPT = `You are an AI agent connected to a BigQuery ML.GENERATE_TEXT model.
Your role is to serve as a chatbot interface for users.

Behavior rules:
1. When the user asks a general question, respond conversationally in natural language.
2. When the user asks to "see data" or requests information from tables in BigQuery, respond ONLY with a valid BigQuery SQL query string.
   - Do not include explanations, comments, or natural language.
   - The SQL must be executable directly in BigQuery.
   - Keep SQL queries simple and clean.
   - Use simple table references like \`computellm-468509\`.\`analytics_438107951\`.\`events_*\`
   - Only add date filters when specifically requested by the user.
   - Use clear, readable formatting.

3. The SQL query should always reference dataset: \`computellm-468509\`.\`analytics_438107951\`.\`events_*\`.
4. Queries should be optimized and include filters/aggregations relevant to the user's request.

SQL Examples:
- For event counts: SELECT event_name, COUNT(*) as total_events FROM \`computellm-468509\`.\`analytics_438107951\`.\`events_*\` GROUP BY event_name ORDER BY total_events DESC;
- For page views: SELECT COUNT(*) as page_views FROM \`computellm-468509\`.\`analytics_438107951\`.\`events_*\` WHERE event_name = 'page_view';

Integration flow (handled outside you, but important for consistency):
- If you return SQL, it will be extracted and executed via the BigQuery API.
- The resulting table will be transformed into a graph and displayed to the user.

Example user interactions:
- User: "How many page views in the last 7 days?"
  → You output only a SQL query with date filter.
- User: "select all event's count here and also classified it as type"
  → You output: SELECT event_name, COUNT(*) as total_events FROM \`computellm-468509\`.\`analytics_438107951\`.\`events_*\` GROUP BY event_name ORDER BY total_events DESC;
- User: "Hi, can you help me understand what this app does?"
  → You reply in natural language.`;

function isSQL(text: string): boolean {
    let cleanText = text.trim();
    
    // If it starts with ```sql, it's definitely SQL
    if (cleanText.startsWith('```sql')) {
        return true;
    }
    
    // Remove markdown code block markers if present
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\n?/, '').replace(/```$/, '').trim();
    }
    
    const upperText = cleanText.toUpperCase();
    
    // Check if it starts with SELECT and contains SQL keywords
    const startsWithSelect = upperText.startsWith('SELECT');
    const containsFrom = upperText.includes(' FROM ');
    const containsKeywords = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|COUNT|SUM|AVG|JOIN|INNER|LEFT|RIGHT)\b/.test(upperText);
    
    return startsWithSelect && containsFrom && containsKeywords;
}

async function executeSQL(sqlQuery: string): Promise<Record<string, unknown>[]> {
    try {
        const [job] = await client.createQueryJob({
            query: sqlQuery,
            location: 'US',
        });

        const [rows] = await job.getQueryResults();
        
        // Convert BigQuery rows to plain objects
        const results = rows.map(row => {
            const obj: Record<string, unknown> = {};
            Object.keys(row).forEach(key => {
                obj[key] = (row as Record<string, unknown>)[key];
            });
            return obj;
        });

        return results;
    } catch (error) {
        console.error('BigQuery execution error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`BigQuery error: ${errorMessage}`);
    }
}

async function callBigQueryML(prompt: string): Promise<string> {
    try {
        // Use parameterized query to avoid SQL injection and escaping issues
        const fullPrompt = `${SYSTEM_PROMPT}\n\nUser: ${prompt}`;
        
        const query = `
            SELECT *
            FROM ML.GENERATE_TEXT(
                MODEL \`computellm-468509.analytics_438107951.gemini_model\`,
                (
                    SELECT @prompt AS prompt
                )
            );
        `;

        const [job] = await client.createQueryJob({
            query: query,
            location: 'US',
            params: {
                prompt: fullPrompt
            }
        });

        const [rows] = await job.getQueryResults();
        
        if (rows.length > 0) {
            const result = (rows[0] as Record<string, unknown>).ml_generate_text_result;
            
            // Parse the JSON response from BigQuery ML
            if (typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    
                    // Extract the text content from the candidates
                    if (parsed.candidates && parsed.candidates.length > 0 && 
                        parsed.candidates[0].content && parsed.candidates[0].content.parts && 
                        parsed.candidates[0].content.parts.length > 0) {
                        
                        return parsed.candidates[0].content.parts[0].text.trim();
                    }
                } catch (parseError) {
                    console.error('Error parsing ML result:', parseError);
                    // If parsing fails, return the raw result
                    return result;
                }
            }
            
            // Fallback to raw result if it's not a string or parsing failed
            return String(result);
        } else {
            throw new Error('No response from BigQuery ML model');
        }
    } catch (error) {
        console.error('BigQuery ML error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`BigQuery ML error: ${errorMessage}`);
    }
}

export async function POST({ request }: { request: Request }) {
    try {
        const { message } = await request.json();

        if (!message || typeof message !== 'string') {
            return json({ error: 'Message is required' }, { status: 400 });
        }

        // Call BigQuery ML to generate response
        const aiResponse = await callBigQueryML(message.trim());
        console.log('AI Response:', aiResponse);
        console.log('Is SQL?', isSQL(aiResponse));

        // Check if the response is a SQL query
        if (isSQL(aiResponse)) {
            console.log('Detected SQL, executing query...');
            try {
                // Clean up the SQL query (remove markdown formatting if present)
                let cleanSQL = aiResponse.trim();
                
                // Remove SQL code block markers if present
                if (cleanSQL.startsWith('```sql')) {
                    cleanSQL = cleanSQL.replace(/```sql\n?/, '').replace(/```$/, '').trim();
                } else if (cleanSQL.startsWith('```')) {
                    cleanSQL = cleanSQL.replace(/```\n?/, '').replace(/```$/, '').trim();
                }
                
                console.log('Clean SQL:', cleanSQL);
                
                // Execute the SQL query
                const queryResults = await executeSQL(cleanSQL);
                console.log('Query results:', queryResults.length, 'rows');
                
                return json({
                    type: 'sql',
                    response: cleanSQL,
                    data: queryResults,
                    executedQuery: true,
                    message: `Found ${queryResults.length} result${queryResults.length !== 1 ? 's' : ''}`
                });
            } catch (sqlError) {
                console.error('SQL execution error:', sqlError);
                // If SQL execution fails, return the SQL with error info
                const errorMessage = sqlError instanceof Error ? sqlError.message : 'Unknown error';
                return json({
                    type: 'sql',
                    response: aiResponse,
                    error: `SQL execution failed: ${errorMessage}`,
                    executedQuery: false
                });
            }
        } else {
            console.log('Not SQL, returning natural language response');
            // Return natural language response
            return json({
                type: 'assistant',
                response: aiResponse
            });
        }

    } catch (error) {
        console.error('API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return json(
            { error: `Server error: ${errorMessage}` },
            { status: 500 }
        );
    }
}