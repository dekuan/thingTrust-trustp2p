class MyClass
{
	async test()
	{
		console.log( '##### test :: before call.' );
		let a = await MyClass._isGoodPeer( '' );
		console.log( '##### test :: after call.' );
	}

	static async _isGoodPeer( sHost )
	{
		let bRet;

		//	...
		bRet	= false;

		console.log( "# call _isGoodPeerQuery() ... 111" );

		await new Promise( ( resolve, reject ) =>
		{
			setTimeout( () =>
			{
				resolve( true );
			}, 2000 );
		})
		.then( function( vParam )
		{
			console.log( "# then ...", vParam );
			bRet = true;
		})
		.catch( function( vParam )
		{
			console.log( "# catch", vParam );
		});

		console.log( "# call _isGoodPeerQuery() ... 222" );


		return bRet;
	}
}



let my = new MyClass();
let aa = my.test();

console.log( 'aa = ', aa );


