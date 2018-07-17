const cluster		= require('cluster');
const os		= require('os');

const _redis		= require( 'redis' );
const _redis_client	= _redis.createClient();

const { promisify }	= require('util');
const getAsync		= promisify( _redis_client.get ).bind( _redis_client );



async function getByBat()
{
	let arrData	= [];
	let i;

	console.time( `getByBat[${ process.pid }]` );

	for ( i = 0; i < 10000; i ++ )
	{
		_redis_client.set( 'foo', Date.now() );
		arrData.push( await getAsync( 'foo' ) );
	}

	console.timeEnd( `getByBat[${ process.pid }]` );
}




if ( cluster.isMaster )
{
	const nCPUNumber	= os.cpus().length;

	console.log( `Forking for ${nCPUNumber} CPUs` );
	for ( let i = 0; i < nCPUNumber; i++ )
	{
		cluster.fork();
	}
}
else
{
	console.log( `Started child process [${ process.pid }] for calculation ...` );
	getByBat();
}



