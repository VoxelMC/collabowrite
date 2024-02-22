import * as Y from 'yjs';
import * as AwarenessProtocol from 'y-protocols/awareness';

/**
 * Clients added, updated and deleted to awareness.
 */
export interface AwarenessChange {
	/**
	 * The clients added
	 */
	added: number[];
	/**
	 * The clients updated
	 */
	updated: number[];
	/**
	 * The clients removed
	 */
	removed: number[];
}
import { Namespace, Server, Socket } from 'socket.io';
// @ts-ignore
import { LeveldbPersistence } from 'y-leveldb';
import { Observable } from 'lib0/observable';

/**
 * Level db persistence object
 */
export interface Persistence {
	bindState: (docName: string, ydoc: Document) => void;
	writeState: (docName: string, ydoc: Document) => Promise<any>;
	provider: any;
}

/**
 * YSocketIO instance cofiguration. Here you can configure:
 * - gcEnabled: Enable/Disable garbage collection (default: gc=true)
 * - levelPersistenceDir: The directory path where the persistent Level database will be stored
 * - authenticate: The callback to authenticate the client connection
 */
export interface YSocketIOConfiguration {
	/**
	 * Enable/Disable garbage collection (default: gc=true)
	 */
	gcEnabled?: boolean;
	/**
	 * The directory path where the persistent Level database will be stored
	 */
	levelPersistenceDir?: string;
	/**
	 * Callback to authenticate the client connection.
	 *
	 *  It can be a promise and if it returns true, the connection is allowed; otherwise, if it returns false, the connection is rejected.
	 * @param handshake Provided from the handshake attribute of the socket io
	 */
	authenticate?: (handshake: {
		[key: string]: any;
	}) => Promise<boolean> | boolean;
}

/**
 * YSocketIO class. This handles document synchronization.
 */
export class YSocketIO extends Observable<string> {
	/**
	 * @type {Map<string, Document>}
	 */
	private readonly _documents: Map<string, Document> = new Map<
		string,
		Document
	>();
	/**
	 * @type {Server}
	 */
	private readonly io: Server;
	/**
	 * @type {string | undefined | null}
	 */
	private readonly _levelPersistenceDir: string | undefined | null = null;
	/**
	 * @type {Persistence | null}
	 */
	private persistence: Persistence | null = null;
	/**
	 * @type {YSocketIOConfiguration}
	 */
	private readonly configuration?: YSocketIOConfiguration;
	/**
	 * @type {Namespace | null}
	 */
	public nsp: Namespace | null = null;
	/**
	 * YSocketIO constructor.
	 * @constructor
	 * @param {Server} io Server instance from Socket IO
	 * @param {YSocketIOConfiguration} configuration (Optional) The YSocketIO configuration
	 */
	constructor(io: Server, configuration?: YSocketIOConfiguration) {
		super();

		this.io = io;

		this._levelPersistenceDir =
			configuration?.levelPersistenceDir ?? process.env.YPERSISTENCE;
		if (this._levelPersistenceDir != null)
			this.initLevelDB(this._levelPersistenceDir);

		this.configuration = configuration;
	}

	/**
	 * YSocketIO initialization.
	 *
	 *  This method set ups a dynamic namespace manager for namespaces that match with the regular expression `/^\/yjs\|.*$/`
	 *  and adds the connection authentication middleware to the dynamics namespaces.
	 *
	 *  It also starts socket connection listeners.
	 * @type {() => void}
	 */
	public initialize(): void {
		this.nsp = this.io.of(/^\/yjs\|.*$/);

		this.nsp.use(async (socket, next) => {
			if (this.configuration?.authenticate == null) return next();
			if (await this.configuration.authenticate(socket.handshake))
				return next();
			else return next(new Error('Unauthorized'));
		});

		this.nsp.on('connection', async socket => {
			const namespace = socket.nsp.name.replace(/\/yjs\|/, '');

			const doc = await this.initDocument(
				namespace,
				socket.nsp,
				this.configuration?.gcEnabled
			);

			this.initSyncListeners(socket, doc);
			this.initAwarenessListeners(socket, doc);

			this.initSocketListeners(socket, doc);

			this.startSynchronization(socket, doc);
		});
	}

	/**
	 * The document map's getter. If you want to delete a document externally, make sure you don't delete
	 * the document directly from the map, instead use the "destroy" method of the document you want to delete,
	 * this way when you destroy the document you are also closing any existing connection on the document.
	 * @type {Map<string, Document>}
	 */
	public get documents(): Map<string, Document> {
		return this._documents;
	}

	/**
	 * This method creates a yjs document if it doesn't exist in the document map. If the document exists, get the map document.
	 *
	 *  - If document is created:
	 *      - Binds the document to LevelDB if LevelDB persistence is enabled.
	 *      - Adds the new document to the documents map.
	 *      - Emit the `document-loaded` event
	 * @private
	 * @param {string} name The name for the document
	 * @param {Namespace} namespace The namespace of the document
	 * @param {boolean} gc Enable/Disable garbage collection (default: gc=true)
	 * @returns {Promise<Document>} The document
	 */
	private async initDocument(
		name: string,
		namespace: Namespace,
		gc: boolean = true
	): Promise<Document> {
		const doc =
			this._documents.get(name) ??
			new Document(name, namespace, {
				onUpdate: (doc, update) =>
					this.emit('document-update', [doc, update]),
				onChangeAwareness: (doc, update) =>
					this.emit('awareness-update', [doc, update]),
				onDestroy: async doc => {
					this._documents.delete(doc.name);
					this.emit('document-destroy', [doc]);
				},
			});
		doc.gc = gc;
		if (!this._documents.has(name)) {
			if (this.persistence != null)
				await this.persistence.bindState(name, doc);
			this._documents.set(name, doc);
			this.emit('document-loaded', [doc]);
		}
		return doc;
	}

	/**
	 * This method sets persistence if enabled.
	 * @private
	 * @param {string} levelPersistenceDir The directory path where the persistent Level database is stored
	 */
	private initLevelDB(levelPersistenceDir: string): void {
		const ldb = new LeveldbPersistence(levelPersistenceDir);
		this.persistence = {
			provider: ldb,
			bindState: async (docName: string, ydoc: Document) => {
				const persistedYdoc = await ldb.getYDoc(docName);
				const newUpdates = Y.encodeStateAsUpdate(ydoc);
				await ldb.storeUpdate(docName, newUpdates);
				Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
				ydoc.on(
					'update',
					async (update: Uint8Array) =>
						await ldb.storeUpdate(docName, update)
				);
			},
			writeState: async (_docName: string, _ydoc: Document) => {},
		};
	}

	/**
	 * This function initializes the socket event listeners to synchronize document changes.
	 *
	 *  The synchronization protocol is as follows:
	 *  - A client emits the sync step one event (`sync-step-1`) which sends the document as a state vector
	 *    and the sync step two callback as an acknowledgment according to the socket io acknowledgments.
	 *  - When the server receives the `sync-step-1` event, it executes the `syncStep2` acknowledgment callback and sends
	 *    the difference between the received state vector and the local document (this difference is called an update).
	 *  - The second step of the sync is to apply the update sent in the `syncStep2` callback parameters from the server
	 *    to the document on the client side.
	 *  - There is another event (`sync-update`) that is emitted from the client, which sends an update for the document,
	 *    and when the server receives this event, it applies the received update to the local document.
	 *  - When an update is applied to a document, it will fire the document's "update" event, which
	 *    sends the update to clients connected to the document's namespace.
	 * @private
	 * @type {(socket: Socket, doc: Document) => void}
	 * @param {Socket} socket The socket connection
	 * @param {Document} doc The document
	 */
	private readonly initSyncListeners = (
		socket: Socket,
		doc: Document
	): void => {
		socket.on(
			'sync-step-1',
			(
				stateVector: Uint8Array,
				syncStep2: (update: Uint8Array) => void
			) => {
				syncStep2(
					Y.encodeStateAsUpdate(doc, new Uint8Array(stateVector))
				);
			}
		);

		socket.on('sync-update', (update: Uint8Array) => {
			Y.applyUpdate(doc, update, null);
		});
	};

	/**
	 * This function initializes socket event listeners to synchronize awareness changes.
	 *
	 *  The awareness protocol is as follows:
	 *  - A client emits the `awareness-update` event by sending the awareness update.
	 *  - The server receives that event and applies the received update to the local awareness.
	 *  - When an update is applied to awareness, the awareness "update" event will fire, which
	 *    sends the update to clients connected to the document namespace.
	 * @private
	 * @type {(socket: Socket, doc: Document) => void}
	 * @param {Socket} socket The socket connection
	 * @param {Document} doc The document
	 */
	private readonly initAwarenessListeners = (
		socket: Socket,
		doc: Document
	): void => {
		socket.on('awareness-update', (update: ArrayBuffer) => {
			AwarenessProtocol.applyAwarenessUpdate(
				doc.awareness,
				new Uint8Array(update),
				socket
			);
		});
	};

	/**
	 *  This function initializes socket event listeners for general purposes.
	 *
	 *  When a client has been disconnected, check the clients connected to the document namespace,
	 *  if no connection remains, emit the `all-document-connections-closed` event
	 *  parameters and if LevelDB persistence is enabled, persist the document in LevelDB and destroys it.
	 * @private
	 * @type {(socket: Socket, doc: Document) => void}
	 * @param {Socket} socket The socket connection
	 * @param {Document} doc The document
	 */
	private readonly initSocketListeners = (
		socket: Socket,
		doc: Document
	): void => {
		socket.on('disconnect', async () => {
			if ((await socket.nsp.allSockets()).size === 0) {
				this.emit('all-document-connections-closed', [doc]);
				if (this.persistence != null) {
					await this.persistence.writeState(doc.name, doc);
					await doc.destroy();
				}
			}
		});
	};

	/**
	 * This function is called when a client connects and it emit the `sync-step-1` and `awareness-update`
	 * events to the client to start the sync.
	 * @private
	 * @type {(socket: Socket, doc: Document) => void}
	 * @param {Socket} socket The socket connection
	 * @param {Document} doc The document
	 */
	private readonly startSynchronization = (
		socket: Socket,
		doc: Document
	): void => {
		socket.emit(
			'sync-step-1',
			Y.encodeStateVector(doc),
			(update: Uint8Array) => {
				Y.applyUpdate(doc, new Uint8Array(update), this);
			}
		);
		socket.emit(
			'awareness-update',
			AwarenessProtocol.encodeAwarenessUpdate(
				doc.awareness,
				Array.from(doc.awareness.getStates().keys())
			)
		);
	};
}
const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0';

/**
 * Document callbacks. Here you can set:
 * - onUpdate: Set a callback that will be triggered when the document is updated
 * - onChangeAwareness: Set a callback that will be triggered when the awareness is updated
 * - onDestroy: Set a callback that will be triggered when the document is destroyed
 */
export interface Callbacks {
	/**
	 * Set a callback that will be triggered when the document is updated
	 */
	onUpdate?: (doc: Document, docUpdate: Uint8Array) => void;
	/**
	 * Set a callback that will be triggered when the awareness is updated
	 */
	onChangeAwareness?: (doc: Document, awarenessUpdate: Uint8Array) => void;
	/**
	 * Set a callback that will be triggered when the document is destroyed
	 */
	onDestroy?: (doc: Document) => Promise<void>;
}

/**
 * YSocketIO document
 */
export class Document extends Y.Doc {
	/**
	 * The document name
	 * @type {string}
	 */
	public name: string;
	/**
	 * The socket connection
	 * @type {Namespace}
	 * @private
	 */
	private readonly namespace: Namespace;
	/**
	 * The document awareness
	 * @type {Awareness}
	 */
	public awareness: AwarenessProtocol.Awareness;
	/**
	 * The document callbacks
	 * @type {Callbacks}
	 * @private
	 */
	private readonly callbacks?: Callbacks;

	/**
	 * Document constructor.
	 * @constructor
	 * @param {string} name Name for the document
	 * @param {Namespace} namespace The namespace connection
	 * @param {Callbacks} callbacks The document callbacks
	 */
	constructor(name: string, namespace: Namespace, callbacks?: Callbacks) {
		super({ gc: gcEnabled });
		this.name = name;
		this.namespace = namespace;
		this.awareness = new AwarenessProtocol.Awareness(this);
		this.awareness.setLocalState(null);
		this.callbacks = callbacks;

		this.awareness.on('update', this.onUpdateAwareness);

		this.on('update', this.onUpdateDoc);
	}

	/**
	 * Handles the document's update and emit eht changes to clients.
	 * @type {(update: Uint8Array) => void}
	 * @param {Uint8Array} update
	 * @private
	 */
	private readonly onUpdateDoc = (update: Uint8Array): void => {
		if (this.callbacks?.onUpdate != null) {
			try {
				this.callbacks.onUpdate(this, update);
			} catch (error) {
				console.warn(error);
			}
		}
		this.namespace.emit('sync-update', update);
	};

	/**
	 * Handles the awareness update and emit the changes to clients.
	 * @type {({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }, _socket: Socket | null) => void}
	 * @param {AwarenessChange} awarenessChange
	 * @param {Socket | null} _socket
	 * @private
	 */
	private readonly onUpdateAwareness = (
		{ added, updated, removed }: AwarenessChange,
		_socket: Socket | null
	): void => {
		const changedClients = added.concat(updated, removed);
		const update = AwarenessProtocol.encodeAwarenessUpdate(
			this.awareness,
			changedClients
		);
		if (this.callbacks?.onChangeAwareness != null) {
			try {
				this.callbacks.onChangeAwareness(this, update);
			} catch (error) {
				console.warn(error);
			}
		}
		this.namespace.emit('awareness-update', update);
	};

	/**
	 * Destroy the document and remove the listeners.
	 * @type {() => Promise<void>}
	 */
	public async destroy(): Promise<void> {
		if (this.callbacks?.onDestroy != null) {
			try {
				await this.callbacks.onDestroy(this);
			} catch (error) {
				console.warn(error);
			}
		}
		this.awareness.off('update', this.onUpdateAwareness);
		this.off('update', this.onUpdateDoc);
		this.namespace.disconnectSockets();
		super.destroy();
	}
}