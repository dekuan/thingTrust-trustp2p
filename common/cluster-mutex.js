/*jslint node: true */
"use strict";

const _			= require( 'lodash' );
const _redis		= require( 'redis' );
const _redis_client	= _redis.createClient();
//require('./enforce_singleton.js');


let m_nInterval			= null;
let m_arrQueuedJobs		= [];
let m_arrLockedKeyArrays	= [];



/**
 *	lock
 */
function lock( arrKeys, pfnProcedure, pfnNextProcedure )
{
	if ( null === _startInterval )
	{
		_startInterval();
	}

	//	...
	if ( _isAnyOfKeysLocked( arrKeys ) )
	{
		console.log( 'queuing job held by keys', arrKeys );
		m_arrQueuedJobs.push
		(
			{
				arrKeys		: arrKeys,
				procedure	: pfnProcedure,
				nextProcedure	: pfnNextProcedure,
				ts		: Date.now()
			}
		);
	}
	else
	{
		_execute( arrKeys, pfnProcedure, pfnNextProcedure );
	}
}


function lockOrSkip( arrKeys, pfnProcedure, pfnNextProcedure )
{
	if ( null === _startInterval )
	{
		_startInterval();
	}

	//	...
	if ( _isAnyOfKeysLocked( arrKeys ) )
	{
		console.log( 'skipping job held by keys', arrKeys );
		if ( pfnNextProcedure )
		{
			pfnNextProcedure();
		}
	}
	else
	{
		_execute( arrKeys, pfnProcedure, pfnNextProcedure );
	}
}

function getCountOfQueuedJobs()
{
	return m_arrQueuedJobs.length;
}

function getCountOfLocks()
{
	return m_arrLockedKeyArrays.length;
}






////////////////////////////////////////////////////////////////////////////////
//	Private
//

function _isAnyOfKeysLocked( arrKeys )
{
	let i;
	let j;
	let arrLockedKeys;

	for ( i = 0; i < m_arrLockedKeyArrays.length; i ++ )
	{
		arrLockedKeys = m_arrLockedKeyArrays[ i ];
		for ( j = 0; j < arrLockedKeys.length; j ++ )
		{
			if ( arrKeys.indexOf( arrLockedKeys[ j ] ) !== -1 )
			{
				return true;
			}
		}
	}

	return false;
}

function _release( arrKeys )
{
	let i;

	for ( i = 0; i < m_arrLockedKeyArrays.length; i ++ )
	{
		if ( _.isEqual( arrKeys, m_arrLockedKeyArrays[ i ] ) )
		{
			m_arrLockedKeyArrays.splice( i, 1 );
			return;
		}
	}
}

function _execute( arrKeys, pfnProcedure, pfnNextProcedure )
{
	let bLocked;

	m_arrLockedKeyArrays.push( arrKeys );
	console.log( "lock acquired", arrKeys );

	//	...
	bLocked = true;
	pfnProcedure
	(
		function()
		{
			if ( ! bLocked )
			{
				throw Error( "double unlock?" );
			}

			bLocked = false;
			_release( arrKeys );
			console.log( "lock released", arrKeys );

			if ( pfnNextProcedure )
			{
				pfnNextProcedure.apply( pfnNextProcedure, arguments );
			}

			//	...
			_handleQueue();
		}
	);
}

function _handleQueue()
{
	let i;
	let job;

	//	...
	console.log( "_handleQueue " + m_arrQueuedJobs.length + " items" );
	for ( i = 0; i < m_arrQueuedJobs.length; i ++ )
	{
		job	= m_arrQueuedJobs[ i ];
		if ( _isAnyOfKeysLocked( job.arrKeys ) )
		{
			continue;
		}

		//	do it before _execute as _execute can trigger another job added, another lock unlocked, another _handleQueue called
		m_arrQueuedJobs.splice( i, 1 );
		console.log( "starting job held by keys", job.arrKeys );

		//	...
		_execute( job.arrKeys, job.procedure, job.nextProcedure );

		//	we've just removed one item
		i --;
	}

	console.log( "_handleQueue done " + m_arrQueuedJobs.length + " items" );
}

function _checkForDeadlocks()
{
	let i;
	let job;

	for ( i = 0; i < m_arrQueuedJobs.length; i ++ )
	{
		job	= m_arrQueuedJobs[ i ];
		if ( Date.now() - job.ts > 30 * 1000 )
		{
			throw Error
			(
				"possible deadlock on job " + require('util').inspect(job) + ",\n"
				+ "procedure:" + job.procedure.toString() + " \n"
				+ "all jobs: " + require('util').inspect( m_arrQueuedJobs, { depth: null } )
			);
		}
	}
}




/**
 *	long running locks are normal in multisig scenarios
 *	setInterval(_checkForDeadlocks, 1000);
 */
function _startInterval()
{
	if ( m_nInterval )
	{
		return false;
	}

	m_nInterval = setInterval
	(
		function()
		{
			console.log
			(
				"queued jobs: " + JSON.stringify
				(
					m_arrQueuedJobs.map
					(
						function( job )
						{
							return job.arrKeys;
						}
					)
				) + ", locked keys: " + JSON.stringify( m_arrLockedKeyArrays )
			);
		},
		10000
	);
}
function _clearInterval()
{
	if ( m_nInterval )
	{
		_clearInterval( m_nInterval );
		m_nInterval = null;
	}
}





/**
 *	exports
 */
exports.lock			= lock;
exports.lockOrSkip		= lockOrSkip;
exports.getCountOfQueuedJobs	= getCountOfQueuedJobs;
exports.getCountOfLocks		= getCountOfLocks;


/*
function test(key){
	let loc = "localvar"+key;
	lock(
		[key],
		function(cb){
			console.log("doing "+key);
			setTimeout(function(){
				console.log("done "+key);
				cb("arg1", "arg2");
			}, 1000)
		},
		function(arg1, arg2){
			console.log("got "+arg1+", "+arg2+", loc="+loc);
		}
	);
}

test("key1");
test("key2");
*/
