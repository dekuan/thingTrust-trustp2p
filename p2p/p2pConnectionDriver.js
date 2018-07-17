const EventEmitter	= require( 'events' );
const _p2pConstants	= require( './p2pConstants.js' );

/**
 *	@constant
 */
const EVENT_START	= 'start';	//	( oSocket, sInfo )
const EVENT_CONNECT	= 'connect';	//	( oSocket )
const EVENT_MESSAGE	= 'message';	//	( oSocket, vMessage )
const EVENT_CLOSE	= 'close';	//	( oSocket )
const EVENT_ERROR	= 'error';	//	( vError )


/**
 *	interface P2pConnectionDriver
 *	@module	iP2pConnectionDriver
 *	@class	iP2pConnectionDriver
 */
class iP2pConnectionDriver extends EventEmitter
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
 *	@type {iP2pConnectionDriver}
 */
module.exports	= iP2pConnectionDriver;

module.exports.EVENT_START		= EVENT_START;
module.exports.EVENT_CONNECT		= EVENT_CONNECT;
module.exports.EVENT_MESSAGE		= EVENT_MESSAGE;
module.exports.EVENT_CLOSE		= EVENT_CLOSE;
module.exports.EVENT_ERROR		= EVENT_ERROR;
