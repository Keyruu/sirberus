import { defineConfig } from 'orval';

export default defineConfig({
	api: {
		output: {
			mode: 'tags-split',
			target: 'src/generated/api.ts',
			schemas: 'src/generated/model',
			client: 'react-query',
			mock: false,
		},
		input: {
			target: '../docs/swagger.yaml',
			filters: {
				mode: 'exclude',
				tags: ['sse'],
			},
		},
		hooks: {
			afterAllFilesWrite: 'prettier --write',
		},
	},
});
