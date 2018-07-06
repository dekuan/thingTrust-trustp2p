/*jslint node: true */
"use strict";

let _conf			= require( '../conf.js' );

let _network_peer		= require( './p2pPeer.js' );
let _network_heartbeat		= require( './p2pHeartbeat.js' );

let m_nIntervalHeartbeat	= null;



/**
 *	start heart beat
 *	@private
 */
function _startHeartbeat()
{
	if ( null !== m_nIntervalHeartbeat )
	{
		return;
	}

	//
	//	if we have exactly same intervals on two clints,
	//	they might send heartbeats to each other at the same time
	//
	m_nIntervalHeartbeat = setInterval
	(
		_network_heartbeat.heartbeatEmitter,
		3 * 1000 + _network_peer.getRandomInt( 0, 1000 )
	);
}
function _stopHeartbeat()
{
	if ( null !== m_nIntervalHeartbeat )
	{
		clearInterval( m_nIntervalHeartbeat );
		m_nIntervalHeartbeat = null;
	}
}





/**
 *	@public
 */
function closeAllWsConnections()
{
	_network_peer.getOutboundPeers().forEach( function( ws )
	{
		ws.close( 1000, 'Re-connect' );
	});
}


/**
 *	@public
 */
function getConnectionStatus()
{
	return {
		inbound 	: _network_peer.getInboundClients().length,
		outbound	: _network_peer.getInboundClients().length,
		outbound_opened	: _network_peer.getInboundClients().length
	};
}

/**
 *	@public
 *	@returns {*}
 */
function isConnected()
{
	return !! ( _network_peer.getOutboundPeers().length + _network_peer.getInboundClients().length );
}


/**
 *	@public
 */
function startClient()
{
	//
	//	no listener on mobile
	//
	_network_peer.initWebSocketServer();

	//
	//	the default value of _conf.bWantNewPeers is true
	//
	if ( _conf.bWantNewPeers )
	{
		console.log( "network::_startRelay, _conf.bWantNewPeers = true" );

		//
		//	add outbound connections
		//
		//	retry lost and failed connections
		//	every 1 minute
		//
		_network_peer.addOutboundPeers();
		setInterval
		(
			_network_peer.addOutboundPeers,
			60 * 1000
		);

		//
		//	...
		//
		setTimeout
		(
			_network_peer.checkIfHaveEnoughOutboundPeersAndAdd,
			30 * 1000
		);

		//
		//	purge dead peers
		//	every half hour
		//
		setInterval
		(
			_network_peer.purgeDeadPeers,
			30 * 60 * 1000
		);
	}

	//
	//	purge peer_events
	//	removing those older than 3 days ago.
	//	every 6 hours
	//
	setInterval
	(
		_network_peer.purgePeerEvents,
		6 * 60 * 60 * 1000
	);

	//
	//	start heartbeat
	//
	_startHeartbeat();
}

/**
 *	start server
 *
 * 	oOptions
 * 	{
 *		subscribe	: function() {},
 *		onMessage	: function() {},
 *		onClose		: function() {}
 * 	}
 */
function startServer( oOptions )
{
	//
	//	user configuration a port, so we will start a listening socket service
	//	*
	//	prepare to accepting connections
	//
	_network_peer.startWebSocketServer( oOptions );

	//
	//	start heartbeat
	//
	_startHeartbeat();
}





/**
 *	exports
 */
exports.startClient			= startClient;
exports.startServer			= startServer;

exports.closeAllWsConnections		= closeAllWsConnections;
exports.getConnectionStatus		= getConnectionStatus;
exports.isConnected			= isConnected;
