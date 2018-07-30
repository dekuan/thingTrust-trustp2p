'use strict';

const CP2pClient 	= require( './CP2pClient.js' );
const CP2pServer 	= require( './CP2pServer.js' );



/**
 *	@module	TrustP2p
 */
class CTrustP2p
{
	/**
	 *	create server instance
	 *
	 *	@public
	 *	@static
	 *	@param	oOptions
	 *	@return {CP2pServer}
	 */
	static createServer( oOptions )
	{
		const p2pServer	= new CP2pServer( oOptions );
		p2pServer.startServer();

		//	...
		return p2pServer;
	}

	/**
	 *	create client instance
	 *
	 *	@public
	 *	@static
	 *	@param	oOptions
	 *	@return {CP2pClient}
	 */
	static createClient( oOptions )
	{
		const p2pClient	= new CP2pClient( oOptions );
		p2pClient.startClient();

		return p2pClient;
	}


	/**
	 *	create node( server, client )
	 *
	 * 	@public
	 * 	@static
	 *	@param	oServerOptions
	 *	@param	oClientOptions
	 *	@return {{server: CP2pServer, client: CP2pClient}}
	 */
	static createNode( oServerOptions, oClientOptions )
	{
		const p2pServer	= new CP2pServer( oOptions );
		const p2pClient	= new CP2pClient( oOptions );

		p2pServer.startServer();
		p2pClient.startClient();

		return {
			server	: p2pServer,
			client	: p2pClient,
		};
	}


}





/**
 *	@exports
 */
module.exports	= CTrustP2p;
