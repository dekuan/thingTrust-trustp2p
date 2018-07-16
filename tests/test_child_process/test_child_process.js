const { spawn }	= require('child_process');
//const child	= spawn('pwd');
//const child = spawn('find', ['.', '-type', 'f']);

const find = spawn('find', ['.', '-type', 'f']);
const child = spawn('wc', ['-l']);

find.stdout.pipe(child.stdin);

child.stdout.on('data', (data) => {
	console.log(`Number of files ${data}`);
});


// child.on( 'exit', function ( code, signal )
// {
// 	console.log( 'child process exited with ' + `code ${code} and signal ${signal}` );
// });
//
//
// child.stdout.on( 'data', ( data ) =>
// {
// 	console.log( `child stdout:\n${data}` );
// });
//
// child.stderr.on( 'data', ( data ) =>
// {
// 	console.error( `child stderr:\n${data}` );
// });
//
