<script lang="ts">
	import { browser } from '$app/environment';
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

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
	<!-- Background Pattern -->
	<div class="absolute inset-0 opacity-20">
		<div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
	</div>
	
	<div class="relative z-10">
		<div class="container mx-auto px-4 py-6 max-w-7xl">
			<!-- Header -->
			<div class="text-center mb-6">
				<div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
					<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
					</svg>
				</div>
				<h1 class="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
					BigQuery Analytics Chat
				</h1>
				<p class="text-slate-300 text-lg">Your AI-powered data analytics assistant</p>
			</div>

			<!-- Modern Chat Container -->
			<div class="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
				<!-- Messages Area -->
				<div
					bind:this={chatContainer}
					class="h-[75vh] overflow-y-auto p-8 space-y-6 bg-gradient-to-b from-white/5 to-white/10"
				>
				{#each messages as message (message.id)}
					<div class="flex {message.type === 'user' ? 'justify-end' : 'justify-start'}">
						<div class="max-w-2xl lg:max-w-4xl px-6 py-4 rounded-2xl backdrop-blur-sm {
							message.type === 'user' 
								? 'bg-gradient-to-r from-blue-500/90 to-purple-500/90 text-white shadow-lg' 
								: message.type === 'sql'
								? 'bg-green-500/20 text-green-100 border border-green-400/30 shadow-lg'
								: 'bg-white/20 text-slate-100 border border-white/30 shadow-lg'
						}">
							{#if message.type === 'sql'}
								<div class="flex items-center gap-2 text-xs font-semibold text-green-300 mb-3">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
									</svg>
									SQL Query
								</div>
								<pre class="text-sm font-mono whitespace-pre-wrap overflow-x-auto bg-black/20 p-4 rounded-lg border border-green-400/20">{message.content}</pre>
							{:else if message.type === 'data'}
								<div class="flex items-center gap-2 text-sm font-semibold text-blue-300 mb-4">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
									</svg>
									Query Results
								</div>
								{#if message.data && message.data.length > 0}
									<div class="bg-black/20 rounded-2xl p-6 overflow-hidden backdrop-blur-sm border border-white/10">
										<div class="mb-4 text-sm text-slate-300 font-medium">
											✨ Found {message.data.length} result{message.data.length !== 1 ? 's' : ''}
										</div>
										<div class="overflow-x-auto max-h-80 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
											<table class="min-w-full text-sm">
												<thead class="sticky top-0 bg-white/10 backdrop-blur-sm">
													<tr class="border-b border-white/20">
														{#each Object.keys(message.data[0]) as header}
															<th class="px-4 py-3 text-left font-semibold text-slate-200 border-r border-white/10 last:border-r-0">
																{header.replace(/_/g, ' ').toUpperCase()}
															</th>
														{/each}
													</tr>
												</thead>
												<tbody>
													{#each message.data.slice(0, 20) as row, index}
														<tr class="border-b border-white/10 hover:bg-white/5 {index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}">
															{#each Object.values(row) as cell}
																<td class="px-4 py-3 border-r border-white/10 last:border-r-0">
																	{#if typeof cell === 'number'}
																		<span class="font-mono text-blue-300 font-semibold">{cell.toLocaleString()}</span>
																	{:else if cell === null}
																		<span class="text-slate-400 italic">null</span>
																	{:else}
																		<span class="break-words text-slate-200">{String(cell)}</span>
																	{/if}
																</td>
															{/each}
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
										{#if message.data.length > 20}
											<div class="text-sm text-slate-300 mt-4 p-3 bg-yellow-500/20 rounded-xl border border-yellow-400/30">
												📊 Showing first 20 rows of {message.data.length} total results
											</div>
										{/if}
									</div>
									
									<!-- Modern Chart Visualization -->
									{#if message.data.length > 0 && browser}
										<div class="mt-6">
											<div class="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/20">
												<Chart data={message.data} title="Data Visualization" />
											</div>
										</div>
									{/if}
								{:else}
									<div class="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-600/30">
										<p class="text-slate-400">No data returned from query</p>
									</div>
								{/if}
							{:else}
								<p class="whitespace-pre-wrap leading-relaxed">{message.content}</p>
							{/if}
							<div class="text-xs opacity-60 mt-3 flex items-center gap-2">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								{formatTimestamp(message.timestamp)}
							</div>
						</div>
					</div>
				{/each}

				{#if isLoading}
					<div class="flex justify-start">
						<div class="bg-white/20 backdrop-blur-sm text-slate-100 border border-white/30 px-6 py-4 rounded-2xl shadow-lg">
							<div class="flex items-center space-x-3">
								<div class="flex space-x-1">
									<div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
									<div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
									<div class="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
								</div>
								<span class="text-slate-200">AI is thinking...</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Modern Input Area -->
			<div class="border-t border-white/20 p-8 bg-white/5 backdrop-blur-sm">
				<div class="flex space-x-4 items-end">
					<div class="flex-1">
						<textarea
							bind:value={userInput}
							on:keypress={handleKeypress}
							placeholder="Ask me about your data analytics or chat with me..."
							class="w-full resize-none bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
							rows="3"
							disabled={isLoading}
						></textarea>
					</div>
					<button
						on:click={sendMessage}
						disabled={!userInput.trim() || isLoading}
						class="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100 flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
						</svg>
						Send
					</button>
				</div>
				<div class="mt-3 text-sm text-slate-400 flex items-center gap-2">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
					</svg>
					Press Enter to send, Shift+Enter for new line
				</div>
			</div>
		</div>

		<!-- Modern Help Section -->
		<div class="mt-8 bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/20">
			<div class="flex items-center gap-3 mb-6">
				<div class="w-10 h-10 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-xl flex items-center justify-center">
					<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<h2 class="text-2xl font-bold text-slate-100">How to use</h2>
			</div>
			<div class="grid md:grid-cols-2 gap-8">
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
							<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
							</svg>
						</div>
						<h3 class="font-semibold text-slate-200">General Questions</h3>
					</div>
					<ul class="text-slate-400 space-y-2 ml-11">
						<li class="flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
							"What can you help me with?"
						</li>
						<li class="flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
							"Explain what this app does"
						</li>
						<li class="flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
							"How do I analyze my data?"
						</li>
					</ul>
				</div>
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
							<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
							</svg>
						</div>
						<h3 class="font-semibold text-slate-200">Data Requests</h3>
					</div>
					<ul class="text-slate-400 space-y-2 ml-11">
						<li class="flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
							"Show me page views from last 7 days"
						</li>
						<li class="flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
							"See data on user events"
						</li>
						<li class="flex items-center gap-2">
							<span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
							"Get me the top events this month"
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
	</div>
</div>
