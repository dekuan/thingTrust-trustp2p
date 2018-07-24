/*jslint node: true */
"use strict";


const EventEmitter	= require( 'events' );
const _fs		= require( 'fs' );

const _p2pConstants	= require( '../p2pConstants.js' );
const _p2pUtils		= require( '../p2pUtils.js' );



/**
 * 	driver events
 *	@constant
 */
const EVENT_START		= 'start';	//	( oSocket, sInfo )	| emitted while your implementation started.
const EVENT_CONNECTION		= 'connection';	//	( oSocket )		| emitted while a new driver is made.
const EVENT_OPEN		= 'open';	//	( oSocket )		| emitted after successfully connected to server.
const EVENT_MESSAGE		= 'message';	//	( oSocket, vMessage )	| emitted while a new message was received.
const EVENT_CLOSE		= 'close';	//	( oSocket )		| emitted while socket was closed.
const EVENT_ERROR		= 'error';	//	( vError )		| emitted while a error was occurred.

const DRIVER_TYPE_SERVER	= 'server';
const DRIVER_TYPE_CLIENT	= 'client';




/**
 *	interface definition of p2p driver, so we call it Driver
 *
 *	@module	CP2pDriver
 *	@class	CP2pDriver
 *
 *	@description
 *		communicate with caller by emitting events below in your implementation for this interface
 *	@see constant
 */
class CP2pDriver extends EventEmitter
{
	/**
	 *	@constructor
	 *	@param	{object}	oOptions	configurations
	 */
	constructor( oOptions )
	{
		super();

		//	...
		this.m_sDriverType	= oOptions.type;
		this.m_oOptions		=
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

	/**
	 *	get driver type
	 *	@return {string}
	 */
	get sDriverType()
	{
		return this.m_sDriverType;
	}

	/**
	 *	create new instance
	 *
	 *	@param	{string}	sDriver
	 *	@param	{string}	sType
	 *	@param	{object}	oOptions
	 *	@returns {instance}
	 */
	static createInstance( sDriver, sType, oOptions )
	{
		let cRet;
		let sFullFilename;
		let CClassName;

		if ( ! _p2pUtils.isString( sDriver ) || 0 === sDriver.length )
		{
			return null;
		}
		if ( ! _p2pUtils.isString( sType ) || 0 === sType.length )
		{
			return null;
		}

		//	...
		cRet		= null;
		sFullFilename	= `${ __dirname }/${ _p2pConstants.CONNECTION_ADAPTER_LIST[ sDriver ][ sType ] }`;
		if ( _fs.existsSync( sFullFilename ) )
		{
			CClassName		= require( sFullFilename );
			oOptions		= Object.assign( {}, oOptions, { type : sType } );
			cRet			= new CClassName( oOptions );
		}

		return cRet;
	}

}




/**
 *	@exports
 *	@type {CP2pDriver}
 */
module.exports	= CP2pDriver;

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

module.exports.DRIVER_TYPE_SERVER	= DRIVER_TYPE_SERVER;
module.exports.DRIVER_TYPE_CLIENT	= DRIVER_TYPE_CLIENT;
