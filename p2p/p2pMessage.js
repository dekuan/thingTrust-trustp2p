/*jslint node: true */
"use strict";

let _conf			= require( '../conf.js' );

let _constants			= require( './p2pConstants.js' );


/**
 *	@class	CP2pMessage
 */
class CP2pMessage
{
	constructor()
	{

	}

	sendMessage( ws, type, content )
	{
		let message;

		//	...
		message	= JSON.stringify( [ type, content ] );

		if ( ws.readyState !== ws.OPEN )
		{
			return console.log( "readyState=" + ws.readyState + ' on peer ' + ws.peer + ', will not send ' + message );
		}

		console.log( "SENDING " + message + " to " + ws.peer );
		ws.send( message );
	}

	sendJustSaying( ws, subject, body )
	{
		this.sendMessage( ws, 'justsaying', { subject : subject, body : body } );
	}

	sendError( ws, error )
	{
		this.sendJustSaying( ws, 'error', error );
	}

	sendInfo( ws, content )
	{
		this.sendJustSaying( ws, 'info', content );
	}

	sendResult( ws, content )
	{
		this.sendJustSaying( ws, 'result', content );
	}

	sendErrorResult( ws, unit, error )
	{
		this.sendResult( ws, { unit : unit, result : 'error', error : error } );
	}

	sendVersion( ws )
	{
		let libraryPackageJson;

		//	...
		libraryPackageJson	= require( '../package.json' );

		//	...
		this.sendJustSaying
		(
			ws,
			'version',
			{
				protocol_version	: _constants.version,
				alt			: _constants.alt,
				library			: libraryPackageJson.name,
				library_version		: libraryPackageJson.version,
				program			: _conf.program,
				program_version		: _conf.program_version
			}
		);
	}

	sendResponse( ws, tag, response )
	{
		delete ws.assocInPreparingResponse[ tag ];
		this.sendMessage( ws, 'response', { tag: tag, response: response } );
	}

	sendErrorResponse( ws, tag, error )
	{
		this.sendResponse( ws, tag, { error : error } );
	}

}






/**
 *	exports
 */
module.exports	= CP2pMessage;
