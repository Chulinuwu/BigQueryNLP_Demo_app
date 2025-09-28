<script lang="ts">
	import FileUpload from './FileUpload.svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let isProcessing = false;

	// Schema detection and table creation state
	let uploadedFile: { file: File; content: string; type: 'csv' | 'json' } | null = null;
	let detectedSchema: SchemaField[] = [];
	let tableName = '';
	let datasetName = 'analytics_438107951'; // Default dataset
	let showSchemaPreview = false;
	let schemaError = '';
	let createTableError = '';
	let tableExistsWarning = '';
	let insertMode: 'create' | 'append' | 'replace' = 'create';

	interface SchemaField {
		name: string;
		type: 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE';
		mode: 'REQUIRED' | 'NULLABLE' | 'REPEATED';
		description?: string;
	}

	const bigQueryTypes = ['STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'TIMESTAMP', 'DATE'];
	const modes = ['REQUIRED', 'NULLABLE', 'REPEATED'];

	async function handleFileProcessed(event: CustomEvent) {
		uploadedFile = event.detail;
		tableName = uploadedFile.file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

		// Auto-detect schema
		await detectSchema();
	}

	async function detectSchema() {
		if (!uploadedFile) return;

		schemaError = '';
		isProcessing = true;

		try {
			const response = await fetch('/api/schema/detect', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content: uploadedFile.content,
					type: uploadedFile.type,
					fileName: uploadedFile.file.name
				})
			});

			const result = await response.json();

			if (result.error) {
				throw new Error(result.error);
			}

			detectedSchema = result.schema;
			showSchemaPreview = true;
		} catch (error) {
			schemaError = error instanceof Error ? error.message : 'Failed to detect schema';
		} finally {
			isProcessing = false;
		}
	}

	async function checkTableExists() {
		if (!tableName.trim() || !datasetName.trim()) return;

		try {
			const response = await fetch('/api/tables/check', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					datasetId: datasetName,
					tableId: tableName
				})
			});

			const result = await response.json();
			if (result.exists) {
				tableExistsWarning = `Table ${datasetName}.${tableName} already exists. You can append data or replace the table.`;
				insertMode = 'append';
			} else {
				tableExistsWarning = '';
				insertMode = 'create';
			}
		} catch (error) {
			console.warn('Could not check table existence:', error);
			tableExistsWarning = '';
			insertMode = 'create';
		}
	}

	async function createTable() {
		if (!uploadedFile || !detectedSchema.length || !tableName.trim()) return;

		createTableError = '';
		tableExistsWarning = '';
		isProcessing = true;

		try {
			if (insertMode === 'create') {
				// Create table with schema
				const createResponse = await fetch('/api/tables/create', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						datasetId: datasetName,
						tableId: tableName,
						schema: detectedSchema
					})
				});

				const createResult = await createResponse.json();
				if (createResult.error) {
					// If table exists error, offer append option
					if (createResult.error.includes('already exists')) {
						tableExistsWarning = `Table ${datasetName}.${tableName} already exists. Choose append or replace mode.`;
						insertMode = 'append';
						isProcessing = false;
						return;
					}
					throw new Error(createResult.error);
				}
			}

			// Insert data (works for both new tables and existing ones)
			const insertResponse = await fetch('/api/data/insert', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					datasetId: datasetName,
					tableId: tableName,
					content: uploadedFile.content,
					type: uploadedFile.type,
					mode: insertMode // Pass the insert mode
				})
			});

			const insertResult = await insertResponse.json();
			if (insertResult.error) {
				throw new Error(insertResult.error);
			}

			// Success! Reset state and notify parent
			const actionText =
				insertMode === 'create' ? 'created' : insertMode === 'append' ? 'appended to' : 'replaced';
			dispatch('tableCreated', {
				datasetId: datasetName,
				tableId: tableName,
				rowsInserted: insertResult.rowsInserted,
				action: actionText
			});

			resetState();
		} catch (error) {
			createTableError = error instanceof Error ? error.message : 'Failed to process table';
		} finally {
			isProcessing = false;
		}
	}

	function resetState() {
		uploadedFile = null;
		detectedSchema = [];
		tableName = '';
		showSchemaPreview = false;
		schemaError = '';
		createTableError = '';
		tableExistsWarning = '';
		insertMode = 'create';
	}

	// Check table existence when table name or dataset changes
	$: if (tableName.trim() && datasetName.trim() && showSchemaPreview) {
		checkTableExists();
	}

	function updateSchemaField(index: number, field: string, value: string) {
		detectedSchema[index] = { ...detectedSchema[index], [field]: value };
	}

	function addSchemaField() {
		detectedSchema = [
			...detectedSchema,
			{
				name: 'new_field',
				type: 'STRING',
				mode: 'NULLABLE'
			}
		];
	}

	function removeSchemaField(index: number) {
		detectedSchema = detectedSchema.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-6">
	<div class="rounded-lg border border-gray-200 bg-white p-6">
		<h2 class="mb-4 text-xl font-semibold text-gray-900">Upload Dataset</h2>
		<p class="mb-6 text-gray-600">
			Upload your CSV or JSON file to create a new BigQuery table. We'll automatically detect the
			schema and let you customize it before creation.
		</p>

		<FileUpload
			acceptedTypes={['.csv', '.json']}
			maxSizeBytes={50 * 1024 * 1024}
			isUploading={isProcessing}
			on:fileProcessed={handleFileProcessed}
		/>

		{#if schemaError}
			<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-red-700">{schemaError}</p>
					</div>
				</div>
			</div>
		{/if}
	</div>

	{#if showSchemaPreview && detectedSchema.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Configure Table Schema</h3>

			<!-- Table Configuration -->
			<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="dataset-name" class="mb-1 block text-sm font-medium text-gray-700">
						Dataset ID
					</label>
					<input
						id="dataset-name"
						type="text"
						bind:value={datasetName}
						class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="analytics_438107951"
					/>
				</div>
				<div>
					<label for="table-name" class="mb-1 block text-sm font-medium text-gray-700">
						Table ID
					</label>
					<input
						id="table-name"
						type="text"
						bind:value={tableName}
						class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="my_new_table"
						required
					/>
				</div>
			</div>

			<!-- Table Existence Warning and Insert Mode -->
			{#if tableExistsWarning}
				<div class="rounded-md border border-amber-200 bg-amber-50 p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-amber-800">Table Already Exists</h3>
							<p class="mt-1 text-sm text-amber-700">{tableExistsWarning}</p>
							<div class="mt-3 space-y-2">
								<label class="block text-sm font-medium text-amber-800">Choose Action:</label>
								<div class="space-y-2">
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={insertMode}
											value="append"
											class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
										<span class="ml-2 text-sm text-gray-700">
											<strong>Append Data</strong> - Add new rows to existing table (recommended)
										</span>
									</label>
									<label class="flex items-center">
										<input
											type="radio"
											bind:group={insertMode}
											value="replace"
											class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
										<span class="ml-2 text-sm text-gray-700">
											<strong>Replace Table</strong> - Delete existing table and create new one (destructive)
										</span>
									</label>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Schema Fields -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h4 class="text-md font-medium text-gray-900">Schema Fields</h4>
					<button
						on:click={addSchemaField}
						class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
					>
						Add Field
					</button>
				</div>

				<div class="max-h-96 space-y-3 overflow-y-auto">
					{#each detectedSchema as field, index}
						<div class="grid grid-cols-1 gap-3 rounded-md bg-gray-50 p-3 md:grid-cols-4">
							<div>
								<label class="mb-1 block text-xs font-medium text-gray-700">Field Name</label>
								<input
									type="text"
									value={field.name}
									on:input={(e) => updateSchemaField(index, 'name', e.target.value)}
									class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-gray-700">Type</label>
								<select
									value={field.type}
									on:change={(e) => updateSchemaField(index, 'type', e.target.value)}
									class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
								>
									{#each bigQueryTypes as type}
										<option value={type}>{type}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-gray-700">Mode</label>
								<select
									value={field.mode}
									on:change={(e) => updateSchemaField(index, 'mode', e.target.value)}
									class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
								>
									{#each modes as mode}
										<option value={mode}>{mode}</option>
									{/each}
								</select>
							</div>
							<div class="flex items-end">
								<button
									on:click={() => removeSchemaField(index)}
									class="rounded bg-red-600 px-2 py-1 text-sm text-white transition-colors hover:bg-red-700"
									title="Remove field"
								>
									Remove
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>

			{#if createTableError}
				<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-red-700">{createTableError}</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="mt-6 flex space-x-3">
				<button
					on:click={createTable}
					disabled={isProcessing || !tableName.trim() || detectedSchema.length === 0}
					class="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isProcessing}
						<div class="flex items-center">
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							{insertMode === 'create'
								? 'Creating Table...'
								: insertMode === 'append'
									? 'Appending Data...'
									: 'Replacing Table...'}
						</div>
					{:else}
						{insertMode === 'create'
							? 'Create Table & Insert Data'
							: insertMode === 'append'
								? 'Append Data to Existing Table'
								: 'Replace Table & Insert Data'}
					{/if}
				</button>
				<button
					on:click={resetState}
					disabled={isProcessing}
					class="rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
