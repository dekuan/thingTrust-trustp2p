/*jslint node: true */
"use strict";

let _p2pMain	= require( './p2p/p2pMain.js' );


/**
 *	start here
 */
_p2pMain.startServer
({
	port	: 6611
});

