/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const CP2pDriver		= require( './driver/CP2pDriver.js' );
const CP2pPackage		= require( './CP2pPackage.js' );
const CP2pDeliver		= require( './CP2pDeliver.js' );
const CThreadBootstrap		= require( './CThreadBootstrap.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pLog			= require( './CP2pLog.js' );





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
		this.m_cDriverClient		= CP2pDriver.createInstance( 'client', oOptions );
		super.cDriver			= this.m_cDriverClient;

		//	...
		this.m_cThreadBootstrap		= new CThreadBootstrap( oOptions );

		//
		this._init();
	}


	/**
	 * 	make client connected to server
	 *
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async startClient()
	{
		setImmediate( () =>
		{
			this.m_cDriverClient.connectToServer( 'ws://127.0.0.1:1107' );
		});
	}


	/**
	 * 	initialize
	 *	@private
	 */
	async _init()
	{
		//
		//	load threads
		//
		await this.m_cThreadBootstrap.run({
			server	: null,
			client	: this,
		});

		//
		//	events for client
		//
		this.m_cDriverClient
		.on( CP2pDriver.EVENT_OPEN, ( oSocket ) =>
		{
			_p2pLog.info( `* ${ this.constructor.name } Received [${ CP2pDriver.EVENT_OPEN }], connect to server successfully.` );

			//
			//	send our version information to server peer
			//
			this.sendVersion( oSocket );
			setImmediate
			(
				() =>
				{
					this.m_cThreadBootstrap.transitSocketOpen( oSocket );
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
					case CP2pPackage.PACKAGE_HEARTBEAT_PING:
					case CP2pPackage.PACKAGE_REQUEST:
						this.m_cThreadBootstrap.transitSocketMessage( oSocket, objMessage );
						break;
					case CP2pPackage.PACKAGE_RESPONSE:
						this.onRequestResponded( oSocket, objMessage );
						break;
					case CP2pPackage.PACKAGE_TALK:
						break;
				}
			}
			else
			{
				_p2pLog.info( `* ${ this.constructor.name } Received ${ CP2pDriver.EVENT_MESSAGE } :: # abandon invalid message.` );
			}
		})
		.on( CP2pDriver.EVENT_CLOSE, ( oSocket ) =>
		{
			_p2pLog.info( `* ${ this.constructor.name } Received [${ CP2pDriver.EVENT_CLOSE }].` );

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
			_p2pLog.info( `* ${ this.constructor.name } Received [${ CP2pDriver.EVENT_ERROR }].` );
			this.m_cThreadBootstrap.transitSocketError( vError );
		});
	}
}




/**
 *	@exports
 *	@type {CP2pClient}
 */
module.exports	= CP2pClient;
