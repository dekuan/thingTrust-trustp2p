/*jslint node: true */
"use strict";

const CP2pDriver		= require( './driver/CP2pDriver.js' );
const CP2pRequest		= require( './CP2pRequest.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './CP2pUtils.js' );
const _p2pLog			= require( './CP2pLog.js' );




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
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody
	 *	@return	{boolean}
	 */
	sendResponse( oSocket, nPackageType, sEvent, oBody )
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
		if ( _p2pUtils.isObjectWithKeys( oBody, 'tag' ) )
		{
			delete oSocket.assocInPreparingResponse[ oBody.tag ];
		}

		//	...
		this.sendMessage( oSocket, nPackageType, sEvent, oBody );
		return true;
	}


	/**
	 *	send response
	 *
	 *	@public
	 * 	@param	{object}	oSocket
	 * 	@param	{number}	nPackageType
	 *	@param	{string}	sEvent
	 *	@param	{string}	sTag
	 *	@param	{string}	sError
	 *	@return	{void}
	 */
	sendErrorResponse( oSocket, nPackageType, sEvent, sTag, sError )
	{
		this.sendResponse( oSocket, nPackageType, sEvent, { tag : sTag, error : sError } );
	}

}





/**
 *	@exports
 */
module.exports	= CP2pDeliver;
