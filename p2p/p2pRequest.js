/*jslint node: true */
"use strict";

const EventEmitter		= require( 'events' );

const _				= require( 'lodash' );

const CP2pDriver		= require( './driver/p2pDriver.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );
const _object_hash		= require( '../object_hash.js' );




/**
 *	P2p Request
 *	@class	CP2pRequest
 *	@module	CP2pRequest
 */
class CP2pRequest
{
	constructor()
	{
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
	 *	if a 2nd identical request is issued before we receive a response to the 1st request, then:
	 *	1. its pfnResponseHandler will be called too but no second request will be sent to the wire
	 *	2. bReroute flag must be the same
	 *
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackType
	 *	@param	{string}	sCommand
	 *	@param	{object}	oJsonBody
	 *	@param	{boolean}	bReroute
	 *	@param	{function}	pfnResponseHandler( ws, request, response ){ ... }
	 */
	sendRequest( oSocket, nPackType, sCommand, oJsonBody, bReroute, pfnResponseHandler )
	{
		//
		//	oJsonBody for 'catchup'
		// 	{
		// 		witnesses	: arrWitnesses,		//	12 addresses of witnesses
		// 		last_stable_mci	: last_stable_mci,	//	stable last mci
		// 		last_known_mci	: last_known_mci	//	known last mci
		// 	};
		//
		let oJsonRequest;
		let oJsonContent;
		let sTag;
		let pfnReroute;
		let nRerouteTimer;
		let nCancelTimer;

		if ( ! oSocket )
		{
			this.m_cP2pLog.error( `call sendRequest with invalid oSocket` );
			return false;
		}
		if ( ! this.m_cP2pPackage.isValidPackType( nPackType ) )
		{
			this.m_cP2pLog.error( `call sendRequest with invalid nPackType` );
			return false;
		}
		if ( ! _p2pUtils.isString( sCommand ) || 0 === sCommand.length )
		{
			this.m_cP2pLog.error( `call sendRequest with invalid sCommand` );
			return false;
		}
		if ( ! _p2pUtils.isFunction( pfnResponseHandler ) )
		{
			this.m_cP2pLog.error( `call sendRequest with invalid pfnResponseHandler` );
			return false;
		}

		//
		//	package format
		//
		oJsonRequest =
			{
				version	: String( _p2pConstants.version ),
				alt	: String( _p2pConstants.alt ),
				type	: nPackType,
				command	: sCommand,
				body	: oJsonBody ? oJsonBody : null
			};

		//
		//	sTag like : w35dxwqyQ2CzqHkOG5q+gwagPtaPweD4LEwzC2RjQNo=
		//
		oJsonContent	= Object.assign( {}, oJsonRequest );
		sTag		= _object_hash.getBase64Hash( oJsonRequest );

		//
		//	will not send identical
		//	ignore duplicate requests while still waiting for response from the same peer
		//
		if ( oSocket.assocPendingRequests[ sTag ] )
		{
			oSocket.assocPendingRequests[ sTag ].responseHandlers.push( pfnResponseHandler );
			this.m_cP2pLog.error
			(
				`already sent a ${ sCommand } request to ${ oSocket.peer }, 
				will add one more response handler rather than sending a duplicate request to the wire`
			);
			return false;
		}

		//
		//	...
		//
		oJsonContent.tag	= sTag;

		//
		//	* re-route only for clients
		//
		if ( CP2pDriver.DRIVER_TYPE_CLIENT !== this.m_cDriver.sDriverType )
		{
			bReroute	= false;
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
			? this._createRerouteExecutor( oSocket, nPackType, sCommand, oJsonBody, bReroute, sTag )
			: null;

		//
		//	timeout
		//	in sending request
		//
		nRerouteTimer	= bReroute
			? this._createRerouteTimer( oSocket, nPackType, sCommand, pfnReroute )
			: null;

		//
		//	timeout
		//	in receiving response
		//
		nCancelTimer	= bReroute
			? null
			: this._createCancelTimer( oSocket, nPackType, sCommand, sTag, oJsonContent );

		//
		//	build pending request list
		//
		oSocket.assocPendingRequests[ sTag ] =
			{
				request			: oJsonContent,
				responseHandlers	: [ pfnResponseHandler ],
				reroute			: pfnReroute,
				reroute_timer		: nRerouteTimer,
				cancel_timer		: nCancelTimer
			};

		//
		//	send message by socket handle
		//
		this.sendMessage( oSocket, 'request', oJsonContent );
	}


	/**
	 *	handle request message
	 *	received message in client/server with PackType .PACKTYPE_REQUEST
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{string}	sCommand
	 * 	@param	{string}	sBody
	 */
	handleRequest( oSocket, sCommand, sBody )
	{
	}


	/**
	 *	handle response message
	 *	received message in client/server with PackType .PACKTYPE_RESPONSE
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{string}	sTag
	 * 	@param	{string}	sResponse
	 */
	handleResponse( oSocket, sTag, sResponse )
	{
		//
		//	execute all pending requests
		//
		this._executePendingRequestsByTag( oSocket, sTag, sResponse );

		//
		//	clear cache
		//
		this._clearCacheReroutedConnectionsByTag( sTag );
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
		if ( oSocket.hasOwnProperty( assocPendingRequests ) &&
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
				oPendingRequest.responseHandlers.forEach
				(
					pfnResponseHandler =>
					{
						process.nextTick( function()
						{
							pfnResponseHandler( oSocket, oPendingRequest.request, sResponse );
						});
					}
				);

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
				this.m_cP2pLog.error( `handleResponse with no request by tag ${ sTag }` );
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
	 *	@param	{object}	oSocket
	 *	@param 	{number}	nPackType
	 *	@param	{string}	sCommand
	 *	@param	{object}	oJsonBody
	 *	@param	{boolean}	bReroute
	 *	@param	{string}	sTag
	 *	@return {Function}
	 */
	_createRerouteExecutor( oSocket, nPackType, sCommand, oJsonBody, bReroute, sTag )
	{
		return () =>
		{
			let oNextSocket;

			this.m_cP2pLog.info( `will try to reroute a ${ sCommand } request stalled at ${ oSocket.peer }` );

			if ( ! sTag in oSocket.assocPendingRequests )
			{
				return this.m_cP2pLog.error( `will not reroute - the request was already handled by another peer` );
			}

			//
			//	try to find the next server peer
			//
			oNextSocket	= this.m_cDriver.findNextServerSync( oSocket );
			if ( ! oNextSocket )
			{
				return this.m_cP2pLog.error( `will not reroute - can not find another peer` );
			}

			//	the callback may be called much later if .findNextServerSync has to wait for driver
			if ( ! sTag in oSocket.assocPendingRequests )
			{
				return this.m_cP2pLog.error( `will not reroute after findNextPeer - the request was already handled by another peer` );
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
				// 		console.log( 'got new driver, retrying reroute ' + sCommand );
				// 		pfnReroute();
				// 	}
				// );
				return this.m_cP2pLog.error( `will not reroute ${ sCommand } to the same peer, will rather wait for a new connection` );
			}

			//
			//	RESEND Request, i.e. re-route
			//	SEND REQUEST AGAIN FOR EVERY responseHandlers
			//
			this.m_cP2pLog.info( `rerouting ${ sCommand } from ${ oSocket.peer } to ${ oNextSocket.peer }` );
			oSocket.assocPendingRequests[ sTag ].bRerouted = true;
			oSocket.assocPendingRequests[ sTag ].responseHandlers.forEach
			(
				rh =>
				{
					//
					//	rh	is pfnResponseHandler
					//	this will send only once by tag cache assocPendingRequests
					//	Amazing!!!
					//
					this.sendRequest( oNextSocket, nPackType, sCommand, oJsonBody, bReroute, rh );
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
	 *	@param	{string}	sCommand
	 *	@param	{function}	pfnRerouteExecutor
	 *	@return {*}
	 */
	_createRerouteTimer( oSocket, nPackType, sCommand, pfnRerouteExecutor )
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
				this.m_cP2pLog.error( `request ${ sCommand }, send to ${ oSocket.peer } was overtime.` );
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
	 *	@param	{string}	sCommand
	 *	@param	{string}	sTag
	 *	@param	{object}	oJsonContent
	 *	@return {number | Object}
	 */
	_createCancelTimer( oSocket, nPackType, sCommand, sTag, oJsonContent )
	{
		return setTimeout
		(
			() =>
			{
				this.m_cP2pLog.error( `request ${ sCommand }, response from ${ oSocket.peer } was overtime.` );

				//
				//	delete all overtime requests/connections in pending requests list
				//
				oSocket.assocPendingRequests[ sTag ].responseHandlers.forEach
				(
					rh =>
					{
						//	rh	is pfnResponseHandler
						rh( oSocket, oJsonContent, { error : "[internal] response timeout" } );
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
