/*jslint node: true */
"use strict";

const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pRequest		= require( './p2pRequest.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );
const _p2pLog			= require( './p2pLog.js' );




/**
 *	P2p Deliver
 *	@class	CP2pDeliver
 *	@module	CP2pDeliver
 */
class CP2pDeliver extends CP2pRequest
{
	constructor()
	{
		super();

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
		this.m_cDriver	= cDriver;
		super.cDriver	= cDriver;
	}


	broadcast()
	{
		if ( CP2pDriver.DRIVER_TYPE_CLIENT !== this.m_cDriver.sDriverType )
		{
			_p2pLog.error( `will broadcast nothing, only client instance broadcast.` );
			return false;
		}
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
	handleHeartbeatPing( arrSockets )
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
				//
				//	sleeping status is for light Wallet only
				//	web socket is not ready
				//
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
					_p2pLog.info( `will disconnect peer ${ oSocket.peer } who was silent for ${ nElapsedSinceLastReceived }ms` );
					oSocket.close( 1000, 'lost driver' );
				}
			}
			else
			{
				oSocket.last_sent_heartbeat_ts	= Date.now();
				this.sendRequest
				(
					oSocket,
					_p2pConstants.PACKAGE_HEARTBEAT,
					'heartbeat',
					{ msg : 'ping' },
					false,
					function( oNextSocket, request, sResponse )
					{
						delete oNextSocket.last_sent_heartbeat_ts;
						oNextSocket.last_sent_heartbeat_ts = null;

						if ( 'sleep' === sResponse )
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
	handleHeartbeatPong( oSocket )
	{
	}


	/**
	 *	send response
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 *	@param	{string}	sTag
	 *	@param	{object}	oResponse
	 *	@return	{boolean}
	 */
	sendResponse( oSocket, sTag, oResponse )
	{
		if ( ! _p2pUtils.isObject( oSocket ) )
		{
			return false;
		}

		delete oSocket.assocInPreparingResponse[ sTag ];
		this.sendMessage( oSocket, _p2pConstants.PACKAGE_RESPONSE, null, { tag : sTag, response : oResponse } );
		return true;
	}


	/**
	 *	send response
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 *	@param	{string}	sTag
	 *	@param	{string}	sError
	 *	@return	{void}
	 */
	sendErrorResponse( oSocket, sTag, sError )
	{
		this.sendResponse( oSocket, sTag, { error : sError } );
	}

}





/**
 *	@exports
 */
module.exports	= CP2pDeliver;
