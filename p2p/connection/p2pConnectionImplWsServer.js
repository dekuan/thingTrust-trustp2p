/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
const CP2pConnectionDriver	= require( './p2pConnectionDriver.js' );
const CP2pPersistence		= require( '../p2pPersistence.js' );

const _p2pConstants		= require( '../p2pConstants.js' );
const _p2pUtils			= require( '../p2pUtils.js' );
const _p2pLog			= require( '../p2pLog.js' );
const _p2pMessage		= require( '../p2pMessage.js' );




/**
 *	implementation of p2p connection server using Web Socket
 *
 *	@module	CP2pConnectionImplWsServer
 *	@class	CP2pConnectionImplWsServer
 */
class CP2pConnectionImplWsServer extends CP2pConnectionDriver
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
		this.m_oWss			= { clients : [] };
		this.m_oOptions			= Object.assign( {}, super.oOptions, oOptions );
		this.m_cP2pPersistence		= new CP2pPersistence();
	}

	/**
	 *	start web socket server
	 * 	@public
	 *	@returns {Promise<any>}
	 */
	async startServer()
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			if ( ! _p2pUtils.isValidPortNumber( this.m_oOptions.nPort ) )
			{
				pfnReject( `startServer with invalid socket port number.` );
				return false;
			}

			//
			//	delete all ...
			//
			this.m_cP2pPersistence.clearWholeWatchListSync();

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
			this.emit
			(
				CP2pConnectionDriver.EVENT_START,
				this.m_oWss,
				`WSS running at port ${ this.m_oOptions.nPort }`
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
			this.m_oWss.on( 'connection', ( oWs ) =>
			{
				return this._onClientConnectedIn( oWs );
			});

			//	...
			pfnResolve();
			return true;
		});
	}

	/**
	 *	@public
	 *	@returns {Array}
	 */
	getClients()
	{
		return Array.isArray( this.m_oWss.clients )
			? this.m_oWss.clients
			: [];
	}



	/**
	 * 	callback function for a incoming connection
	 *
	 *	@private
	 *	@param	{object}	oWs
	 */
	async _onClientConnectedIn( oWs )
	{
		//
		//	ws
		//	- the connected Web Socket handle of remote client
		//
		let sRemoteAddress;

		if ( ! oWs )
		{
			_p2pLog.error( `_onClientConnectedIn with invalid oWs.` );
			return false;
		}

		//	...
		sRemoteAddress = this._getRemoteAddress( oWs );
		if ( ! sRemoteAddress )
		{
			_p2pLog.error( `no ip/sRemoteAddress in accepted connection` );
			oWs.terminate();
			return false;
		}

		//
		//	...
		//
		oWs.peer			= sRemoteAddress + ":" + oWs.upgradeReq.connection.remotePort;
		oWs.host			= sRemoteAddress;
		oWs.assocPendingRequests	= {};
		oWs.assocInPreparingResponse	= {};
		oWs.bInbound			= true;
		oWs.last_ts			= Date.now();

		//	...
		_p2pLog.info( `got connection from ${ oWs.peer }, host ${ oWs.host }` );

		if ( this.m_oWss.clients.length >= this.m_oOptions.CONNECTION_MAX_INBOUND )
		{
			_p2pLog.error( `inbound connections maxed out, rejecting new client ${ sRemoteAddress }` );

			//	1001 doesn't work in cordova
			oWs.close( 1000, "inbound connections maxed out" );
			return false;
		}
		if ( ! await this.m_cP2pPersistence.isGoodPeer( oWs.host ) )
		{
			_p2pLog.error( `# rejecting new client ${ oWs.host } because of bad stats` );
			oWs.terminate();
			return false;
		}


		//
		//	emit a event say there was a client connected
		//
		this.emit( CP2pConnectionDriver.EVENT_CONNECTION, oWs );

		//
		//	receive message
		//
		oWs.on
		(
			'message',
			( vMessage ) =>
			{
				//
				//	call while receiving message
				//
				this.emit( CP2pConnectionDriver.EVENT_MESSAGE, oWs, vMessage );
			}
		);

		//
		//	on close
		//
		oWs.on
		(
			'close',
			async () =>
			{
				_p2pLog.warning( `client ${ oWs.peer } disconnected` );

				//
				//	...
				//
				await this.m_cP2pPersistence.removePeerFromWatchList( oWs.peer );

				//
				//	call while the connection was closed
				//
				this.emit( CP2pConnectionDriver.EVENT_CLOSE, oWs );
			}
		);

		//
		//	on error
		//
		oWs.on
		(
			'error',
			( vError ) =>
			{
				_p2pLog.error( `error on client ${ oWs.peer }: ${ vError }` );

				//	close
				oWs.close( 1000, "received error" );
				this.emit( CP2pConnectionDriver.EVENT_ERROR, vError );
			}
		);

		//	...
		//await this.m_cP2pPersistence.addPeerHost( oWs.host );

		//	...
		return true;
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
 *	@exports
 *	@type {CP2pConnectionImplWsServer}
 */
module.exports	= CP2pConnectionImplWsServer;
