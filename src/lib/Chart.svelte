<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	export let data: Record<string, unknown>[] = [];
	export let title = 'Data Visualization';

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	Chart.register(...registerables);

	onMount(() => {
		if (data && data.length > 0) {
			createChart();
		}

		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});

	$: if (data && data.length > 0 && canvas) {
		createChart();
	}

	function createChart() {
		if (chart) {
			chart.destroy();
		}

		if (!data || data.length === 0 || !canvas) return;

		const keys = Object.keys(data[0]);
		
		// Try to detect the best chart type based on data structure
		if (keys.length === 2) {
			// Likely label + value pair, good for bar/pie charts
			const labelKey = keys.find(key => 
				typeof data[0][key] === 'string' || 
				key.toLowerCase().includes('name') || 
				key.toLowerCase().includes('type') ||
				key.toLowerCase().includes('event')
			) || keys[0];
			
			const valueKey = keys.find(key => 
				typeof data[0][key] === 'number' || 
				key.toLowerCase().includes('count') || 
				key.toLowerCase().includes('total') ||
				key.toLowerCase().includes('sum')
			) || keys[1];

			const labels = data.map(row => String(row[labelKey]));
			const values = data.map(row => Number(row[valueKey]) || 0);

			// Use different colors for each bar
			const colors = [
				'rgba(59, 130, 246, 0.8)',   // blue
				'rgba(16, 185, 129, 0.8)',   // green  
				'rgba(245, 158, 11, 0.8)',   // yellow
				'rgba(239, 68, 68, 0.8)',    // red
				'rgba(139, 92, 246, 0.8)',   // purple
				'rgba(236, 72, 153, 0.8)',   // pink
				'rgba(6, 182, 212, 0.8)',    // cyan
				'rgba(34, 197, 94, 0.8)',    // emerald
			];

			chart = new Chart(canvas, {
				type: 'bar',
				data: {
					labels,
					datasets: [{
						label: title,
						data: values,
						backgroundColor: colors.slice(0, values.length),
						borderColor: colors.slice(0, values.length).map(color => color.replace('0.8', '1')),
						borderWidth: 1
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						title: {
							display: true,
							text: title,
							font: { size: 16, weight: 'bold' }
						},
						legend: {
							display: false
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							title: {
								display: true,
								text: String(valueKey).replace(/_/g, ' ').toUpperCase()
							}
						},
						x: {
							title: {
								display: true,
								text: String(labelKey).replace(/_/g, ' ').toUpperCase()
							}
						}
					}
				}
			});
		}
	}
</script>

<div class="bg-white rounded-lg p-4 border border-gray-200">
	<div class="h-64 w-full">
		<canvas bind:this={canvas}></canvas>
	</div>
</div>