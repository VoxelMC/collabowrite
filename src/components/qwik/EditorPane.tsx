import {
	component$,
	useVisibleTask$,
	$,
	useStore,
	noSerialize,
	useSignal,
	useTask$,
} from '@builder.io/qwik';
import { isServer } from '@builder.io/qwik/build';

import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import { yCollab } from 'y-codemirror.next';
import * as random from 'lib0/random';

import { EditorView, basicSetup } from 'codemirror';
import type { ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
	type Update,
	// rebaseUpdates,
	// collab,
	// getSyncedVersion,
	// receiveUpdates,
} from '@codemirror/collab';

import * as IncrementalDOM from 'incremental-dom';
import MarkdownIt from 'markdown-it';

// @ts-ignore-warn
import MarkdownItIncrementalDOM from 'markdown-it-incremental-dom';
import type { YText } from 'node_modules/yjs/dist/src/types/YText';
import { EditorState } from '@codemirror/state';

interface ItemProps {
	url: string;
}

interface Store {
	md?: MarkdownIt;
	updates: Update[];
	ydoc?: Y.Doc;
	provider?: YPartyKitProvider;
	undoManager?: Y.UndoManager;
}

export default component$(({ url }: ItemProps) => {
	const wsUrl =
		import.meta.env.DEV && process.env.TESTING !== '1' ?
			'localhost:49414'
			: import.meta.env.PARTYKIT_URL;
	const usercolors = [
		{ color: '#30bced', light: '#30bced33' },
		{ color: '#6eeb83', light: '#6eeb8333' },
		{ color: '#ffbc42', light: '#ffbc4233' },
		{ color: '#ecd444', light: '#ecd44433' },
		{ color: '#ee6352', light: '#ee635233' },
		{ color: '#9ac2c9', light: '#9ac2c933' },
		{ color: '#8acb88', light: '#8acb8833' },
		{ color: '#1be7ff', light: '#1be7ff33' },
	];

	const userColor: { color: string; light: string } =
		usercolors[random.uint32() % usercolors.length];

	const editorRef = useSignal<HTMLElement>();
	const codeMirrorRef = useSignal<EditorView>();
	const displayRef = useSignal<HTMLElement>();
	const store = useStore<Store>({
		md: undefined,
		updates: [],
		ydoc: undefined,
		provider: undefined,
	});

	const currentValue = useSignal<string>();

	const processEditorUpdate = $((update: ViewUpdate) => {
		const value = update.state.doc.toString();
		if (value !== currentValue.value) {
			IncrementalDOM.patch(
				displayRef.value as HTMLElement,
				// @ts-ignore
				store.md.renderToIncrementalDOM(value)
			);
			currentValue.value = value;
		}
	});

	useTask$(({ track }) => {
		track(() => codeMirrorRef.value);
		if (isServer) {
			return; // Server guard
		}

		if (currentValue.value === '') {
			const multiplayerNames: Element[] = Array.from(
				document.querySelectorAll('.cm-ySelectionInfo')
			);
			const arr = Array.from(document.querySelectorAll('.cm-line'))
				.map(e => {
					let out = e.textContent as string;
					for (let name of multiplayerNames) {
						out = out.replaceAll(name.textContent as string, '');
					}
					return out;
				})
				.join('\n');
			IncrementalDOM.patch(
				displayRef.value as HTMLElement,
				// @ts-ignore
				store.md.renderToIncrementalDOM(arr)
			);
		}
	});

	useVisibleTask$(async () => {
		store.ydoc = noSerialize(new Y.Doc());
		store.provider = noSerialize(
			new YPartyKitProvider(
				// 'ws://10.0.0.37:49414',
				wsUrl,
				url,
				store.ydoc,
				{
					params: async () => ({
						token: 'TOKEN',
						userId: 'test-user',
					}),
				}
			)
		);

		store.provider?.once('connected', () => {
			console.log('connecter');
		});

		const ytext = store.ydoc?.getText('codemirror');
		currentValue.value = ytext?.toJSON();

		const md = new MarkdownIt();
		md.use(MarkdownItIncrementalDOM, IncrementalDOM);
		store.md = noSerialize(md);
		IncrementalDOM.patch(
			displayRef.value as HTMLElement,
			// @ts-ignore
			store.md.renderToIncrementalDOM(currentValue.value)
		);

		store.undoManager = noSerialize(new Y.UndoManager(ytext as YText));

		store?.provider?.awareness.setLocalStateField('user', {
			name: 'Anonymous ' + Math.floor(Math.random() * 100),
			color: userColor.color,
			colorLight: userColor.light,
		});

		const state = EditorState.create({
			doc: ytext?.toString(),
			extensions: [
				basicSetup,
				EditorView.updateListener.of(processEditorUpdate),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto' },
				}),
				markdown({ codeLanguages: languages }),
				EditorView.lineWrapping,
				yCollab(ytext, store.provider?.awareness, {
					undoManager: store.undoManager,
				}),
			],
		});

		codeMirrorRef.value = noSerialize(
			new EditorView({
				state,
				parent: editorRef.value as HTMLElement,
			})
		);
		codeMirrorRef.value?.focus();
		codeMirrorRef.value?.dispatch(state.update());
	});

	return (
		<section class="flex h-[80vh] flex-row justify-between">
			<div
				class="output prose prose-stone h-full w-[49.5%] max-w-none border border-black bg-white"
				ref={editorRef}
			></div>
			<div
				class="output prose prose-stone w-[49.5%] max-w-none overflow-y-scroll text-wrap border border-black bg-white px-4 py-2 leading-normal prose-headings:mb-3 prose-h1:text-4xl prose-h2:mb-2 prose-h2:mt-4 prose-h2:text-3xl prose-h3:mt-4 prose-h3:text-2xl prose-h4:mt-4 prose-h4:text-xl prose-h5:mt-4 prose-h5:text-lg prose-h6:mt-4 prose-p:my-2"
				ref={displayRef}
			></div>
		</section>
	);
});
