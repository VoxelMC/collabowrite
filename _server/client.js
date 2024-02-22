// This is a testing client
console.log('test');

import { io } from 'socket.io-client';
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log(socket.id);
    socket.on('event-a', ({ data }) => {
        console.log(data);
    });

    socket.emit('event-a', 'Hello, world');
    socket.emit('event-a', { nested: 'Hello, world' });
});
