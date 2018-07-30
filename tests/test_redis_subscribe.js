const _redis	= require("redis");
const _sub	= _redis.createClient();
const _channel	= 'my_channel';

let m_nMsgCount	= 0;


_sub.on('connect', function()
{
	console.log( 'Redis client was connected' );

	//	...
	_sub.subscribe( _channel );
});
_sub.on( "message", function( channel, message )
{
	console.log( `[${ (new Date()).toString() }] Received message on channel (${channel}): ${message}.` );
	m_nMsgCount ++;

	// if ( msg_count === 3 )
	// {
	// 	sub.unsubscribe();
	// 	sub.quit();
	// 	pub.quit();
	// }
});
