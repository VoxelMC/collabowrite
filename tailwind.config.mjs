/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {},
	},

	plugins: [require('@tailwindcss/typography'), require('daisyui')],
	daisyui: {
		themes: [
			{
				collabolight: {
					primary: '#570df8',
					'primary-focus': '#3b04b4',
					'primary-content': '#ffffff',
					secondary: '#b8194e',
					'secondary-focus': '#e1336d',
					'secondary-content': '#ffcce4',
					accent: '#fdd053',
					'accent-focus': '#f4ba1a',
					'accent-content': '#1e2734',
					neutral: '#3b424e',
					'neutral-focus': '#2a2e37',
					'neutral-content': '#ffffff',

					'base-100': '#ffffff',
					'base-200': '#f9fafb',
					'base-300': '#ced3d9',
					'base-content': '#1e2734',

					info: '#1c92f2',
					success: '#8EDE87',
					warning: '#ffe770',
					error: '#ff4d4d',

					'--rounded-box': '1rem',
					'--rounded-btn': '.5rem',
					'--rounded-badge': '1.9rem',
					'--animation-btn': '.25s',
					'--animation-input': '.2s',
					'--btn-text-case': 'case',
					'--navbar-padding': '.5rem',
					'--border-btn': '1px',
				},
			},
			// 'light',
			'sunset',
		],
		logs: false,
	},
};
