/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );
const CP2pRequest		= require( './p2pRequest.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pConnectionDriver	= require( './connection/p2pConnectionDriver.js' );




/**
 *	p2p client
 *
 *	@module	CP2pClient
 *	@class	CP2pClient
 */
class CP2pClient extends CP2pRequest
{
	/**
	 *	@constructor
	 *	@param oOptions
	 */
	constructor( oOptions )
	{
		super();

		/**
		 *	create client instance
		 */
		this.m_cConnectionClient = _p2pConnectionDriver.createInstance( _p2pConstants.CONNECTION_DRIVER, 'client', oOptions );
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
			console.log( `Received [${ _p2pConnectionDriver.EVENT_CONNECTION }] from server.` );

			//
			//	send our version information to server peer
			//
			this.sendVersion( oSocket );
		})
		.on( _p2pConnectionDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			console.log( `Received ${ _p2pConnectionDriver.EVENT_MESSAGE } :: [${ vMessage }]` );
		})
		.on( _p2pConnectionDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			console.log( `Received [${ _p2pConnectionDriver.EVENT_CLOSE }] from server.` );
		})
		.on( _p2pConnectionDriver.EVENT_ERROR, ( vError ) =>
		{
			console.log( `Received [${ _p2pConnectionDriver.EVENT_ERROR }] from server.` );
		})
		.connectToServer( 'ws://127.0.0.1:1107' );
	}
}




/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pClient;
