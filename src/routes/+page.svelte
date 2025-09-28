<script lang="ts">
	import Chart from '$lib/Chart.svelte';

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

	// Add initial welcome message
	messages = [
		{
			id: crypto.randomUUID(),
			type: 'assistant',
			content: 'Hello! I\'m your BigQuery Analytics Assistant. You can ask me general questions or request data from our analytics. When you ask to "see data" or request specific information from tables, I\'ll generate SQL queries for you.',
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
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="container mx-auto px-4 py-8 max-w-4xl">
		<!-- Header -->
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold text-gray-800 mb-2">BigQuery Analytics Chat</h1>
			<p class="text-gray-600">Your AI-powered data analytics assistant</p>
		</div>

		<!-- Chat Container -->
		<div class="bg-white rounded-2xl shadow-2xl overflow-hidden">
			<!-- Messages Area -->
			<div
				bind:this={chatContainer}
				class="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50"
			>
				{#each messages as message (message.id)}
					<div class="flex {message.type === 'user' ? 'justify-end' : 'justify-start'}">
						<div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg {
							message.type === 'user' 
								? 'bg-blue-500 text-white' 
								: message.type === 'sql'
								? 'bg-green-100 text-green-800 border border-green-200'
								: 'bg-white text-gray-800 border border-gray-200'
						}">
							{#if message.type === 'sql'}
								<div class="text-xs font-semibold text-green-600 mb-1">SQL Query:</div>
								<pre class="text-sm font-mono whitespace-pre-wrap overflow-x-auto">{message.content}</pre>
							{:else if message.type === 'data'}
								<div class="text-xs font-semibold text-blue-600 mb-2">Query Results:</div>
								{#if message.data && message.data.length > 0}
									<div class="bg-gray-50 rounded-lg p-3 overflow-hidden">
										<div class="mb-2 text-xs text-gray-600">
											Found {message.data.length} result{message.data.length !== 1 ? 's' : ''}
										</div>
										<div class="overflow-x-auto max-h-64">
											<table class="min-w-full text-xs border-collapse">
												<thead class="sticky top-0 bg-white">
													<tr class="border-b border-gray-200">
														{#each Object.keys(message.data[0]) as header}
															<th class="px-3 py-2 text-left font-semibold text-gray-700 bg-gray-100 border-r border-gray-200 last:border-r-0">
																{header}
															</th>
														{/each}
													</tr>
												</thead>
												<tbody>
													{#each message.data.slice(0, 20) as row, index}
														<tr class="border-b border-gray-100 hover:bg-gray-50 {index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}">
															{#each Object.values(row) as cell}
																<td class="px-3 py-2 border-r border-gray-100 last:border-r-0">
																	{#if typeof cell === 'number'}
																		<span class="font-mono">{cell.toLocaleString()}</span>
																	{:else if cell === null}
																		<span class="text-gray-400 italic">null</span>
																	{:else}
																		<span class="break-words">{String(cell)}</span>
																	{/if}
																</td>
															{/each}
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
										{#if message.data.length > 20}
											<div class="text-xs text-gray-500 mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
												📊 Showing first 20 rows of {message.data.length} total results
											</div>
										{/if}
									</div>
									
									<!-- Chart Visualization -->
									{#if message.data.length > 0}
										<div class="mt-4">
											<Chart data={message.data} title="Data Visualization" />
										</div>
									{/if}
								{:else}
									<div class="bg-gray-100 rounded-lg p-4 text-center">
										<p class="text-gray-500 text-sm">No data returned from query</p>
									</div>
								{/if}
							{:else}
								<p class="whitespace-pre-wrap">{message.content}</p>
							{/if}
							<div class="text-xs opacity-70 mt-1">
								{formatTimestamp(message.timestamp)}
							</div>
						</div>
					</div>
				{/each}

				{#if isLoading}
					<div class="flex justify-start">
						<div class="bg-white text-gray-800 border border-gray-200 px-4 py-2 rounded-lg">
							<div class="flex items-center space-x-2">
								<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
								<span>Thinking...</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Input Area -->
			<div class="border-t border-gray-200 p-6 bg-white">
				<div class="flex space-x-4">
					<textarea
						bind:value={userInput}
						on:keypress={handleKeypress}
						placeholder="Ask me about data or chat with me..."
						class="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						rows="2"
						disabled={isLoading}
					></textarea>
					<button
						on:click={sendMessage}
						disabled={!userInput.trim() || isLoading}
						class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
					>
						Send
					</button>
				</div>
				<div class="mt-2 text-xs text-gray-500">
					Press Enter to send, Shift+Enter for new line
				</div>
			</div>
		</div>

		<!-- Help Section -->
		<div class="mt-8 bg-white rounded-lg p-6 shadow-lg">
			<h2 class="text-lg font-semibold text-gray-800 mb-3">How to use:</h2>
			<div class="grid md:grid-cols-2 gap-4">
				<div class="space-y-2">
					<h3 class="font-medium text-gray-700">General Questions</h3>
					<ul class="text-sm text-gray-600 space-y-1">
						<li>• "What can you help me with?"</li>
						<li>• "Explain what this app does"</li>
						<li>• "How do I analyze my data?"</li>
					</ul>
				</div>
				<div class="space-y-2">
					<h3 class="font-medium text-gray-700">Data Requests</h3>
					<ul class="text-sm text-gray-600 space-y-1">
						<li>• "Show me page views from last 7 days"</li>
						<li>• "See data on user events"</li>
						<li>• "Get me the top events this month"</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
