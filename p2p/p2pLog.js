/*jslint node: true */
"use strict";


/**
 *	CP2pLog
 */
class CP2pLog
{
	static info( ...args )
	{
		console.log( ...args );
	}

	static error( ...args )
	{
		console.log( ...args );
	}

	static warning( ...args )
	{
		console.log( ...args );
	}
}



/**
 *	exports
 *	@type {CP2pLog}
 */
module.exports	= CP2pLog;