const EventEmitter		= require( 'events' );


class A extends EventEmitter
{
	constructor()
	{
		super();

		const oEventMap	=
			{
				'event'	: [ this._handle1, this._handle2, this._handle3 ]
			};

		Object.entries( oEventMap ).forEach( ( [ sEventName, arrHandlers ] ) =>
		{
			arrHandlers.forEach( handler =>
			{
				this.on( sEventName, handler );
			});
		});

		setTimeout( () =>
		{
			this.emit( 'event', 111 );
		});
	}

	_handle1( oSocket )
	{
		console.log( `[_handle1] Received event` );
	}

	_handle2( oSocket )
	{
		console.log( `[_handle2] Received event` );
	}

	_handle3( oSocket )
	{
		console.log( `[_handle3] Received event` );
	}



}

//let aaa = new A();




function loga( ... args )
{
	if ( Array.isArray( args ) )
	{
		args.unshift( `[${ ( new Date() ).toString() }]` );
	}
	else
	{
		args = `[${ ( new Date() ).toString() }]`;
	}

	console.log( ...args );
}


loga( "222222", [ 1, 2, 3, 4 ] );