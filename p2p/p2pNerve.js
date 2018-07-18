/*jslint node: true */
"use strict";

const _redis		= require( 'redis' );
const { _promise_util }	= require( 'util' );

const _p2pUtils		= require( './p2pUtils.js' );



/**
 *	CP2pNerve
 *	@module	CP2pNerve
 */
class CP2pNerve
{
	constructor()
	{
		this.m_oRedisClient	= _redis.createClient();
		this.m_pfnGetAsync	= _promise_util( this.m_oRedisClient.get ).bind( this.m_oRedisClient );
		this.m_pfnExistsAsync	= _promise_util( this.m_oRedisClient.exists ).bind( this.m_oRedisClient );
	}

	/**
	 *	store string value
	 *
	 *	@param	{string}		sKey		key to be stored
	 *	@param	{string}		sValue		value to be stored
	 *	@param	{number}		nExpireSeconds	expire time in seconds
	 *	@returns {boolean}
	 */
	setStringValue( sKey, sValue, nExpireSeconds = 0 )
	{
		if ( ! _p2pUtils.isString( sKey ) || 0 === sKey.length )
		{
			return false;
		}

		//	...
		if ( Number.isInteger( nExpireSeconds ) && nExpireSeconds > 0 )
		{
			this.m_oRedisClient.set( sKey, sValue, 'EX', nExpireSeconds );
		}
		else
		{
			this.m_oRedisClient.set( sKey, sValue );
		}

		return true;
	}

	/**
	 *	get string asynchronously
	 *
	 * 	@param	{string}	sKey
	 *	@param pfnCallback
	 *	@returns {boolean}
	 */
	getStringValue( sKey, pfnCallback )
	{
		if ( ! _p2pUtils.isString( sKey ) || 0 === sKey.length )
		{
			return false;
		}
		if ( ! _p2pUtils.isFunction( pfnCallback ) )
		{
			return false;
		}

		//	...
		this.m_oRedisClient.get( sKey, pfnCallback );
		return true;
	}

	/**
	 *	get string synchronously
	 *
	 *	@param	{string}	sKey	load value by this key.
	 *	@returns {Promise<null>}
	 */
	async getStringValueSync( sKey )
	{
		let vRet;

		if ( ! _p2pUtils.isString( sKey ) || 0 === sKey.length )
		{
			return null;
		}

		//	...
		vRet	= null;
		await this.m_pfnGetAsync( sKey, ( err, vReply ) =>
		{
			if ( null === err )
			{
				vRet = vReply;
			}
		})
		.catch( () =>
		{
		});

		//	...
		return vRet;
	}

	/**
	 * 	check if key exists synchronously
	 *
	 *	@param {string}	sKey
	 *	@returns {Promise<boolean>}
	 */
	async isKeyExistsSync( sKey )
	{
		let bRet;

		if ( ! _p2pUtils.isString( sKey ) || 0 === sKey.length )
		{
			return false;
		}

		//	...
		bRet	= false;
		await this.m_pfnExistsAsync.exists( sKey, function( err, vReply )
		{
			bRet = ( 1 === vReply );
		})
		.catch( () =>
		{
		});

		//	...
		return bRet;
	}
}




/**
 *	exprots
 */
module.exports	= CP2pNerve;
