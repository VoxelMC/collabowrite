import {
	component$,
	$,
	useStore,
	noSerialize,
	useSignal,
	useTask$,
	useOnDocument,
} from '@builder.io/qwik';
// @ts-ignore
import { isServer } from '@builder.io/qwik/build';

import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
// @ts-ignore
import { yCollab } from 'y-codemirror.next';
import * as random from 'lib0/random';

import { EditorView, basicSetup } from 'codemirror';
import type { ViewUpdate } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { type Update } from '@codemirror/collab';

import * as IncrementalDOM from 'incremental-dom';
import MarkdownIt from 'markdown-it';

// @ts-ignore-warn
import MarkdownItIncrementalDOM from 'markdown-it-incremental-dom';
import type { YText } from 'node_modules/yjs/dist/src/types/YText';
import { EditorState } from '@codemirror/state';
import supabase from '~/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';

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

async function decodeDoc(json: string): Promise<Y.Doc> {
	const update = Uint8Array.from(JSON.parse(json));
	const doc = new Y.Doc();
	Y.applyUpdate(doc, update);
	return doc;
}

export default component$(({ url }: ItemProps) => {
	const wsUrl = useSignal<string>();

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

	const initData = useSignal<{ data: any; error: PostgrestError | null }>();

	useTask$(async () => {
		if (isServer) {
			wsUrl.value =
				import.meta.env.DEV && process.env.TESTING !== '1' ?
					'localhost:49414'
					: import.meta.env.PARTYKIT_URL;
			const { data, error } = await supabase
				.from('document')
				.select('data')
				.eq('uuid', url);
			initData.value = { data, error };
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
			const arr = Array.from(document.querySelectorAll('.cm-line'));
			const newArr = arr
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
				store.md.renderToIncrementalDOM(newArr)
			);
		}
	});

	const state = useSignal<EditorState>();
	const languagesData = $(() => languages);

	useOnDocument(
		'DOMContentLoaded',
		$(async () => {
			const currentUser = await window.supabase.auth.getUser();
			if (!currentUser.data || currentUser.error) return;

			if (initData?.value?.error || initData?.value?.data.length === 0) {
				store.ydoc = noSerialize(new Y.Doc());
			} else {
				store.ydoc = noSerialize(
					await decodeDoc(initData?.value?.data[0].data as string)
				);
			}
			store.provider = noSerialize(
				new YPartyKitProvider(wsUrl.value as string, url, store.ydoc, {
					params: () => ({
						token: 'TOKEN',
						userId: currentUser.data.user.id,
					}),
				})
			);

			const ytext = store.ydoc?.getText('codemirror');

			const md = new MarkdownIt();
			md.use(MarkdownItIncrementalDOM, IncrementalDOM);

			store.md = noSerialize(md);
			store.undoManager = noSerialize(new Y.UndoManager(ytext as YText));
			store?.provider?.awareness.setLocalStateField('user', {
				name: currentUser.data.user?.user_metadata.name,
				color: userColor.color,
				colorLight: userColor.light,
			});

			state.value = noSerialize(
				EditorState.create({
					doc: ytext?.toString(),
					extensions: [
						basicSetup,
						EditorView.updateListener.of(processEditorUpdate),
						EditorView.theme({
							'&': { height: 'auto', maxHeight: '100%' },
							'& *': { fontFamily: "'JetBrains Mono'" },
							'.cm-scroller': { overflow: 'auto' },
						}),
						markdown({ codeLanguages: await languagesData() }),
						EditorView.lineWrapping,
						yCollab(ytext, store.provider?.awareness, {
							undoManager: store.undoManager,
						}),
					],
				})
			);

			function getSanitizedInputField(): string {
				const multiplayerNames: Element[] = Array.from(
					document.querySelectorAll('.cm-ySelectionInfo')
				);
				const arr = Array.from(document.querySelectorAll('.cm-line'));
				console.log(arr);
				const out = arr
					.map(e => {
						let out = e.textContent as string;
						for (let name of multiplayerNames) {
							out = out.replaceAll(
								name.textContent as string,
								''
							);
						}
						return out;
					})
					.join('\n');
				return out;
			}

			function download(
				content: string,
				mimeType: string,
				filename: string
			) {
				const a = document.createElement('a'); // Create "a" element
				const blob = new Blob([content], { type: mimeType }); // Create a blob (file-like object)
				const url = URL.createObjectURL(blob); // Create an object URL from blob
				a.setAttribute('href', url); // Set "a" element link
				a.setAttribute('download', filename); // Set download filename
				a.click(); // Start downloading
			}

			document.addEventListener('download-md', (payload: any) => {
				const url = payload.detail.url;
				const input = codeMirrorRef?.value?.state.doc.toString() as string;
				download(input, 'text/markdown', url + '.md');
				console.log('Downloaded as' + url + '.md');
				console.log(input);
			});

			codeMirrorRef.value = noSerialize(
				new EditorView({
					state: state?.value as EditorState,
					parent: editorRef.value as HTMLElement,
				})
			);
			codeMirrorRef.value?.focus();
		})
	);

	return (
		<section class="flex h-[80vh] flex-row justify-between">
			<div
				class="output mono prose prose-stone h-full w-[49.5%] max-w-none border border-black bg-white"
				ref={editorRef}
			></div>
			<div
				class="output prose prose-stone w-[49.5%] max-w-none overflow-y-scroll text-wrap border border-black bg-white px-4 py-2 leading-normal prose-headings:mb-3 prose-h1:text-4xl prose-h2:mb-2 prose-h2:mt-4 prose-h2:text-3xl prose-h3:mt-4 prose-h3:text-2xl prose-h4:mt-4 prose-h4:text-xl prose-h5:mt-4 prose-h5:text-lg prose-h6:mt-4 prose-p:my-2"
				ref={displayRef}
			></div>
		</section>
	);
});
