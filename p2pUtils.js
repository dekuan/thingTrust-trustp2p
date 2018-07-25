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

	/**
	 * 	get all methods from a class or its instance
	 *
	 * 	@public
	 *	@param	{object}	objObject
	 *	@return {array}
	 */
	getAllMethodsOfClass( objObject )
	{
		let setRet;
		let arrKeys;

		try
		{
			setRet = new Set();
			while ( true )
			{
				objObject = Reflect.getPrototypeOf( objObject );
				if ( ! objObject )
				{
					break;
				}

				//	...
				arrKeys	= Reflect.ownKeys( objObject );
				if ( Array.isArray( arrKeys ) && arrKeys.length > 0 )
				{
					arrKeys.forEach( sKey => setRet.add( sKey ) );
				}
			}
		}
		catch ( vError )
		{
		}

		return Array.from( setRet );
	}

}




/**
 *	exports
 */
module.exports	= CP2pUtils;
