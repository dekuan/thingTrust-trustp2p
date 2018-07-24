/*jslint node: true */
"use strict";

let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
let socks			= process.browser ? null : require( 'socks' + '' );

let _conf			= require( '../conf.js' );

let _async			= require( 'async' );
let _db				= require( '../db.js' );
let _breadcrumbs		= require( '../breadcrumbs.js' );

let _event_bus			= require( './p2pEvents' );
let _network_message		= require( './p2pMessage.js' );
let _network_request		= require( './p2pRequest.js' );


let m_oWss;
let m_arrOutboundPeers				= [];		//	all peers server connected to

let m_oAssocConnectingOutboundWebSockets	= {};
let m_oAssocKnownPeers				= {};

let m_pfnOnWebSocketMessage			= null;
let m_pfnOnWebSocketClosed			= null;
let m_pfnSubscribe				= null;





//////////////////////////////////////////////////////////////////////
//	peers
//////////////////////////////////////////////////////////////////////



function setAddressOnWebSocketMessage( pfnAddress )
{
	m_pfnOnWebSocketMessage = pfnAddress;
}

function setAddressOnWebSocketClosed( pfnAddress )
{
	m_pfnOnWebSocketClosed = pfnAddress;
}

function setAddressSubscribe( pfnAddress )
{
	m_pfnSubscribe = pfnAddress;
}




/**
 *	check and add peers
 */
function checkIfHaveEnoughOutboundPeersAndAdd()
{
	return true;

	let arrOutboundPeerUrls;

	//	...
	arrOutboundPeerUrls = m_arrOutboundPeers.map( function( ws ) { return ws.peer; } );

	//
	//	select peers good_joints > 0 and ...
	//
	_db.query
	(
		"SELECT peer FROM peers JOIN peer_hosts USING( peer_host ) \
		WHERE count_new_good_joints > 0 \
			AND count_invalid_joints / count_new_good_joints < ? \
			AND peer IN( ? )",
		[
			_conf.MAX_TOLERATED_INVALID_RATIO,
			( arrOutboundPeerUrls.length > 0 ) ? arrOutboundPeerUrls : null
		],
		function( rows )
		{
			let count_good_peers;
			let arrGoodPeerUrls;
			let i;
			let ws;

			//	...
			count_good_peers = rows.length;
			if ( count_good_peers >= _conf.MIN_COUNT_GOOD_PEERS )
			{
				//	larger then limitation
				return;
			}
			if ( count_good_peers === 0 )
			{
				//	nobody trusted enough to ask for new peers, can't do anything
				return;
			}

			//
			//	good peers
			//
			arrGoodPeerUrls	= rows.map( function( row ) { return row.peer; } );

			for ( i = 0; i < m_arrOutboundPeers.length; i++ )
			{
				ws = m_arrOutboundPeers[ i ];
				if ( arrGoodPeerUrls.indexOf( ws.peer ) !== -1 )
				{
					//
					//	peer was not found in m_arrOutboundPeers
					//
					//	* try to send request to get peers
					//
					console.log( "****** peer was not found in m_arrOutboundPeers, * try to send request to get peers" );
					_requestPeers( ws );
				}
			}
		}
	);
}


/**
 *	send request for getting peers
 */
function _requestPeers( ws )
{
	return ws;

	_network_request.sendRequest
	(
		ws,
		'get_peers',
		null,
		false,
		function( ws, request, arrPeerUrls )
		{
			let arrQueries;
			let i;
			let url;
			let regexp;
			let host;

			if ( arrPeerUrls.error )
			{
				return console.log( 'get_peers failed: ' + arrPeerUrls.error );
			}
			if ( ! Array.isArray( arrPeerUrls ) )
			{
				return _network_message.sendError( ws, "peer urls is not an array" );
			}

			//	...
			arrQueries = [];
			for ( i = 0; i < arrPeerUrls.length; i++ )
			{
				url	= arrPeerUrls[ i ];

				if ( _conf.myUrl && _conf.myUrl.toLowerCase() === url.toLowerCase() )
				{
					continue;
				}

				//	...
				regexp	= ( _conf.WS_PROTOCOL === 'wss://' ) ? /^wss:\/\// : /^wss?:\/\//;
				if ( ! url.match( regexp ) )
				{
					console.log( 'ignoring new peer ' + url + ' because of incompatible ws protocol' );
					continue;
				}

				host	= getHostByPeer( url );
				_db.addQuery
				(
					arrQueries,
					"INSERT " + _db.getIgnore() + " INTO peer_hosts (peer_host) VALUES (?)",
					[ host ]
				);
				_db.addQuery
				(
					arrQueries,
					"INSERT " + _db.getIgnore() + " INTO peers (peer_host, peer, learnt_from_peer_host) VALUES(?,?,?)",
					[ host, url, ws.host ]
				);
			}

			//	...
			_async.series( arrQueries );
		}
	);
}




function findNextPeer( ws, handleNextPeer )
{
	tryFindNextPeer
	(
		ws,
		function( next_ws )
		{
			let peer;

			if ( next_ws )
			{
				return handleNextPeer( next_ws );
			}

			//	...
			peer	= ws ? ws.peer : '[none]';
			console.log( 'findNextPeer after ' + peer + ' found no appropriate peer, will wait for a new driver' );

			//	...
			_event_bus.once
			(
				'connected_to_source',
				function( new_ws )
				{
					console.log( 'got new driver, findNextPeer retrying findNextPeer after ' + peer );
					findNextPeer( ws, handleNextPeer );
				}
			);
		}
	);
}


/**
 *	always pick the next peer as target to connect to
 *
 *	@param ws
 *	@param handleNextPeer
 */
function tryFindNextPeer( ws, handleNextPeer )
{
	let arrOutboundSources;
	let len;
	let peer_index;
	let next_peer_index;

	//
	//	bSource == true
	//	means:
	//		I connected to source after sending a 'subscribe' command to hub/server
	//
	arrOutboundSources	= m_arrOutboundPeers.filter( function( outbound_ws ) { return outbound_ws.bSource; } );
	len			= arrOutboundSources.length;

	if ( len > 0 )
	{
		//
		//	there are active outbound connections
		//

		//
		//	-1 if it is already disconnected by now,
		//		or if it is inbound peer,
		//		or if it is null
		//
		peer_index	= arrOutboundSources.indexOf( ws );
		next_peer_index	= ( peer_index === -1 ) ? getRandomInt( 0, len - 1 ) : ( ( peer_index + 1 ) % len );
		handleNextPeer( arrOutboundSources[ next_peer_index ] );
	}
	else
	{
		findRandomInboundPeer( handleNextPeer );
	}
}

function getRandomInt( min, max )
{
	return Math.floor( Math.random() * ( max + 1 - min ) ) + min;
}

function findRandomInboundPeer( handleInboundPeer )
{
	let arrInboundSources;
	let arrInboundHosts;

	//	...
	arrInboundSources	= m_oWss.clients.filter( function( inbound_ws ) { return inbound_ws.bSource; } );
	if ( arrInboundSources.length === 0 )
	{
		return handleInboundPeer( null );
	}

	//	...
	arrInboundHosts	= arrInboundSources.map( function( ws ) { return ws.host; } );

	//
	//	filter only those inbound peers that are reversible
	//
	_db.query
	(
		"SELECT peer_host \
		FROM peer_host_urls JOIN peer_hosts USING( peer_host ) \
		WHERE is_active = 1 AND peer_host IN( ? ) \
			AND ( \
				count_invalid_joints / count_new_good_joints < ? \
				OR \
				count_new_good_joints = 0 AND count_nonserial_joints = 0 AND count_invalid_joints = 0 \
			) \
		ORDER BY ( count_new_good_joints = 0 ), " + _db.getRandom() + " LIMIT 1",
		[
			arrInboundHosts,
			_conf.MAX_TOLERATED_INVALID_RATIO
		],
		function( rows )
		{
			let host;
			let ws;

			//	...
			console.log( rows.length + " inbound peers" );

			if ( rows.length === 0 )
			{
				return handleInboundPeer( null );
			}

			//	...
			host	= rows[ 0 ].peer_host;
			console.log( "selected inbound peer " + host );

			ws = arrInboundSources.filter
			(
				function( ws )
				{
					return ( ws.host === host );
				}
			)[ 0 ];

			if ( ! ws )
			{
				throw Error( "inbound ws not found" );
			}

			//	...
			handleInboundPeer( ws );
		}
	);
}


/**
 *	@public
 *
 *	@param url
 *	@param onOpen
 */
function connectToPeer( url, onOpen )
{
	let options;
	let ws;

	//
	//	...
	//
	addPeer( url );

	//	...
	options	= {};
	if ( socks && _conf.socksHost && _conf.socksPort )
	{
		options.agent	= new socks.Agent
		(
			{
				proxy :
				{
					ipaddress	: _conf.socksHost,
					port		: _conf.socksPort,
					type		: 5
				}
			},
			/^wss/i.test( url )
		);

		//	...
		console.log( 'Using proxy: ' + _conf.socksHost + ':' + _conf.socksPort );
	}

	//	...
	ws = options.agent ? new WebSocket( url, options ) : new WebSocket( url );
	m_oAssocConnectingOutboundWebSockets[ url ] = ws;

	//
	//	delete from m_oAssocConnectingOutboundWebSockets after 5 seconds
	//
	setTimeout
	(
		function()
		{
			if ( m_oAssocConnectingOutboundWebSockets[ url ] )
			{
				console.log( 'abandoning driver to ' + url + ' due to timeout' );
				delete m_oAssocConnectingOutboundWebSockets[ url ];
				m_oAssocConnectingOutboundWebSockets[ url ]	= null;

				//
				//	after this,
				//	new driver attempts will be allowed to the wire,
				// 	but this one can still succeed.
				//
				//	See the check for duplicates below.
				//
			}
		},
		5000
	);

	//
	//	avoid warning
	//
	ws.setMaxListeners( 20 );
	ws.once
	(
		'open',
		function onWsOpen()
		{
			let oAnotherWsToSamePeer;

			//	...
			_breadcrumbs.add( 'connected to ' + url );
			delete m_oAssocConnectingOutboundWebSockets[ url ];
			m_oAssocConnectingOutboundWebSockets[ url ]	= null;

			//	...
			ws.assocPendingRequests		= {};
			ws.assocInPreparingResponse	= {};

			if ( ! ws.url )
			{
				throw Error( "no url on ws" );
			}

			//	browser implementatin of Websocket might add "/"
			if ( ws.url !== url && ws.url !== url + "/" )
			{
				throw Error( "url is different: " + ws.url );
			}

			//	...
			oAnotherWsToSamePeer	= getOutboundPeerWsByUrl( url );
			if ( oAnotherWsToSamePeer )
			{
				//
				//	duplicate driver.
				//	May happen if we abondoned a driver attempt after timeout but it still succeeded while we opened another driver
				//
				console.log( 'already have a driver to ' + url + ', will keep the old one and close the duplicate' );
				ws.close( 1000, 'duplicate driver' );

				if ( onOpen )
				{
					onOpen( null, oAnotherWsToSamePeer );
				}

				return;
			}

			//	...
			ws.peer		= url;				//	peer
			ws.host		= getHostByPeer( ws.peer );	//	host
			ws.bOutbound	= true;				//	identify this driver as outbound driver
			ws.last_ts	= Date.now();			//	record the last timestamp while we connected to this peer

			console.log( 'connected to ' + url + ", host " + ws.host );

			//
			//	*
			//	save new peer driver to m_arrOutboundPeers
			//
			m_arrOutboundPeers.push( ws );

			//
			//	send our version information to outbound peer
			//
			_network_message.sendVersion( ws );

			//
			//	I can listen too, this is my url to connect to me
			//
			if ( _conf.myUrl )
			{
				_network_message.sendTalk( ws, 'my_url', _conf.myUrl );
			}

			if ( ! _conf.bLight )
			{
				if ( 'function' === typeof m_pfnSubscribe )
				{
					m_pfnSubscribe.call( this, ws );
				}
			}

			//
			//	callback by function onOpen
			//
			if ( onOpen )
			{
				onOpen( null, ws );
			}

			//
			//	broadcast the news that we have connected to the peer.
			//
			_event_bus.emit( 'connected', ws );
			_event_bus.emit( 'open-' + url );
		}
	);

	ws.on
	(
		'close',
		function onWsClose()
		{
			let i;

			//	...
			i	= m_arrOutboundPeers.indexOf( ws );
			console.log( 'close event, removing ' + i + ': ' + url );

			if ( i !== -1 )
			{
				m_arrOutboundPeers.splice( i, 1 );
			}

			//	...
			if ( 'function' === typeof m_pfnOnWebSocketClosed )
			{
				m_pfnOnWebSocketClosed.call( this, ws );
			}

			if ( options.agent &&
				options.agent.destroy )
			{
				options.agent.destroy();
			}
		}
	);

	ws.on
	(
		'error',
		function onWsError( e )
		{
			let err;

			//	...
			delete m_oAssocConnectingOutboundWebSockets[ url ];
			m_oAssocConnectingOutboundWebSockets[ url ]	= null;
			console.log( "error from server " + url + ": " + e );

			//	...
			err	= e.toString();
			//	! ws.bOutbound means not connected yet. This is to distinguish driver errors from later errors that occur on open driver

			//
			//	this is not an outbound driver
			//
			if ( ! ws.bOutbound )
			{
				if ( onOpen )
				{
					//	execute callback by error
					onOpen( err );
				}
				else
				{
					//	broadcast this error
					_event_bus.emit( 'open-' + url, err );
				}
			}
		}
	);

	//
	//	set callback for receiving messages from this peer
	//
	if ( 'function' === typeof m_pfnOnWebSocketMessage )
	{
		ws.on( 'message', m_pfnOnWebSocketMessage );
	}

	//	...
	console.log( 'connectToPeer done' );
}


/**
 *	try to add outbound peers
 */
function addOutboundPeers( multiplier )
{
	let order_by;
	let arrOutboundPeerUrls;
	let arrInboundHosts;
	let max_new_outbound_peers;

	if ( ! multiplier )
	{
		multiplier = 1;
	}
	if ( multiplier >= 32 )
	{
		//	limit recursion
		return;
	}

	//
	//	don't stick to old peers with most accumulated good joints
	//
	order_by		= ( multiplier <= 4 ) ? "count_new_good_joints DESC" : _db.getRandom();
	arrOutboundPeerUrls	= m_arrOutboundPeers.map( function( ws ) { return ws.peer; } );
	arrInboundHosts		= m_oWss.clients.map( function( ws ) { return ws.host; } );

	//	having too many connections being opened creates odd delays in _db functions
	max_new_outbound_peers	= Math.min( _conf.MAX_OUTBOUND_CONNECTIONS - arrOutboundPeerUrls.length, 5 );
	if ( max_new_outbound_peers <= 0 )
	{
		return;
	}

	//
	//	TODO
	//	LONG SQL, BUT FAST, CAUSE FEW DATA
	//
	//	Questions:
	//	1, What's the different among [peers], [peer_hosts], [peer_host_urls] ?
	//	2, INVALID_RATIO = count_invalid_joints / count_new_good_joints, if 0/0 ?
	//
	_db.query
	(
		"SELECT peer \
		FROM peers \
		JOIN peer_hosts USING(peer_host) \
		LEFT JOIN peer_host_urls ON peer=url AND is_active=1 \
		WHERE ( \
			count_invalid_joints / count_new_good_joints < ? \
			OR count_new_good_joints = 0 AND count_nonserial_joints = 0 AND count_invalid_joints = 0 \
		      ) \
			" + ( ( arrOutboundPeerUrls.length > 0 ) ? " AND peer NOT IN(" + _db.escape( arrOutboundPeerUrls ) + ") " : "" ) + " \
			" + ( ( arrInboundHosts.length > 0 ) ? " AND (peer_host_urls.peer_host IS NULL OR peer_host_urls.peer_host NOT IN(" + _db.escape( arrInboundHosts ) + ")) " : "" ) + " \
			AND is_self=0 \
		ORDER BY " + order_by + " LIMIT ?",
		[
			_conf.MAX_TOLERATED_INVALID_RATIO * multiplier,
			max_new_outbound_peers
		],
		function( rows )
		{
			let i;

			//
			//	TODO
			//	find outbound peer or connect ?
			//
			for ( i = 0; i < rows.length; i ++ )
			{
				m_oAssocKnownPeers[ rows[ i ].peer ] = true;
				findOutboundPeerOrConnect( rows[ i ].peer );
			}

			//	if no outbound connections at all, get less strict
			if ( arrOutboundPeerUrls.length === 0 && rows.length === 0 )
			{
				addOutboundPeers( multiplier * 2 );
			}
		}
	);
}

function getHostByPeer( peer )
{
	let matches;

	//	...
	matches	= peer.match( /^wss?:\/\/(.*)$/i );
	if ( matches )
	{
		peer = matches[ 1 ];
	}

	matches	= peer.match( /^(.*?)[:\/]/ );
	return matches ? matches[ 1 ] : peer;
}

function addPeerHost( host, onDone )
{
	_db.query
	(
		"INSERT " + _db.getIgnore() + " INTO peer_hosts ( peer_host ) VALUES ( ? )",
		[
			host
		],
		function()
		{
			if ( onDone )
			{
				onDone();
			}
		}
	);
}


/**
 *	@public
 *	save peer and it's host to database
 *
 *	@param peer
 */
function addPeer( peer )
{
	let host;

	if ( m_oAssocKnownPeers[ peer ] )
	{
		//	already added before
		return;
	}

	//	...
	m_oAssocKnownPeers[ peer ] = true;
	host = getHostByPeer( peer );

	//
	//	1, Add host to [peer_hosts]
	//	2, Add host and peer to [peers]
	//
	addPeerHost
	(
		host,
		function()
		{
			console.log( "will insert peer " + peer );
			_db.query
			(
				"INSERT " + _db.getIgnore() + " INTO peers ( peer_host, peer ) VALUES ( ?, ? )",
				[
					host,
					peer
				]
			);
		}
	);
}

function getOutboundPeerWsByUrl( url )
{
	let i;

	//	...
	console.log( "outbound peers: " + m_arrOutboundPeers.map( function( o ){ return o.peer; } ).join( ", " ) );

	for ( i = 0; i < m_arrOutboundPeers.length; i ++ )
	{
		if ( m_arrOutboundPeers[ i ].peer === url )
		{
			//	...
			return m_arrOutboundPeers[ i ];
		}
	}

	return null;
}

function getPeerWebSocket( peer )
{
	let i;

	for ( i = 0; i < m_arrOutboundPeers.length; i ++ )
	{
		if ( m_arrOutboundPeers[ i ].peer === peer )
		{
			//	...
			return m_arrOutboundPeers[ i ];
		}
	}

	for ( i = 0; i < m_oWss.clients.length; i ++ )
	{
		if ( m_oWss.clients[ i ].peer === peer )
		{
			//	...
			return m_oWss.clients[ i ];
		}
	}

	return null;
}


/**
 *
 *	@param url
 *	@param onOpen
 *	@returns {*}
 */
function findOutboundPeerOrConnect( url, onOpen )
{
	let ws;

	if ( ! url )
	{
		throw Error( 'no url' );
	}
	if ( ! onOpen )
	{
		onOpen = function(){};
	}

	//	...
	url	= url.toLowerCase();
	ws	= getOutboundPeerWsByUrl( url );
	if ( ws )
	{
		return onOpen( null, ws );
	}

	//
	//	check if we are already connecting to the peer before
	//	use m_oAssocConnectingOutboundWebSockets to avoid duplicated connections
	//	while we sent the driver request to one outbound peer and were waiting for response.
	//
	ws = m_oAssocConnectingOutboundWebSockets[ url ];
	if ( ws )
	{
		//	add second event handler
		_breadcrumbs.add( 'already connecting to ' + url );
		return _event_bus.once
		(
			'open-' + url,
			function secondOnOpen( err )
			{
				console.log( 'second open ' + url + ', err=' + err );

				if ( err )
				{
					return onOpen( err );
				}

				if ( ws.readyState === ws.OPEN )
				{
					onOpen( null, ws );
				}
				else
				{
					//
					//	can happen
					//	e.g. if the ws was abandoned but later succeeded, we opened another driver in the meantime,
					//	and had oAnotherWsToSamePeer on the first driver
					//
					console.log( 'in second onOpen, websocket already closed' );
					onOpen( '[internal] websocket already closed' );
				}
			}
		);
	}

	console.log( "will connect to " + url );

	//
	//	...
	//
	connectToPeer( url, onOpen );
}

function purgePeerEvents()
{
	if ( _conf.storage !== 'sqlite' )
	{
		return;
	}

	console.log( 'will purge peer events' );
	_db.query
	(
		"DELETE FROM peer_events WHERE event_date <= datetime('now', '-3 day')",
		function()
		{
        		console.log("deleted some old peer_events");
		}
	);
}

/**
 *	try to purge dead peers
 */
function purgeDeadPeers()
{
	let arrOutboundPeerUrls;

	if ( _conf.storage !== 'sqlite' )
	{
		//	for SQLite only
		return;
	}

	//	...
	console.log( 'will purge dead peers' );
	arrOutboundPeerUrls = m_arrOutboundPeers.map
	(
		function( ws )
		{
			return ws.peer;
		}
	);

	//
	//	rowid is a 64-bit signed integer
	//	The rowid column is a key that uniquely identifies the row within its table.
	//	The table that has rowid column is called rowid table.
	//
	_db.query
	(
		"SELECT rowid, " + _db.getUnixTimestamp( 'event_date' ) + " AS ts " +
		"FROM peer_events " +
		"ORDER BY rowid DESC " +
		"LIMIT 1",
		function( lrows )
		{
			let last_rowid;
			let last_event_ts;

			if ( lrows.length === 0 )
			{
				return;
			}

			//	the last rowid and event ts
			last_rowid	= lrows[ 0 ].rowid;
			last_event_ts	= lrows[ 0 ].ts;

			//	...
			_db.query
			(
				"SELECT peer, peer_host FROM peers",
				function( rows )
				{
					//	...
					_async.eachSeries
					(
						rows,
						function( row, cb )
						{
							if ( arrOutboundPeerUrls.indexOf( row.peer ) >= 0 )
							{
								return cb();
							}

							_db.query
							(
								"SELECT MAX(rowid) AS max_rowid, " +
								"MAX(" + _db.getUnixTimestamp( 'event_date' ) + ") AS max_event_ts " +
								"FROM peer_events WHERE peer_host=?",
								[
									row.peer_host
								],
								function( mrows )
								{
									let max_rowid;
									let max_event_ts;
									let count_other_events;
									let days_since_last_event;

									//	...
									max_rowid		= mrows[ 0 ].max_rowid || 0;
									max_event_ts		= mrows[ 0 ].max_event_ts || 0;
									count_other_events	= last_rowid - max_rowid;
									days_since_last_event	= ( last_event_ts - max_event_ts ) / 24 / 3600;

									if ( count_other_events < 20000 || days_since_last_event < 7 )
									{
										return cb();
									}

									//	...
									console.log( 'peer ' + row.peer + ' is dead, will delete' );
									_db.query
									(
										"DELETE FROM peers WHERE peer=?",
										[
											row.peer
										],
										function()
										{
											delete m_oAssocKnownPeers[ row.peer ];
											m_oAssocKnownPeers[ row.peer ] = null;
											cb();
										}
									);
								}
							);
						}
					);
				}
			);
		}
	);
}




////////////////////////////////////////////////////////////////////////////////
//	web socket server
////////////////////////////////////////////////////////////////////////////////


/**
 *	initialize web socket server
 */
function initWebSocketServer()
{
	m_oWss	= { clients : [] };
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
function startWebSocketServer( oOptions )
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
	m_oWss	= new WebSocket.Server
	(
		{
			port	: oOptions.port
		}
	);

	//
	//	Event 'driver'
	//		Emitted when the handshake is complete.
	//
	//		- socket	{ WebSocket }
	//		- request	{ http.IncomingMessage }
	//
	//		request is the http GET request sent by the client.
	// 		Useful for parsing authority headers, cookie headers, and other information.
	//
	m_oWss.on
	(
		'connection',
		function( ws )
		{
			//
			//	ws
			//	- the connected Web Socket handle of remote client
			//
			let sRemoteAddress;
			let bStatsCheckUnderWay;

			//	...
			sRemoteAddress = ws.upgradeReq.connection.remoteAddress;
			if ( ! sRemoteAddress )
			{
				console.log( "no ip/sRemoteAddress in accepted driver" );
				ws.terminate();
				return;
			}
			if ( ws.upgradeReq.headers[ 'x-real-ip' ] &&
				( sRemoteAddress === '127.0.0.1' || sRemoteAddress.match( /^192\.168\./ ) ) )
			{
				//
				//	TODO
				//	check for resources IP addresses
				//

				//	we are behind a proxy
				sRemoteAddress = ws.upgradeReq.headers[ 'x-real-ip' ];
			}

			//	...
			ws.peer				= sRemoteAddress + ":" + ws.upgradeReq.connection.remotePort;
			ws.host				= sRemoteAddress;
			ws.assocPendingRequests		= {};
			ws.assocInPreparingResponse	= {};
			ws.bInbound			= true;
			ws.last_ts			= Date.now();

			console.log( 'got driver from ' + ws.peer + ", host " + ws.host );

			if ( m_oWss.clients.length >= _conf.CONNECTION_MAX_INBOUND )
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
				function( rows )
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
						_network_message.sendTalk( ws, 'hub/challenge', ws.challenge );
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
					//	call while the driver was closed
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
	);

	console.log( 'WSS running at port ' + _conf.port );
}





////////////////////////////////////////////////////////////////////////////////
//	utils
////////////////////////////////////////////////////////////////////////////////


function getInboundClients()
{
	return m_oWss.clients;
}

function getOutboundPeers()
{
	return m_arrOutboundPeers;
}

function getAllInboundClientsAndOutboundPeers()
{
	return m_oWss.clients.concat( m_arrOutboundPeers );
}


function getAssocConnectingOutboundWebSockets()
{
	return m_oAssocConnectingOutboundWebSockets;
}








/**
 *	Adding support for browser
 */
if ( process.browser )
{
	//	browser
	console.log( "defining .on() on ws" );

	WebSocket.prototype.on = function( event, callback )
	{
		let self;

		//	...
		self = this;

		if ( event === 'message' )
		{
			this[ 'on' + event ] = function( event )
			{
				callback.call( self, event.data );
			};
			return;
		}
		if ( event !== 'open' )
		{
			this[ 'on' + event ] = callback;
			return;
		}

		//	allow several handlers for 'open' event
		if ( ! this[ 'open_handlers' ] )
		{
			this[ 'open_handlers' ] = [];
		}

		this[ 'open_handlers' ].push( callback );
		this[ 'on' + event ] = function()
		{
			self[ 'open_handlers' ].forEach
			(
				function( cb )
				{
					cb();
				}
			);
		};
	};

	//	...
	WebSocket.prototype.once		= WebSocket.prototype.on;
	WebSocket.prototype.setMaxListeners	= function(){};
}




/**
 *	outbound peers
 */
exports.setAddressOnWebSocketMessage			= setAddressOnWebSocketMessage;
exports.setAddressOnWebSocketClosed			= setAddressOnWebSocketClosed;
exports.setAddressSubscribe				= setAddressSubscribe;

exports.checkIfHaveEnoughOutboundPeersAndAdd		= checkIfHaveEnoughOutboundPeersAndAdd;
exports.findNextPeer					= findNextPeer;
exports.tryFindNextPeer					= tryFindNextPeer;
exports.getRandomInt					= getRandomInt;
exports.findRandomInboundPeer				= findRandomInboundPeer;
exports.connectToPeer					= connectToPeer;
exports.addOutboundPeers				= addOutboundPeers;
exports.getHostByPeer					= getHostByPeer;
exports.addPeerHost					= addPeerHost;
exports.addPeer						= addPeer;
exports.getOutboundPeerWsByUrl				= getOutboundPeerWsByUrl;
exports.getPeerWebSocket				= getPeerWebSocket;
exports.findOutboundPeerOrConnect			= findOutboundPeerOrConnect;
exports.purgePeerEvents					= purgePeerEvents;
exports.purgeDeadPeers					= purgeDeadPeers;


/**
 *	web socket server
 */
exports.initWebSocketServer				= initWebSocketServer;
exports.startWebSocketServer				= startWebSocketServer;


/**
 *	utils
 */
exports.getInboundClients				= getInboundClients;
exports.getOutboundPeers				= getOutboundPeers;
exports.getAllInboundClientsAndOutboundPeers		= getAllInboundClientsAndOutboundPeers;
exports.getAssocConnectingOutboundWebSockets		= getAssocConnectingOutboundWebSockets;

