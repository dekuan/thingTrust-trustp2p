/*jslint node: true */
"use strict";

let socks			= process.browser ? null : require( 'socks' + '' );

let _p2pConstants		= require( './p2pConstants.js' );
let _p2pMessage			= require( './p2pMessage.js' );
let _p2pRequest			= require( './p2pRequest.js' );
let _p2pPeer			= require( './p2pPeer.js' );



/**
 *	class of CP2pHeartbeat
 */
class CP2pHeartbeat
{
	m_nLastHeartbeatWakeTs	= null;
	m_nIntervalHeartbeat	= null;

	constructor()
	{
		this.m_nLastHeartbeatWakeTs	= Date.now();
		this.m_nIntervalHeartbeat	= null;
	}

	/**
	 *	@public
	 *	start heartbeat
	 */
	start()
	{
		if ( null !== this.m_nIntervalHeartbeat )
		{
			return this.m_nIntervalHeartbeat;
		}

		//
		//	if we have exactly same intervals on two clints,
		//	they might send heartbeats to each other at the same time
		//
		this.m_nIntervalHeartbeat = setInterval
		(
			this._heartbeatEmitter,
			_p2pConstants.HEARTBEAT_INTERVAL + _p2pPeer.getRandomInt( 0, 1000 )
		);

		//	...
		return this.m_nIntervalHeartbeat;
	}

	/**
	 *	@public
	 *	stop heartbeat
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
	 *	@public
	 *	handle received heartbeat message
	 *
	 *	@param	ws
	 *	@param	tag
	 */
	handleReceivedMessage( ws, tag )
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
			Date.now() - this.m_nLastHeartbeatWakeTs > _p2pConstants.PAUSE_TIMEOUT
		);
		if ( bPaused )
		{
			//	opt out of receiving heartbeats and move the connection into a sleeping state
			return _p2pMessage.sendResponse( ws, tag, 'sleep' );
		}

		//	...
		_p2pMessage.sendResponse( ws, tag );
	}



	/**
	 *	@private
	 *
	 *	*
	 *	heartbeat
	 *	about every 3 seconds
	 */
	_heartbeatEmitter()
	{
		let bJustResumed;

		//	just resumed after sleeping
		bJustResumed	= ( typeof window !== 'undefined' &&
			window &&
			window.cordova &&
			Date.now() - this.m_nLastHeartbeatWakeTs > 2 * _p2pConstants.HEARTBEAT_TIMEOUT );
		this.m_nLastHeartbeatWakeTs	= Date.now();

		//
		//	The concat() method is used to merge two or more arrays.
		//	This method does not change the existing arrays, but instead returns a new array.
		//
		_p2pPeer.getAllInboundClientsAndOutboundPeers().forEach( function( ws )
		{
			let nElapsedSinceLastReceived;
			let nElapsedSinceLastSentHeartbeat;

			if ( ws.bSleeping ||
				ws.readyState !== ws.OPEN )
			{
				//	web socket is not ready
				return;
			}

			//	...
			nElapsedSinceLastReceived	= Date.now() - ws.last_ts;
			if ( nElapsedSinceLastReceived >= _p2pConstants.HEARTBEAT_TIMEOUT )
			{
				//	>= 10 seconds
				if ( ws.last_sent_heartbeat_ts && ! bJustResumed )
				{
					nElapsedSinceLastSentHeartbeat	= Date.now() - ws.last_sent_heartbeat_ts;
					if ( nElapsedSinceLastSentHeartbeat >= _p2pConstants.HEARTBEAT_RESPONSE_TIMEOUT )
					{
						//	>= 60 seconds
						console.log( 'will disconnect peer ' + ws.peer + ' who was silent for ' + nElapsedSinceLastReceived + 'ms' );
						ws.close( 1000, 'lost connection' );
					}
				}
				else
				{
					ws.last_sent_heartbeat_ts	= Date.now();
					_p2pRequest.sendRequest
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
		});
	}

}



/**
 *	exports
 */
exports.CP2pHeartbeat	= CP2pHeartbeat;
