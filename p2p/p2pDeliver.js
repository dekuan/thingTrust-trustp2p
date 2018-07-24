/*jslint node: true */
"use strict";

const CP2pDriver		= require( './driver/p2pDriver.js' );
const CP2pRequest		= require( './p2pRequest.js' );
const CP2pHeartbeat		= require( './p2pHeartbeat.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );
const _p2pLog			= require( './p2pLog.js' );




/**
 *	P2p Deliver
 *	@class	CP2pDeliver
 *	@module	CP2pDeliver
 */
class CP2pDeliver extends CP2pRequest
{
	constructor()
	{
		super();

		//	...
		this.m_cDriver			= null;
		this.m_nLastHeartbeatWakeTs	= Date.now();
		this.m_cP2pHeartbeat		= new CP2pHeartbeat();
	}


	/**
	 *	set driver instance
	 *
	 *	@param	{instance}	cDriver
	 *	@return	{void}
	 */
	set cDriver( cDriver )
	{
		this.m_cDriver	= cDriver;
		super.cDriver	= cDriver;
	}


	broadcast()
	{
		if ( CP2pDriver.DRIVER_TYPE_CLIENT !== this.m_cDriver.sDriverType )
		{
			_p2pLog.error( `will broadcast nothing, only client instance broadcast.` );
			return false;
		}
	}


	/**
	 *	send response
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 * 	@param	{number}	nPackageType
	 *	@param	{string}	sTag
	 *	@param	{object}	oBody
	 *	@return	{boolean}
	 */
	sendResponse( oSocket, nPackageType, sTag, oBody )
	{
		if ( ! _p2pUtils.isObject( oSocket ) )
		{
			return false;
		}
		if ( ! this.m_cP2pPackage.isValidPackageType( nPackageType ) )
		{
			return false;
		}

		//	...
		delete oSocket.assocInPreparingResponse[ sTag ];

		this.sendMessage( oSocket, nPackageType, '', { tag : sTag, response : oBody } );
		return true;
	}


	/**
	 *	send response
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 * 	@param	{number}	nPackageType
	 *	@param	{string}	sTag
	 *	@param	{string}	sError
	 *	@return	{void}
	 */
	sendErrorResponse( oSocket, nPackageType, sTag, sError )
	{
		this.sendResponse( oSocket, nPackageType, sTag, { error : sError } );
	}

}





/**
 *	@exports
 */
module.exports	= CP2pDeliver;
