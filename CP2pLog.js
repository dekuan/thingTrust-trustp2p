/*jslint node: true */
"use strict";


function __appendDateTime( arrArgs )
{
	if ( Array.isArray( arrArgs ) )
	{
		arrArgs.unshift( `[${ ( new Date() ).toString() }]` );
	}
	else
	{
		arrArgs = `[${ ( new Date() ).toString() }]`;
	}

	return arrArgs;
}



/**
 *	CP2pLog
 */
class CP2pLog
{
	static info( ...args )
	{
		__appendDateTime( args );
		console.log( ...args );
	}

	static error( ...args )
	{
		__appendDateTime( args );
		console.error( ...args );
	}

	static warn( ...args )
	{
		__appendDateTime( args );
		console.warn( ...args );
	}
}



/**
 *	exports
 *	@type {CP2pLog}
 */
module.exports	= CP2pLog;