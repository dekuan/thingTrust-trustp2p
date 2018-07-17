/*jslint node: true */
"use strict";

/**
 *	1, 类似于对象，也是键值对的集合，但是“键”的范围不限于字符串，各种类型的值（包括对象）都可以当作键。
 * 	   也就是说，Object 结构提供了“字符串—值”的对应，Map 结构提供了“值—值”的对应，是一种更完善的 Hash 结构实现。
 *
 *	2, Map 的键实际上是跟内存地址绑定的，只要内存地址不一样，就视为两个键。
 *	   这就解决了同名属性碰撞（clash）的问题，我们扩展别人的库的时候，如果使用对象作为键名，就不用担心自己的属性与原作者的属性同名。
 *
 *	3, WeakMap只接受对象作为键名（null除外），不接受其他类型的值作为键名。
 *
 *	   之前，有时我们想在某个对象上面存放一些数据，但是这会形成对于这个对象的引用。
 *	   一旦不再需要这两个对象，我们就必须手动删除这个引用，否则垃圾回收机制就不会释放e1和e2占用的内存。
 *	   一旦忘了写，就会造成内存泄露。
 *
 * 	   WeakMap的键名所指向的对象，不计入垃圾回收机制。
 *	   WeakMap 就是为了解决这个问题而诞生的，它的键名所引用的对象都是弱引用，即垃圾回收机制不将该引用考虑在内。因此，只要所引用的对象的其他引用都被清除，垃圾回收机制就会释放该对象所占用的内存。也就是说，一旦不再需要，WeakMap 里面的键名对象和所对应的键值对会自动消失，不用手动删除引用。
 *
 *	   基本上，如果你要往对象上添加数据，又不想干扰垃圾回收机制，就可以使用 WeakMap。
 *
 *
 *
 *
 *
 */


const m = new Map();

m.set('edition', 6)        // 键是字符串
m.set(262, 'standard')     // 键是数值
m.set(undefined, 'nah....')    // 键是 undefined
console.log( m.get( undefined ) );



/**
 *	先执行
 *	$ node --expose-gc
 *	--expose-gc参数表示允许手动执行垃圾回收机制。
 */
function test_weakMap()
{
	//	手动执行一次垃圾回收，保证获取的内存使用状态准确
	global.gc();
	//	undefined

	//	查看内存占用的初始状态，heapUsed 为 4M 左右
	process.memoryUsage();
	// { rss: 21106688,
	// 	heapTotal: 7376896,
	// 	heapUsed: 4153936,
	// 	external: 9059 }

	let wm = new WeakMap();
	//	undefined

	//	新建一个变量 key，指向一个 5*1024*1024 的数组
	let key = new Array(5 * 1024 * 1024);
	//	undefined

	// 设置 WeakMap 实例的键名，也指向 key 数组
	// 这时，key 数组实际被引用了两次，
	// 变量 key 引用一次，WeakMap 的键名引用了第二次
	// 但是，WeakMap 是弱引用，对于引擎来说，引用计数还是1
	wm.set( key, 1 );
	//WeakMap {}

	global.gc();
	//	undefined

	//	这时内存占用 heapUsed 增加到 45M 了
	process.memoryUsage();
	// { rss: 67538944,
	// 	heapTotal: 7376896,
	// 	heapUsed: 45782816,
	// 	external: 8945 }

	// 清除变量 key 对数组的引用，
	// 但没有手动清除 WeakMap 实例的键名对数组的引用
	key = null;
	//	null

	//	再次执行垃圾回收
	global.gc();
	//	undefined

	// 内存占用 heapUsed 变回 4M 左右，
	// 可以看到 WeakMap 的键名引用没有阻止 gc 对内存的回收
	process.memoryUsage();
	// { rss: 20639744,
	// 	heapTotal: 8425472,
	// 	heapUsed: 3979792,
	// 	external: 8956 }

}



//test_weakMap();