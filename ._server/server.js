import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { YSocketIO } from './util/document.js';

// Create the YSocketIO instance
// NOTE: This uses the socket namespaces that match the regular expression /^\/yjs\|.*$/
//       (for example: 'ws://localhost:1234/yjs|my-document-room'), make sure that when using namespaces
//       for other logic, these do not match the regular expression, this could cause unwanted problems.
// TIP: You can export a new instance from another file to manage as singleton and access documents from all app.

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: ['http://10.0.0.37:4321', 'http://localhost:4321'],
	},
});

console.log('Starting Server...');

const ysocketio = new YSocketIO(io);
// Execute initialize method
ysocketio.initialize();

io.on('connection', socket => {
	console.log('Connected');
	// socket.join(socket.handshake.query.slug);
	socket.on('event-a', data => {
		// console.log(socket.rooms)
		console.log(data);
		socket.emit('event-a', data);
	});
});

httpServer.listen(3000);
