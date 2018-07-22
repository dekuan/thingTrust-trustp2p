/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );
const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pHeartbeat		= require( './p2pHeartbeat.js' );
const CP2pRequest		= require( './p2pRequest.js' );

const _crypto			= require( 'crypto' );

const _p2pConstants		= require( './p2pConstants.js' );
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

		this.m_oOptions		= Object.assign( {}, oOptions );
		this.m_cDriverServer	= CP2pDriver.createInstance( _p2pConstants.CONNECTION_DRIVER, 'server', oOptions );
		this.m_cP2pHeartbeat	= new CP2pHeartbeat();
	}


	/**
	 * 	start server
	 *
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async startServer()
	{
		return this.m_cDriverServer
		.on( CP2pDriver.EVENT_START, ( oSocket, sInfo ) =>
		{
			console.log( `Received a message [${ CP2pDriver.EVENT_START }] from server.`, sInfo );
		})
		.on( CP2pDriver.EVENT_CONNECTION, ( oSocket ) =>
		{
			console.log( `Received a message [${ CP2pDriver.EVENT_CONNECTION }] from server.` );


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
			this.m_cP2pHeartbeat.startHeartbeat( () =>
			{
				console.log( `HEARTBEAT for ${ this.getClients().length } clients.` );
				this.handlePingClients( this.getClients() );
			});
		})
		.on( CP2pDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			console.log( `Received a message [${ CP2pDriver.EVENT_MESSAGE }] from server.` );
		})
		.on( CP2pDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			console.log( `Received a message [${ CP2pDriver.EVENT_CLOSE }] from server.` );
		})
		.on( CP2pDriver.EVENT_ERROR, ( vError ) =>
		{
			console.log( `Received a message [${ CP2pDriver.EVENT_ERROR }] from server.` );
		}).startServer();
	}

	/**
	 *	@public
	 *	@returns {Array}
	 */
	getClients()
	{
		return this.m_cDriverServer.getClients();
	}

}






/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pServer;
