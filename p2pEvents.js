/*jslint node: true */
"use strict";

let EventEmitter	= require( 'events' ).EventEmitter;

//	...
let eventEmitter	= new EventEmitter();



/**
 *	set max listeners
 */
eventEmitter.setMaxListeners( 20 );



/**
 *	exports
 */
module.exports = eventEmitter;
