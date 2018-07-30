const _redis		= require( 'redis' );
const WebSocket		= process.browser ? global.WebSocket : require( 'ws' );

const _redis_client	= _redis.createClient();

const { promisify }	= require('util');
const getAsync		= promisify( _redis_client.get ).bind( _redis_client );


//
//	https://redis.io/commands/set
//
console.time( 'trust_foo' );

// const url	= 'wss://byteball.org/bb';
// const ws	= new WebSocket( url );

//_redis_client.set( 'trust_foo', Date.now() );
_redis_client.set( 'trust_foo', Date.now(), 'EX', 100 );


let bGet = _redis_client.get( 'trust_foo', ( err, reply ) =>
{
	_redis_client.quit();

	//	...
	console.log( `trust_foo = ${ reply }` );
	console.timeEnd( 'trust_foo' );
});

console.log( `return value from redis client get = ${ bGet }` );