/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );
const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pHeartbeat		= require( './p2pHeartbeat.js' );
const CP2pDeliver		= require( './p2pDeliver.js' );

const _crypto			= require( 'crypto' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );
const _p2pLog			= require( './p2pLog.js' );



/**
 *	p2p server
 *
 *	@module	CP2pServer
 *	@class	CP2pServer
 */
class CP2pServer extends CP2pDeliver
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

		super.cDriver		= this.m_cDriverServer;
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
			_p2pLog.info( `Received a message [${ CP2pDriver.EVENT_START }] from server.`, sInfo );
		})
		.on( CP2pDriver.EVENT_CONNECTION, ( oSocket ) =>
		{
			_p2pLog.info( `Received a message [${ CP2pDriver.EVENT_CONNECTION }] from server.` );

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
				this.sendTalk( oSocket, 'hub/challenge', oSocket.challenge );
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
				_p2pLog.info( `HEARTBEAT for ${ this.getClients().length } clients.` );
				this.handleHeartbeatPing( this.getClients() );
			});
		})
		.on( CP2pDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			_p2pLog.info( `Received a message [${ CP2pDriver.EVENT_MESSAGE }] from server.` );

			let oMessage	= this.m_cP2pPackage.decodePackage( vMessage );
			console.log( oMessage );
		})
		.on( CP2pDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			_p2pLog.info( `Received a message [${ CP2pDriver.EVENT_CLOSE }] from server.` );
		})
		.on( CP2pDriver.EVENT_ERROR, ( vError ) =>
		{
			_p2pLog.info( `Received a message [${ CP2pDriver.EVENT_ERROR }] from server.` );
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
