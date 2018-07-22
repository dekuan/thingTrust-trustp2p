/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );
const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pRequest		= require( './p2pRequest.js' );

const _p2pConstants		= require( './p2pConstants.js' );




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
		this.m_cConnectionClient = CP2pDriver.createInstance( _p2pConstants.CONNECTION_DRIVER, 'client', oOptions );
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
		.on( CP2pDriver.EVENT_OPEN, ( oSocket ) =>
		{
			console.log( `Received [${ CP2pDriver.EVENT_CONNECTION }] from server.` );

			//
			//	send our version information to server peer
			//
			this.sendVersion( oSocket );
		})
		.on( CP2pDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			console.log( `Received ${ CP2pDriver.EVENT_MESSAGE } :: [${ vMessage }]` );
		})
		.on( CP2pDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			console.log( `Received [${ CP2pDriver.EVENT_CLOSE }] from server.` );
		})
		.on( CP2pDriver.EVENT_ERROR, ( vError ) =>
		{
			console.log( `Received [${ CP2pDriver.EVENT_ERROR }] from server.` );
		})
		.connectToServer( 'ws://127.0.0.1:1107' );
	}
}




/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pClient;
