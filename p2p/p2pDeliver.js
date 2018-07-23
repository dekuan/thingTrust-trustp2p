/*jslint node: true */
"use strict";

const EventEmitter		= require( 'events' );

const _				= require( 'lodash' );

const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pMessage		= require( './p2pMessage.js' );
const CP2pRequest		= require( './p2pRequest.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );
const _object_hash		= require( '../object_hash.js' );
const _network_peer		= require( './p2pPeer.js' );




/**
 *	P2p Deliver
 *	@class	CP2pDeliver
 *	@module	CP2pDeliver
 */
class CP2pDeliver extends CP2pMessage
{
	constructor()
	{
		super();

		//	...
		this.m_cP2pRequest		= new CP2pRequest();

		//	...
		this.m_cDriver			= null;
		this.m_nLastHeartbeatWakeTs	= Date.now();
	}

	/**
	 *	set driver instance
	 *
	 *	@param	{instance}	cDriver
	 *	@return	{void}
	 */
	set cDriver( cDriver )
	{
		this.m_cDriver			= cDriver;
		this.m_cP2pRequest.cDriver	= cDriver;
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
					this.m_cP2pPackage.PackType.PACKTYPE_HEARTBEAT,
					'heartbeat',
					{ msg : 'ping' },
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
	 *	2. bReroute flag must be the same
	 *
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackType
	 *	@param	{string}	sCommand
	 *	@param	{object}	oJsonBody
	 *	@param	{boolean}	bReroute
	 *	@param	{function}	pfnResponseHandler( ws, request, response ){ ... }
	 */
	sendRequest( oSocket, nPackType, sCommand, oJsonBody, bReroute, pfnResponseHandler )
	{
		return this.m_cP2pRequest.sendRequest( oSocket, nPackType, sCommand, oJsonBody, bReroute, pfnResponseHandler );
	}


	/**
	 *	handle socket closed
	 *
	 * 	@public
	 *	@param 	{object}	oSocket
	 *	@return {boolean}
	 */
	handleSocketClosed( oSocket )
	{
		let sTag;
		let oPendingRequest;

		if ( ! _p2pUtils.isObject( oSocket ) ||
			! oSocket.hasOwnProperty( 'assocPendingRequests' ) ||
			! _p2pUtils.isObject( oSocket.assocPendingRequests ) )
		{
			this.m_cP2pLog.error( `handleSocketClosed with invalid oSocket` );
			return false;
		}

		//	...
		console.log( `Web Socket closed, will complete all outstanding requests` );

		for ( sTag in oSocket.assocPendingRequests )
		{
			//	...
			oPendingRequest	= oSocket.assocPendingRequests[ sTag ];

			//	...
			clearTimeout( oPendingRequest.reroute_timer );
			clearTimeout( oPendingRequest.cancel_timer );
			oPendingRequest.reroute_timer	= null;
			oPendingRequest.cancel_timer	= null;

			//
			//	reroute immediately, not waiting for _network_consts.STALLED_TIMEOUT
			//
			if ( _p2pUtils.isFunction( oPendingRequest.reroute ) )
			{
				if ( ! oPendingRequest.bRerouted )
				{
					oPendingRequest.reroute();
				}

				//
				//	***
				//	we still keep ws.assocPendingRequests[tag] because we'll need it when we find a peer to reroute to
				//
			}
			else
			{
				//
				//	respond all caller and then clear all pending requests
				//
				oPendingRequest.responseHandlers.forEach( function( rh )
				{
					rh( oSocket, oPendingRequest.request, { error : "[internal] driver closed" } );
				});

				delete oSocket.assocPendingRequests[ sTag ];
				oSocket.assocPendingRequests[ sTag ]	= null;
			}
		}

		return true;
	}


	sendResponse( oSocket, sTag, response )
	{
		delete oSocket.assocInPreparingResponse[ sTag ];
		this.sendMessage( oSocket, 'response', { tag : sTag, response : response } );
	}

	sendErrorResponse( oSocket, sTag, error )
	{
		this.sendResponse( oSocket, sTag, { error : error } );
	}
}





/**
 *	@exports
 */
module.exports	= CP2pDeliver;
