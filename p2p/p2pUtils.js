/*jslint node: true */
"use strict";


/**
 *	Library
 */
class CP2pUtils
{
	static isString( vValue )
	{
		return ( vValue && 'string' === typeof vValue );
	}

	static isFunction( vValue )
	{
		return ( vValue && 'function' === typeof vValue );
	}

	static isObject( vValue )
	{
		return ( vValue && 'object' === typeof vValue );
	}


	/**
	 *	get random integer
	 *
	 *	@public
	 *	@param	{number}	nMin
	 *	@param	{number}	nMax
	 *	@returns {number}
	 */
	static getRandomInt( nMin, nMax )
	{
		return Math.floor( Math.random() * ( nMax + 1 - nMin ) ) + nMin;
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
