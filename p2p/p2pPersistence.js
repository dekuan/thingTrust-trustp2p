/*jslint node: true */
"use strict";

let _db			= require( '../db.js' );
let _p2pConstants	= require( './p2pConstants.js' );
let _p2pUtils		= require( './p2pUtils.js' );
let CP2pNerve		= require( './p2pNerve.js' );
const CP2pDriver	= require( './driver/p2pDriver.js' );


/**
 *	Library
 */
class CP2pPersistence
{
	constructor()
	{
		this.m_cP2pNerve	= new CP2pNerve();
	}

	getHostByPeer( sUrl )
	{
		let arrMatches;

		//
		//	this regex will match wss://xxx and ws://xxx
		//
		arrMatches = sUrl.match( /^wss?:\/\/(.*)$/i );
		if ( Array.isArray( arrMatches ) && arrMatches.length >= 1 )
		{
			sUrl = arrMatches[ 1 ];
		}

		//	...
		arrMatches	= sUrl.match( /^(.*?)[:\/]/ );
		return ( Array.isArray( arrMatches ) && arrMatches.length >= 1 ) ? arrMatches[ 1 ] : sUrl;
	}

	/**
	 *	get key by peer
	 *
	 *	@param	{string}	sType
	 *	@param	{string}	sUrl
	 *	@returns {*}
	 */
	getKeyByPeer( sType, sUrl )
	{
		if ( ! _p2pUtils.isString( sType ) || 0 === sType.length )
		{
			return null;
		}
		if ( ! [ CP2pDriver.DRIVER_TYPE_CLIENT, CP2pDriver.DRIVER_TYPE_SERVER ].includes( sType ) )
		{
			return null;
		}

		return `p2p_peer_${ sType }_${ this.getHostByPeer( sUrl ) }`;
	}


	/**
	 *	add server peer synchronously
	 *
	 *	@param	{string}	sUrl
	 *	@returns {boolean}
	 */
	async addServerSync( sUrl )
	{
		return this.addPeerSync( CP2pDriver.DRIVER_TYPE_SERVER, sUrl );
	}

	/**
	 * 	add server peer
	 *	@param	{string}	sUrl
	 *	@returns {Promise<any>}
	 */
	async addServer( sUrl )
	{
		return this.addPeer( CP2pDriver.DRIVER_TYPE_SERVER, sUrl );
	}


	/**
	 *	add client peer synchronously
	 *
	 *	@param	{string}	sUrl
	 *	@returns {boolean}
	 */
	async addClientSync( sUrl )
	{
		return this.addPeerSync( CP2pDriver.DRIVER_TYPE_CLIENT, sUrl );
	}

	/**
	 * 	add client peer
	 *	@param	{string}	sUrl
	 *	@returns {Promise<any>}
	 */
	async addClient( sUrl )
	{
		return this.addPeer( CP2pDriver.DRIVER_TYPE_CLIENT, sUrl );
	}

	/**
	 *	add server to storage synchronously
	 *
	 *	@param	{string}	sType
	 *	@param	{string}	sUrl
	 *	@returns {boolean}
	 */
	async addPeerSync( sType, sUrl )
	{
		let bRet;

		//	...
		bRet	= false;
		await this.addPeer( sType, sUrl )
		.then( () =>
		{
			bRet = true;
		})
		.catch( () =>
		{
		});

		return bRet;
	}

	/**
	 *	add server to storage
	 *
	 *	@param	{string}	sType
	 *	@param	{string}	sUrl
	 *	@returns {Promise<any>}
	 */
	async addPeer( sType, sUrl )
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let sKey;

			if ( ! _p2pUtils.isString( sUrl ) || 0 === sUrl.length )
			{
				//	rejected
				return pfnReject( `addServer with invalid url.` );
			}

			//	...
			sUrl	= sUrl.trim().toLocaleLowerCase();
			sKey	= this.getKeyByPeer( sType, sUrl );
			if ( ! this.m_cP2pNerve.isKeyExistsSync( sKey ) )
			{
				this.m_cP2pNerve.setStringValue( sKey, sUrl );
				pfnResolve( `add server successfully.` );
			}
			else
			{
				return pfnResolve( `server already added before.` );
			}
		});
	}


	/**
	 *	clear up all watch list synchronously
	 *
	 * 	@public
	 *	@returns {boolean}
	 */
	async clearWholeWatchListSync()
	{
		let bRet;

		//	...
		bRet	= false;
		await this.clearWholeWatchList()
		.then( () =>
		{
			bRet = true;
		})
		.catch( () =>
		{
		});

		//	...
		return bRet;
	}

	/**
	 *	clear up all watch list
	 *
	 * 	@public
	 *	@returns {Promise<null>}
	 */
	async clearWholeWatchList()
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			// _db.query( "DELETE FROM watched_light_addresses" );
			// _db.query( "DELETE FROM watched_light_units" );
			pfnResolve();
		});
	}

	/**
	 *	remove a specified peer from watch list
	 *	@param sPeer
	 *	@returns {Promise<boolean>}
	 */
	async removePeerFromWatchList( sPeer )
	{
		if ( ! _p2pUtils.isString( sPeer ) || 0 === sPeer.length )
		{
			return false;
		}

		//## _db.query( "DELETE FROM watched_light_addresses WHERE peer = ?", [ sPeer ] );
		//## _db.query( "DELETE FROM watched_light_units WHERE peer = ?", [ sPeer ] );
		//_db.query( "DELETE FROM light_peer_witnesses WHERE peer = ?", [ sPeer ] );

		return true;
	}

	/**
	 *	@public
	 *	@param sHost
	 *	@returns {Promise<boolean>}
	 */
	async isGoodPeer( sHost )
	{
		return true;

		let bRet;

		if ( ! _p2pUtils.isString( sHost ) || 0 === sHost.length )
		{
			return false;
		}

		//	...
		bRet = false;

		//	...
		await new Promise( ( resolve, reject ) =>
		{
			//
			//	calculate the counts of elements in status invalid and new_good
			//	from table [peer_events] by peer_host for a hour ago.
			//
			_db.query
			(
				"SELECT \
					SUM( CASE WHEN event='invalid' THEN 1 ELSE 0 END ) AS count_invalid, \
					SUM( CASE WHEN event='new_good' THEN 1 ELSE 0 END ) AS count_new_good \
					FROM peer_events WHERE peer_host = ? AND event_date > " + _db.addTime( "-1 HOUR" ),
				[
					//	remote host/sRemoteAddress connected by this ws
					sHost
				],
				( rows ) =>
				{
					let oStats;

					//	...
					oStats = rows[ 0 ];
					if ( 0 === oStats.count_invalid ||
						null === oStats.count_invalid )
					{
						resolve();
					}
					else
					{
						//
						//	CONNECTION WAS REJECTED
						//	this peer have invalid events before
						//
						reject();
					}
				}
			);
		})
		.then( () =>
		{
			//	resolved
			bRet	= true;
		})
		.catch( () =>
		{
			//	rejected
			bRet	= false;
		});

		//	...
		return bRet;
	}
}




/**
 *	exprots
 */
module.exports	= CP2pPersistence;
