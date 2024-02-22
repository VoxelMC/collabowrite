var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as Y from 'yjs';
import * as AwarenessProtocol from 'y-protocols/awareness';
// @ts-ignore
import { LeveldbPersistence } from 'y-leveldb';
import { Observable } from 'lib0/observable';
/**
 * YSocketIO class. This handles document synchronization.
 */
export class YSocketIO extends Observable {
    /**
     * YSocketIO constructor.
     * @constructor
     * @param {Server} io Server instance from Socket IO
     * @param {YSocketIOConfiguration} configuration (Optional) The YSocketIO configuration
     */
    constructor(io, configuration) {
        var _a;
        super();
        /**
         * @type {Map<string, Document>}
         */
        this._documents = new Map();
        /**
         * @type {string | undefined | null}
         */
        this._levelPersistenceDir = null;
        /**
         * @type {Persistence | null}
         */
        this.persistence = null;
        /**
         * @type {Namespace | null}
         */
        this.nsp = null;
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
        this.initSyncListeners = (socket, doc) => {
            socket.on('sync-step-1', (stateVector, syncStep2) => {
                syncStep2(Y.encodeStateAsUpdate(doc, new Uint8Array(stateVector)));
            });
            socket.on('sync-update', (update) => {
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
        this.initAwarenessListeners = (socket, doc) => {
            socket.on('awareness-update', (update) => {
                AwarenessProtocol.applyAwarenessUpdate(doc.awareness, new Uint8Array(update), socket);
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
        this.initSocketListeners = (socket, doc) => {
            socket.on('disconnect', () => __awaiter(this, void 0, void 0, function* () {
                if ((yield socket.nsp.allSockets()).size === 0) {
                    this.emit('all-document-connections-closed', [doc]);
                    if (this.persistence != null) {
                        yield this.persistence.writeState(doc.name, doc);
                        yield doc.destroy();
                    }
                }
            }));
        };
        /**
         * This function is called when a client connects and it emit the `sync-step-1` and `awareness-update`
         * events to the client to start the sync.
         * @private
         * @type {(socket: Socket, doc: Document) => void}
         * @param {Socket} socket The socket connection
         * @param {Document} doc The document
         */
        this.startSynchronization = (socket, doc) => {
            socket.emit('sync-step-1', Y.encodeStateVector(doc), (update) => {
                Y.applyUpdate(doc, new Uint8Array(update), this);
            });
            socket.emit('awareness-update', AwarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(doc.awareness.getStates().keys())));
        };
        this.io = io;
        this._levelPersistenceDir =
            (_a = configuration === null || configuration === void 0 ? void 0 : configuration.levelPersistenceDir) !== null && _a !== void 0 ? _a : process.env.YPERSISTENCE;
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
    initialize() {
        this.nsp = this.io.of(/^\/yjs\|.*$/);
        this.nsp.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (((_a = this.configuration) === null || _a === void 0 ? void 0 : _a.authenticate) == null)
                return next();
            if (yield this.configuration.authenticate(socket.handshake))
                return next();
            else
                return next(new Error('Unauthorized'));
        }));
        this.nsp.on('connection', (socket) => __awaiter(this, void 0, void 0, function* () {
            var _b;
            const namespace = socket.nsp.name.replace(/\/yjs\|/, '');
            const doc = yield this.initDocument(namespace, socket.nsp, (_b = this.configuration) === null || _b === void 0 ? void 0 : _b.gcEnabled);
            this.initSyncListeners(socket, doc);
            this.initAwarenessListeners(socket, doc);
            this.initSocketListeners(socket, doc);
            this.startSynchronization(socket, doc);
        }));
    }
    /**
     * The document map's getter. If you want to delete a document externally, make sure you don't delete
     * the document directly from the map, instead use the "destroy" method of the document you want to delete,
     * this way when you destroy the document you are also closing any existing connection on the document.
     * @type {Map<string, Document>}
     */
    get documents() {
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
    initDocument(name, namespace, gc = true) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const doc = (_a = this._documents.get(name)) !== null && _a !== void 0 ? _a : new Document(name, namespace, {
                onUpdate: (doc, update) => this.emit('document-update', [doc, update]),
                onChangeAwareness: (doc, update) => this.emit('awareness-update', [doc, update]),
                onDestroy: (doc) => __awaiter(this, void 0, void 0, function* () {
                    this._documents.delete(doc.name);
                    this.emit('document-destroy', [doc]);
                }),
            });
            doc.gc = gc;
            if (!this._documents.has(name)) {
                if (this.persistence != null)
                    yield this.persistence.bindState(name, doc);
                this._documents.set(name, doc);
                this.emit('document-loaded', [doc]);
            }
            return doc;
        });
    }
    /**
     * This method sets persistence if enabled.
     * @private
     * @param {string} levelPersistenceDir The directory path where the persistent Level database is stored
     */
    initLevelDB(levelPersistenceDir) {
        const ldb = new LeveldbPersistence(levelPersistenceDir);
        this.persistence = {
            provider: ldb,
            bindState: (docName, ydoc) => __awaiter(this, void 0, void 0, function* () {
                const persistedYdoc = yield ldb.getYDoc(docName);
                const newUpdates = Y.encodeStateAsUpdate(ydoc);
                yield ldb.storeUpdate(docName, newUpdates);
                Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
                ydoc.on('update', (update) => __awaiter(this, void 0, void 0, function* () { return yield ldb.storeUpdate(docName, update); }));
            }),
            writeState: (_docName, _ydoc) => __awaiter(this, void 0, void 0, function* () { }),
        };
    }
}
const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0';
/**
 * YSocketIO document
 */
export class Document extends Y.Doc {
    /**
     * Document constructor.
     * @constructor
     * @param {string} name Name for the document
     * @param {Namespace} namespace The namespace connection
     * @param {Callbacks} callbacks The document callbacks
     */
    constructor(name, namespace, callbacks) {
        super({ gc: gcEnabled });
        /**
         * Handles the document's update and emit eht changes to clients.
         * @type {(update: Uint8Array) => void}
         * @param {Uint8Array} update
         * @private
         */
        this.onUpdateDoc = (update) => {
            var _a;
            if (((_a = this.callbacks) === null || _a === void 0 ? void 0 : _a.onUpdate) != null) {
                try {
                    this.callbacks.onUpdate(this, update);
                }
                catch (error) {
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
        this.onUpdateAwareness = ({ added, updated, removed }, _socket) => {
            var _a;
            const changedClients = added.concat(updated, removed);
            const update = AwarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
            if (((_a = this.callbacks) === null || _a === void 0 ? void 0 : _a.onChangeAwareness) != null) {
                try {
                    this.callbacks.onChangeAwareness(this, update);
                }
                catch (error) {
                    console.warn(error);
                }
            }
            this.namespace.emit('awareness-update', update);
        };
        this.name = name;
        this.namespace = namespace;
        this.awareness = new AwarenessProtocol.Awareness(this);
        this.awareness.setLocalState(null);
        this.callbacks = callbacks;
        this.awareness.on('update', this.onUpdateAwareness);
        this.on('update', this.onUpdateDoc);
    }
    /**
     * Destroy the document and remove the listeners.
     * @type {() => Promise<void>}
     */
    destroy() {
        const _super = Object.create(null, {
            destroy: { get: () => super.destroy }
        });
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (((_a = this.callbacks) === null || _a === void 0 ? void 0 : _a.onDestroy) != null) {
                try {
                    yield this.callbacks.onDestroy(this);
                }
                catch (error) {
                    console.warn(error);
                }
            }
            this.awareness.off('update', this.onUpdateAwareness);
            this.off('update', this.onUpdateDoc);
            this.namespace.disconnectSockets();
            _super.destroy.call(this);
        });
    }
}
