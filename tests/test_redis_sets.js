const _redis		= require( 'redis' );
const _redis_client	= _redis.createClient();

const { promisify }	= require('util');
const saddAsync		= promisify( _redis_client.sadd ).bind( _redis_client );



//	...
console.time( 'redis-sets' );
_redis_client.sadd
(
	[ 'tags', 'angular-js', 'backbone-js', 'ember-js', 'ember-js', 'ember-js', 'ember-js' ],
	function( err, reply )
	{
		console.log( `reply by calling sadd : ${ reply }` );

		//	...
		_redis_client.smembers
		(
			'tags', function( err, reply )
			{
				console.log( `reply by calling smembers :` );
				console.log( reply );

				//	...
				_redis_client.del( 'tags', function( err, reply )
				{
					console.log( `reply by calling del : ${ reply }` );

					//	...
					console.log( `` );
					console.timeEnd( 'redis-sets' );
				});
			}
		);
	}
);
