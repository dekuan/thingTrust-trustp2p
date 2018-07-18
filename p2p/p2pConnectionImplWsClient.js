/*jslint node: true */
"use strict";

/**
 *	@require	module: *
 */
const WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
const socks			= process.browser ? null : require( 'socks' + '' );
const CP2pConnectionDriver	= require( './p2pConnectionDriver.js' );
const CP2pPersistence		= require( './p2pPersistence.js' );

const _p2pUtils			= require( './p2pUtils.js' );
const _p2pLog			= require( './p2pLog.js' );
const _p2pMessage		= require( './p2pMessage.js' );


/**
 *	class CSocketHandleCache
 *	@class	CSocketHandleCache
 */
class CSocketHandleCache
{
	constructor()
	{
		//	all clients connected in
		this.m_arrOutboundPeers	= [];
	}


	/**
	 *	get socket handle by url
	 *
	 * 	@public
	 *	@param	{string}	sUrl
	 *	@returns {null}
	 */
	getHandleByUrl( sUrl )
	{
		let oRet;
		let arrResult;

		if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
		{
			return null;
		}

		//	...
		oRet		= null;
		sUrl		= sUrl.trim().toLowerCase();
		arrResult	= this.m_arrOutboundPeers.filter( oSocket => oSocket.peer === sUrl );
		if ( Array.isArray( arrResult ) && 1 === arrResult.length )
		{
			oRet = arrResult[ 0 ];
		}

		return oRet;
	}

	/**
	 *	add new socket handle by url
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@returns {boolean}
	 */
	addHandle( oSocket )
	{
		if ( ! oSocket )
		{
			return false;
		}

		//	...
		this.removeHandle( oSocket );
		this.m_arrOutboundPeers.push( oSocket );
		return true;
	}

	/**
	 *	remove socket handle by url
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@returns {boolean}
	 */
	removeHandle( oSocket )
	{
		let bRet;
		let nIndex;

		if ( ! oSocket )
		{
			return false;
		}

		//	...
		bRet	= false;
		nIndex	= this.m_arrOutboundPeers.indexOf( oSocket );
		if ( -1 !== nIndex )
		{
			bRet = true;
			this.m_arrOutboundPeers.splice( nIndex, 1 );
		}

		return bRet;
	}
}




/**
 *	class p2pConnectionImplWsClient
 *	@module	p2pConnectionImplWsClient
 *	@class	p2pConnectionImplWsClient
 */
class p2pConnectionImplWsClient extends CP2pConnectionDriver
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
		this.m_oOptions			= Object.assign( {}, super.oOptions, oOptions );
		this.m_cSocketHandleCache	= new CSocketHandleCache();
		this.m_cP2pPersistence		= new CP2pPersistence();
	}

	/**
	 *	connect to a web socket server
	 *
	 * 	@public
	 *	@param	{string}	sUrl	address in wss/ws format
	 *
	 *	@returns {Promise<void>}
	 */
	async connectToServer( sUrl )
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let oWs;

			if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
			{
				//	rejected
				pfnReject( `connect server with invalid url.` );
				return false;
			}

			//	...
			oWs = this.m_cSocketHandleCache.getHandleByUrl( sUrl );
			if ( ! oWs )
			{
				this._createConnection( sUrl )
				.then( pfnResolve )
				.catch( pfnReject );
			}
			else
			{
				pfnResolve( oWs, `already have a connection to ${ sUrl }.` );
			}

			return true;
		});
	}

	/**
	 *	disconnect connection
	 *
	 * 	@public
	 *	@param	{string}	sUrl
	 *	@returns {Promise<any>}
	 */
	async disconnectFromServer( sUrl )
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let oWs;

			if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
			{
				//	rejected
				pfnReject( `disconnectFromServer with invalid url` );
				return false;
			}

			//	...
			oWs	= this.m_cSocketHandleCache.getHandleByUrl( sUrl );
			if ( oWs )
			{
				oWs.close( 1000, 'disconnect from server manually.' );
				pfnResolve( `disconnect from server manually.` );
			}
			else
			{
				pfnResolve( `Failed to disconnect from server, socket was not found.` );
			}

			return true;
		});
	}


	/**
	 *	create new connection
	 *
	 *	@private
	 *	@param	{string}	sUrl
	 *	@returns {Promise<void>}
	 */
	async _createConnection( sUrl )
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let oWs;
			let oProxy;

			if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
			{
				//	rejected
				pfnReject( `_createConnection with invalid url` );
				return false;
			}

			//	...
			sUrl	= sUrl.trim().toLowerCase();
			oProxy	= this._getProxyOptions( sUrl );
			oWs	= ( oProxy && oProxy.agent ) ? new WebSocket( sUrl, oProxy ) : new WebSocket( sUrl );

			//
			//	avoid warning
			//
			oWs.setMaxListeners( 20 );
			oWs.on
			(
				'open', () =>
				{
					let oWsAnotherToSameServer;

					//	...
					oWs.assocPendingRequests	= {};
					oWs.assocInPreparingResponse	= {};

					if ( ! oWs.url )
					{
						throw Error( "no url on ws" );
					}

					//
					//	browser implementation of Web Socket might add '/'
					//
					if ( oWs.url !== sUrl && oWs.url !== sUrl + "/" )
					{
						throw Error( `url is different: ${ oWs.url }` );
					}

					//	...
					oWsAnotherToSameServer	= this.m_cSocketHandleCache.getHandleByUrl( sUrl );
					if ( oWsAnotherToSameServer )
					{
						//
						//	duplicate connection.
						//	May happen if we abondoned a connection attempt after timeout
						// 		but it still succeeded while we opened another connection
						//
						_p2pLog.warning( `already have a connection to ${ sUrl }, will keep the old one and close the duplicate` );
						oWs.close( 1000, 'duplicate connection' );

						//
						//	...
						//
						return pfnResolve( oWs );
					}

					//
					//	almost done!
					//
					oWs.peer	= sUrl;							//	peer
					oWs.host	= this.m_cP2pPersistence.getHostByPeer( sUrl );		//	host
					oWs.bOutbound	= true;							//	identify this connection as outbound connection
					oWs.last_ts	= Date.now();						//	record the last timestamp while we connected to this peer

					//	...
					_p2pLog.info( `connected to ${ sUrl }, host ${ oWs.host }` );

					//
					//	cache new socket handle
					// 	and, save new peer
					//
					this.m_cSocketHandleCache.addHandle( oWs );
					this.m_cP2pPersistence.addServerSync( sUrl );

					//
					//	send our version information to server peer
					//
					_p2pMessage.sendVersion( oWs );

					//
					//	TODO
					//	I can listen too, this is my url to connect to me
					//
					// if ( _conf.myUrl )
					// {
					// 	_network_message.sendJustSaying( ws, 'my_url', _conf.myUrl );
					// }

					// if ( ! _conf.bLight )
					// {
					// 	if ( 'function' === typeof m_pfnSubscribe )
					// 	{
					// 		m_pfnSubscribe.call( this, ws );
					// 	}
					// }

					//
					//	emit a event to subscriber that we have connect to the server successfully.
					//
					this.emit( CP2pConnectionDriver.EVENT_OPEN, oWs );

					//
					//	...
					//
					return pfnResolve( oWs );
				}
			);

			oWs.on
			(
				'close', () =>
				{
					_p2pLog.info( `socket was close` );
					this.m_cSocketHandleCache.removeHandle( oWs );

					//	...
					this.emit( CP2pConnectionDriver.EVENT_CLOSE, oWs );

					//	...
					if ( oProxy.agent &&
						oProxy.agent.destroy )
					{
						oProxy.agent.destroy();
					}

					//
					//	...
					//
					return pfnResolve( oWs );
				}
			);

			oWs.on
			(
				'error', ( vError ) =>
				{
					_p2pLog.error( `error from server ${ sUrl }: `, vError );

					//	...
					this.emit( CP2pConnectionDriver.EVENT_ERROR, vError );

					//
					//	! ws.bOutbound means not connected yet.
					//	This is to distinguish connection errors from later errors that occur on open connection
					//

					//
					//	this is not an outbound connection
					//
					if ( ! oWs.bOutbound )
					{
						// if ( onOpen )
						// {
						// 	//	execute callback by error
						// 	onOpen( err );
						// }
						// else
						// {
						// 	//	broadcast this error
						// 	_event_bus.emit( 'open-' + url, err );
						// }
					}

					//
					//	...
					//
					return pfnResolve( oWs );
				}
			);

			oWs.on
			(
				'message',
				( vMessage ) =>
				{
					//
					//	emit a event about received message
					//
					return this.emit( CP2pConnectionDriver.EVENT_MESSAGE, oWs, vMessage );
				}
			);

			//	...
			_p2pLog.info( `connectToServer done!` );

			//	...
			return true;
		});
	}

	/**
	 *	get proxy options
	 *
	 * 	@param	{string}	sUrl
	 * 	@returns {object}
	 * 	@private
	 */
	_getProxyOptions( sUrl )
	{
		let oRet;

		if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
		{
			return null;
		}

		//	...
		oRet	= null;
		if ( socks &&
			_p2pUtils.isObject( this.m_oOptions.oProxy ) &&
			'sHost' in this.m_oOptions.oProxy &&
			'nPort' in this.m_oOptions.oProxy )
		{
			oRet =
			{
				agent	: new socks.Agent
				(
					{
						proxy :
						{
							ipaddress	: this.m_oOptions.oProxy[ 'sHost' ],
							port		: this.m_oOptions.oProxy[ 'nPort' ],
							type		: 5
						}
					},
					/^wss/i.test( sUrl )
				)
			};
		}

		return oRet;
	}

}




/**
 *	exports
 *	@exports
 *	@type {p2pConnectionImplWsClient}
 */
module.exports	= p2pConnectionImplWsClient;
