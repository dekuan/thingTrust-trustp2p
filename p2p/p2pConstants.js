/*jslint node: true */
"use strict";


/**
 *	exports
 */
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

module.exports.PEER_TYPE_SERVER			= 'server';
module.exports.PEER_TYPE_CLIENT			= 'client';