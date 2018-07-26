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

}





/**
 *	@exports
 */
module.exports	= CP2pDeliver;
