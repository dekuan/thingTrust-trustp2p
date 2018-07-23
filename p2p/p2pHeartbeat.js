/*jslint node: true */
"use strict";

/**
 *	@module	p2p heartbeat
 */
const socks			= process.browser ? null : require( 'socks' + '' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );

const _p2pMessage		= require( './p2pMessage.js' );
const _p2pPeer			= require( './p2pPeer.js' );




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
class CP2pHeartbeat
{
	/**
	 *	@constructor
	 */
	constructor()
	{
		this.m_nIntervalHeartbeat	= null;
	}

	/**
	 *
	 *
	 *	@public
	 */
	startHeartbeat( pfnCallback )
	{
		if ( ! _p2pUtils.isFunction( pfnCallback ) )
		{
			return null;
		}

		//
		//	if it's working, stop it at first
		//
		if ( null !== this.m_nIntervalHeartbeat )
		{
			this.stopHeartbeat();
		}

		//
		//	ONLY SERVER TO CLIENT
		//
		//	if we have exactly same intervals on two clients,
		//	they might send heartbeats to each other at the same time
		//
		this.m_nIntervalHeartbeat = setInterval
		(
			pfnCallback,
			_p2pConstants.HEARTBEAT_INTERVAL + _p2pPeer.getRandomInt( 0, 1000 )
		);

		//	...
		return this.m_nIntervalHeartbeat;
	}

	/**
	 * 	stop heartbeat, sending ping from server
	 *	@public
	 *	stop heartbeat
	 */
	stopHeartbeat()
	{
		if ( null !== this.m_nIntervalHeartbeat )
		{
			clearInterval( this.m_nIntervalHeartbeat );
			this.m_nIntervalHeartbeat = null;
		}
	}







	/**
	 *	@public
	 *	handle received heartbeat message
	 *
	 *	@param	ws
	 *	@param	tag
	 */
	handlePong( ws, tag )
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
			window &&
			window.cordova &&
			Date.now() - this.m_nLastHeartbeatWakeTs > _p2pConstants.HEARTBEAT_PAUSE_TIMEOUT
		);
		if ( bPaused )
		{
			//	opt out of receiving heartbeats and move the driver into a sleeping state
			return _p2pMessage.sendResponse( ws, tag, 'sleep' );
		}

		//	...
		_p2pMessage.sendResponse( ws, tag );
	}
}





/**
 *	@exports
 */
module.exports	= CP2pHeartbeat;
