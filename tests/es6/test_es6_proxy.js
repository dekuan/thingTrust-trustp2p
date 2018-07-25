const proxy = new Proxy({}, {
	get: function(target, property) {
		return 35;
	}
});

class A
{
	constructor()
	{
	}

	get cDriver()
	{
		return 1;
	}

	set cDriver( cClass )
	{
	}

	getKeys()
	{
		return [ 1, 2, 3, 4, 5 ];
	}
}
class B extends A
{

}



function getClassMethods( objObject )
{
	let setRet;
	let arrKeys;

	try
	{
		setRet = new Set();
		while ( true )
		{
			objObject = Reflect.getPrototypeOf( objObject );
			if ( ! objObject )
			{
				break;
			}

			//	...
			arrKeys	= Reflect.ownKeys( objObject );
			if ( Array.isArray( arrKeys ) && arrKeys.length > 0 )
			{
				arrKeys.forEach( sKey => setRet.add( sKey ) );
			}
		}
	}
	catch ( vError )
	{
	}

	return Array.from( setRet );
}




console.log( `class A isExtensible = ${ Reflect.isExtensible( A ) }.` );
console.log( `class B isExtensible = ${ Reflect.isExtensible( B ) }.` );
console.log( `Reflect.getPrototypeOf A =`, Reflect.getPrototypeOf( A ) );
console.log( `keys in class A =`, getClassMethods( new A() ) );
console.log( `keys in class B =`, getClassMethods( new B() ) );
console.log( proxy.time, proxy.name, proxy.title );

