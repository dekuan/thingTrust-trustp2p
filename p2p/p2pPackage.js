/*jslint node: true */
"use strict";

/**
 *	@module	p2p heartbeat
 */
const socks			= process.browser ? null : require( 'socks' + '' );

const _protobufjs		= require( 'protobufjs' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './p2pUtils.js' );
const _p2pMessage		= require( './p2pMessage.js' );
const _p2pRequest		= require( './p2pRequest.js' );
const _p2pPeer			= require( './p2pPeer.js' );
//const jsonDescriptor		= require( './p2p.proto' );



/**
 * 	@constant
 */
const PACKAGE_P2P_PROTO		= `${ __dirname }/p2pPackage.proto`;



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
		this.m_oRoot			= this._loadProtocolBufferSync();

		this.m_oMessage			= root.lookupType( 'trust_note_p2p_package.TrustNoteP2p' );
		this.m_enumPackType		= root.lookupEnum( 'trust_note_p2p_package.TrustNoteP2p.PackType' );
		this.m_arrPackTypeValues	= Object.values( this.m_enumPackType.values );

		//
		//	copy Enumerations( key => value ) to this object
		//
		Object.assign( this, {}, { PackType : this.m_enumPackType.values } );
	}

	/**
	 *	check if the given package type is valid
	 *	@param	{number}	nPackType
	 *	@return	{boolean}
	 */
	isValidPackType( nPackType )
	{
		return Number.isInteger( nPackType ) && this.m_arrPackTypeValues.includes( nPackType );
	}


	/**
	 *	load protocol buffer synchronously
	 *	@private
	 *	@return {Promise<void>}
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
