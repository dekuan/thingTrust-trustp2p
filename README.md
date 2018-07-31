# Trustp2p
A peer to peer network framework by TrustNote Foundation.


## Features
* Write every events by thread plugin.
* Transmit messages between peers via Protocol Buffer.
* Peers communicate each other with concordant message structure.



## Architecture
```
Node( client, server )
    ThreadBootstrap
        threads
            threads-available
                CThreadHeartbeat
                CThreadNode
                CThreadCatchup
                CThread...
            threads-enabled
    Driver
        Adapters
            Web Socket
            ...
    Deliver
        Request, Response
            CP2pMessage
                CP2pPackage
                    Protocol Buffer

```



## How It Works?

## Installation

```
$ npm install trustp2p
```


## Get Started

trustp2p will try to load all threads in directory threads-enabled.
So, the first thing is to create 2 sub-directories in your project directory.
```
$ mkdir threads-available
$ mkdir threads-enabled
```

And, then I strongly recommend that you copy thread-available/CThreadHeartbeat.js to ./thread-available/CThreadHeartbeat.js and make it works.
Following these steps:
```
$ cd threads-enabled
$ ln -s ../threads-available/CThreadHeartbeat.js
```

As you can see in thread-available/CThreadHeartbeat.js, go ahead and try to write your own thread now!


## Examples

### Thread
[CThreadHeartbeat.js](threads-available/CThreadHeartbeat.js)





## Documentation

### createServer

```
const _trustp2p		= require( 'trustp2p' );

/**
 *	constants
 *	@type {{}}
 */
const _oOptions		= {
	cwd : __dirname
};


/**
 *	create server
 */
_trustp2p.createServer( _oOptions );
```


### createClient

```
const _trustp2p		= require( 'trustp2p' );


/**
 *	constants
 *	@type {{}}
 */
const _oOptions		= {
	cwd : __dirname
};


/**
 *	create server
 */
_trustp2p.createClient( _oOptions );
```


### Thread

##### get eventMap()

Register events you like here, trustp2p will transit all these events to you.

```js
return {
    [ CP2pPackage.PACKAGE_HEARTBEAT_PING ]	:
    {
        'ping'	: this._handleMessagePing,	//	ping by server
    }
}
```

##### start()

trustp2p will call this method at the moment while the thread was loaded by thread-bootstrap.


##### stop()

trustp2p will call this method at the moment while the thread was unloaded by thread-bootstrap.

##### onSocketConnection( oSocket )

If you implement this method in your thread,
trustp2p will thansit CP2pDriver.EVENT_CONNECTION events to you while new clients connected in.

##### onSocketOpen( oSocket )

If you implement this method in your thread,
trustp2p will thansit CP2pDriver.EVENT_OPEN events to you while your thread connected to servers.


##### onSocketClose( oSocket )

If you implement this method in your thread,
trustp2p will thansit CP2pDriver.EVENT_CLOSE events to you while the connection specified by oSocket was closed.

And, if you want to known which side we're on, please check the variable oSocket.bInbound.

```js
    if ( oSocket.bInbound )
    {
        //  I am a server, and I accept a client connected in
        //  Now, the connection for this client was closed
    }
```

##### onSocketError( vError )

If you implement this method in your thread,
trustp2p will thansit CP2pDriver.EVENT_ERROR events to you while the connection specified by oSocket occurred an error.

And, if you want to known which side we're on, please check the variable oSocket.bInbound.

```js
    if ( oSocket.bInbound )
    {
        //  I am a server, and I accept a client connected in
        //  Now, the connection for this client occurred an error
    }
```





