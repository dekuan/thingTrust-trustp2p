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
					'client'	: './p2pConnectionWsServer.js',
					'server'	: './p2pConnectionWsServer.js',
				}
			};

		let CConnectionClient		= require( this.m_oDrivers[ _p2pConstants.CONNECTION_DRIVER ][ 'client' ] );
		let CConnectionServer		= require( this.m_oDrivers[ _p2pConstants.CONNECTION_DRIVER ][ 'server' ] );

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
		.on( _p2pConnectionDriver.EVENT_CONNECT, ( oSocket ) =>
		{
			console.log( `Received a message [${ _p2pConnectionDriver.EVENT_CONNECT }] from server.` );
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
