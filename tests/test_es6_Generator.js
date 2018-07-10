/*jslint node: true */
"use strict";

/**
 *	1, Generator 函数是一个状态机，封装了多个内部状态。
 *
 *	2, 执行 Generator 函数会返回一个遍历器对象
 *	   也就是说，Generator 函数除了状态机，还是一个遍历器对象生成函数。返回的遍历器对象，可以依次遍历 Generator 函数内部的每一个状态。
 *
 */

function* helloWorldGenerator() {
	yield 'hello';
	yield 'world';
	return 'ending';
}

let hw = helloWorldGenerator();


console.log( hw.next() );
// { value: 'hello', done: false }

console.log( hw.next() );
// { value: 'world', done: false }

console.log( hw.next() );
// { value: 'ending', done: true }

console.log( hw.next() );
// { value: undefined, done: true }


