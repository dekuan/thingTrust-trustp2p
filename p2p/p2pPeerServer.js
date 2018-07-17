/*jslint node: true */
"use strict";

let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );
let socks			= process.browser ? null : require( 'socks' + '' );

let _conf			= require( '../conf.js' );

let _crypto			= require( 'crypto' );

let _p2pUtils			= require( './p2pUtils.js' );
let _p2pLog			= require( './p2pLog.js' );
let _p2pPersistence		= require( './p2pPersistence.js' );

let _p2pEvents			= require( './p2pEvents.js' );
let _p2pMessage			= require( './p2pMessage.js' );



/**
 *	CP2pPeerServer
 */
class CP2pPeerServer
{


}




/**
 *	web socket server
 */
exports.CP2pPeerServer		= CP2pPeerServer;
