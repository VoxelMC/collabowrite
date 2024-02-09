import {
	component$,
	useVisibleTask$,
	$,
	useStore,
	noSerialize,
	useSignal,
} from '@builder.io/qwik';

import { Socket, io } from 'socket.io-client';
import supabase from '~/supabase/client';

import * as Y from 'yjs';
import { yCollab } from 'y-codemirror.next';
import { SocketIOProvider } from './util/provider';
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

// import {
// 	peerExtension,
// 	EditorConnection,
// 	getDocument,
// } from '~/util/peerExtension';

import * as IncrementalDOM from 'incremental-dom';
import MarkdownIt from 'markdown-it';
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
	provider?: SocketIOProvider;
	undoManager?: Y.UndoManager;
}

export default component$(({ url }: ItemProps) => {
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

	// const ioSocket = useSignal<Socket>();
	const editorRef = useSignal<HTMLElement>();
	const displayRef = useSignal<HTMLElement>();
	const store = useStore<Store>({
		md: undefined,
		updates: [],
		ydoc: undefined,
		provider: undefined,
	});

	const currentValue = useSignal<string>();
	const startingValue = '# Hello, Incremental DOM!';

	// const socketUrl = url.replace(/^http/, 'ws');
	// const socketUrl = 'ws://localhost:3000/test';
	// const socketUrl = url.replace(/^http/, 'http') + "/socket";

	const test = $((update: ViewUpdate) => {
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

	useVisibleTask$(async () => {
		store.ydoc = noSerialize(new Y.Doc());
		store.provider = noSerialize(
			new SocketIOProvider(
				'ws://10.0.0.37:3000',
				'test-room',
				store.ydoc,
				{ autoConnect: true }
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

		// let { version, doc } = await getDocument(new EditorConnection(ioSocket?.value as Socket));

		const state = EditorState.create({
			doc: ytext?.toString(),
			extensions: [
				basicSetup,
				EditorView.updateListener.of(test),
				EditorView.theme({
					'&': { height: '100%' },
					'.cm-scroller': { overflow: 'auto' },
				}),
				markdown({ codeLanguages: languages }),
				EditorView.lineWrapping,
				yCollab(ytext, store.provider, {
					undoManager: store.undoManager,
				}),
				// peerExtension(0, new EditorConnection(ioSocket?.value as Socket))
			],
		});

		new EditorView({
			state,
			parent: editorRef.value as HTMLElement,
		});
	});

	return (
		<section class="flex h-[50vh] flex-row justify-between">
			<div
				class="output prose prose-stone h-full w-[49%] border border-black"
				ref={editorRef}
			></div>
			<div
				class="output prose prose-stone w-[49%] border border-black px-4 py-2"
				ref={displayRef}
			></div>
		</section>
	);
});
