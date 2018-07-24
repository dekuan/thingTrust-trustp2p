/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const EventEmitter		= require( 'events' );
const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pDeliver		= require( './p2pDeliver.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pLog			= require( './p2pLog.js' );



/**
 *	p2p client
 *
 *	@module	CP2pClient
 *	@class	CP2pClient
 */
class CP2pClient extends CP2pDeliver
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
		this.m_cDriverClient	= CP2pDriver.createInstance( _p2pConstants.CONNECTION_DRIVER, 'client', oOptions );
		super.cDriver		= this.m_cDriverClient;
	}


	/**
	 * 	make client connected to server
	 *
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async startClient()
	{
		return this.m_cDriverClient
		.on( CP2pDriver.EVENT_OPEN, ( oSocket ) =>
		{
			_p2pLog.info( `Received [${ CP2pDriver.EVENT_CONNECTION }], new connection was opened.` );

			//
			//	send our version information to server peer
			//
			this.sendVersion( oSocket );
		})
		.on( CP2pDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			_p2pLog.info( `Received ${ CP2pDriver.EVENT_MESSAGE } :: [${ vMessage }]` );
		})
		.on( CP2pDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			_p2pLog.info( `Received [${ CP2pDriver.EVENT_CLOSE }] from server.` );

			//
			//	handle things while a socket was closed
			//
			this.handleClosed( oSocket );
		})
		.on( CP2pDriver.EVENT_ERROR, ( vError ) =>
		{
			_p2pLog.info( `Received [${ CP2pDriver.EVENT_ERROR }] from server.` );
		})
		.connectToServer( 'ws://127.0.0.1:1107' );
	}
}




/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pClient;
