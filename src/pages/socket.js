import { WebSocketServer } from 'ws';

export const GET = ({ params, request }) => {
	const wss = new WebSocketServer({ noServer: true });
	console.log(request);
	// wss.on('connection', function connection(ws, request, client) {
	// 	ws.on('error', console.error);
	//
	// 	ws.on('message', function message(data) {
	// 		console.log(`Received message ${data} from user ${client}`);
	// 	});
	//
	// 	console.log(request);
	// });
	wss.handleUpgrade(request, socket, head, function done(ws) {
		wss.emit('connection', ws, request, client);
	});
	return new Response(
		JSON.stringify({
			message: 'This was a GET!',
		})
	);
};
