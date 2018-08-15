'use strict';

const { EventEmitter }			= require( 'events' );
const { Transform : TransformStream }	= require( 'stream' );
const MetaPipe				= require( 'metapipe' );

const jsonrpc				= require( 'jsonrpc-lite' );
const uuid				= require( 'uuid' );



/**
 *	Represents and duplex stream for dispatching messages to a given transport
 *	adapter and receiving messages to process through middleware stacks
 *	@class
 */
class CMessenger extends EventEmitter
{
	static get DEFAULTS()
	{
		return {
			serializer	: CMessenger.JsonRpcSerializer,
			deserializer	: CMessenger.JsonRpcDeserializer
		};
	}

	/**
	 *	@function
	 *	@memberof CMessenger
	 *	@param {array} data			- Object to transform
	 *	@param {object} data.0			- JSON payload, parsed into an object
	 *	@param {Bucket~contact} sender		- Origin peer for message
	 *	@param {Bucket~contact} receiver	- Destination peer for message
	 *	@param {function} callback		- Transform stream callback(err, data)
	 */
	static get JsonRpcSerializer()
	{
		return function ( [ object, sender, receiver ], callback )
		{
			let message = jsonrpc.parseObject
			(
				Object.assign( {}, { jsonrpc: '2.0', id: uuid() }, object )
			);
			let notification = jsonrpc.notification('IDENTIFY', sender);

			switch ( message.type )
			{
				case 'request':
				case 'error':
				case 'success':
					return callback
					(
						null,
						[
							message.payload.id,
							Buffer.from
							(
								JSON.stringify
								(
									[
										message.payload,
										notification
									]
								),
								'utf8'
							),
							receiver
						]
					);
				case 'invalid':
				case 'notification':
				default:
					return callback( new Error(`Invalid message type "${message.type}"` ) );
			}
		}
	}


	/**
	 *	@function
	 *	@memberof CMessenger
	 *	@param {buffer} rawMessage	- Incoming message as buffer
	 *	@param {function} callback	- Transform stream callback(err, data)
	 */
	static get JsonRpcDeserializer()
	{
		return function( buffer, callback )
		{
			let [ message, notification ]	= jsonrpc.parse( buffer.toString( 'utf8' ) );

			switch ( message.type )
			{
				case 'request':
				case 'error':
				case 'success':
					return callback( null, [ message, notification ] );
				case 'invalid':
				case 'notification':
				default:
					return callback( new Error( `Invalid message type "${message.type}"` ) );
			}
		}
	}

	/**
	 *	@interface CMessenger~serializer
	 *	@function
	 *	@param {object|buffer}	data - Outgoing message buffer or parsed JSON data
	 *	@param {string|null}	encoding - Encoding of incoming data
	 *	@param {CMessenger~serializerCallback} callback
	 */

	/**
	 *	@callback CMessenger~serializerCallback
	 *	@param {error|null} error
	 *	@param {buffer|object} data - Serialized data to pass through middleware
	 */

	/**
	 *	@interface CMessenger~deserializer
	 *	@function
	 *	@param {object|buffer} data - Incoming message buffer or parsed JSON data
	 *	@param {string|null} encoding - Encoding of incoming data
	 *	@param {CMessenger~deserializerCallback} callback
	 */

	/**
	 *	@callback CMessenger~deserializerCallback
	 *	@param {error|null} error
	 *	@param {buffer|object} data - Deserialized data to pass through middleware
	 */

	/**
	 *	@constructor
	 *	@param {object} [options]
	 *	@param {CMessenger~serializer} [options.serializer] - Serializer function
	 *	@param {CMessenger~deserializer} [options.deserializer] - Deserializer function
	 */
	constructor( options = CMessenger.DEFAULTS )
	{
		super();

		this._opts		= Object.assign( {}, CMessenger.DEFAULTS, options );
		this.serializer		= new MetaPipe( { objectMode: true } );
		this.deserializer	= new MetaPipe( { objectMode: true } );

		this.serializer.append
		(
			new TransformStream
			(
				{
					objectMode	: true,
					transform	: ( object, enc, cb ) => this._serialize( object, cb )
				}
			)
		);
		this.deserializer.append
		(
			new TransformStream
			(
				{
					objectMode	: true,
					transform	: ( object, enc, cb ) => this._deserialize( object, cb )
				}
			)
		);

		this.serializer.on( 'error', ( err ) => this.emit( 'error', err ) );
		this.deserializer.on( 'error', ( err ) => this.emit( 'error', err ) );
	}

	/**
	 *	Serializes a message to a buffer
	 *	@private
	 */
	_serialize( object, callback )
	{
		this._opts.serializer( object, ( err, data ) =>
		{
			callback( null, err ? undefined : data );
		});
	}

	/**
	 *	Deserializes a buffer into a message
	 *	@private
	 */
	_deserialize( object, callback )
	{
		if ( ! Buffer.isBuffer( object ) )
		{
			return callback( new Error( 'Cannot deserialize non-buffer chunk' ) );
		}

		this._opts.deserializer( object, ( err, data ) =>
		{
			callback( null, err ? undefined : data );
		});
	}

}




/**
 *	@exports
 *	@type {CMessenger}
 */
module.exports = CMessenger;
