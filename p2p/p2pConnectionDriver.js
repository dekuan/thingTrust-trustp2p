const EventEmitter	= require( 'events' );
const _p2pConstants	= require( './p2pConstants.js' );

/**
 *	@constant
 */
const EVENT_START	= 'start';	//	( oSocket, sInfo )
const EVENT_CONNECTION	= 'connection';	//	( oSocket )		Emitted when a new connection is made.
const EVENT_MESSAGE	= 'message';	//	( oSocket, vMessage )
const EVENT_CLOSE	= 'close';	//	( oSocket )
const EVENT_ERROR	= 'error';	//	( vError )


/**
 *	interface P2pConnectionDriver
 *	@module	CP2pConnectionDriver
 *	@class	CP2pConnectionDriver
 */
class CP2pConnectionDriver extends EventEmitter
{
	/**
	 *	@constructor
	 *	@param oOptions
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

				//	...
				MAX_INBOUND_CONNECTIONS	: _p2pConstants.MAX_INBOUND_CONNECTIONS,
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
module.exports.EVENT_MESSAGE		= EVENT_MESSAGE;
module.exports.EVENT_CLOSE		= EVENT_CLOSE;
module.exports.EVENT_ERROR		= EVENT_ERROR;
