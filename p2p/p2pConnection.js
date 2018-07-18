/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const _p2pConstants		= require( './p2pConstants.js' );
const _p2pConnectionDriver	= require( './p2pConnectionDriver.js' );




/**
 *	class CP2pConnection
 *	@module	CP2pConnection
 *	@class	CP2pConnection
 */
class CP2pConnection
{
	/**
	 *	@constructor
	 *	@param oOptions
	 */
	constructor( oOptions )
	{
		this.m_oDrivers	=
			{
				'ws'	:
				{
					'client'	: './p2pConnectionImplWsServer.js',
					'server'	: './p2pConnectionImplWsServer.js',
				}
			};

		const sDriver			= _p2pConstants.CONNECTION_DRIVER;
		let CConnectionClient		= require( this.m_oDrivers[ sDriver ][ 'client' ] );
		let CConnectionServer		= require( this.m_oDrivers[ sDriver ][ 'server' ] );

		this.m_cConnectionClient	= new CConnectionClient( oOptions );
		this.m_cConnectionServer	= new CConnectionServer( oOptions );
	}

	/**
	 * 	@public
	 *	start web socket server
	 */
	async start()
	{
		this.m_cConnectionServer.on( _p2pConnectionDriver.EVENT_START, ( oSocket, sInfo ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_START }] from server.`, sInfo );
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
	 *	@public
	 *	@returns {Array}
	 */
	getClients()
	{
		return this.m_cConnectionServer.getClients();
	}

}




/**
 *	exports
 *	@exports
 *	@type {CP2pConnectionWsServer}
 */
module.exports	= CP2pConnection;
