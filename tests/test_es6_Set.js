/*jslint node: true */
"use strict";

/**
 *	1, set 的 key 重复，且被排序
 *	2，WeakSet 的成员只能是对象，而不能是其他类型的值。
 *
 *
 *
 *
 *
 */

//
// class CMyMap
// {
// 	constructor()
// 	{
// 		setTimeout
// 		(
// 			() =>
// 			{
// 				console.log( 'this is : ', this );
// 			},
// 			100
// 		);
// 	}
//
// 	run()
// 	{
//
// 	}
// }
//
// let a = new CMyMap();




//
//	Set
//
let _setQueue	= new Set( [ 1, 2, 3, 8, 9, 7, 7, 1 ] );
_setQueue.add( 100 );
_setQueue.add( 100 );
_setQueue.add( 100 );
_setQueue.add( 100 );
_setQueue.add( 0 );
_setQueue.add( 0 );

//_setQueue	= new Set( [..._setQueue].sort() );
console.log( _setQueue );





