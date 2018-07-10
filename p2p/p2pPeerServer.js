/*jslint node: true */
"use strict";

let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
let socks			= process.browser ? null : require( 'socks' + '' );
let WebSocketServer		= WebSocket.Server;

let _conf			= require( '../conf.js' );

let _db				= require( '../db.js' );

let _event_bus			= require( './p2pEvents' );
let _network_message		= require( './p2pMessage.js' );



/**
 *	CP2pPeerServer
 */
class CP2pPeerServer
{
	m_oWss	= null;

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
	}


	/**
	 *	start web socket server
	 *
	 *	@param oOptions
	 *		.port
	 *		.subscribe
	 *		.onMessage
	 *		.onClose
	 */
	startServer( oOptions )
	{
		//
		//	delete all ...
		//
		_db.query( "DELETE FROM watched_light_addresses" );
		_db.query( "DELETE FROM watched_light_units" );

		//
		//	create a new web socket server
		//
		//	npm ws
		//	https://github.com/websockets/ws
		//
		//	_db.query("DELETE FROM light_peer_witnesses");
		//	listen for new connections
		//
		this.m_oWss	= new WebSocketServer
		(
			{
				port	: oOptions.port
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
		this.m_oWss.on
		(
			'connection',
			this._onPeerConnected
		);

		console.log( 'WSS running at port ' + oOptions.port );
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
	_onPeerConnected( ws )
	{
		//
		//	ws
		//	- the connected Web Socket handle of remote client
		//
		let sRemoteAddress;
		let bStatsCheckUnderWay;

		//	...
		sRemoteAddress = this._getRemoteAddress( ws );
		if ( ! sRemoteAddress )
		{
			console.log( "no ip/sRemoteAddress in accepted connection" );
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
		console.log( 'got connection from ' + ws.peer + ", host " + ws.host );

		if ( this.m_oWss.clients.length >= _conf.MAX_INBOUND_CONNECTIONS )
		{
			console.log( "inbound connections maxed out, rejecting new client " + sRemoteAddress );

			//	1001 doesn't work in cordova
			ws.close( 1000, "inbound connections maxed out" );
			return;
		}

		//	...
		bStatsCheckUnderWay	= true;

		//
		//	calculate the counts of elements in status invalid and new_good
		//	from table [peer_events] by peer_host for a hour ago.
		//
		_db.query
		(
			"SELECT \
				SUM( CASE WHEN event='invalid' THEN 1 ELSE 0 END ) AS count_invalid, \
				SUM( CASE WHEN event='new_good' THEN 1 ELSE 0 END ) AS count_new_good \
				FROM peer_events WHERE peer_host = ? AND event_date > " + _db.addTime( "-1 HOUR" ),
			[
				//	remote host/sRemoteAddress connected by this ws
				ws.host
			],
			( rows ) =>
			{
				let oStats;

				//	...
				bStatsCheckUnderWay	= false;

				//	...
				oStats	= rows[ 0 ];
				if ( oStats.count_invalid )
				{
					//
					//	CONNECTION WAS REJECTED
					//	this peer have invalid events before
					//
					console.log( "# rejecting new client " + ws.host + " because of bad stats" );
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
				_network_message.sendVersion( ws );

				//	I'm a hub, send challenge
				if ( _conf.bServeAsHub )
				{
					ws.challenge	= _crypto.randomBytes( 30 ).toString( "base64" );

					//
					//	the new peer, I am a hub and I have ability to exchange data
					//
					_network_message.sendJustSaying( ws, 'hub/challenge', ws.challenge );
				}
				if ( ! _conf.bLight )
				{
					//
					//	call
					//	subscribe data from others
					//	while a client connected to me
					//
					oOptions.subscribe( ws );
				}

				//
				//	emit a event say there was a client connected
				//
				_event_bus.emit( 'connected', ws );
			}
		);

		//
		//	receive message
		//
		ws.on
		(
			'message',
			function( message )
			{
				//	might come earlier than stats check completes
				function tryHandleMessage()
				{
					if ( bStatsCheckUnderWay )
					{
						setTimeout
						(
							tryHandleMessage,
							100
						);
					}
					else
					{
						//
						//	call while receiving message
						//
						oOptions.onMessage.call( ws, message );
					}
				}

				//	...
				tryHandleMessage();
			}
		);

		//
		//	on close
		//
		ws.on
		(
			'close',
			function()
			{
				_db.query( "DELETE FROM watched_light_addresses WHERE peer = ?", [ ws.peer ] );
				_db.query( "DELETE FROM watched_light_units WHERE peer = ?", [ ws.peer ] );
				//_db.query( "DELETE FROM light_peer_witnesses WHERE peer = ?", [ ws.peer ] );
				console.log( "client " + ws.peer + " disconnected" );

				//
				//	call while the connection was closed
				//
				oOptions.onClose( ws );
			}
		);

		//
		//	on error
		//
		ws.on
		(
			'error',
			function( e )
			{
				console.log( "error on client " + ws.peer + ": " + e );

				//	close
				ws.close( 1000, "received error" );
			}
		);

		//	...
		addPeerHost( ws.host );
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
