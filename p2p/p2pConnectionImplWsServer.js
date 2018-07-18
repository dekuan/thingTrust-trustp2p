/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
let socks			= process.browser ? null : require( 'socks' + '' );
const CP2pConnectionDriver	= require( './p2pConnectionDriver.js' );

let _crypto			= require( 'crypto' );
let _p2pUtils			= require( './p2pUtils.js' );
let _p2pLog			= require( './p2pLog.js' );
let _p2pPersistence		= require( './p2pPersistence.js' );
let _p2pMessage			= require( './p2pMessage.js' );




/**
 *	class CP2pConnectionWsServer
 *	@module	CP2pConnectionWsServer
 *	@class	CP2pConnectionWsServer
 */
class CP2pConnectionWsServer extends CP2pConnectionDriver
{
	/**
	 *	@constructor
	 *	@param oOptions
	 *	@see super
	 */
	constructor( oOptions )
	{
		super( oOptions );

		//	...
		this.m_oWss		= { clients : [] };
		this.m_oOptions		= Object.assign( {}, super.oOptions, oOptions );
	}

	/**
	 * 	@public
	 *	start web socket server
	 */
	async startServer()
	{
		if ( ! _p2pUtils.isValidPortNumber( this.m_oOptions.nPort ) )
		{
			throw Error( `startServer with invalid socket port number.` );
		}

		//
		//	delete all ...
		//
		await _p2pPersistence.clearWholeWatchList();


		//
		//	create a new web socket server
		//
		//	npm ws
		//	https://github.com/websockets/ws
		//
		//	_db.query("DELETE FROM light_peer_witnesses");
		//	listen for new connections
		//
		this.m_oWss = new WebSocket.Server
		(
			{
				port : this.m_oOptions.nPort
			}
		);

		//	...
		_p2pLog.info( `CONNECTION Server :: WSS running at port ${ this.m_oOptions.nPort }` );
		this.emit( CP2pConnectionDriver.EVENT_START, this.m_oWss, `WSS running at port ${ this.m_oOptions.nPort }` );

		//
		//	Event 'connection'
		//		Emitted when the handshake is complete.
		//
		//		- socket	{ WebSocket }
		//		- request	{ http.IncomingMessage }
		//
		//		request is the http GET request sent by the client.
		// 		Useful for parsing authority headers, cookie headers, and other information.
		//
		this.m_oWss.on( 'connection', ( ws ) =>
		{
			this._onPeerConnectedIn( ws );
		});
	}

	/**
	 *	@public
	 *	@returns {Array}
	 */
	getClients()
	{
		return this.m_oWss.clients;
	}


	/**
	 *	@private
	 *	@param ws
	 */
	async _onPeerConnectedIn( ws )
	{
		//
		//	ws
		//	- the connected Web Socket handle of remote client
		//
		let sRemoteAddress;

		//	...
		sRemoteAddress = this._getRemoteAddress( ws );
		if ( ! sRemoteAddress )
		{
			_p2pLog.error( `no ip/sRemoteAddress in accepted connection` );
			ws.terminate();
			return;
		}

		//
		//	...
		//
		ws.peer				= sRemoteAddress + ":" + ws.upgradeReq.connection.remotePort;
		ws.host				= sRemoteAddress;
		ws.assocPendingRequests		= {};
		ws.assocInPreparingResponse	= {};
		ws.bInbound			= true;
		ws.last_ts			= Date.now();

		//	...
		_p2pLog.info( `got connection from ${ ws.peer }, host ${ ws.host }` );

		if ( this.m_oWss.clients.length >= this.m_oOptions.MAX_INBOUND_CONNECTIONS )
		{
			_p2pLog.error( `inbound connections maxed out, rejecting new client ${ sRemoteAddress }` );

			//	1001 doesn't work in cordova
			ws.close( 1000, "inbound connections maxed out" );
			return null;
		}
		if ( ! await _p2pPersistence.isGoodPeer( ws.host ) )
		{
			_p2pLog.error( `# rejecting new client ${ ws.host } because of bad stats` );
			return ws.terminate();
		}

		//
		//	WELCOME THE NEW PEER
		//
		//	so, we respond our version to the new client
		//
		_p2pMessage.sendVersion( ws );


		//
		//	I'm a hub, send challenge
		//
		if ( this.m_oOptions.bServeAsHub )
		{
			//
			//	create 'challenge' key for clients
			//	the new peer, I am a hub and I have ability to exchange data
			//
			ws.challenge = _crypto.randomBytes( 30 ).toString( "base64" );
			_p2pMessage.sendJustSaying( ws, 'hub/challenge', ws.challenge );
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
		//	emit a event say there was a client connected
		//
		this.emit( CP2pConnectionDriver.EVENT_CONNECTION, ws );

		//
		//	receive message
		//
		ws.on
		(
			'message',
			( vMessage ) =>
			{
				//
				//	call while receiving message
				//
				this.emit( CP2pConnectionDriver.EVENT_MESSAGE, ws, vMessage );
			}
		);

		//
		//	on close
		//
		ws.on
		(
			'close',
			async () =>
			{
				_p2pLog.warning( `client ${ ws.peer } disconnected` );

				//
				//	...
				//
				await _p2pPersistence.removePeerFromWatchList( ws.peer );

				//
				//	call while the connection was closed
				//
				this.emit( CP2pConnectionDriver.EVENT_CLOSE, ws );
			}
		);

		//
		//	on error
		//
		ws.on
		(
			'error',
			( vError ) =>
			{
				_p2pLog.error( `error on client ${ ws.peer }: ${ vError }` );

				//	close
				ws.close( 1000, "received error" );
				this.emit( CP2pConnectionDriver.EVENT_ERROR, vError );
			}
		);

		//	...
		await _p2pPersistence.addPeerHost( ws.host );
	}


	/**
	 *	@private
	 *	@param ws
	 */
	_getRemoteAddress( ws )
	{
		//
		//	ws
		//	- the connected Web Socket handle of remote client
		//
		let sRet;

		//	...
		sRet = ws.upgradeReq.connection.remoteAddress;
		if ( sRet )
		{
			//
			//	check for proxy
			//	ONLY VALID FOR 127.0.0.1 and resources addresses
			//
			if ( ws.upgradeReq.headers[ 'x-real-ip' ] &&
				( sRet === '127.0.0.1' || sRet.match( /^192\.168\./ ) ) )
			{
				//
				//	TODO
				//	check for resources IP addresses
				//

				//	we are behind a proxy
				sRet = ws.upgradeReq.headers[ 'x-real-ip' ];
			}
		}

		return sRet;
	}

}




/**
 *	exports
 *	@exports
 *	@type {CP2pConnectionWsServer}
 */
module.exports	= CP2pConnectionWsServer;
