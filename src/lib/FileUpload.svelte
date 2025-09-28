<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let acceptedTypes = ['.csv', '.json'];
	export let maxSizeBytes = 10 * 1024 * 1024; // 10MB default
	export let isUploading = false;

	let fileInput: HTMLInputElement;
	let dragOver = false;
	let uploadError = '';

	interface FileData {
		file: File;
		content: string;
		type: 'csv' | 'json';
	}

	function validateFile(file: File): string | null {
		const extension = '.' + file.name.split('.').pop()?.toLowerCase();

		if (!acceptedTypes.includes(extension)) {
			return `File type ${extension} not supported. Please upload ${acceptedTypes.join(' or ')} files.`;
		}

		if (file.size > maxSizeBytes) {
			return `File size too large. Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`;
		}

		return null;
	}

	async function processFile(file: File) {
		const validation = validateFile(file);
		if (validation) {
			uploadError = validation;
			return;
		}

		uploadError = '';
		isUploading = true;

		try {
			const content = await readFileContent(file);
			const extension = file.name.split('.').pop()?.toLowerCase();
			const type = extension === 'csv' ? 'csv' : 'json';

			const fileData: FileData = {
				file,
				content,
				type
			};

			dispatch('fileProcessed', fileData);
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Failed to read file';
		} finally {
			isUploading = false;
		}
	}

	function readFileContent(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				resolve(content);
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsText(file);
		});
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}

	function triggerFileSelect() {
		fileInput?.click();
	}
</script>

<div class="w-full">
	<input
		bind:this={fileInput}
		type="file"
		accept={acceptedTypes.join(',')}
		on:change={handleFileSelect}
		class="hidden"
	/>

	<div
		class="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
			{dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
			{isUploading ? 'cursor-not-allowed opacity-50' : ''}"
		on:drop={handleDrop}
		on:dragover={handleDragOver}
		on:dragleave={handleDragLeave}
		on:click={triggerFileSelect}
		role="button"
		tabindex="0"
		on:keydown={(e) => e.key === 'Enter' && triggerFileSelect()}
	>
		{#if isUploading}
			<div class="flex items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
				<span class="ml-3 text-gray-600">Processing file...</span>
			</div>
		{:else}
			<div class="space-y-2">
				<div class="mx-auto h-12 w-12 text-gray-400">
					<svg class="h-full w-full" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
				</div>
				<div>
					<p class="text-lg font-medium text-gray-900">Upload your dataset</p>
					<p class="text-sm text-gray-500">
						Drag and drop your {acceptedTypes.join(' or ')} file here, or click to select
					</p>
					<p class="mt-1 text-xs text-gray-400">
						Maximum file size: {Math.round(maxSizeBytes / 1024 / 1024)}MB
					</p>
				</div>
			</div>
		{/if}
	</div>

	{#if uploadError}
		<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
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
					<p class="text-sm text-red-700">{uploadError}</p>
				</div>
			</div>
		</div>
	{/if}
</div>
