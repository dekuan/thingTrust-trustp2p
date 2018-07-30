# Trustp2p
peer to peer network of TrustNote.


### Architecture
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



### How It Works?

### Installation

### Examples

### Documentation

