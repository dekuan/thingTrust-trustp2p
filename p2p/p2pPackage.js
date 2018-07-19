/*jslint node: true */
"use strict";

/**
 *	@module	p2p heartbeat
 */
const socks			= process.browser ? null : require( 'socks' + '' );

const _protobufjs		= require( 'protobufjs' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pMessage		= require( './p2pMessage.js' );
const _p2pRequest		= require( './p2pRequest.js' );
const _p2pPeer			= require( './p2pPeer.js' );
//const jsonDescriptor		= require( './p2p.proto' );

/**
 * 	@constant
 */
const PACKAGE_P2P_PROTO		= `${ __dirname }/p2p.proto`;



/**
 *	p2p package
 *
 *	@class	CP2pPackage
 *
 */
class CP2pPackage
{
	/**
	 *	@constructor
	 */
	constructor()
	{
		this.m_oRoot	= this._loadProtocolBufferSync();
	}


	/**
	 *	load protocol buffer synchronously
	 *	@private
	 *	@returns {Promise<void>}
	 */
	async _loadProtocolBufferSync()
	{
		let oRet;

		//	...
		oRet	= null;
		await this._loadProtocolBuffer()
		.then( oRoot =>
		{
			oRet = oRoot;
		})
		.catch( vError =>
		{
		});

		return oRet;
	}

	/**
	 *	load protocol buffer
	 *	@private
	 */
	async _loadProtocolBuffer()
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			_protobufjs.load
			(
				PACKAGE_P2P_PROTO,
				function( err, root )
				{
					if ( err )
					{
						return pfnReject( err );
					}

					//	Obtain a message type
					//let TrustNoteP2p = root.lookupType( "trust_note_p2p_package.TrustNoteP2p" );
					pfnResolve( root );
				}
			);
		});
	}


}



/**
 *	exports
 */
module.exports	= CP2pPackage;
