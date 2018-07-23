/*jslint node: true */
"use strict";


/**
 *	CP2pLog
 */
class CP2pLog
{
	info( ...args )
	{
		console.log( ...args );
	}

	error( ...args )
	{
		console.log( ...args );
	}

	warning( ...args )
	{
		console.log( ...args );
	}
}



/**
 *	exports
 *	@type {CP2pLog}
 */
module.exports	= CP2pLog;