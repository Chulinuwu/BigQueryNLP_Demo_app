<script lang="ts">
	import { browser } from '$app/environment';
	import Chart from '$lib/Chart.svelte';
	import DatasetManager from '$lib/DatasetManager.svelte';

	// Message type definition
	type Message = {
		id: string;
		type: 'user' | 'assistant' | 'sql' | 'data';
		content: string;
		timestamp: Date;
		data?: Record<string, unknown>[];
	};

	let messages: Message[] = [];
	let userInput = '';
	let isLoading = false;
	let chatContainer: HTMLDivElement;
	let activeTab: 'chat' | 'datasets' = 'chat';
	let isDatasetProcessing = false;
	let createdTables: Array<{ datasetId: string; tableId: string; rowsInserted: number }> = [];

	// Add initial welcome message
	messages = [
		{
			id: crypto.randomUUID(),
			type: 'assistant',
			content:
				'Hello! I\'m your BigQuery Analytics Assistant. You can ask me general questions or request data from our analytics. When you ask to "see data" or request specific information from tables, I\'ll generate SQL queries for you.',
			timestamp: new Date()
		}
	];

	async function sendMessage() {
		if (!userInput.trim() || isLoading) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			type: 'user',
			content: userInput.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const currentInput = userInput;
		userInput = '';
		isLoading = true;

		// Scroll to bottom
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 10);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ message: currentInput })
			});

			const result = await response.json();

			if (result.error) {
				throw new Error(result.error);
			}

			// Add assistant response
			if (result.type === 'sql' && result.data) {
				// If we have SQL with data, show both the SQL and the results
				const sqlMessage: Message = {
					id: crypto.randomUUID(),
					type: 'sql',
					content: result.response,
					timestamp: new Date()
				};

				const dataMessage: Message = {
					id: crypto.randomUUID(),
					type: 'data',
					content: result.message || `Query executed successfully`,
					timestamp: new Date(),
					data: result.data
				};

				messages = [...messages, sqlMessage, dataMessage];
			} else if (result.type === 'sql' && result.error) {
				// If SQL failed to execute, show the SQL and error
				const sqlMessage: Message = {
					id: crypto.randomUUID(),
					type: 'sql',
					content: result.response,
					timestamp: new Date()
				};

				const errorMessage: Message = {
					id: crypto.randomUUID(),
					type: 'assistant',
					content: `❌ ${result.error}`,
					timestamp: new Date()
				};

				messages = [...messages, sqlMessage, errorMessage];
			} else {
				const assistantMessage: Message = {
					id: crypto.randomUUID(),
					type: result.type || 'assistant',
					content: result.response,
					timestamp: new Date(),
					data: result.data
				};

				messages = [...messages, assistantMessage];
			}
		} catch (error) {
			const errorMessage: Message = {
				id: crypto.randomUUID(),
				type: 'assistant',
				content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date()
			};
			messages = [...messages, errorMessage];
		}

		isLoading = false;

		// Scroll to bottom
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 10);
	}

	function handleKeypress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function formatTimestamp(date: Date) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function handleTableCreated(event: CustomEvent) {
		const { datasetId, tableId, rowsInserted, action = 'created' } = event.detail;

		// Update or add to created tables list
		const existingIndex = createdTables.findIndex(
			(t) => t.datasetId === datasetId && t.tableId === tableId
		);
		if (existingIndex >= 0) {
			createdTables[existingIndex] = { datasetId, tableId, rowsInserted };
		} else {
			createdTables = [...createdTables, { datasetId, tableId, rowsInserted }];
		}

		// Show success message in chat
		const actionText =
			action === 'created'
				? 'created'
				: action === 'appended to'
					? 'added data to'
					: 'replaced data in';
		const successMessage: Message = {
			id: crypto.randomUUID(),
			type: 'assistant',
			content: `✅ Successfully ${actionText} table \`${datasetId}.${tableId}\` with ${rowsInserted} rows! You can now ask me questions about this data.`,
			timestamp: new Date()
		};
		messages = [...messages, successMessage];

		// Auto-switch to chat tab
		activeTab = 'chat';

		// Scroll to bottom of chat
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 10);
	}

	function switchToChatAndQuery(table: {
		datasetId: string;
		tableId: string;
		rowsInserted: number;
	}) {
		activeTab = 'chat';
		userInput = `Show me a summary of the data in ${table.datasetId}.${table.tableId}`;

		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 10);
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto max-w-7xl px-4 py-6">
		<!-- Header -->
		<div class="mb-6 text-center">
			<div
				class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-sm"
			>
				<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
					></path>
				</svg>
			</div>
			<h1 class="mb-2 text-4xl font-bold text-gray-900">BigQuery Analytics Chat</h1>
			<p class="text-lg text-gray-600">Your AI-powered data analytics assistant</p>
		</div>

		<!-- Tab Navigation -->
		<div class="rounded-t-2xl border border-b-0 border-gray-200 bg-white shadow-lg">
			<nav class="flex space-x-8 border-b border-gray-200 px-8 py-4">
				<button
					on:click={() => (activeTab = 'chat')}
					class="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab ===
					'chat'
						? 'border-b-2 border-blue-500 bg-blue-100 text-blue-700'
						: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						></path>
					</svg>
					<span>Analytics Chat</span>
				</button>
				<button
					on:click={() => (activeTab = 'datasets')}
					class="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors {activeTab ===
					'datasets'
						? 'border-b-2 border-blue-500 bg-blue-100 text-blue-700'
						: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
						></path>
					</svg>
					<span>Upload Data</span>
					{#if createdTables.length > 0}
						<span
							class="min-w-[1.25rem] rounded-full bg-green-500 px-2 py-0.5 text-center text-xs text-white"
						>
							{createdTables.length}
						</span>
					{/if}
				</button>
			</nav>
		</div>

		<!-- Tab Content -->
		<div class="overflow-hidden rounded-b-2xl border border-t-0 border-gray-200 bg-white shadow-lg">
			{#if activeTab === 'chat'}
				<!-- Chat Interface -->
				<!-- Messages Area -->
				<div bind:this={chatContainer} class="h-[75vh] space-y-6 overflow-y-auto bg-white p-8">
					{#each messages as message (message.id)}
						<div class="flex {message.type === 'user' ? 'justify-end' : 'justify-start'}">
							<div
								class="max-w-2xl rounded-2xl px-6 py-4 lg:max-w-4xl {message.type === 'user'
									? 'bg-blue-600 text-white shadow-sm'
									: message.type === 'sql'
										? 'border border-green-200 bg-green-50 text-green-800 shadow-sm'
										: 'border border-gray-200 bg-gray-100 text-gray-800 shadow-sm'}"
							>
								{#if message.type === 'sql'}
									<div class="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700">
										<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
											></path>
										</svg>
										SQL Query
									</div>
									<pre
										class="overflow-x-auto whitespace-pre-wrap rounded-lg border border-green-200 bg-white p-4 font-mono text-sm">{message.content}</pre>
								{:else if message.type === 'data'}
									<div class="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-700">
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
											></path>
										</svg>
										Query Results
									</div>
									{#if message.data && message.data.length > 0}
										<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
											<div class="mb-4 text-sm font-medium text-gray-600">
												✨ Found {message.data.length} result{message.data.length !== 1 ? 's' : ''}
											</div>
											<div
												class="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 max-h-80 overflow-x-auto"
											>
												<table class="min-w-full text-sm">
													<thead class="sticky top-0 bg-gray-50">
														<tr class="border-b border-gray-200">
															{#each Object.keys(message.data[0]) as header}
																<th
																	class="border-r border-gray-200 px-4 py-3 text-left font-semibold text-gray-700 last:border-r-0"
																>
																	{header.replace(/_/g, ' ').toUpperCase()}
																</th>
															{/each}
														</tr>
													</thead>
													<tbody>
														{#each message.data.slice(0, 20) as row, index}
															<tr
																class="border-b border-gray-100 hover:bg-gray-50 {index % 2 === 0
																	? 'bg-white'
																	: 'bg-gray-50/50'}"
															>
																{#each Object.values(row) as cell}
																	<td class="border-r border-gray-100 px-4 py-3 last:border-r-0">
																		{#if typeof cell === 'number'}
																			<span class="font-mono font-semibold text-blue-600"
																				>{cell.toLocaleString()}</span
																			>
																		{:else if cell === null}
																			<span class="italic text-gray-400">null</span>
																		{:else}
																			<span class="break-words text-gray-700">{String(cell)}</span>
																		{/if}
																	</td>
																{/each}
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
											{#if message.data.length > 20}
												<div
													class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"
												>
													📊 Showing first 20 rows of {message.data.length} total results
												</div>
											{/if}
										</div>

										<!-- Clean Chart Visualization -->
										{#if message.data.length > 0 && browser}
											<div class="mt-6">
												<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
													<Chart data={message.data} title="Data Visualization" />
												</div>
											</div>
										{/if}
									{:else}
										<div class="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
											<p class="text-gray-500">No data returned from query</p>
										</div>
									{/if}
								{:else}
									<p class="whitespace-pre-wrap leading-relaxed">{message.content}</p>
								{/if}
								<div class="mt-3 flex items-center gap-2 text-xs opacity-60">
									<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
										></path>
									</svg>
									{formatTimestamp(message.timestamp)}
								</div>
							</div>
						</div>
					{/each}

					{#if isLoading}
						<div class="flex justify-start">
							<div
								class="rounded-2xl border border-gray-200 bg-gray-100 px-6 py-4 text-gray-700 shadow-sm"
							>
								<div class="flex items-center space-x-3">
									<div class="flex space-x-1">
										<div
											class="h-2 w-2 animate-bounce rounded-full bg-blue-500"
											style="animation-delay: 0ms"
										></div>
										<div
											class="h-2 w-2 animate-bounce rounded-full bg-blue-500"
											style="animation-delay: 150ms"
										></div>
										<div
											class="h-2 w-2 animate-bounce rounded-full bg-blue-500"
											style="animation-delay: 300ms"
										></div>
									</div>
									<span>AI is thinking...</span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Clean Input Area -->
				<div class="border-t border-gray-200 bg-gray-50 p-8">
					<div class="flex items-end space-x-4">
						<div class="flex-1">
							<textarea
								bind:value={userInput}
								on:keypress={handleKeypress}
								placeholder="Ask me about your data analytics or chat with me..."
								class="w-full resize-none rounded-2xl border border-gray-300 bg-white px-6 py-4 text-gray-900 placeholder-gray-500 shadow-sm transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
								rows="3"
								disabled={isLoading}
							></textarea>
						</div>
						<button
							on:click={sendMessage}
							disabled={!userInput.trim() || isLoading}
							class="flex transform items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 font-semibold text-white shadow-sm transition-all duration-200 hover:scale-105 hover:bg-blue-700 hover:shadow-md disabled:transform-none disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:scale-100"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
								></path>
							</svg>
							Send
						</button>
					</div>
					<div class="mt-3 flex items-center gap-2 text-sm text-gray-500">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 10V3L4 14h7v7l9-11h-7z"
							></path>
						</svg>
						Press Enter to send, Shift+Enter for new line
					</div>
				</div>
			{:else if activeTab === 'datasets'}
				<!-- Dataset Management Interface -->
				<div class="p-8">
					<DatasetManager
						bind:isProcessing={isDatasetProcessing}
						on:tableCreated={handleTableCreated}
					/>

					{#if createdTables.length > 0}
						<div class="mt-8 rounded-lg border border-green-200 bg-green-50 p-6">
							<h3 class="mb-4 flex items-center text-lg font-semibold text-green-800">
								<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									></path>
								</svg>
								Successfully Created Tables
							</h3>
							<div class="space-y-2">
								{#each createdTables as table}
									<div
										class="flex items-center justify-between rounded border border-green-200 bg-white p-3"
									>
										<div>
											<span class="font-medium text-gray-900"
												>{table.datasetId}.{table.tableId}</span
											>
											<span class="ml-2 text-sm text-gray-600">({table.rowsInserted} rows)</span>
										</div>
										<button
											on:click={() => switchToChatAndQuery(table)}
											class="rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
										>
											Query in Chat
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Clean Help Section -->
		<div class="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
			<div class="mb-6 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
					<svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
				</div>
				<h2 class="text-2xl font-bold text-gray-900">How to use</h2>
			</div>
			<div class="grid gap-8 md:grid-cols-2">
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
							<svg
								class="h-4 w-4 text-blue-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
								></path>
							</svg>
						</div>
						<h3 class="font-semibold text-gray-800">General Questions</h3>
					</div>
					<ul class="ml-11 space-y-2 text-gray-600">
						<li class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
							"What can you help me with?"
						</li>
						<li class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
							"Explain what this app does"
						</li>
						<li class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
							"How do I analyze my data?"
						</li>
					</ul>
				</div>
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
							<svg
								class="h-4 w-4 text-green-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								></path>
							</svg>
						</div>
						<h3 class="font-semibold text-gray-800">Data Requests</h3>
					</div>
					<ul class="ml-11 space-y-2 text-gray-600">
						<li class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
							"Show me page views from last 7 days"
						</li>
						<li class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
							"See data on user events"
						</li>
						<li class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
							"Get me the top events this month"
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
