/*jslint node: true */
"use strict";

let socks			= process.browser ? null : require( 'socks' + '' );


let _network_consts		= require( './p2pConstants.js' );
let _network_message		= require( './p2pMessage.js' );
let _network_request		= require( './p2pRequest.js' );
let _network_peer		= require( './p2pPeer.js' );



let m_nLastHeartbeatWakeTs			= Date.now();





/**
 *	*
 *	heartbeat
 *	about every 3 seconds
 */
function heartbeatEmitter()
{
	let bJustResumed;

	//	just resumed after sleeping
	bJustResumed		= ( typeof window !== 'undefined' &&
					window &&
					window.cordova &&
					Date.now() - m_nLastHeartbeatWakeTs > 2 * _network_consts.HEARTBEAT_TIMEOUT );
	m_nLastHeartbeatWakeTs	= Date.now();

	//
	//	The concat() method is used to merge two or more arrays.
	//	This method does not change the existing arrays, but instead returns a new array.
	//
	_network_peer.getInboundClients().concat( _network_peer.getOutboundPeers() ).forEach( function( ws )
	{
		let nElapsedSinceLastReceived;
		let nElapsedSinceLastSentHeartbeat;

		if ( ! ws.bSleeping &&
			ws.readyState === ws.OPEN )
		{
			//	...
			nElapsedSinceLastReceived	= Date.now() - ws.last_ts;
			if ( nElapsedSinceLastReceived >= _network_consts.HEARTBEAT_TIMEOUT )
			{
				//	>= 10 seconds
				if ( ws.last_sent_heartbeat_ts && ! bJustResumed )
				{
					nElapsedSinceLastSentHeartbeat	= Date.now() - ws.last_sent_heartbeat_ts;
					if ( nElapsedSinceLastSentHeartbeat >= _network_consts.HEARTBEAT_RESPONSE_TIMEOUT )
					{
						//	>= 60 seconds
						console.log( 'will disconnect peer ' + ws.peer + ' who was silent for ' + nElapsedSinceLastReceived + 'ms' );
						ws.close( 1000, 'lost connection' );
					}
				}
				else
				{
					ws.last_sent_heartbeat_ts	= Date.now();
					_network_request.sendRequest
					(
						ws,
						'heartbeat',
						null,
						false,
						function( ws, request, response )
						{
							delete ws.last_sent_heartbeat_ts;
							ws.last_sent_heartbeat_ts = null;

							if ( 'sleep' === response )
							{
								//
								//	the peer doesn't want to be bothered with heartbeats any more,
								//	but still wants to keep the connection open
								//
								ws.bSleeping = true;
							}

							//
							//	as soon as the peer sends a heartbeat himself,
							//	we'll think he's woken up and resume our heartbeats too
							//
						}
					);
				}
			}
		}
		else
		{
			//	web socket is not ready
		}
	});
}


/**
 *	acceptor
 *
 *	@param	ws
 *	@param	tag
 */
function heartbeatAcceptor( ws, tag )
{
	let bPaused;

	//
	//	the peer is sending heartbeats, therefore he is awake
	//
	ws.bSleeping = false;

	//
	//	true if our timers were paused
	//	Happens only on android, which suspends timers when the app becomes paused but still keeps network connections
	//	Handling 'pause' event would've been more straightforward but with preference KeepRunning=false,
	// 	the event is delayed till resume
	//
	bPaused = (
		typeof window !== 'undefined' &&
		window
		&&
		window.cordova &&
		Date.now() - m_nLastHeartbeatWakeTs > _network_consts.PAUSE_TIMEOUT
	);
	if ( bPaused )
	{
		//	opt out of receiving heartbeats and move the connection into a sleeping state
		return _network_message.sendResponse( ws, tag, 'sleep' );
	}

	//	...
	_network_message.sendResponse( ws, tag );
}





/**
 *	exports
 */
exports.heartbeatEmitter			= heartbeatEmitter;
exports.heartbeatAcceptor			= heartbeatAcceptor;
