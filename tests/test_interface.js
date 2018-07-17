class iConnectionDriver
{
	constructor( oOptions, oCallbacks )
	{
		this.assertOptions( oOptions );
		this.assertCallbacks( oCallbacks );

		this.m_oOptions	= { 'key1' : 1 };
	}

	get oOptions()
	{
		return this.m_oOptions;
	}


	assertOptions( oOptions )
	{
		if ( 'object' !== typeof oOptions )
		{
			throw new Error( 'parameter oOptions must be a plain object.' );
		}
	}

	assertCallbacks( oCallbacks )
	{
		let sFunctionName;

		//	...
		if ( 'object' === typeof oCallbacks )
		{
			for ( sFunctionName of [ 'onConnected', 'onMessage', 'onClosed', 'onError' ] )
			{
				if ( oCallbacks.hasOwnProperty( sFunctionName ) &&
					'function' !== typeof( oCallbacks[ sFunctionName ] ) )
				{
					throw new Error( `parameter oCallbacks.${ sFunctionName } must be a function object.` );
				}
			}
		}
		else
		{
			throw new Error( 'parameter oCallbacks must be a plain object.' );
		}
	}
}


class CConnectionDriverWs extends iConnectionDriver
{
	constructor( oOptions, oCallbacks )
	{
		super( oOptions, oCallbacks );
	}

	onConnected( oSocket )
	{
		console.log( `onConnected was invoked on ${ this.constructor.name }, ${ super.oOptions }` );
	}

	onMessage( oSocket, oMessage )
	{
		console.log( `onMessage was invoked on ${ this.constructor.name }` );
	}

	onClosed( oSocket )
	{
		console.log( `onClosed was invoked on ${ this.constructor.name }` );
	}

	onError( oSocket )
	{
		console.log( `onError was invoked on ${ this.constructor.name }` );
	}
}


console.time( 'time' );
console.time( 'time2' );

let obj = new CConnectionDriverWs( {}, {} );
obj.onConnected( 1 );
obj.onMessage( 1 );
obj.onClosed( 1 );
obj.onError( 1 );

console.timeEnd( 'time' );
console.timeEnd( 'time2' );

console.log( Object.assign( {}, { 'key1' : 1, 'key2' : 2 }, null ) );



/**
 *	exports
 *	@type {iConnectionDriver}
 */
exports	= iConnectionDriver;
