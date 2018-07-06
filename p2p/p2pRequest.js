/*jslint node: true */
"use strict";

let _				= require( 'lodash' );
let _object_hash		= require( '../object_hash.js' );

let _event_bus			= require( './p2pEvents.js' );
let _network_consts		= require( './p2pConstants.js' );
let _network_message		= require( './p2pMessage.js' );
let _network_peer		= require( './p2pPeer.js' );


let m_oAssocReroutedConnectionsByTag		= {};






/**
 *	if a 2nd identical request is issued before we receive a response to the 1st request, then:
 *	1. its pfnResponseHandler will be called too but no second request will be sent to the wire
 *	2. bReRoutable flag must be the same
 *
 *	@param ws
 *	@param command
 *	@param params
 *	@param bReRoutable
 *	@param pfnResponseHandler
 */
function sendRequest( ws, command, params, bReRoutable, pfnResponseHandler )
{
	//
	//	params for 'catchup'
	// 	{
	// 		witnesses	: arrWitnesses,		//	12 addresses of witnesses
	// 		last_stable_mci	: last_stable_mci,	//	stable last mci
	// 		last_known_mci	: last_known_mci	//	known last mci
	// 	};
	//
	let request;
	let content;
	let tag;
	let pfnReroute;
	let nRerouteTimer;
	let nCancelTimer;

	//	...
	request = { command : command };

	if ( params )
	{
		request.params = params;
	}

	//
	//	tag like : w35dxwqyQ2CzqHkOG5q+gwagPtaPweD4LEwzC2RjQNo=
	//
	content	= _.clone( request );
	tag	= _object_hash.getBase64Hash( request );

	//
	//	if (ws.assocPendingRequests[tag]) // ignore duplicate requests while still waiting for response from the same peer
	//	return console.log("will not send identical "+command+" request");
	//
	if ( ws.assocPendingRequests[ tag ] )
	{
		//	...
		ws.assocPendingRequests[ tag ].responseHandlers.push( pfnResponseHandler );

		//	...
		return console.log
		(
			'already sent a ' + command + ' request to ' + ws.peer + ', will add one more response handler rather than sending a duplicate request to the wire'
		);
	}


	//
	//	...
	//
	content.tag	= tag;

	//
	//	after _network_consts.STALLED_TIMEOUT, reroute the request to another peer
	//	it'll work correctly even if the current peer is already disconnected when the timeout fires
	//
	//	THIS function will be called when the request is timeout
	//
	pfnReroute = bReRoutable ? function()
	{
		console.log( 'will try to reroute a ' + command + ' request stalled at ' + ws.peer );

		if ( ! ws.assocPendingRequests[ tag ] )
		{
			return console.log( 'will not reroute - the request was already handled by another peer' );
		}

		//	...
		ws.assocPendingRequests[ tag ].bRerouted	= true;
		_network_peer.findNextPeer
		(
			ws,
			function( next_ws )
			{
				//
				//	the callback may be called much later if _network_peer.findNextPeer has to wait for connection
				//
				if ( ! ws.assocPendingRequests[ tag ] )
				{
					return console.log( 'will not reroute after findNextPeer - the request was already handled by another peer' );
				}

				if ( next_ws === ws ||
					m_oAssocReroutedConnectionsByTag[ tag ] && m_oAssocReroutedConnectionsByTag[ tag ].indexOf( next_ws ) >= 0 )
				{
					console.log( 'will not reroute ' + command + ' to the same peer, will rather wait for a new connection' );
					_event_bus.once
					(
						'connected_to_source',
						function()
						{
							//	try again
							console.log( 'got new connection, retrying reroute ' + command );
							pfnReroute();
						}
					);
					return;
				}

				//
				//	SEND REQUEST AGAIN FOR EVERY responseHandlers
				//
				console.log( 'rerouting ' + command + ' from ' + ws.peer + ' to ' + next_ws.peer );
				ws.assocPendingRequests[ tag ].responseHandlers.forEach
				(
					function( rh )
					{
						sendRequest( next_ws, command, params, bReRoutable, rh );
					}
				);

				//
				//	push to cache
				//
				if ( ! m_oAssocReroutedConnectionsByTag[ tag ] )
				{
					m_oAssocReroutedConnectionsByTag[ tag ] = [ ws ];
				}
				m_oAssocReroutedConnectionsByTag[ tag ].push( next_ws );
			}
		);
	}
	: null;

	//
	//	timeout
	//	in sending request
	//
	nRerouteTimer	= bReRoutable
		? setTimeout
		(
			//	callback handler while the request is TIMEOUT
			function ()
			{
				console.log( '# network::sendRequest request ' + command + ', send to ' + ws.peer + ' was overtime.' );
				pfnReroute.apply( this, arguments );
			},
			_network_consts.STALLED_TIMEOUT
		)
		: null;

	//
	//	timeout
	//	in receiving response
	//
	nCancelTimer	= bReRoutable
		? null
		: setTimeout
		(
			function()
			{
				console.log( '# network::sendRequest request ' + command + ', response from ' + ws.peer + ' was overtime.' );

				//
				//	delete all overtime requests/connections in pending requests list
				//
				ws.assocPendingRequests[ tag ].responseHandlers.forEach
				(
					function( rh )
					{
						rh( ws, request, { error: "[internal] response timeout" } );
					}
				);
				delete ws.assocPendingRequests[ tag ];
			},
			_network_consts.RESPONSE_TIMEOUT
		);

	//
	//	build pending request list
	//
	ws.assocPendingRequests[ tag ] =
	{
		request			: request,
		responseHandlers	: [ pfnResponseHandler ],
		reroute			: pfnReroute,
		reroute_timer		: nRerouteTimer,
		cancel_timer		: nCancelTimer
	};

	//
	//	...
	//
	_network_message.sendMessage( ws, 'request', content );
}

function clearRequest( tag )
{
	//
	//	if the request was rerouted, cancel all other pending requests
	//
	if ( m_oAssocReroutedConnectionsByTag[ tag ] )
	{
		m_oAssocReroutedConnectionsByTag[ tag ].forEach
		(
			function( client )
			{
				if ( client.assocPendingRequests[ tag ] )
				{
					clearTimeout( client.assocPendingRequests[ tag ].reroute_timer );
					clearTimeout( client.assocPendingRequests[ tag ].cancel_timer );
					delete client.assocPendingRequests[ tag ];
				}
			}
		);
		delete m_oAssocReroutedConnectionsByTag[ tag ];
	}
}





/**
 *	exports
 */
exports.sendRequest			= sendRequest;
exports.clearRequest			= clearRequest;
