/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );
const CP2pRequest		= require( './p2pRequest.js' );

const _crypto			= require( 'crypto' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pConnectionDriver	= require( './connection/p2pConnectionDriver.js' );
const _p2pUtils			= require( './p2pUtils.js' );



/**
 *	p2p server
 *
 *	@module	CP2pServer
 *	@class	CP2pServer
 */
class CP2pServer extends CP2pRequest
{
	/**
	 *	@constructor
	 *	@param oOptions
	 */
	constructor( oOptions )
	{
		super();

		this.m_oOptions			= Object.assign( {}, oOptions );
		this.m_cConnectionServer	= _p2pConnectionDriver.createInstance( _p2pConstants.CONNECTION_DRIVER, 'server', oOptions );

		this.m_nIntervalHeartbeat	= null;
	}


	/**
	 * 	start server
	 *
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async startServer()
	{
		return this.m_cConnectionServer
		.on( _p2pConnectionDriver.EVENT_START, ( oSocket, sInfo ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_START }] from server.`, sInfo );
		})
		.on( _p2pConnectionDriver.EVENT_CONNECTION, ( oSocket ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_CONNECTION }] from server.` );


			//
			//	WELCOME THE NEW PEER
			//
			//	so, we respond our version to the new client
			//
			this.sendVersion( oSocket );

			//
			//	I'm a hub, send challenge
			//
			if ( this.m_oOptions.bServeAsHub )
			{
				//
				//	create 'challenge' key for clients
				//	the new peer, I am a hub and I have ability to exchange data
				//
				oSocket.challenge = _crypto.randomBytes( 30 ).toString( "base64" );
				this.sendJustSaying( oSocket, 'hub/challenge', oSocket.challenge );
			}

			// if ( ! this.m_oOptions.bLight )
			// {
			// 	//
			// 	//	call
			// 	//	subscribe data from others
			// 	//	while a client connected to me
			// 	//
			// 	this.m_oOptions.subscribe( ws );
			// }

			//
			//	start heartbeat
			//
			this._startPingAllClients();
		})
		.on( _p2pConnectionDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_MESSAGE }] from server.` );
		})
		.on( _p2pConnectionDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_CLOSE }] from server.` );
		})
		.on( _p2pConnectionDriver.EVENT_ERROR, ( vError ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_ERROR }] from server.` );
		}).startServer();
	}

	/**
	 *	@public
	 *	@returns {Array}
	 */
	getClients()
	{
		return this.m_cConnectionServer.getClients();
	}


	/**
	 *	start ping all clients
	 *
	 *	@private
	 *	@returns {null|*}
	 */
	_startPingAllClients()
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
			() =>
			{
				console.log( `HEARTBEAT [send ping to ${ this.getClients().length } clients.]` );
				this.handlePingClients( this.getClients() );
			},
			_p2pConstants.HEARTBEAT_INTERVAL + _p2pUtils.getRandomInt( 0, 1000 )
		);

		//	...
		return this.m_nIntervalHeartbeat;
	}

	/**
	 * 	stop ping clients
	 *
	 *	@private
	 *	@return {void}
	 */
	_stopPingAllClients()
	{
		if ( null !== this.m_nIntervalHeartbeat )
		{
			clearInterval( this.m_nIntervalHeartbeat );
			this.m_nIntervalHeartbeat = null;
		}
	}


}






/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pServer;
