'use strict';

const { Duplex : DuplexStream }		= require( 'stream' );

const dgram		= require( 'dgram' );




/**
 *	Implements a UDP transport adapter
 */
class CUDPTransport extends DuplexStream
{
	static get DEFAULTS()
	{
		return {
			type		: 'udp4',
			reuseAddr	: false
		};
	}

	/**
	 *	Constructs a datagram socket interface
	 *	@constructor
	 *	@param	{object} options	Passed to dgram.createSocket(options)
	 */
	constructor( options )
	{
		super( { objectMode : true } );

		//	...
		this.socket	= dgram.createSocket( Object.assign( {}, CUDPTransport.DEFAULTS, options ) )
			.on( 'error', ( err ) => this.emit( 'error', err ) );
	}

	/**
	 *	Implements the writable interface
	 *	@private
	 */
	_write( [ id, buffer, target ], encoding, callback )
	{
		let [ , contact ] = target;
		this.socket.send( buffer, 0, buffer.length, contact.port, contact.hostname, callback );
	}

	/**
	 *	Implements the readable interface
	 *	@private
	 */
	_read()
	{
		this.socket.once( 'message', ( buffer ) =>
		{
			this.push( buffer );
		});
	}

	/**
	 *	Binds the socket to the [port] [, address] [, callback]
	 *	@param	{number}	[ port = 0 ]		- Port to bind to
	 *	@param	{string}	[ address = 0.0.0.0 ]	- Address to bind to
	 *	@param	{function}	[ callback ]		- called after bind complete
	 */
	listen()
	{
		this.socket.bind( ...arguments );
	}
}





/**
 *	@exports
 *	@type {CUDPTransport}
 */
module.exports = CUDPTransport;
