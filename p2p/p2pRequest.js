/*jslint node: true */
"use strict";

const EventEmitter		= require( 'events' );

const _				= require( 'lodash' );

const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pMessage		= require( './p2pMessage.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _object_hash		= require( '../object_hash.js' );
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
		this.m_cDriver				= null;
		this.m_oAssocReroutedConnectionsByTag	= {};
		this.m_nLastHeartbeatWakeTs		= Date.now();
	}

	/**
	 *	set driver instance
	 *
	 *	@param	{instance}	cDriver
	 *	@return	{void}
	 */
	setDriver( cDriver )
	{
		this.m_cDriver = cDriver;
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
					oSocket.close( 1000, 'lost driver' );
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
							//	but still wants to keep the driver open
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
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackType
	 *	@param	{string}	sCommand
	 *	@param	{object}	oJsonBody
	 *	@param	{boolean}	bReRoutable
	 *	@param	{function}	pfnResponseHandler( ws, request, response ){ ... }
	 */
	sendRequest( oSocket, nPackType, sCommand, oJsonBody, bReRoutable, pfnResponseHandler )
	{
		//
		//	oJsonBody for 'catchup'
		// 	{
		// 		witnesses	: arrWitnesses,		//	12 addresses of witnesses
		// 		last_stable_mci	: last_stable_mci,	//	stable last mci
		// 		last_known_mci	: last_known_mci	//	known last mci
		// 	};
		//
		let oJsonRequest;
		let oJsonContent;
		let sTag;
		let pfnReroute;
		let nRerouteTimer;
		let nCancelTimer;

		//	...
		oJsonRequest =
			{
				version	: String( _p2pConstants.version ),
				alt	: String( _p2pConstants.alt ),
				type	: nPackType,
				command	: sCommand,
				body	: oJsonBody ? oJsonBody : null
			};

		//
		//	sTag like : w35dxwqyQ2CzqHkOG5q+gwagPtaPweD4LEwzC2RjQNo=
		//
		oJsonContent	= Object.assign( {}, oJsonRequest );
		sTag		= _object_hash.getBase64Hash( oJsonRequest );

		//
		//	if (oSocket.assocPendingRequests[sTag]) // ignore duplicate requests while still waiting for response from the same peer
		//	return console.log("will not send identical "+sCommand+" oJsonRequest");
		//
		if ( oSocket.assocPendingRequests[ sTag ] )
		{
			oSocket.assocPendingRequests[ sTag ].responseHandlers.push( pfnResponseHandler );
			return console.log
			(
				`already sent a ${ sCommand } request to ${ oSocket.peer }, 
				will add one more response handler rather than sending a duplicate request to the wire`
			);
		}

		//
		//	...
		//
		oJsonContent.tag	= sTag;

		//
		//	* re-route only for clients
		//
		if ( CP2pDriver.DRIVER_TYPE_CLIENT !== this.m_cDriver.sDriverType )
		{
			bReRoutable	= false;
		}

		//
		//	* RE-ROUTE TO THE NEXT PEER, NOT TO SAME PEER AGAIN
		//
		//	after _p2pConstants.STALLED_TIMEOUT, reroute the request to another peer
		//	it'll work correctly even if the current peer is already disconnected when the timeout fires
		//
		//	THIS function will be called when the request is timeout
		//
		pfnReroute = bReRoutable ? () =>
			{
				let oNextWs;

				console.log( 'will try to reroute a ' + sCommand + ' request stalled at ' + oSocket.peer );

				if ( ! oSocket.assocPendingRequests[ sTag ] )
				{
					return console.log( 'will not reroute - the request was already handled by another peer' );
				}

				//	...
				oSocket.assocPendingRequests[ sTag ].bRerouted	= true;
				oNextWs	= this.m_cDriver.findNextServerSync( oSocket );

				//
				//	the callback may be called much later if _network_peer.findNextPeer has to wait for driver
				//
				if ( ! oSocket.assocPendingRequests[ sTag ] )
				{
					return console.log( 'will not reroute after findNextPeer - the request was already handled by another peer' );
				}
				if ( oNextWs === oSocket ||
					this.m_oAssocReroutedConnectionsByTag[ sTag ] && this.m_oAssocReroutedConnectionsByTag[ sTag ].indexOf( oNextWs ) >= 0 )
				{
					console.log( `will not reroute ${ sCommand } to the same peer, will rather wait for a new connection` );
					// _event_bus.once
					// (
					// 	'connected_to_source',
					// 	() =>
					// 	{
					// 		//	try again
					// 		console.log( 'got new driver, retrying reroute ' + sCommand );
					// 		pfnReroute();
					// 	}
					// );
					return;
				}

				//
				//	SEND REQUEST AGAIN FOR EVERY responseHandlers
				//
				console.log( `rerouting ${ sCommand } from ${ oSocket.peer } to ${ oNextWs.peer }` );
				oSocket.assocPendingRequests[ sTag ].responseHandlers.forEach
				(
					( rh ) =>
					{
						this.sendRequest( oNextWs, nPackType, sCommand, oJsonBody, bReRoutable, rh );
					}
				);

				//
				//	push to cache
				//
				if ( ! this.m_oAssocReroutedConnectionsByTag[ sTag ] )
				{
					this.m_oAssocReroutedConnectionsByTag[ sTag ] = [ oSocket ];
				}
				this.m_oAssocReroutedConnectionsByTag[ sTag ].push( oNextWs );

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
					console.log( `# network::sendRequest request ${ sCommand }, send to ${ oSocket.peer } was overtime.` );
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
					console.log( `# request ${ sCommand }, response from ${ oSocket.peer } was overtime.` );

					//
					//	delete all overtime requests/connections in pending requests list
					//
					oSocket.assocPendingRequests[ sTag ].responseHandlers.forEach
					(
						rh =>
						{
							rh( oSocket, oJsonRequest, { error : "[internal] response timeout" } );
						}
					);
					delete oSocket.assocPendingRequests[ sTag ];
				},
				_p2pConstants.RESPONSE_TIMEOUT
			);

		//
		//	build pending request list
		//
		oSocket.assocPendingRequests[ sTag ] =
			{
				request			: oJsonRequest,
				responseHandlers	: [ pfnResponseHandler ],
				reroute			: pfnReroute,
				reroute_timer		: nRerouteTimer,
				cancel_timer		: nCancelTimer
			};

		//
		//	...
		//
		this.sendMessage( oSocket, 'request', oJsonContent );
	}


	clearRequest( sTag )
	{
		//
		//	if the request was rerouted, cancel all other pending requests
		//
		if ( this.m_oAssocReroutedConnectionsByTag[ sTag ] )
		{
			this.m_oAssocReroutedConnectionsByTag[ sTag ].forEach
			(
				client =>
				{
					if ( client.assocPendingRequests[ sTag ] )
					{
						clearTimeout( client.assocPendingRequests[ sTag ].reroute_timer );
						clearTimeout( client.assocPendingRequests[ sTag ].cancel_timer );
						delete client.assocPendingRequests[ sTag ];
					}
				}
			);
			delete this.m_oAssocReroutedConnectionsByTag[ sTag ];
		}
	}



	sendResponse( oSocket, sTag, response )
	{
		delete oSocket.assocInPreparingResponse[ sTag ];
		this.sendMessage( oSocket, 'response', { tag: sTag, response: response } );
	}

	sendErrorResponse( oSocket, sTag, error )
	{
		this.sendResponse( oSocket, sTag, { error : error } );
	}
}





/**
 *	exports
 */
module.exports	= CP2pRequest;
