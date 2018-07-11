/*jslint node: true */
"use strict";

let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
let socks			= process.browser ? null : require( 'socks' + '' );

let _conf			= require( '../conf.js' );

let _crypto			= require( 'crypto' );

let _p2pUtils			= require( './p2pUtils.js' );
let _p2pLog			= require( './p2pLog.js' );
let _p2pPersistence		= require( './p2pPersistence.js' );

let _p2pEvents			= require( './p2pEvents.js' );
let _p2pMessage			= require( './p2pMessage.js' );



/**
 *	CP2pPeerServer
 */
class CP2pPeerServer
{
	constructor()
	{
		this.init();
	}

	/**
	 *	@public
	 *	initialize web socket server
	 */
	init()
	{
		this.m_oWss	= { clients : [] };
		this.m_oOptions	=
			{
				port		: 80,
				bServeAsHub	: false,
				bLight		: false,
				subscribe	: () => {},
				onMessage	: () => {},
				onClose		: () => {},
			};
	}


	/**
	 *	start web socket server
	 *
	 *	@param oOptions
	 *		.port
	 *		.bServeAsHub
	 *		.bLight
	 *		.subscribe
	 *		.onMessage
	 *		.onClose
	 */
	async startServer( oOptions )
	{
		if ( ! Number.isInteger( oOptions.port ) ||
			( oOptions.hasOwnProperty( 'subscribe' ) && ! _p2pUtils.isFunction( oOptions.subscribe ) ) ||
			( oOptions.hasOwnProperty( 'onMessage' ) && ! _p2pUtils.isFunction( oOptions.onMessage ) ) ||
			( oOptions.hasOwnProperty( 'onClose' ) && ! _p2pUtils.isFunction( oOptions.onClose )  ) )
		{
			throw Error( 'startServer with invalid parameter.' );
		}

		//
		//	copy options
		//
		this.m_oOptions = Object.assign( {}, this.m_oOptions, oOptions );

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
		this.m_oWss	= new WebSocket.Server
		(
			{
				port	: this.m_oOptions.port
			}
		);

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
		this.m_oWss.on( 'connection', this._onPeerConnectedIn );

		//	...
		_p2pLog.info( 'WSS running at port ' + this.m_oOptions.port );
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
			_p2pLog.error( "no ip/sRemoteAddress in accepted connection" );
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
		_p2pLog.info( 'got connection from ' + ws.peer + ", host " + ws.host );

		if ( this.m_oWss.clients.length >= _conf.MAX_INBOUND_CONNECTIONS )
		{
			_p2pLog.error( "inbound connections maxed out, rejecting new client " + sRemoteAddress );

			//	1001 doesn't work in cordova
			ws.close( 1000, "inbound connections maxed out" );
			return null;
		}
		if ( ! await _p2pPersistence.isGoodPeer( ws.host ) )
		{
			_p2pLog.error( "# rejecting new client " + ws.host + " because of bad stats" );
			return ws.terminate();
		}

		//
		//	WELCOME THE NEW PEER WITH THE LIST OF FREE JOINTS
		//
		//	if (!m_bCatchingUp)
		//		_sendFreeJoints(ws);
		//
		//	*
		//	so, we response the version of this hub/witness
		//
		_p2pMessage.sendVersion( ws );


		//
		//	I'm a hub, send challenge
		//
		if ( this.m_oOptions.bServeAsHub )
		{
			//
			//	create 'challenge' key for clients
			//
			ws.challenge	= _crypto.randomBytes( 30 ).toString( "base64" );

			//
			//	the new peer, I am a hub and I have ability to exchange data
			//
			_p2pMessage.sendJustSaying( ws, 'hub/challenge', ws.challenge );
		}

		if ( ! this.m_oOptions.bLight )
		{
			//
			//	call
			//	subscribe data from others
			//	while a client connected to me
			//
			this.m_oOptions.subscribe( ws );
		}

		//
		//	emit a event say there was a client connected
		//
		_p2pEvents.emit( 'connected', ws );

		//
		//	receive message
		//
		ws.on
		(
			'message',
			( message ) =>
			{
				//
				//	call while receiving message
				//
				this.m_oOptions.onMessage.call( ws, message );
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
				_p2pLog.warning( "client " + ws.peer + " disconnected" );

				//
				//	...
				//
				await _p2pPersistence.removePeerFromWatchList( ws.peer );

				//
				//	call while the connection was closed
				//
				this.m_oOptions.onClose( ws );
			}
		);

		//
		//	on error
		//
		ws.on
		(
			'error',
			( e ) =>
			{
				_p2pLog.error( "error on client " + ws.peer + ": " + e );

				//	close
				ws.close( 1000, "received error" );
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
 *	web socket server
 */
exports.CP2pPeerServer		= CP2pPeerServer;
