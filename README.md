# Trustp2p
peer to peer network of TrustNote.


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

## Examples


```
const EventEmitter		= require( 'events' );

const CP2pPackage		= require( 'trustp2p/CP2pPackage.js' );
const _p2pConstants		= require( 'trustp2p/p2pConstants.js' );
const _p2pUtils			= require( 'trustp2p/CP2pUtils.js' );



/**
 *	heartbeat thread
 *	@class	CThreadHeartbeat
 *
 */
class CThreadHeartbeat extends EventEmitter
{
	/**
	 * 	@constructor
	 *
	 * 	@public
	 * 	@param	{object}	oNode
	 * 	@param	{object}	oNode.client	null or undefined if this is not a client instance
	 * 	@param	{object}	oNode.server	null or undefined if this is not a server instance
	 * 	@param	{object}	oNode.log
	 * 	@return	{void}
	 */
	constructor( oNode )
	{
		super();

		if ( ! _p2pUtils.isObject( oNode ) )
		{
			throw new Error( `constructor ${ this.constructor.name } with an invalid parameter oNode.` );
		}

		this.m_oNode			= oNode;
	}


	/**
	 *	events/handler map
	 *
	 * 	@public
	 *	@return {object}
	 */
	get eventMap()
	{
		return {
			[ CP2pPackage.PACKAGE_HEARTBEAT_PING ]	:
				{
					[ MESSAGE_PING ]	: this._handleMessagePing,	//	ping by server
				}
		}
	}

	/**
	 * 	start for this thread
	 * 	@public
	 */
	start()
	{
	}

	/**
	 * 	stop for this thread
	 * 	@public
	 */
	stop()
	{
	}


	/**
	 *	callee for listening event about a new client connected in
	 *
	 * 	@public
	 *	@param oSocket
	 */
	onSocketConnection( oSocket )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } a new client connected in.` );
	}

	/**
	 *	callee for listening event about a outbound connection was opened
	 *
	 * 	@public
	 *	@param oSocket
	 */
	onSocketOpen( oSocket )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } a new outbound connection was opened.` );
	}

	/**
	 *	callee for listening event about a socket was closed
	 *
	 * 	@public
	 *	@param oSocket
	 */
	onSocketClose( oSocket )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } received a close message about socket.` );
	}

	/**
	 *	callee for listening event about error of a socket
	 *
	 * 	@public
	 *	@param vError
	 */
	onSocketError( vError )
	{
		this.m_oNode.log.info( `> ${ this.constructor.name } received a error message about socket.` );
	}



	/**
	 *	received ping message coming from server
	 *
	 *	@public
	 *	@param	{object}	oSocket
	 *	@param	{object}	objMessage
	 *	@return	{boolean}
	 */
	_handleMessagePing( oSocket, objMessage )
	{
	}

}


/**
 *	@exports	CThreadHeartbeat
 */
module.exports	= CThreadHeartbeat;

```


## Documentation

##### get eventMap()

Register events you like here, trustp2p will transit all these events to you.

```
    return {
        [ CP2pPackage.PACKAGE_HEARTBEAT_PING ]	:
        {
            'ping'	: this._handleMessagePing,	//	ping by server
        }
    }
```

##### start()

    trustp2p will call this function at the moment while the thread was loaded by thread-bootstrap.


##### stop()

    trustp2p will call this function at the moment while the thread was unloaded by thread-bootstrap.

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

```
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

```
    if ( oSocket.bInbound )
    {
        //  I am a server, and I accept a client connected in
        //  Now, the connection for this client occurred an error
    }
```





