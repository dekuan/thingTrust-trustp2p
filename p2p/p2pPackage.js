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
		this.m_enumPackageType		= root.lookupEnum( 'trust_note_p2p_package.TrustNoteP2p.PackageType' );
		this.m_arrPackTypeValues	= Object.values( this.m_enumPackageType.values );
	}

	/**
	 *	check if the given package type is valid
	 *	@param	{number}	nPackageType
	 *	@return	{boolean}
	 */
	isValidPackageType( nPackageType )
	{
		return Number.isInteger( nPackageType ) && this.m_arrPackTypeValues.includes( nPackageType );
	}


	/**
	 *	encode a JavaScript plain object to binary p2p package
	 *
	 * 	@public
	 *	@param	{number}	nPackageType
	 *	@param	{string}	vCommand
	 *	@param	{object | string}	vBody
	 *	@return {binary | null}
	 */
	encodePackage( nPackageType, vCommand, vBody )
	{
		let bufRet;
		let sCommand;
		let sBody;
		let oMessageJson;
		let oMessageObj;

		if ( ! this.isValidPackageType( nPackageType ) )
		{
			return null;
		}

		//	...
		bufRet		= null;
		sCommand	= String( vCommand );
		sBody		= _p2pUtils.isObject( vBody ) ? JSON.stringify( vBody ) : String( vBody ).trim();
		oMessageJson	=
			{
				version	: _p2pConstants.version,
				alt	: _p2pConstants.alt,
				type	: nPackageType,
				command	: sCommand,
				body	: sBody,
			};
		if ( ! this.m_oMessage.verify( oMessageJson ) )
		{
			//
			//	Create a new message
			//	or use .fromObject if conversion is necessary
			//
			oMessageObj = this.m_oMessage.create( oMessageJson );
			if ( oMessageObj )
			{
				//
				//	encode a message to an Uint8Array (browser) or Buffer (node)
				//
				bufRet = this.m_oMessage.encode( oMessageObj ).finish();
			}
		}

		return bufRet;
	}

	/**
	 *	decode a p2p encoded binary package to JavaScript plain object
	 *
	 * 	@public
	 *	@param	{binary}	bufPackage
	 *	@return {object}
	 */
	decodePackage( bufPackage )
	{
		let oRet;
		let oMessageObj;

		//	...
		oRet		= null;
		oMessageObj	= this.m_oMessage.decode( bufPackage );
		if ( oMessageObj )
		{
			//
			//	convert the message back to a JavaScript plain object
			//
			oRet = this.m_oMessage.toObject( oMessageObj );
		}

		return oRet;
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
