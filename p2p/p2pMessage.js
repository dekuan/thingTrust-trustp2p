/*jslint node: true */
"use strict";

const CP2pPackage		= require( './p2pPackage.js' );

const _p2pLog			= require( './p2pLog.js' );
const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );



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
	 *	@param	{string}	vCommand	null is okay
	 *	@param	{object}	vBody		string, null are both okay
	 *	@return	{boolean}
	 */
	sendMessage( oSocket, nPackageType, vCommand, vBody )
	{
		let bufMessage;
		let sCommand;
		let sBody;

		if ( ! oSocket )
		{
			_p2pLog.error( `call sendMessage with invalid oSocket.` );
			return false;
		}
		if ( oSocket.readyState !== oSocket.OPEN )
		{
			_p2pLog.error( `readyState is ${ oSocket.readyState } on peer ${ oSocket.peer }, will not send ${ String( vCommand ) }.` );
			return false;
		}
		if ( ! this.m_cP2pPackage.isValidPackageType( nPackageType ) )
		{
			return false;
		}

		//	...
		sCommand	= String( vCommand );
		sBody		= _p2pUtils.isObject( vBody ) ? JSON.stringify( vBody ) : String( vBody );
		_p2pLog.info( `SENDING ${ sCommand }, ${ sBody } to ${ oSocket.peer }` );

		//	...
		bufMessage	= this.m_cP2pPackage.encodePackage( nPackageType, vCommand, vBody );
		oSocket.send( bufMessage );

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
		this.sendMessage( oSocket, _p2pConstants.PACKAGE_TALK, sSubject, oBody );
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
		let libraryPackageJson;

		//	...
		libraryPackageJson	= require( '../package.json' );

		//	...
		this.sendTalk
		(
			oSocket,
			'version',
			{
				protocol_version	: _p2pConstants.version,
				alt			: _p2pConstants.alt,
				library			: libraryPackageJson.name,
				library_version		: libraryPackageJson.version,
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
