// let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
//
//
// let url	= 'ws://127.0.0.1:1107';
// let ws	= new WebSocket( url );
//
// ws.setMaxListeners( 20 );
// if ( ws.OPEN === ws.readyState )
// {
// 	ws.send
// 	(
// 		JSON.stringify( { type : 'message', content : '1111' } )
// 	);
// }
// else
// {
// 	console.error( 'WS is not ready.' )
// }


const CP2pClient 	= require( '../CP2pClient.js' );


let _p2pClient	= new CP2pClient();

_p2pClient.startClient();