/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const _crypto			= require( 'crypto' );

const CP2pDriver		= require( './driver/CP2pDriver.js' );
const CP2pPackage		= require( './CP2pPackage.js' );
const CP2pDeliver		= require( './CP2pDeliver.js' );
const CThreadBootstrap		= require( './CThreadBootstrap.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pLog			= require( './CP2pLog.js' );




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

		this.m_oOptions			= Object.assign( {}, oOptions );
		this.m_cDriverServer		= CP2pDriver.createInstance( 'server', oOptions );
		super.cDriver			= this.m_cDriverServer;

		//	...
		this.m_cThreadBootstrap		= new CThreadBootstrap( oOptions );

		//	...
		this._init();
	}


	/**
	 * 	start server
	 *
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async startServer()
	{
		setImmediate
		(
			() =>
			{
				this.m_cDriverServer.startServer();
			}
		);
	}

	/**
	 *	@public
	 *	@returns {Array}
	 */
	getClients()
	{
		return this.m_cDriverServer.getClients();
	}


	/**
	 *	initialize
	 *	@private
	 */
	async _init()
	{
		//
		//	hook events for server
		//
		this.m_cDriverServer
		.on( CP2pDriver.EVENT_START, ( oSocket, sInfo ) =>
		{
			_p2pLog.info( `* ${ this.constructor.name } Received [${ CP2pDriver.EVENT_START }].`, sInfo );
		})
		.on( CP2pDriver.EVENT_CONNECTION, ( oSocket ) =>
		{
			_p2pLog.info( `* ${ this.constructor.name } Received [${ CP2pDriver.EVENT_CONNECTION }].` );

			//
			//	WELCOME THE NEW CLIENT
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

			setImmediate
			(
				() =>
				{
					this.m_cThreadBootstrap.transitSocketConnection( oSocket );
				}
			);
		})
		.on( CP2pDriver.EVENT_MESSAGE, ( oSocket, vMessage ) =>
		{
			let objMessage	= this.m_cP2pPackage.decodePackage( vMessage );
			if ( objMessage )
			{
				_p2pLog.info( `* ${ this.constructor.name } Received ${ CP2pDriver.EVENT_MESSAGE } :: ( type:${ objMessage.type }, event:${ objMessage.event }, tag:${ objMessage.tag } )` );
				switch ( objMessage.type )
				{
					case CP2pPackage.PACKAGE_REQUEST:
						this.m_cThreadBootstrap.transitSocketMessage( oSocket, objMessage );
						break;
					case CP2pPackage.PACKAGE_HEARTBEAT_PONG:
					case CP2pPackage.PACKAGE_RESPONSE:
						this.onRequestResponded( oSocket, objMessage );
						break;
					case CP2pPackage.PACKAGE_TALK:
						break;
				}
			}

		})
		.on( CP2pDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			_p2pLog.info( `* ${ this.constructor.name } Received a message [${ CP2pDriver.EVENT_CLOSE }].` );

			//
			//	handle a socket was closed
			//
			this.handleClosed( oSocket );
			setImmediate( () =>
			{
				this.m_cThreadBootstrap.transitSocketClose( oSocket );
			});
		})
		.on( CP2pDriver.EVENT_ERROR, ( vError ) =>
		{
			_p2pLog.info( `* ${ this.constructor.name } Received a message [${ CP2pDriver.EVENT_ERROR }].` );
			this.m_cThreadBootstrap.transitSocketError( vError );
		});


		//
		//	load threads
		//
		await this.m_cThreadBootstrap.run({
			server	: this,
			client	: null,
		});
	}
}




/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pServer;
