/*jslint node: true */
"use strict";

/**
 *	@import library
 */
const _p2pUtils			= require( './p2pUtils.js' );




/**
 *	cache for socket handle
 *	@class	CP2pSocketHandleCache
 */
class CP2pSocketHandleCache
{
	constructor()
	{
		//	all clients connected in
		this.m_arrOutboundPeers	= [];
	}


	/**
	 *	get socket handle by url
	 *
	 * 	@public
	 *	@param	{string}	sUrl
	 *	@returns {null}
	 */
	getHandleByUrl( sUrl )
	{
		let oRet;
		let arrResult;

		if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
		{
			return null;
		}

		//	...
		oRet		= null;
		sUrl		= sUrl.trim().toLowerCase();
		arrResult	= this.m_arrOutboundPeers.filter( oSocket => oSocket.peer === sUrl );
		if ( Array.isArray( arrResult ) && 1 === arrResult.length )
		{
			oRet = arrResult[ 0 ];
		}

		return oRet;
	}

	/**
	 *	add new socket handle by url
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@returns {boolean}
	 */
	addHandle( oSocket )
	{
		if ( ! oSocket )
		{
			return false;
		}

		//	...
		this.removeHandle( oSocket );
		this.m_arrOutboundPeers.push( oSocket );
		return true;
	}

	/**
	 *	remove socket handle by url
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@returns {boolean}
	 */
	removeHandle( oSocket )
	{
		let bRet;
		let nIndex;

		if ( ! oSocket )
		{
			return false;
		}

		//	...
		bRet	= false;
		nIndex	= this.m_arrOutboundPeers.indexOf( oSocket );
		if ( -1 !== nIndex )
		{
			bRet = true;
			this.m_arrOutboundPeers.splice( nIndex, 1 );
		}

		return bRet;
	}
}



/**
 *	@exports
 *	@type {CP2pSocketHandleCache}
 */
module.exports	= CP2pSocketHandleCache;
