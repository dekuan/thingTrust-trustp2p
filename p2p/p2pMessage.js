/*jslint node: true */
"use strict";

let _conf			= require( '../conf.js' );

let _constants			= require( './p2pConstants.js' );



//////////////////////////////////////////////////////////////////////
//	general network functions
//////////////////////////////////////////////////////////////////////


function sendMessage( ws, type, content )
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

function sendJustSaying( ws, subject, body )
{
	sendMessage( ws, 'justsaying', { subject : subject, body : body } );
}

function sendError( ws, error )
{
	sendJustSaying( ws, 'error', error );
}

function sendInfo( ws, content )
{
	sendJustSaying( ws, 'info', content );
}

function sendResult( ws, content )
{
	sendJustSaying( ws, 'result', content );
}

function sendErrorResult( ws, unit, error )
{
	sendResult( ws, { unit : unit, result : 'error', error : error } );
}

function sendVersion( ws )
{
	let libraryPackageJson;

	//	...
	libraryPackageJson	= require( '../package.json' );

	//	...
	sendJustSaying
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

function sendResponse( ws, tag, response )
{
	delete ws.assocInPreparingResponse[ tag ];
	sendMessage( ws, 'response', { tag: tag, response: response } );
}

function sendErrorResponse( ws, tag, error )
{
	sendResponse( ws, tag, { error : error } );
}






/**
 *	exports
 */
module.exports.sendMessage			= sendMessage;
module.exports.sendJustSaying			= sendJustSaying;
module.exports.sendError			= sendError;
module.exports.sendInfo				= sendInfo;
module.exports.sendResult			= sendResult;
module.exports.sendErrorResult			= sendErrorResult;
module.exports.sendVersion			= sendVersion;
module.exports.sendResponse			= sendResponse;
module.exports.sendErrorResponse		= sendErrorResponse;
