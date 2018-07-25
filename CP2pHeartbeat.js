/*jslint node: true */
"use strict";

/**
 *	@module	p2p heartbeat
 */
const socks			= process.browser ? null : require( 'socks' + '' );
const EventEmitter		= require( 'events' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './CP2pUtils.js' );
const _p2pLog			= require( './CP2pLog.js' );


/**
 * 	@constant
 */
const EVENT_WANT_PING		= 'want_ping';
const EVENT_WANT_PONG		= 'want_pong';

const MESSAGE_PING		= 'ping';
const MESSAGE_PONG		= 'pong';




/**
 *	p2p heartbeat
 *
 *	@class	CP2pHeartbeat
 *
 *	@description
 *
 * 	Web Socket Protocol
 * 	@see https://tools.ietf.org/html/rfc6455#section-5.5.2
 *
 * 	Control Frames
 * 		Currently defined opcodes for control frames include 0x8 (Close), 0x9 (Ping), and 0xA (Pong)
 *
 * 	Ping
 * 		be sent only from server to client
 * 	Pong
 * 		answer as soon as possible by client
 *
 *
 *
 */
class CP2pHeartbeat extends EventEmitter
{
	/**
	 *	@constructor
	 */
	constructor()
	{
		super();

		//	...
		this.m_nIntervalHeartbeat	= null;
	}

	/**
	 *	start heartbeat from server by sending ping command
	 *
	 *	@public
	 */
	start( pfnGetClients )
	{
		if ( ! _p2pUtils.isFunction( pfnGetClients ) )
		{
			return null;
		}
		if ( null !== this.m_nIntervalHeartbeat )
		{
			//
			//	if it's working, stop it at first
			//
			this.stop();
		}

		//
		//	ONLY SERVER TO CLIENT
		//
		//	if we have exactly same intervals on two clients,
		//	they might send heartbeats to each other at the same time
		//
		this.m_nIntervalHeartbeat = setInterval
		(
			() =>
			{
				this._handlePing( pfnGetClients() );
			},
			_p2pConstants.HEARTBEAT_INTERVAL + _p2pUtils.getRandomInt( 0, 1000 )
		);

		//	...
		return this.m_nIntervalHeartbeat;
	}

	/**
	 * 	stop sending ping command from server
	 *
	 *	@public
	 */
	stop()
	{
		if ( null !== this.m_nIntervalHeartbeat )
		{
			clearInterval( this.m_nIntervalHeartbeat );
			this.m_nIntervalHeartbeat = null;
		}
	}



	/**
	 * 	* HEARTBEAT
	 *	ping all clients
	 *
	 *	@private
	 *	@param	{array}		arrSockets
	 *	@return	{boolean}
	 *
	 *	@description
	 *	keep on sending heartbeat PING command from server to all its clients about every 3 seconds.
	 */
	_handlePing( arrSockets )
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
			window.hasOwnProperty( 'cordova' ) && window.cordova &&
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
				//
				//	save the last sent timestamp
				//
				oSocket.last_sent_heartbeat_ts	= Date.now();

				//
				//	emit a event about we want to send a ping command
				//
				this.emit
				(
					EVENT_WANT_PING,
					oSocket,
					( oSocketT, request, sResponse ) =>
					{
						delete oSocketT.last_sent_heartbeat_ts;
						oSocketT.last_sent_heartbeat_ts = null;

						if ( 'sleep' === sResponse )
						{
							//
							//	the peer doesn't want to be bothered with heartbeats any more,
							//	but still wants to keep the driver open
							//
							oSocketT.bSleeping = true;
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
	 *	handle received heartbeat message
	 *
	 *	@public
	 *	@param	{object}	oSocket
	 *	@param	{object}	objMessage
	 *	@return	{boolean}
	 */
	handlePong( oSocket, objMessage )
	{
		let bSleep;

		//
		//	the peer is sending heartbeats, therefore he is awake
		//
		oSocket.bSleeping = false;

		//
		//	true if our timers were paused
		//	Happens only on android, which suspends timers when the app becomes paused but still keeps network connections
		//	Handling 'pause' event would've been more straightforward but with preference KeepRunning=false,
		// 	the event is delayed till resume
		//
		//	if bSleep == true
		//		sleep = true;
		//		opt out of receiving heartbeats and move the driver into a sleeping state
		//
		bSleep = (
			typeof window !== 'undefined' &&
			window &&
			window.hasOwnProperty( 'cordova' ) && window.cordova &&
			Date.now() - this.m_nLastHeartbeatWakeTs > _p2pConstants.HEARTBEAT_PAUSE_TIMEOUT
		);

		this.emit
		(
			EVENT_WANT_PONG,
			oSocket,
			objMessage,
			{ sleep : bSleep }
		);
	}
}





/**
 *	@exports
 */
module.exports	= CP2pHeartbeat;


/**
 *	events list
 */
module.exports.EVENT_WANT_PING		= EVENT_WANT_PING;
module.exports.EVENT_WANT_PONG		= EVENT_WANT_PONG;

module.exports.MESSAGE_PING		= MESSAGE_PING;
module.exports.MESSAGE_PONG		= MESSAGE_PONG;
