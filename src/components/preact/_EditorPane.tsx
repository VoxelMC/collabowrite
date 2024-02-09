import { signal } from '@preact/signals';
import { Component } from 'preact';

/*
 * Three tabs, two panels. Tabs change gridsize,
 */

export class EditorPane extends Component {
	/**
	 *
	 */
	constructor() {
		super();
		this.state = {
			clientText: '',
		};
	}

	componentDidMount(): void {
		const editorStateEl = document.getElementById('editor-state');
		const editorStateTabs = document.querySelectorAll('#editor-state .tab');
		for (let item of editorStateTabs) {
			console.log(item);
		}
	}

	render() {
		const innerText = signal('');

		return (
			<>
				<div
					id="editor-state"
					role="tablist"
					class="tabs-boxed tabs w-1/3"
				>
					<a role="tab" class="tab">
						Editor
					</a>
					<a role="tab" class="tab tab-active">
						Preview
					</a>
					<a role="tab" class="tab">
						Dual View
					</a>
				</div>
				<div
					className="flex h-full w-full flex-row rounded-md border border-black bg-slate-300 p-1 data-[dual=true]:space-x-1"
					data-dual="true"
				>
					<div className="h-full w-full bg-slate-200 rounded-l-md"></div>
					<div className="h-full w-full bg-slate-400 rounded-r-md"></div>
				</div>
			</>
		);
	}
}
