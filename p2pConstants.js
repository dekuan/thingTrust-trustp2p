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
module.exports.PACKAGE_SYSTEM			= 0;
module.exports.PACKAGE_HEARTBEAT_PING		= 10;
module.exports.PACKAGE_HEARTBEAT_PONG		= 11;
module.exports.PACKAGE_TALK			= 20;
module.exports.PACKAGE_REQUEST			= 30;
module.exports.PACKAGE_RESPONSE			= 31;


module.exports.FORWARDING_TIMEOUT		= 10 * 1000;		//	don't forward if the joint was received more than FORWARDING_TIMEOUT ms ago
module.exports.STALLED_TIMEOUT			= 5000;			//	a request is treated as stalled if no response received within STALLED_TIMEOUT ms
module.exports.RESPONSE_TIMEOUT			= 300 * 1000;		//	after this timeout, the request is abandoned

module.exports.HEARTBEAT_INTERVAL		= 3 * 1000;
module.exports.HEARTBEAT_TIMEOUT		= 10 * 1000;
module.exports.HEARTBEAT_RESPONSE_TIMEOUT	= 60 * 1000;
module.exports.HEARTBEAT_PAUSE_TIMEOUT		= 2 * exports.HEARTBEAT_TIMEOUT;

module.exports.EVENTEMITTER_MAX_LISTENERS	= 20;

module.exports.CONNECTION_MAX_INBOUND		= 100;

module.exports.DRIVER_TYPE_CLIENT		= 'client';
module.exports.DRIVER_TYPE_SERVER		= 'server';

module.exports.CONNECTION_DRIVER		= 'ws';		//	web socket
module.exports.CONNECTION_ADAPTER_LIST		=
	{
		'ws'	:
		{
			[ module.exports.DRIVER_TYPE_CLIENT ]	: 'p2pDriverImplWsClient.js',
			[ module.exports.DRIVER_TYPE_SERVER ]	: 'p2pDriverImplWsServer.js',
		}
	};