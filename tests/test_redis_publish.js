const _redis	= require( 'redis' );

const _pub	= _redis.createClient();
const _channel	= 'my_channel';



function publishByBatch()
{
	_pub.publish( _channel, `It's time ${ ( new Date() ).toString() }, I am sending you a message.` );
	_pub.publish( _channel, `I am sending a second message.` );
	_pub.publish( _channel, `I am sending my last message.` );
}

_pub.on( 'connect', function()
{
	console.log( 'Redis client was connected' );

	//	...
	setInterval( () =>
	{
		publishByBatch();

	}, 100 );
});

//_pub.quit();