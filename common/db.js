/*jslint node: true */
"use strict";

var conf	= require( '../conf.js' );

var mysql			= require( 'mysql' );
var mysql_pool_constructor	= require( './mysql_pool.js' );
var pool			= mysql.createPool
(
	{
		//var pool  = mysql.createConnection({
		connectionLimit	: conf.database.max_connections,
		host		: conf.database.host,
		user		: conf.database.user,
		password	: conf.database.password,
		charset		: 'UTF8_UNICODE_CI',
		database	: conf.database.name
	}
);





function executeInTransaction( doWork, onDone )
{
	module.exports.takeConnectionFromPool
	(
		function( conn )
		{
			conn.query
			(
				"BEGIN",
				function()
				{
					doWork
					(
						conn,
						function( err )
						{
							conn.query
							(
								err ? "ROLLBACK" : "COMMIT",
								function()
								{
									conn.release();
									onDone( err );
								}
							);
						}
					);
				}
			);
		}
	);
}


/**
 *	exports
 */
module.exports				= mysql_pool_constructor( pool );
module.exports.executeInTransaction	= executeInTransaction;
