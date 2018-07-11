/*jslint node: true */
"use strict";

/**
 *	1, Generator 函数是一个状态机，封装了多个内部状态。
 *
 *	2, 执行 Generator 函数会返回一个遍历器对象
 *	   也就是说，Generator 函数除了状态机，还是一个遍历器对象生成函数。返回的遍历器对象，可以依次遍历 Generator 函数内部的每一个状态。
 *
 *	3, Generator 函数可以不用yield表达式，这时就变成了一个单纯的暂缓执行函数。
 *
 * 	4, next 方法的参数
 *	   yield 表达式本身没有返回值，或者说总是返回 undefined。
 *	   next 方法可以带一个参数，该参数就会被当作上一个 yield 表达式的返回值。
 *
 * 	5, Generator.prototype.return()
 * 	   Generator 函数返回的遍历器对象，还有一个return方法，可以返回给定的值，并且终结遍历 Generator 函数。
 *
 * 	6, yield* 表达式
 *	   用来在一个 Generator 函数里面执行另一个 Generator 函数。
 *
 */




//
// let read = (function* () {
// 	yield 'hello';
// 	yield* 'hello';
// })();
//
// console.log( read.next() );	//	{ value: 'hello', done: false }
// console.log( read.next() );	//	{ value: 'h', done: false }
// console.log( read.next() );	//	{ value: 'e', done: false }
// console.log( read.next() );	//	{ value: 'l', done: false }
// console.log( read.next() );	//	{ value: 'l', done: false }
// console.log( read.next() );	//	{ value: 'o', done: false }
// console.log( read.next() );	//	{ value: undefined, done: true }




//
// function* objectEntries(obj) {
// 	let propKeys = Reflect.ownKeys(obj);
//
// 	for (let propKey of propKeys) {
// 		yield [propKey, obj[propKey]];
// 	}
// }
//
// let jane = { first: 'Jane', last: 'Doe' };
// for (let [key, value] of objectEntries(jane)) {
// 	console.log(`${key}: ${value}`);
// }
// // first: Jane
// // last: Doe





//
// function * fibonacci()
// {
// 	let [ prev, curr ] = [0, 1];
// 	for (;;) {
// 		yield curr;
// 		[ prev, curr ] = [ curr, prev + curr ];
// 	}
// }
// for ( let n of fibonacci() )
// {
// 	if ( n > 1000 )
// 		break;
// 	console.log( n );
// }
//


//
// //
// //	依次显示 5 个yield表达式的值。
// //	这里需要注意，一旦next方法的返回对象的done属性为true，for...of循环就会中止，且不包含该返回对象，
// //	所以上面代码的return语句返回的6，不包括在for...of循环之中。
// function * foo()
// {
// 	yield 1;
// 	yield 2;
// 	yield 3;
// 	yield 4;
// 	yield 5;
// 	return 6;
// }
// for ( let v of foo() )
// {
// 	console.log(v);
// }




//
// function* dataConsumer() {
// 	console.log('Started');
// 	console.log(`1. ${yield}`);
// 	console.log(`2. ${yield}`);
// 	return 'result';
// }
//
// let genObj = dataConsumer();
// console.log( genObj.next() );		//	Started
// 					//	{ value: undefined, done: false }
// console.log( genObj.next('a') );	//	1. a
// 					//	{ value: undefined, done: false }
// console.log( genObj.next('b') );	//	2. b
// 					//	{ value: 'result', done: true }
//





//
// function * foo( x )
// {
// 	let y	= 2 * ( yield ( x + 1 ) );
// 	let z	= yield ( y / 3 );
// 	return ( x + y + z );
// }
//
// let a = foo( 5 );
// console.log( a.next() );	//	{ value:6, done:false }
// console.log( a.next() );	//	{ value:NaN, done:false }
// console.log( a.next() );	//	{ value:NaN, done:true }
//
// let b = foo( 5 );
// console.log( b.next() );	//	{ value:6, done:false }
// console.log( b.next( 12 ) );	//	{ value:8, done:false }		( 12 * 2 ) / 3 = 8
// console.log( b.next( 13 ) );	//	{ value:42, done:true }		( 5 + ( 12 * 2 ) + 13 ) = 42
//






function * f()
{
	for( let i = 0; true; i++ )
	{
		//
		//	yield表达式本身没有返回值，或者说总是返回undefined。
		//	next方法可以带一个参数，该参数就会被当作上一个yield表达式的返回值。
		//
		let reset = yield i;
		if ( reset )
		{
			i = -1;
		}
	}
}
let g = f();

console.log( g.next() );	// { value: 0, done: false }
console.log( g.next() );	// { value: 1, done: false }
console.log( g.next() );	// { value: 2, done: false }
console.log( g.next( true ) );	// { value: 0, done: false }
console.log( g.next() );	// { value: 1, done: false }
console.log( g.next() );	// { value: 1, done: false }
console.log( g.next() );	// { value: 1, done: false }






//
// //
// //	Generator 函数赋值给Symbol.iterator属性，
// //	从而使得 myIterable 对象具有了 Iterator 接口，可以被 ... 运算符遍历了。
// //
// let myIterable = {};
// //myIterable[ Symbol.iterator ].next();
// myIterable[ Symbol.iterator ] = function * ()
// {
// 	yield 1;
// 	yield 2;
// 	yield 3;
// };
// console.log( [ ... myIterable ] );	//	[1, 2, 3]
//





// function* f() {
// 	console.log('执行了！')
// }
//
// var generator = f();
//
// setTimeout(function () {
// 	generator.next()
// }, 2000);






//
// function* helloWorldGenerator() {
// 	yield 'hello';
// 	yield 'world';
// 	return 'ending';
// }
// let hw = helloWorldGenerator();
//
// console.log( hw.next() );
// // { value: 'hello', done: false }
//
// console.log( hw.next() );
// // { value: 'world', done: false }
//
// console.log( hw.next() );
// // { value: 'ending', done: true }
//
// console.log( hw.next() );
// // { value: undefined, done: true }
//

