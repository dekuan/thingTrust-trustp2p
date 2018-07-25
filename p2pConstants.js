/*jslint node: true */
"use strict";


/**
 *	exports
 */
module.exports.version                                 = '1.0';
module.exports.alt                                     = '1';

//
//	PACKET TYPES
//
module.exports.PACKAGE_HEARTBEAT_PING		= 0;
module.exports.PACKAGE_HEARTBEAT_PONG		= 1;
module.exports.PACKAGE_TALK			= 10;
module.exports.PACKAGE_REQUEST			= 20;
module.exports.PACKAGE_RESPONSE			= 21;


module.exports.FORWARDING_TIMEOUT		= 10 * 1000;		//	don't forward if the joint was received more than FORWARDING_TIMEOUT ms ago
module.exports.STALLED_TIMEOUT			= 5000;			//	a request is treated as stalled if no response received within STALLED_TIMEOUT ms
module.exports.RESPONSE_TIMEOUT			= 300 * 1000;		//	after this timeout, the request is abandoned

module.exports.HEARTBEAT_INTERVAL		= 3 * 1000;
module.exports.HEARTBEAT_TIMEOUT		= 10 * 1000;
module.exports.HEARTBEAT_RESPONSE_TIMEOUT	= 60 * 1000;
module.exports.HEARTBEAT_PAUSE_TIMEOUT		= 2 * exports.HEARTBEAT_TIMEOUT;

module.exports.EVENTEMITTER_MAX_LISTENERS	= 20;

module.exports.CONNECTION_MAX_INBOUND		= 100;

module.exports.CONNECTION_DRIVER		= 'ws';		//	web socket
module.exports.CONNECTION_ADAPTER_LIST		=
	{
		'ws'	:
		{
			'client'	: 'p2pDriverImplWsClient.js',
			'server'	: 'p2pDriverImplWsServer.js',
		}
	};
