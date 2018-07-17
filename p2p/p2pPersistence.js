/*jslint node: true */
"use strict";

let _db				= require( '../db.js' );
let _p2pUtils			= require( './p2pUtils.js' );



/**
 *	Library
 */
class CP2pPersistence
{
	static async addPeerHost( sHost )
	{
		return new Promise( ( resolve, reject ) =>
		{
			resolve();
		})
		.then( () =>
		{
		})
		.catch( () =>
		{
		});
	}

	/**
	 *	clear up all watch list
	 *	@returns {Promise<boolean>}
	 */
	static async clearWholeWatchList()
	{
		_db.query( "DELETE FROM watched_light_addresses" );
		_db.query( "DELETE FROM watched_light_units" );

		return true;
	}

	/**
	 *	remove a specified peer from watch list
	 *	@param sPeer
	 *	@returns {Promise<boolean>}
	 */
	static async removePeerFromWatchList( sPeer )
	{
		if ( ! _p2pUtils.isString( sPeer ) || 0 === sPeer.length )
		{
			return false;
		}

		_db.query( "DELETE FROM watched_light_addresses WHERE peer = ?", [ sPeer ] );
		_db.query( "DELETE FROM watched_light_units WHERE peer = ?", [ sPeer ] );
		//_db.query( "DELETE FROM light_peer_witnesses WHERE peer = ?", [ sPeer ] );

		return true;
	}

	/**
	 *	@public
	 *	@param sHost
	 *	@returns {Promise<boolean>}
	 */
	static async isGoodPeer( sHost )
	{
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
