/**
 *	整个 Generator 函数就是一个封装的异步任务，或者说是异步任务的容器。异步操作需要暂停的地方，都用yield语句注明。
 *
 * 	co
 *	https://github.com/tj/co#readme
 *
 */
let co	= require( 'co' );


co( function * ()
{
	let arrValues;

	yield function *()
	{
		console.log( '# step 1, resolved' );
	};

	yield new Promise( ( resolve ) =>
		{
			console.log( '# step 2, start' );
			setTimeout( () =>
			{
				resolve();
				console.log( '# step 2, resolved' );
			}, 3000 );
		});

	yield function *()
	{
		console.log( '# step 3, resolved' );
	};


	//
	//	resolve multiple promises in parallel
	//
	arrValues = [ 1000, 2000, 3000 ];
	yield arrValues.map( x =>
	{
		return new Promise( ( resolve ) =>
		{
			console.log( '* start async in parallel for ' + x );

			setTimeout( () =>
			{
				console.log( '* resolved async in parallel for ' + x );
				resolve();

			}, Math.random() * 5000 );
		});
	});
});


// function* gen(x){
// 	try {
// 		var y = yield x + 2;
// 	} catch (e){
// 		console.log(e);
// 	}
// 	return y;
// }
//
// var g = gen(1);
// g.next();
// g.throw('出错了');
// g.throw('出错了ddddddddd');
// // 出错了