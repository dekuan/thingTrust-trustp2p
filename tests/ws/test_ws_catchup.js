const WebSocket			= process.browser ? global.WebSocket : require( 'ws' );


//const _peer	= 'wss://stable.trustnote.org/tn';
const _peer	= 'wss://kake.trustnote.org/tn';
const _msg	= '["request",{"command":"catchup","params":{"witnesses":["2SATGZDFDXNNJRVZ52O4J6VYTTMO2EZR","33RVJX3WBNZXJOSFCU6KK7O7TVEXLXGR","FYQXBPQWBPXWMJGCHWJ52AK2QMEOICR5","J3XIKRBU4BV2PX2BP4PSGIXDVND2XRIF","K5JWBZBADITKZAZDTHAPCU5FLYVSM752","KM5FZPIP264YRRWRQPXF7F7Y6ETDEW5Y","NBEFJ3LKG2SBSBK7D7GCFREOAFMS7QTQ","RIHZR7AHPVKZWTTDWI6UTKC7L73BJJQW","TIPXQ4CAO7G4C4P2P4PEN2KQK4MY73WD","X27CW2UWU5SGE647LK5SBTIPOOIQ7GJT","X6DWZUEW4IBFR77I46CAKTJVK4DBPOHE","XIM76DRNUNFWPXPI5AGOCYNMA3IOXL7V"],"last_stable_mci":0,"last_known_mci":0},"tag":"gLtnzwF9OyFyCCoSGil9/3Soh9zZuMLCiulzRQX5ciE="}]';

const oWs	= new WebSocket( _peer );


function __appendDateTime( arrArgs )
{
	if ( Array.isArray( arrArgs ) )
	{
		arrArgs.unshift( `[${ ( new Date() ).toString() }, ${ Date.now() }]` );
	}
	else
	{
		arrArgs = `[${ ( new Date() ).toString() }]`;
	}

	return arrArgs;
}
function log_info( ...args )
{
	__appendDateTime( args );
	console.log( ...args );
}








oWs.on( 'open', () =>
{
	//	...
	log_info( `connected to ${ _peer }` );
	oWs.send( _msg );
});
oWs.on( 'message', vMessage =>
{
	log_info( `RECEIVED : ${ vMessage }` );
});



oWs.on( 'close', () =>
{
	log_info( `socket was close` );
});

oWs.on( 'error', ( vError ) =>
{
	log_info( `error from server ${ _peer }: `, vError );
});

