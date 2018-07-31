/*jslint node: true */
"use strict";

const CP2pDriver		= require( './driver/CP2pDriver.js' );
const CP2pMessage		= require( './CP2pMessage.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './CP2pUtils.js' );
const _p2pLog			= require( './CP2pLog.js' );




/**
 *	P2p Request
 *	@class	CP2pRequest
 *	@module	CP2pRequest
 */
class CP2pRequest extends CP2pMessage
{
	constructor()
	{
		super();

		//	...
		this.m_cDriver				= null;
		this.m_oAssocReroutedConnectionsByTag	= {};
	}

	/**
	 *	set driver instance
	 *
	 *	@param	{instance}	cDriver
	 *	@return	{void}
	 */
	set cDriver( cDriver )
	{
		this.m_cDriver = cDriver;
	}


	/**
	 *	send request to all connected outbounds
	 *
	 *	@param	{object}	oInstance
	 *	@param	{array}		arrSockets
	 *	@param	{number}	nPackageType
	 *					- PACKAGE_SYSTEM
	 *					- PACKAGE_PING
	 *					- PACKAGE_PONG
	 *					- PACKAGE_TALK
	 *					- PACKAGE_REQUEST
	 *					- PACKAGE_RESPONSE
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody
	 *	@param	{boolean}	bReroute
	 *	@param	{function}	pfnResponseHandler( ws, request, response ){ ... }
	 *	@return {boolean}
	 */
	sendBroadcast( oInstance, arrSockets, nPackageType, sEvent, oBody, bReroute, pfnResponseHandler )
	{
		if ( CP2pDriver.DRIVER_TYPE_CLIENT !== this.m_cDriver.sDriverType )
		{
			_p2pLog.error( `will broadcast nothing, only client instance can send broadcast.` );
			return false;
		}
		if ( ! Array.isArray( arrSockets ) )
		{
			_p2pLog.error( `call sendBroadcast with invalid parameter arrSockets` );
			return false;
		}

		arrSockets.forEach
		(
			oSocket => this.sendRequest( oInstance, oSocket, nPackageType, sEvent, oBody, bReroute, pfnResponseHandler )
		);

		return true;
	}



	/**
	 *	send request with re-route ability supported
	 *
	 *	@param	{object}	oInstance
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackageType
	 *					- PACKAGE_SYSTEM
	 *					- PACKAGE_PING
	 *					- PACKAGE_PONG
	 *					- PACKAGE_TALK
	 *					- PACKAGE_REQUEST
	 *					- PACKAGE_RESPONSE
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody
	 *	@param	{boolean}	bReroute
	 *	@param	{function}	pfnResponseHandler( ws, request, response ){ ... }
	 *
	 * 	@description
	 *
	 *	if a 2nd identical request is issued before we receive a response to the 1st request, then:
	 *	1, its pfnResponseHandler will be called too but no second request will be sent to the wire
	 *	2, bReroute flag must be the same
	 *
	 */
	sendRequest( oInstance, oSocket, nPackageType, sEvent, oBody, bReroute, pfnResponseHandler )
	{
		//
		//	oJsonBody for 'catchup'
		// 	{
		// 		witnesses	: arrWitnesses,		//	12 addresses of witnesses
		// 		last_stable_mci	: last_stable_mci,	//	stable last mci
		// 		last_known_mci	: last_known_mci	//	known last mci
		// 	};
		//
		let oJsonContent;
		let sTag;
		let pfnReroute;
		let nRerouteTimer;
		let nCancelTimer;

		if ( ! oSocket )
		{
			_p2pLog.error( `call sendRequest with invalid oSocket` );
			return false;
		}
		if ( ! this.m_cP2pPackage.isValidPackageType( nPackageType ) )
		{
			_p2pLog.error( `call sendRequest with invalid nPackType` );
			return false;
		}
		if ( ! _p2pUtils.isString( sEvent ) || 0 === sEvent.length )
		{
			_p2pLog.error( `call sendRequest with invalid sEvent` );
			return false;
		}
		if ( ! _p2pUtils.isObject( oBody ) )
		{
			_p2pLog.error( `call sendRequest with invalid oBody` );
			return false;
		}
		if ( ! _p2pUtils.isFunction( pfnResponseHandler ) )
		{
			_p2pLog.error( `call sendRequest with invalid pfnResponseHandler` );
			return false;
		}

		//
		//	sTag like : w35dxwqyQ2CzqHkOG5q+gwagPtaPweD4LEwzC2RjQNo=
		//
		oJsonContent	= Object.assign( {}, oBody );
		sTag		= this.m_cP2pPackage.calculateTag( nPackageType, sEvent, oBody );

		//
		//	will not send identical
		//	ignore duplicate requests while still waiting for response from the same peer
		//
		if ( oSocket.assocPendingRequests[ sTag ] )
		{
			oSocket.assocPendingRequests[ sTag ].responseHandlers.push
			({
				instance	: oInstance,
				handler		: pfnResponseHandler,
			});
			_p2pLog.error
			(
				`already sent a ${ sEvent } request to ${ oSocket.peer }, 
				will add one more response handler rather than sending a duplicate request to the wire`
			);
			return false;
		}

		//
		//	append tag
		//
		oJsonContent.tag	= sTag;

		//
		//	* RE-ROUTE ONLY FOR CLIENTS TO SEND REQUEST TO ALL OUTBOUND SERVERS
		//
		if ( CP2pDriver.DRIVER_TYPE_CLIENT !== this.m_cDriver.sDriverType )
		{
			bReroute = false;
		}

		//
		//	* RE-ROUTE TO THE NEXT PEER, NOT TO SAME PEER AGAIN
		//
		//	after _p2pConstants.STALLED_TIMEOUT, reroute the request to another peer
		//	it'll work correctly even if the current peer is already disconnected when the timeout fires
		//
		//	THIS function will be called when the request is timeout
		//
		pfnReroute = bReroute
			? this._createRerouteExecutor( oInstance, oSocket, nPackageType, sEvent, oBody, bReroute, sTag )
			: null;

		//
		//	timeout
		//	in sending request
		//
		nRerouteTimer	= bReroute
			? this._createRerouteTimer( oSocket, nPackageType, sEvent, pfnReroute )
			: null;

		//
		//	timeout
		//	in receiving response
		//
		nCancelTimer	= bReroute
			? null
			: this._createCancelTimer( oSocket, nPackageType, sEvent, sTag, oJsonContent );

		//
		//	build pending request list
		//
		oSocket.assocPendingRequests[ sTag ] =
			{
				request			: oJsonContent,
				responseHandlers	: [
					{
						instance	: oInstance,
						handler		: pfnResponseHandler,
					}
				],
				reroute			: pfnReroute,
				reroute_timer		: nRerouteTimer,
				cancel_timer		: nCancelTimer
			};

		//
		//	send message by socket handle
		//
		return this.sendMessage( oSocket, nPackageType, sEvent, oJsonContent );
	}

	/**
	 *	received response message by calling .sendRequest
	 *	with PackageType .PACKAGE_RESPONSE
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{object}	objMessage
	 */
	onRequestResponded( oSocket, objMessage )
	{
		if ( ! _p2pUtils.isObject( oSocket ) )
		{
			return false;
		}
		if ( ! objMessage )
		{
			return false;
		}

		//
		//	execute all pending requests
		//
		this._executePendingRequestsByTag( oSocket, objMessage.tag, objMessage.body );

		//
		//	clear cache
		//
		this._clearCacheReroutedConnectionsByTag( objMessage.tag );
	}



	/**
	 *	respond to the request sent by this.sendRequest
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 * 	@param	{number}	nPackageType
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody
	 *	@return	{boolean}
	 */
	sendResponse( oSocket, nPackageType, sEvent, oBody )
	{
		if ( ! _p2pUtils.isObject( oSocket ) )
		{
			return false;
		}
		if ( ! this.m_cP2pPackage.isValidPackageType( nPackageType ) )
		{
			return false;
		}

		//	...
		if ( _p2pUtils.isObjectWithKeys( oBody, 'tag' ) &&
			_p2pUtils.isObjectWithKeys( oSocket, 'assocInPreparingResponse' ) &&
			_p2pUtils.isObjectWithKeys( oSocket.assocInPreparingResponse, oBody.tag ) )
		{
			_p2pLog.info( `will delete oSocket.assocInPreparingResponse[ ${ oBody.tag } ] while .sendResponse` );
			delete oSocket.assocInPreparingResponse[ oBody.tag ];
		}

		//	...
		this.sendMessage( oSocket, nPackageType, sEvent, oBody );
		return true;
	}

	/**
	 *	respond error to the request sent by this.sendRequest
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 * 	@param	{number}	nPackageType
	 *	@param	{string}	sEvent
	 *	@param	{string}	sTag
	 *	@param	{string}	sError
	 *	@return	{void}
	 */
	sendErrorResponse( oSocket, nPackageType, sEvent, sTag, sError )
	{
		this.sendResponse( oSocket, nPackageType, sEvent, { tag : sTag, error : sError } );
	}



	/**
	 *	handle socket closed
	 *
	 * 	@public
	 *	@param 	{object}	oSocket
	 *	@return {boolean}
	 */
	handleClosed( oSocket )
	{
		let sTag;
		let oPendingRequest;

		if ( ! _p2pUtils.isObject( oSocket ) ||
			! oSocket.hasOwnProperty( 'assocPendingRequests' ) ||
			! _p2pUtils.isObject( oSocket.assocPendingRequests ) )
		{
			_p2pLog.error( `handleClosed with invalid oSocket` );
			return false;
		}

		//	...
		console.log( `Web Socket closed, will complete all outstanding requests` );

		for ( sTag in oSocket.assocPendingRequests )
		{
			//	...
			oPendingRequest	= oSocket.assocPendingRequests[ sTag ];

			//	...
			clearTimeout( oPendingRequest.reroute_timer );
			clearTimeout( oPendingRequest.cancel_timer );
			oPendingRequest.reroute_timer	= null;
			oPendingRequest.cancel_timer	= null;

			//
			//	reroute immediately, not waiting for _network_consts.STALLED_TIMEOUT
			//
			if ( _p2pUtils.isFunction( oPendingRequest.reroute ) )
			{
				if ( ! oPendingRequest.bRerouted )
				{
					oPendingRequest.reroute();
				}

				//
				//	***
				//	we still keep ws.assocPendingRequests[tag] because we'll need it when we find a peer to reroute to
				//
			}
			else
			{
				//
				//	respond all caller and then clear all pending requests
				//
				oPendingRequest.responseHandlers.forEach
				(
					oRh =>
					{
						oRh.handler.call
						(
							oRh.instance,
							oSocket,
							oPendingRequest.request,
							{ error : "[internal] driver closed" }
						);
					}
				);

				delete oSocket.assocPendingRequests[ sTag ];
				oSocket.assocPendingRequests[ sTag ]	= null;
			}
		}

		return true;
	}





	/**
	 *	execute pending requests by tag
	 *
	 *	@private
	 *	@param	{object}	oSocket
	 *	@param	{string}	sTag
	 *	@param	{string}	sResponse
	 *	@return {boolean}
	 */
	_executePendingRequestsByTag( oSocket, sTag, sResponse )
	{
		let oPendingRequest;

		if ( ! _p2pUtils.isObject( oSocket ) )
		{
			return false;
		}
		if ( ! _p2pUtils.isString( sTag ) || 0 === sTag.length )
		{
			return false;
		}

		//	...
		if ( oSocket.hasOwnProperty( 'assocPendingRequests' ) &&
			_p2pUtils.isObject( oSocket.assocPendingRequests ) &&
			oSocket.assocPendingRequests.hasOwnProperty( sTag ) )
		{
			oPendingRequest	= oSocket.assocPendingRequests[ sTag ];
			if ( _p2pUtils.isObject( oPendingRequest ) &&
				oPendingRequest.hasOwnProperty( 'responseHandlers' ) &&
				oPendingRequest.hasOwnProperty( 'reroute_timer' ) &&
				oPendingRequest.hasOwnProperty( 'cancel_timer' ) )
			{
				//
				//	call all responseHandlers next tick
				//
				for ( const [ nHandlerIndex, oRh ] of oPendingRequest.responseHandlers.entries() )
				{
					process.nextTick( () =>
					{
						oRh.handler.call
						(
							oRh.instance,
							oSocket,
							oPendingRequest.request,
							sResponse
						);
					});
				}

				//
				//	clear timers for
				//	- request reroute timer
				//	- response timer
				//
				clearTimeout( oPendingRequest.reroute_timer );
				clearTimeout( oPendingRequest.cancel_timer );
				oPendingRequest.reroute_timer	= null;
				oPendingRequest.cancel_timer	= null;
			}
			else
			{
				//
				//	was canceled due to timeout or rerouted and answered by another peer
				//
				_p2pLog.error( `handleResponse with no request by tag ${ sTag }` );
			}

			//
			//	remove the pending requests by tag
			//
			delete oSocket.assocPendingRequests[ sTag ];
		}

		return true;
	}

	/**
	 *	clear rerouted connections by tag in request
	 *
	 *	@param	{string}	sTag
	 *	@return	{void}
	 */
	_clearCacheReroutedConnectionsByTag( sTag )
	{
		//
		//	if the request was rerouted, cancel all other pending requests
		//
		if ( sTag in this.m_oAssocReroutedConnectionsByTag )
		{
			this.m_oAssocReroutedConnectionsByTag[ sTag ].forEach
			(
				oSocket =>
				{
					if ( sTag in oSocket.assocPendingRequests )
					{
						clearTimeout( oSocket.assocPendingRequests[ sTag ].reroute_timer );
						clearTimeout( oSocket.assocPendingRequests[ sTag ].cancel_timer );
						oSocket.assocPendingRequests[ sTag ].reroute_timer	= null;
						oSocket.assocPendingRequests[ sTag ].cancel_timer	= null;
						delete oSocket.assocPendingRequests[ sTag ];
					}
				}
			);
			delete this.m_oAssocReroutedConnectionsByTag[ sTag ];
		}
	}


	/**
	 *	create reroute executor
	 *
	 *	@private
	 *	@param	{object}	oInstance
	 *	@param	{object}	oSocket
	 *	@param 	{number}	nPackType
	 *	@param	{string}	sEvent
	 *	@param	{object}	oJsonBody
	 *	@param	{boolean}	bReroute
	 *	@param	{string}	sTag
	 *	@return {Function}
	 */
	_createRerouteExecutor( oInstance, oSocket, nPackType, sEvent, oJsonBody, bReroute, sTag )
	{
		return () =>
		{
			let oNextSocket;

			_p2pLog.info( `will try to reroute a ${ sEvent } request stalled at ${ oSocket.peer }` );

			if ( ! sTag in oSocket.assocPendingRequests )
			{
				return _p2pLog.error( `will not reroute - the request was already handled by another peer` );
			}

			//
			//	try to find the next server peer
			//
			oNextSocket	= this.m_cDriver.findNextServerSync( oSocket );
			if ( ! oNextSocket )
			{
				return _p2pLog.error( `will not reroute - can not find another peer` );
			}

			//	the callback may be called much later if .findNextServerSync has to wait for driver
			if ( ! sTag in oSocket.assocPendingRequests )
			{
				return _p2pLog.error( `will not reroute after findNextPeer - the request was already handled by another peer` );
			}

			//	...
			if ( this._isSameSocket( oSocket, oNextSocket, sTag ) )
			{
				//
				//	TODO
				//
				// _event_bus.once
				// (
				// 	'connected_to_source',
				// 	() =>
				// 	{
				// 		//	try again
				// 		console.log( 'got new driver, retrying reroute ' + sEvent );
				// 		pfnReroute();
				// 	}
				// );
				return _p2pLog.error( `will not reroute ${ sEvent } to the same peer, will rather wait for a new connection` );
			}

			//
			//	RESEND Request, i.e. re-route
			//	SEND REQUEST AGAIN FOR EVERY responseHandlers
			//
			_p2pLog.info( `rerouting ${ sEvent } from ${ oSocket.peer } to ${ oNextSocket.peer }` );
			oSocket.assocPendingRequests[ sTag ].bRerouted = true;
			oSocket.assocPendingRequests[ sTag ].responseHandlers.forEach
			(
				oRh =>
				{
					//
					//	rh	is pfnResponseHandler
					//	this will send only once by tag cache assocPendingRequests
					//	Amazing!!!
					//
					this.sendRequest( oInstance, oNextSocket, nPackType, sEvent, oJsonBody, bReroute, oRh );
				}
			);

			//
			//	cache socket handle to this.m_oAssocReroutedConnectionsByTag
			//
			if ( ! sTag in this.m_oAssocReroutedConnectionsByTag )
			{
				this.m_oAssocReroutedConnectionsByTag[ sTag ] = [ oSocket ];
			}
			this.m_oAssocReroutedConnectionsByTag[ sTag ].push( oNextSocket );
		};
	}

	/**
	 *	create reroute timer
	 *
	 *	@private
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackType
	 *	@param	{string}	sEvent
	 *	@param	{function}	pfnRerouteExecutor
	 *	@return {*}
	 */
	_createRerouteTimer( oSocket, nPackType, sEvent, pfnRerouteExecutor )
	{
		if ( ! _p2pUtils.isFunction( pfnRerouteExecutor ) )
		{
			return null;
		}

		return setTimeout
		(
			() =>
			{
				//
				//	trigger ReRoute
				//	callback handler while the request is TIMEOUT
				//
				_p2pLog.error( `request ${ sEvent }, send to ${ oSocket.peer } was overtime.` );
				pfnRerouteExecutor.apply( this, arguments );
			},
			_p2pConstants.STALLED_TIMEOUT
		)
	}

	/**
	 *	create cancel timer
	 *
	 * 	@private
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackType
	 *	@param	{string}	sEvent
	 *	@param	{string}	sTag
	 *	@param	{object}	oJsonContent
	 *	@return {number | Object}
	 */
	_createCancelTimer( oSocket, nPackType, sEvent, sTag, oJsonContent )
	{
		return setTimeout
		(
			() =>
			{
				_p2pLog.error( `request ${ sEvent }, response from ${ oSocket.peer } was overtime.` );

				//
				//	delete all overtime requests/connections in pending requests list
				//
				oSocket.assocPendingRequests[ sTag ].responseHandlers.forEach
				(
					oRh =>
					{
						//	rh	is pfnResponseHandler
						oRh.handler.call
						(
							oRh.instance,
							oSocket,
							oJsonContent,
							{ error : "[internal] response timeout" }
						);
					}
				);
				delete oSocket.assocPendingRequests[ sTag ];
			},
			_p2pConstants.RESPONSE_TIMEOUT
		);
	}



	/**
	 *	check if the two sockets are the same
	 *
	 * 	@private
	 *	@param	{object}	oSocket
	 *	@param	{object}	oNextSocket
	 *	@param	{string}	sTag
	 *	@return	{boolean}
	 */
	_isSameSocket( oSocket, oNextSocket, sTag )
	{
		if ( ! oSocket || ! oNextSocket )
		{
			return false;
		}
		if ( ! _p2pUtils.isString( sTag ) || 0 === sTag.length )
		{
			return false;
		}

		return ( oNextSocket === oSocket ||
			(
				sTag in this.m_oAssocReroutedConnectionsByTag &&
				this.m_oAssocReroutedConnectionsByTag[ sTag ].includes( oNextSocket )
			) );
	}
}




/**
 *	@exports
 */
module.exports	= CP2pRequest;
