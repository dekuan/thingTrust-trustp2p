/*jslint node: true */
"use strict";

const _redis		= require( 'redis' );

const _p2pUtils		= require( './CP2pUtils.js' );



/**
 *	CP2pNerve
 *	@module	CP2pNerve
 */
class CP2pNerve
{
	constructor()
	{
		this.m_oRedisClient	= _redis.createClient();
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
		await new Promise( ( pfnResolve, pfnReject ) =>
		{
			this.m_oRedisClient.get( sKey, ( vError, vReply ) =>
			{
				if ( null === vError )
				{
					pfnResolve( vReply );
				}
				else
				{
					pfnReject( vError );
				}
			});
		})
		.then( vReply =>
		{
			vRet = vReply;
		})
		.catch( vError =>
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
		await new Promise( ( pfnResolve, pfnReject ) =>
		{
			this.m_oRedisClient.exists( sKey, ( vError, vReply ) =>
			{
				if ( null === vError )
				{
					pfnResolve( vReply );
				}
				else
				{
					pfnReject( vError );
				}
			});
		})
		.then( vReply =>
		{
			bRet = ( 1 === vReply );
		})
		.catch( vError =>
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
