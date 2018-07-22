/*jslint node: true */
"use strict";

const EventEmitter		= require( 'events' );

const _				= require( 'lodash' );

const CP2pMessage		= require( './p2pMessage.js' );

const _object_hash		= require( '../object_hash.js' );
const _p2pConstants		= require( './p2pConstants.js' );
const _network_peer		= require( './p2pPeer.js' );




/**
 *	P2p Request
 *	@class	CP2pRequest
 *	@module	CP2pRequest
 */
class CP2pRequest extends CP2pMessage
{
	constructor()
	{
		super();

		//	...
		this.m_oAssocReroutedConnectionsByTag		= {};
		this.m_nLastHeartbeatWakeTs			= Date.now();
	}


	broadcast()
	{
	}


	/**
	 * 	* HEARTBEAT
	 *	ping all clients
	 *
	 *	@public
	 *	@param	{array}	arrSockets
	 *	@returns {boolean}
	 *
	 *	@description
	 *	keep on sending heartbeat Ping from server to all clients
	 *	about every 3 seconds we try to send ping command to all clients
	 */
	handlePingClients( arrSockets )
	{
		let bJustResumed;

		if ( ! Array.isArray( arrSockets ) || 0 === arrSockets.length )
		{
			return false;
		}

		//
		//	just resumed after sleeping
		//
		bJustResumed	= ( typeof window !== 'undefined' &&
			window &&
			window.cordova &&
			Date.now() - this.m_nLastHeartbeatWakeTs > 2 * _p2pConstants.HEARTBEAT_TIMEOUT );
		this.m_nLastHeartbeatWakeTs	= Date.now();

		//
		//	The concat() method is used to merge two or more arrays.
		//	This method does not change the existing arrays, but instead returns a new array.
		//
		arrSockets.forEach( oSocket =>
		{
			let nElapsedSinceLastReceived;
			let nElapsedSinceLastSentHeartbeat;

			if ( oSocket.bSleeping ||
				oSocket.readyState !== oSocket.OPEN )
			{
				//	web socket is not ready
				return;
			}

			//	...
			nElapsedSinceLastReceived	= Date.now() - oSocket.last_ts;
			if ( nElapsedSinceLastReceived < _p2pConstants.HEARTBEAT_TIMEOUT )
			{
				return;
			}

			//	>= 10 seconds
			if ( oSocket.last_sent_heartbeat_ts && ! bJustResumed )
			{
				nElapsedSinceLastSentHeartbeat	= Date.now() - oSocket.last_sent_heartbeat_ts;
				if ( nElapsedSinceLastSentHeartbeat >= _p2pConstants.HEARTBEAT_RESPONSE_TIMEOUT )
				{
					//	>= 60 seconds
					console.log( `will disconnect peer ${ oSocket.peer } who was silent for ${ nElapsedSinceLastReceived }ms` );
					oSocket.close( 1000, 'lost connection' );
				}
			}
			else
			{
				oSocket.last_sent_heartbeat_ts	= Date.now();
				this.sendRequest
				(
					oSocket,
					'heartbeat',
					null,
					false,
					function( oNextSocket, request, response )
					{
						delete oNextSocket.last_sent_heartbeat_ts;
						oNextSocket.last_sent_heartbeat_ts = null;

						if ( 'sleep' === response )
						{
							//
							//	the peer doesn't want to be bothered with heartbeats any more,
							//	but still wants to keep the connection open
							//
							oNextSocket.bSleeping = true;
						}

						//
						//	as soon as the peer sends a heartbeat himself,
						//	we'll think he's woken up and resume our heartbeats too
						//
					}
				);
			}
		});

		return true;
	}

	/**
	 * 	* HEARTBEAT
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 */
	handlePongServer( oSocket )
	{
	}



	/**
	 *	if a 2nd identical request is issued before we receive a response to the 1st request, then:
	 *	1. its pfnResponseHandler will be called too but no second request will be sent to the wire
	 *	2. bReRoutable flag must be the same
	 *
	 *	@param ws
	 *	@param command
	 *	@param params
	 *	@param bReRoutable
	 *	@param pfnResponseHandler
	 */
	sendRequest( ws, command, params, bReRoutable, pfnResponseHandler )
	{
		//
		//	params for 'catchup'
		// 	{
		// 		witnesses	: arrWitnesses,		//	12 addresses of witnesses
		// 		last_stable_mci	: last_stable_mci,	//	stable last mci
		// 		last_known_mci	: last_known_mci	//	known last mci
		// 	};
		//
		let request;
		let content;
		let tag;
		let pfnReroute;
		let nRerouteTimer;
		let nCancelTimer;

		//	...
		request = { command : command };

		if ( params )
		{
			request.params = params;
		}

		//
		//	tag like : w35dxwqyQ2CzqHkOG5q+gwagPtaPweD4LEwzC2RjQNo=
		//
		content	= _.clone( request );
		tag	= _object_hash.getBase64Hash( request );

		//
		//	if (ws.assocPendingRequests[tag]) // ignore duplicate requests while still waiting for response from the same peer
		//	return console.log("will not send identical "+command+" request");
		//
		if ( ws.assocPendingRequests[ tag ] )
		{
			//	...
			ws.assocPendingRequests[ tag ].responseHandlers.push( pfnResponseHandler );

			//	...
			return console.log
			(
				'already sent a ' + command + ' request to ' + ws.peer + ', will add one more response handler rather than sending a duplicate request to the wire'
			);
		}


		//
		//	...
		//
		content.tag	= tag;

		//
		//	after _p2pConstants.STALLED_TIMEOUT, reroute the request to another peer
		//	it'll work correctly even if the current peer is already disconnected when the timeout fires
		//
		//	THIS function will be called when the request is timeout
		//
		pfnReroute = bReRoutable ? () =>
			{
				console.log( 'will try to reroute a ' + command + ' request stalled at ' + ws.peer );

				if ( ! ws.assocPendingRequests[ tag ] )
				{
					return console.log( 'will not reroute - the request was already handled by another peer' );
				}

				//	...
				ws.assocPendingRequests[ tag ].bRerouted	= true;
				_network_peer.findNextPeer( ws, ( next_ws ) =>
				{
					//
					//	the callback may be called much later if _network_peer.findNextPeer has to wait for connection
					//
					if ( ! ws.assocPendingRequests[ tag ] )
					{
						return console.log( 'will not reroute after findNextPeer - the request was already handled by another peer' );
					}

					if ( next_ws === ws ||
						this.m_oAssocReroutedConnectionsByTag[ tag ] && this.m_oAssocReroutedConnectionsByTag[ tag ].indexOf( next_ws ) >= 0 )
					{
						console.log( `will not reroute ${ command } to the same peer, will rather wait for a new connection` );
						// _event_bus.once
						// (
						// 	'connected_to_source',
						// 	() =>
						// 	{
						// 		//	try again
						// 		console.log( 'got new connection, retrying reroute ' + command );
						// 		pfnReroute();
						// 	}
						// );
						return;
					}

					//
					//	SEND REQUEST AGAIN FOR EVERY responseHandlers
					//
					console.log( 'rerouting ' + command + ' from ' + ws.peer + ' to ' + next_ws.peer );
					ws.assocPendingRequests[ tag ].responseHandlers.forEach
					(
						( rh ) =>
						{
							this.sendRequest( next_ws, command, params, bReRoutable, rh );
						}
					);

					//
					//	push to cache
					//
					if ( ! this.m_oAssocReroutedConnectionsByTag[ tag ] )
					{
						this.m_oAssocReroutedConnectionsByTag[ tag ] = [ ws ];
					}
					this.m_oAssocReroutedConnectionsByTag[ tag ].push( next_ws );
				});
			}
			: null;

		//
		//	timeout
		//	in sending request
		//
		nRerouteTimer	= bReRoutable
			? setTimeout
			(
				() =>
				{
					//	callback handler while the request is TIMEOUT
					console.log( `# network::sendRequest request ${ command }, send to ${ ws.peer } was overtime.` );
					pfnReroute.apply( this, arguments );
				},
				_p2pConstants.STALLED_TIMEOUT
			)
			: null;

		//
		//	timeout
		//	in receiving response
		//
		nCancelTimer	= bReRoutable
			? null
			: setTimeout
			(
				() =>
				{
					console.log( `# request ${ command }, response from ${ ws.peer } was overtime.` );

					//
					//	delete all overtime requests/connections in pending requests list
					//
					ws.assocPendingRequests[ tag ].responseHandlers.forEach
					(
						rh =>
						{
							rh( ws, request, { error : "[internal] response timeout" } );
						}
					);
					delete ws.assocPendingRequests[ tag ];
				},
				_p2pConstants.RESPONSE_TIMEOUT
			);

		//
		//	build pending request list
		//
		ws.assocPendingRequests[ tag ] =
			{
				request			: request,
				responseHandlers	: [ pfnResponseHandler ],
				reroute			: pfnReroute,
				reroute_timer		: nRerouteTimer,
				cancel_timer		: nCancelTimer
			};

		//
		//	...
		//
		this.sendMessage( ws, 'request', content );
	}


	clearRequest( tag )
	{
		//
		//	if the request was rerouted, cancel all other pending requests
		//
		if ( this.m_oAssocReroutedConnectionsByTag[ tag ] )
		{
			this.m_oAssocReroutedConnectionsByTag[ tag ].forEach
			(
				client =>
				{
					if ( client.assocPendingRequests[ tag ] )
					{
						clearTimeout( client.assocPendingRequests[ tag ].reroute_timer );
						clearTimeout( client.assocPendingRequests[ tag ].cancel_timer );
						delete client.assocPendingRequests[ tag ];
					}
				}
			);
			delete this.m_oAssocReroutedConnectionsByTag[ tag ];
		}
	}



	sendResponse( ws, tag, response )
	{
		delete ws.assocInPreparingResponse[ tag ];
		this.sendMessage( ws, 'response', { tag: tag, response: response } );
	}

	sendErrorResponse( ws, tag, error )
	{
		this.sendResponse( ws, tag, { error : error } );
	}
}





/**
 *	exports
 */
module.exports	= CP2pRequest;
