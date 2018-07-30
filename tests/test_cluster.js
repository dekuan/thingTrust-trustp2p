const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

console.log( `[ ${process.pid} ] started ..........` );

if (cluster.isMaster) {
	console.log(`主进程 ${process.pid} 正在运行`);

	// 衍生工作进程。
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on('exit', (worker, code, signal) => {
		console.log(`工作进程 ${worker.process.pid} 已退出`);
	});
} else {
	// 工作进程可以共享任何 TCP 连接。
	// 在本例子中，共享的是一个 HTTP 服务器。
	http.createServer((req, res) => {
		res.writeHead(200);
		res.end('你好世界\n');
	}).listen(8000);

	console.log(`工作进程 ${process.pid} 已启动`);
}



// let cluster = require('cluster');
// let data = 0;//这里定义数据不会被所有进程共享，各个进程有各自的内存区域
// if ( cluster.isMaster )
// {
// 	//	主进程
// 	let numCPUs = require('os').cpus().length;
// 	for ( let i = 0; i < numCPUs; i++ )
// 	{
// 		console.log( `cluster.fork() ${ i } of ${ numCPUs }.` );
// 		let worker = cluster.fork();
// 	}
// 	data ++;
// 	console.log( `DATA VALUE in MainProcess[${ process.pid }]: ${ data }` );
// }
// else
// {
// 	//	子进程，会被调用 numCPUs 次
// 	data ++;
// 	console.log( `DATA VALUE in ChildProcess[${ process.pid }] ${cluster.worker.id}: ${data}`  );
// }

