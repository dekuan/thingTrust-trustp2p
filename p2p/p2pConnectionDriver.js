/*jslint node: true */
"use strict";


const EventEmitter	= require( 'events' );

const _p2pConstants	= require( './p2pConstants.js' );




/**
 * 	connection events
 *	@constant
 */
const EVENT_START	= 'start';	//	( oSocket, sInfo )	| emitted while your implementation started.
const EVENT_CONNECTION	= 'connection';	//	( oSocket )		| emitted while a new connection is made.
const EVENT_OPEN	= 'open';	//	( oSocket )		| emitted after successfully connected to server.
const EVENT_MESSAGE	= 'message';	//	( oSocket, vMessage )	| emitted while a new message was received.
const EVENT_CLOSE	= 'close';	//	( oSocket )		| emitted while socket was closed.
const EVENT_ERROR	= 'error';	//	( vError )		| emitted while a error was occurred.






/**
 *	interface definition of p2p connection, so we call it Driver
 *
 *	@module	CP2pConnectionDriver
 *	@class	CP2pConnectionDriver
 *
 *	@description
 *		communicate with caller by emitting events below in your implementation for this interface
 *	@see constant
 */
class CP2pConnectionDriver extends EventEmitter
{
	/**
	 *	@constructor
	 *	@param	{object}	oOptions	configurations
	 */
	constructor( oOptions )
	{
		super();

		/**
		 *	@default
		 */
		this.m_oOptions	=
			{
				//	...
				nPort			: 1107,
				bServeAsHub		: false,
				bLight			: false,
				oProxy			: null,

				//	...
				CONNECTION_MAX_INBOUND	: _p2pConstants.CONNECTION_MAX_INBOUND,
			};
	}

	/**
	 * 	get options
	 *	@public
	 *	@returns	object
	 */
	get oOptions()
	{
		return this.m_oOptions;
	}
}




/**
 *	exports
 *	@exports
 *	@type {CP2pConnectionDriver}
 */
module.exports	= CP2pConnectionDriver;

/**
 *	events type
 *	@type {string}
 */
module.exports.EVENT_START		= EVENT_START;
module.exports.EVENT_CONNECTION		= EVENT_CONNECTION;
module.exports.EVENT_OPEN		= EVENT_OPEN;
module.exports.EVENT_MESSAGE		= EVENT_MESSAGE;
module.exports.EVENT_CLOSE		= EVENT_CLOSE;
module.exports.EVENT_ERROR		= EVENT_ERROR;
