let arrLines	= [ 'a', 1, 2, 100, 11, 10, 19, 31 ];
let arrNumber	= arrLines.map( Number );
let arrOdd	= arrLines.filter( n => 1 === n % 2 );

console.time( 'a' );
console.log( arrLines, arrNumber, arrOdd );
console.timeEnd( 'a' );
