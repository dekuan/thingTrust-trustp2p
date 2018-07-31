/*jslint node: true */
"use strict";

const EventEmitter		= require( 'events' );

const CP2pPackage		= require( './../CP2pPackage.js' );
const _p2pConstants		= require( '../p2pConstants.js' );
const _p2pUtils			= require( '../CP2pUtils.js' );


/**
 * 	@constant
 */
const MESSAGE_PING		= 'ping';
const MESSAGE_PONG		= 'pong';





/**
 *	heartbeat thread
 *
 *	@class	CThreadHeartbeat
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
 */
class CThreadHeartbeat extends EventEmitter
{
	/**
	 * 	@constructor
	 *
	 * 	@public
	 * 	@param	{object}	oNode
	 * 	@param	{object}	oNode.client	null or undefined if this is not a client instance
	 * 	@param	{object}	oNode.server	null or undefined if this is not a server instance
	 * 	@param	{object}	oNode.log
	 * 	@return	{void}
	 */
	constructor( oNode )
	{
		super();

		if ( ! _p2pUtils.isObject( oNode ) )
		{
			throw new Error( `constructor ${ this.constructor.name } with an invalid parameter oNode.` );
		}

		this.m_oNode			= oNode;
		this.m_nIntervalHeartbeat	= null;
	}


	/**
	 *	events/handler map
	 *
	 * 	@public
	 *	@return {object}
	 */
	get eventMap()
	{
		return {
			[ CP2pPackage.PACKAGE_PING ]	:
				{
					[ MESSAGE_PING ]	: this._handleMessagePing,	//	ping by server
					// [ MESSAGE_PONG ]	: this._handleMessagePong,	//	pong by client
				}
		}
	}

	/**
	 * 	start for this thread
	 * 	@public
	 */
	start()
	{
		if ( ! this.m_oNode.server )
		{
			//
			//	if we have exactly same intervals on two clients,
			//	they might send heartbeats to each other at the same time
			//
			this.m_oNode.log.error( `[${ ( new Date() ).toString() }] * ${ this.constructor.name } heartbeat interval can start only at server end.` );
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
				this._handleServerPingInterval();
			},
			_p2pConstants.HEARTBEAT_INTERVAL + _p2pUtils.getRandomInt( 0, 1000 )
		);

		//	...
		return this.m_nIntervalHeartbeat;
	}

	/**
	 * 	stop for this thread
	 * 	@public
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
	 *	callee for listening event about a new client connected in
	 *
	 * 	@public
	 *	@param oSocket
	 */
	onSocketConnection( oSocket )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } a new client connected in.` );
	}

	/**
	 *	callee for listening event about a outbound connection was opened
	 *
	 * 	@public
	 *	@param oSocket
	 */
	onSocketOpen( oSocket )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } a new outbound connection was opened.` );
	}

	/**
	 *	callee for listening event about a socket was closed
	 *
	 * 	@public
	 *	@param oSocket
	 */
	onSocketClose( oSocket )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } received a close message about socket.` );
	}

	/**
	 *	callee for listening event about error of a socket
	 *
	 * 	@public
	 *	@param vError
	 */
	onSocketError( vError )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } received a error message about socket.` );
	}



	/**
	 *	received ping message coming from server
	 *
	 *	@public
	 *	@param	{object}	oSocket
	 *	@param	{object}	objMessage
	 *	@return	{boolean}
	 */
	_handleMessagePing( oSocket, objMessage )
	{
		let bSleep;

		if ( ! _p2pUtils.isObject( oSocket ) )
		{
			this.m_oNode.log.info( `* ${ this.constructor.name } call _handleMessagePing with invalid oSocket` );
			return false;
		}
		if ( ! objMessage )
		{
			this.m_oNode.log.info( `* ${ this.constructor.name } call _handleMessagePing with invalid objMessage` );
			return false;
		}

		//	...
		this.m_oNode.log.info( `* ${ this.constructor.name } received message( type:${ objMessage.type }, event:${ objMessage.event } )` );

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

		//
		//	respond a pong message
		//
		return this.m_oNode.client.sendResponse
		(
			oSocket,
			CP2pPackage.PACKAGE_PONG,
			MESSAGE_PONG,
			{ tag : objMessage.tag, sleep : bSleep }
		);
	}


	/**
	 * 	* HEARTBEAT
	 *	ping all clients
	 *
	 *	@private
	 *	@return	{boolean}
	 *
	 *	@description
	 *	keep on sending heartbeat PING event from server to all its clients about every 3 seconds.
	 */
	_handleServerPingInterval()
	{
		let bJustResumed;
		let arrSockets;

		//this.m_oNode.log.info( `will ping all clients from server.` );

		//
		//	get all clients
		//
		arrSockets	= this.m_oNode.server.getClients();
		if ( ! Array.isArray( arrSockets ) || 0 === arrSockets.length )
		{
			//this.m_oNode.log.info( `no client connected in, so we cancel ping` );
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
		for ( const [ nSocketIndex, oSocket ] of arrSockets.entries() )
		{
			let nElapsedSinceLastReceived;
			let nElapsedSinceLastSentHeartbeat;

			if ( oSocket.bSleeping )
			{
				//
				//	sleeping status is for light Wallet only
				//
				this.m_oNode.log.info( `* ${ this.constructor.name } cancel ping because ${ oSocket.peer } is sleeping.` );
				break;
			}
			if ( oSocket.readyState !== oSocket.OPEN )
			{
				//
				//	web socket is not ready
				//
				this.m_oNode.log.info( `* ${ this.constructor.name } cancel ping because ${ oSocket.peer }'s readyState ${ oSocket.readyState } !== OPEN.` );
				break;
			}

			//	...
			nElapsedSinceLastReceived	= Date.now() - oSocket.last_ts;
			if ( nElapsedSinceLastReceived < _p2pConstants.HEARTBEAT_TIMEOUT )
			{
				this.m_oNode.log.info( `* ${ this.constructor.name } cancel ping because ${ oSocket.peer } is active in ${ nElapsedSinceLastReceived } seconds.` );
				break;
			}

			//	>= 10 seconds
			if ( oSocket.last_sent_heartbeat_ts && ! bJustResumed )
			{
				nElapsedSinceLastSentHeartbeat	= Date.now() - oSocket.last_sent_heartbeat_ts;
				if ( nElapsedSinceLastSentHeartbeat >= _p2pConstants.HEARTBEAT_RESPONSE_TIMEOUT )
				{
					//	>= 60 seconds
					this.m_oNode.log.info( `* ${ this.constructor.name } will disconnect peer ${ oSocket.peer } who was silent for ${ nElapsedSinceLastReceived }ms` );
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
				//	send a ping event to this client
				//
				this.m_oNode.log.info( `* ${ this.constructor.name } send heartbeat ping.` );
				this.m_oNode.server.sendRequest
				(
					this,
					oSocket,
					CP2pPackage.PACKAGE_PING,
					MESSAGE_PING,
					{},
					false,
					this._handlePingResponse
				);
			}
		}

		return true;
	}

	/**
	 *	handle received response sent before with message ping
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param 	{object}	oRequestContent		original plain JavaScript object of body of socket message
	 *	@param	{string}	sResponse		socket message transmitted
	 *	@return	{void}
	 */
	_handlePingResponse( oSocket, oRequestContent, sResponse )
	{
		let oBody;

		delete oSocket.last_sent_heartbeat_ts;
		oSocket.last_sent_heartbeat_ts = null;

		this.m_oNode.log.info( `* ${ this.constructor.name }, received response sent before with message ping.` );

		try
		{
			oBody	= JSON.parse( sResponse );
		}
		catch( e )
		{
			oBody	= null;
		}

		if ( _p2pUtils.isObjectWithKeys( oBody, 'sleep' ) &&
			true === oBody.sleep )
		{
			//
			//	the peer doesn't want to be bothered with heartbeats any more,
			//	but still wants to keep the driver open
			//
			oSocket.bSleeping = true;
		}

		//
		//	as soon as the peer sends a heartbeat himself,
		//	we'll think he's woken up and resume our heartbeats too
		//
	}

}






/**
 *	@exports	CThreadHeartbeat
 */
module.exports	= CThreadHeartbeat;








