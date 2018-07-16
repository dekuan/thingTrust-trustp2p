// cluster.js
const cluster = require('cluster');
const os = require('os');

if ( cluster.isMaster )
{
	const cpus = os.cpus().length;

	console.log(`Forking for ${cpus} CPUs`);
	for (let i = 0; i<cpus; i++) {
		cluster.fork();
	}
} else {
	require('./server');
}





function restartWorker( nWorkerIndex )
{
	const arrWorkers	= Object.values( cluster.workers );
	const oWorker		= arrWorkers[ nWorkerIndex ];

	if ( ! oWorker )
	{
		console.log( `# Worker at index ${ nWorkerIndex } is invalid.` );
		return;
	}

	oWorker.on( 'exit', () =>
	{
		if ( ! oWorker.exitedAfterDisconnect )
		{
			console.log( `# Do not use .disconnect method on worker.` );
			return;
		}


		console.log( `* Exited process ${oWorker.process.pid}` );

		let oChild	= cluster.fork();
		oChild.on( 'listening', () =>
		{
			//
			//	tells us that this worker is connected and ready.
			//	When we get this event, we can safely restart the next worker in sequence.
			//
			console.log( `* Worker at index ${ nWorkerIndex } is ready.` );
			console.log( `* Try to restart worker at index ${ nWorkerIndex + 1 } ...` );
			restartWorker( nWorkerIndex + 1 );
		});
	});

	oWorker.disconnect();
}


if ( cluster.isMaster )
{
	process.on( 'SIGUSR2', () =>
	{
		console.log( `>>> Received Signal SIGUSR2` );
		restartWorker( 0 );
	});
}
