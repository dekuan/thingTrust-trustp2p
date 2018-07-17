/*jslint node: true */
"use strict";


/**
 *	Library
 */
class CP2pUtils
{
	static isString( vValue )
	{
		return ( 'string' === typeof vValue );
	}

	static isFunction( vValue )
	{
		return ( 'function' === typeof vValue );
	}


	/**
	 *	check if the given number is a valid socket listen port number
	 *	@public
	 *	@param nPort
	 *	@returns {boolean}
	 */
	static isValidPortNumber( nPort )
	{
		return ( Number.isInteger( nPort ) &&
			Number.isSafeInteger( nPort ) &&
			nPort >= 1024 && nPort < 65535 );
	}
}




/**
 *	exports
 */
module.exports	= CP2pUtils;
