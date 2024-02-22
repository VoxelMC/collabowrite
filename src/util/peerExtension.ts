// @ts-nocheck

import {
	collab,
	getSyncedVersion,
	receiveUpdates,
	sendableUpdates,
	type Update,
} from '@codemirror/collab';
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { ChangeSet, EditorState, Text } from '@codemirror/state';
import type { Socket } from 'socket.io-client';

export class EditorConnection {
	socket: Socket;
	private disconnected: null | { wait: Promise<void>; resolve: () => void } =
		null;

	constructor(
		// private worker: Worker,
		socket: Socket
	) {
		this.socket = socket;
	}

	private _request(value: any): Promise<any> {
		return new Promise(resolve => {
			this.socket.on('event-a', event => {
				resolve(JSON.parse(event.data));
				this.socket.emit('event-a', JSON.stringify(value));
			});
			// this.worker.postMessage(JSON.stringify(value), [channel.port1]);
		});
	}

	async request(value: any) {
		if (this.disconnected) await this.disconnected.wait;
		let result = await this._request(value);
		if (this.disconnected) await this.disconnected.wait;
		return result;
	}

	setConnected(value: boolean) {
		if (value && this.disconnected) {
			this.disconnected.resolve();
			this.disconnected = null;
		} else if (!value && !this.disconnected) {
			let resolve,
				wait = new Promise<void>(r => (resolve = r));
			this.disconnected = { wait, resolve };
		}
	}
}

//!wrappers

function pushUpdates(
	connection: EditorConnection,
	version: number,
	fullUpdates: readonly Update[]
): Promise<boolean> {
	// Strip off transaction data
	let updates = fullUpdates.map(u => ({
		clientID: u.clientID,
		changes: u.changes.toJSON(),
	}));
	console.log(updates);
	return connection.request({ type: 'pushUpdates', version, updates });
}

async function pullUpdates(
	connection: EditorConnection,
	version: number
): Promise<readonly Update[]> {
	const updates = await connection.request({ type: 'pullUpdates', version });
	console.log('pullUpdates');
	return updates.map((u: any) => ({
		changes: ChangeSet.fromJSON(u.changes),
		clientID: u.clientID,
	}));
}

export async function getDocument(
	connection: EditorConnection
): Promise<{ version: number; doc: Text }> {
	const data = await connection.request({ type: 'getDocument' });
	console.log(data);
	return {
		version: data.version,
		doc: Text.of(data.doc.split('\n')),
	};
}

export function peerExtension(
	startVersion: number,
	connection: EditorConnection
) {
	let plugin = ViewPlugin.fromClass(
		class {
			private pushing = false;
			private done = false;

			constructor(private view: EditorView) {
				this.pull();
			}

			update(update: ViewUpdate) {
				console.log(update.docChanged);
				if (update.docChanged) this.push();
			}

			async push() {
				let updates = sendableUpdates(this.view.state);
				if (this.pushing || !updates.length) return;
				this.pushing = true;
				let version = getSyncedVersion(this.view.state);
				await pushUpdates(connection, version, updates);
				this.pushing = false;
				// Regardless of whether the push failed or new updates came in
				// while it was running, try again if there's updates remaining
				if (sendableUpdates(this.view.state).length)
					setTimeout(() => this.push(), 100);
			}

			async pull() {
				while (!this.done) {
					let version = getSyncedVersion(this.view.state);
					let updates = await pullUpdates(connection, version);
					this.view.dispatch(
						receiveUpdates(this.view.state, updates)
					);
				}
			}

			destroy() {
				this.done = true;
			}
		}
	);
	return [collab({ startVersion }), plugin];
}
