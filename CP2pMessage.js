/*jslint node: true */
"use strict";

const CP2pPackage		= require( './CP2pPackage.js' );

const _p2pLog			= require( './CP2pLog.js' );
const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './CP2pUtils.js' );
const _package			= require( './package.json' );




/**
 *	@class	CP2pMessage
 */
class CP2pMessage
{
	constructor()
	{
		this.m_cP2pPackage	= new CP2pPackage();
	}


	/**
	 *	send message
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{number}	nPackageType
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody		string, null are both okay
	 *	@return	{boolean}
	 */
	sendMessage( oSocket, nPackageType, sEvent, oBody )
	{
		let bufMessage;

		if ( ! oSocket )
		{
			_p2pLog.error( `* ${ this.constructor.name } sendMessage with invalid oSocket.` );
			return false;
		}
		if ( oSocket.readyState !== oSocket.OPEN )
		{
			_p2pLog.error( `* ${ this.constructor.name } readyState is ${ oSocket.readyState } on peer ${ oSocket.peer }, will not send ${ String( vCommand ) }.` );
			return false;
		}
		if ( ! this.m_cP2pPackage.isValidPackageType( nPackageType ) )
		{
			_p2pLog.error( `* ${ this.constructor.name } sendMessage with invalid nPackageType.` );
			return false;
		}
		if ( ! _p2pUtils.isObject( oBody ) )
		{
			_p2pLog.error( `* ${ this.constructor.name } sendMessage with invalid oBody.` );
			return false;
		}

		//	...
		bufMessage	= this.m_cP2pPackage.encodePackage( nPackageType, sEvent, oBody );
		oSocket.send( bufMessage );

		//	...
		_p2pLog.info( `* ${ this.constructor.name } SENT ${ sEvent }, ${ JSON.stringify( oBody ) } to ${ oSocket.peer }` );

		//	...
		return true;
	}


	/**
	 * 	send just saying
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{string}	sSubject
	 *	@param 	{object}	oBody
	 *	@return	{void}
	 */
	sendTalk( oSocket, sSubject, oBody )
	{
		this.sendMessage( oSocket, CP2pPackage.PACKAGE_TALK, sSubject, oBody );
	}

	sendError( oSocket, sError )
	{
		this.sendTalk( oSocket, 'error', sError );
	}

	sendInfo( oSocket, sContent )
	{
		this.sendTalk( oSocket, 'info', sContent );
	}

	sendResult( oSocket, sContent )
	{
		this.sendTalk( oSocket, 'result', sContent );
	}

	sendErrorResult( oSocket, oUnit, sError )
	{
		this.sendResult( oSocket, { unit : oUnit, result : 'error', error : sError } );
	}

	sendVersion( oSocket )
	{
		this.sendTalk
		(
			oSocket,
			'version',
			{
				protocol_version	: _p2pConstants.version,
				alt			: _p2pConstants.alt,
				library			: _package.name,
				library_version		: _package.version,
				program			: '_conf.program',
				program_version		: '_conf.program_version'
			}
		);
	}

}






/**
 *	exports
 */
module.exports	= CP2pMessage;
