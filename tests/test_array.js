let WebSocket			= process.browser ? global.WebSocket : require( 'ws' );


let arrLines	= [ 'a', 1, 2, 100, 11, 10, 19, 31 ];
let arrNumber	= arrLines.map( Number );
let arrOdd	= arrLines.filter( n => 1 === n % 2 );

// console.time( 'a' );
// console.log( arrLines, arrNumber, arrOdd );
// console.timeEnd( 'a' );
//

let oObj1	= { key : 1 };
let oObj2	= { key : 2 };
let oObj3	= { key : 3 };
let oObjSock	= new WebSocket( 'wss://byteball.org/bb' );
oObjSock.peer	= 'wss://byteball.org/bb';

let arrTest	= [ oObj1, oObj2, oObjSock ];
let arrFilter	= arrTest.filter( obj => obj.key === 100 );
let oResult	= {
	bInc1		: arrTest.includes( oObj1 ),
	bInc2		: arrTest.includes( oObj2 ),
	bInc3		: arrTest.includes( oObj3 ),
	bIncSock	: arrTest.includes( oObjSock ),
};

console.log( arrFilter );
