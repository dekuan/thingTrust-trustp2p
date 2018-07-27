class A
{
	async fun2()
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			console.log( Date.now() );
			pfnResolve();
		});
	}

	async fun1()
	{
		for ( let i = 0; i < 100; i ++ )
		{
			await this.fun2();
		}
	}
}


let a = new A();
a.fun1();