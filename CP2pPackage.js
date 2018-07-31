/*jslint node: true */
"use strict";

/**
 *	@module	p2p package
 */
const socks			= process.browser ? null : require( 'socks' + '' );

const _protobufjs		= require( 'protobufjs' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './CP2pUtils.js' );
const _object_hash		= require( './common/object_hash.js' );


/**
 * 	@constant
 */
const PACKAGE_P2P_PROTO		= `${ __dirname }/CP2pPackage.proto`;

const PACKAGE_SYSTEM		= 0;		//	system
const PACKAGE_PING		= 10;		//	send on server side
const PACKAGE_PONG		= 11;		//	send on client side
const PACKAGE_TALK		= 20;		//
const PACKAGE_REQUEST		= 30;		//	send on client side
const PACKAGE_RESPONSE		= 31;		//	send on server side




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
		this.m_oRoot			= null;
		this.m_oMessage			= null;
		this.m_enumPackageType		= null;
		this.m_arrPackTypeValues	= null;
		this._loadProtocolBufferSync();
	}

	/**
	 *	check if the given package type is valid
	 *	@param	{number}	nPackageType
	 *	@return	{boolean}
	 */
	isValidPackageType( nPackageType )
	{
		return this.m_arrPackTypeValues &&
			Number.isInteger( nPackageType ) &&
			this.m_arrPackTypeValues.includes( nPackageType );
	}


	/**
	 *	calculate tag
	 *
	 * 	@public
	 *	@param	{number}	nPackageType
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody
	 *	@return {string|null}
	 */
	calculateTag( nPackageType, sEvent, oBody )
	{
		let sBody;
		let oPackage;

		if ( ! this.isValidPackageType( nPackageType ) )
		{
			return null;
		}
		if ( ! _p2pUtils.isObject( oBody ) )
		{
			return null;
		}

		//
		//	package format
		//
		sEvent		= String( sEvent );
		sBody		= JSON.stringify( oBody );
		oPackage	=
			{
				version	: String( _p2pConstants.version ),
				alt	: String( _p2pConstants.alt ),
				type	: nPackageType,
				event	: sEvent,
				body	: sBody
			};

		return _object_hash.getBase64Hash( oPackage );
	}


	/**
	 *	encode a JavaScript plain object to binary p2p package
	 *
	 * 	@public
	 *	@param	{number}	nPackageType
	 *	@param	{string}	sEvent
	 *	@param	{object}	oBody
	 *	@return {binary|null}
	 */
	encodePackage( nPackageType, sEvent, oBody )
	{
		let bufRet;
		let sBody;
		let sTag;
		let oMessageJson;
		let oMessageObj;

		if ( ! this.m_oMessage )
		{
			return null;
		}
		if ( ! this.isValidPackageType( nPackageType ) )
		{
			return null;
		}
		if ( ! _p2pUtils.isObject( oBody ) )
		{
			return null;
		}

		//	...
		bufRet		= null;
		sEvent		= String( sEvent );
		sTag		= oBody.tag;
		delete oBody.tag;

		sBody		= JSON.stringify( oBody );
		oMessageJson	=
			{
				version	: _p2pConstants.version,
				alt	: _p2pConstants.alt,
				type	: nPackageType,
				event	: sEvent,
				body	: sBody,
				tag	: sTag,
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
		let objRet;

		if ( ! this.m_oMessage )
		{
			return null;
		}

		//	...
		objRet	= null;

		try
		{
			objRet = this.m_oMessage.decode( bufPackage );
		}
		catch ( oErr )
		{
		}

		return objRet;
	}


	/**
	 *	decode a p2p encoded binary package to JavaScript plain object
	 *
	 * 	@public
	 *	@param	{binary}	bufPackage
	 *	@return {object}
	 */
	decodePackageToJson( bufPackage )
	{
		let oRet;
		let oMessageObj;

		if ( ! this.m_oMessage )
		{
			return null;
		}

		//	...
		oRet		= null;
		oMessageObj	= this.decodePackage( bufPackage );
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
	 * 	convert message object to JavaScript plain object
	 *
	 * 	@public
	 *	@param	{any}	oMessageObj
	 *	@return {object}
	 */
	getJsonByObject( oMessageObj )
	{
		if ( ! this.m_oMessage )
		{
			return null;
		}

		return this.m_oMessage.toObject( oMessageObj );
	}


	/**
	 *	load protocol buffer and initialize member variables
	 *
	 *	@private
	 *	@return {Promise<void>}
	 */
	async _loadProtocolBufferSync()
	{
		await this._loadProtocolBuffer()
		.then( oRoot =>
		{
			this.m_oRoot			= oRoot;
			this.m_oMessage			= oRoot.lookupType( 'trust_note_p2p_package.TrustNoteP2p' );
			this.m_enumPackageType		= oRoot.lookupEnum( 'trust_note_p2p_package.TrustNoteP2p.PackageType' );
			this.m_arrPackTypeValues	= Object.values( this.m_enumPackageType.values );
		})
		.catch( vError =>
		{
			throw new Error( vError );
		});
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
						//	rejected
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
 *	@exports
 *	@type	{CP2pPackage}
 */
module.exports	= CP2pPackage;

module.exports.PACKAGE_SYSTEM		= PACKAGE_SYSTEM;
module.exports.PACKAGE_PING		= PACKAGE_PING;
module.exports.PACKAGE_PONG		= PACKAGE_PONG;
module.exports.PACKAGE_TALK		= PACKAGE_TALK;
module.exports.PACKAGE_REQUEST		= PACKAGE_REQUEST;
module.exports.PACKAGE_RESPONSE		= PACKAGE_RESPONSE;
