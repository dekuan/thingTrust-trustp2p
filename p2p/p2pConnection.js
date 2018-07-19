/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pConnectionDriver	= require( './p2pConnectionDriver.js' );




/**
 *	p2p connection
 *
 *	@module	CP2pConnection
 *	@class	CP2pConnection
 */
class CP2pConnection extends EventEmitter
{
	/**
	 *	@constructor
	 *	@param oOptions
	 */
	constructor( oOptions )
	{
		super();

		//	...
		this.m_oDrivers	=
			{
				'ws'	:
				{
					'client'	: './p2pConnectionImplWsClient.js',
					'server'	: './p2pConnectionImplWsServer.js',
				}
			};

		const sDriver			= _p2pConstants.CONNECTION_DRIVER;
		const CConnectionClient		= require( this.m_oDrivers[ sDriver ][ 'client' ] );
		const CConnectionServer		= require( this.m_oDrivers[ sDriver ][ 'server' ] );

		this.m_cConnectionClient	= new CConnectionClient( oOptions );
		this.m_cConnectionServer	= new CConnectionServer( oOptions );
	}

	/**
	 * 	@public
	 *	start web socket server
	 */
	async startAll()
	{
		this.on( 'CP2PCONNECTION_EVENT_SERVER_STARTED', ( oSocket, sInfo ) =>
		{
			return this.startClient();
		});

		return this.startServer();
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

			//
			//	emit to start server
			//
			this.emit( 'CP2PCONNECTION_EVENT_SERVER_STARTED', oSocket, sInfo );
		})
		.on( _p2pConnectionDriver.EVENT_CONNECTION, ( oSocket ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_CONNECTION }] from server.` );
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
	 * 	make client connected to server
	 *
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async startClient()
	{
		return this.m_cConnectionClient
		.on( _p2pConnectionDriver.EVENT_OPEN, ( oSocket ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_CONNECTION }] from server.` );
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
		})
		.connectToServer( 'ws://127.0.0.1:1107' );
	}
}




/**
 *	@exports
 *	@type {CP2pConnection}
 */
module.exports	= CP2pConnection;
