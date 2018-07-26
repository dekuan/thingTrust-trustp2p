const EventEmitter		= require( 'events' );

const _fs			= require( 'fs' );
const _crypto			= require( 'crypto' );

const CP2pPackage		= require( './CP2pPackage.js' );
const CP2pDriver		= require( './driver/CP2pDriver.js' );

const _p2pConstants		= require( './p2pConstants.js' );
const _p2pUtils			= require( './CP2pUtils.js' );
const _p2pLog			= require( './CP2pLog.js' );




/**
 * 	@class	CThreadBootstrap
 */
class CThreadBootstrap extends EventEmitter
{
	constructor()
	{
		super();

		this.m_mapThreadsMap	= new Map();
		this.m_oEventsMap	= {};
	}

	/**
	 * 	run bootstrap
	 *
	 * 	@public
	 * 	@param	{object}	oNode
	 * 	@param	{object}	oNode.server	null or undefined if this is not a server instance
	 * 	@param	{object}	oNode.client	null or undefined if this is not a client instance
	 * 	@param	{object}	oNode.log
	 *	@return {void}
	 */
	async run( oNode )
	{
		oNode = {
				server	: oNode.server,
				client	: oNode.client,
				log	: _p2pLog
			};

		await this._load( oNode )
		.then( () =>
		{
			this._install()
			.then( () =>
			{
				_p2pLog.info( `[${ this.constructor.name }] ${ this.m_mapThreadsMap.size } threads loaded!` );
			});
		});
	}

	/**
	 *	get full event name
	 *
	 * 	@public
	 *	@param	{number}	nPackageType
	 *	@param	{string}	sEventName
	 *	@return {string}
	 */
	getFullEventName( nPackageType, sEventName )
	{
		return `TTT-${ String( nPackageType ) }-${ String( sEventName ) }`;
	}

	/**
	 *	transit a socket message to all listeners
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{object}	objMessage
	 */
	transitSocketMessage( oSocket, objMessage )
	{
		let arrEventItems;
		let objClassInstance;

		//
		//	setup event listener
		//
		if ( _p2pUtils.isObjectWithKeys( this.m_oEventsMap, objMessage.type ) )
		{
			if ( _p2pUtils.isObjectWithKeys( this.m_oEventsMap[ objMessage.type ], objMessage.event ) )
			{
				arrEventItems	= this.m_oEventsMap[ objMessage.type ][ objMessage.event ];
				for ( const [ nIndex, oItem ] of arrEventItems.entries() )
				{
					objClassInstance = this.m_mapThreadsMap.get( oItem.md5 ).instance;
					objClassInstance.emit
					(
						this.getFullEventName( objMessage.type, objMessage.event ),
						oSocket,
						objMessage
					);
				}
			}
		}
	}

	/**
	 *	transit a socket close event to all listeners
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 */
	transitSocketClose( oSocket )
	{
		this.emit( this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CLOSE ), oSocket );
	}

	/**
	 *	transit a socket error event to all listeners
	 *
	 * 	@public
	 *	@param	{string}	vError
	 */
	transitSocketError( vError )
	{
		this.emit( this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_ERROR ), vError );
	}




	////////////////////////////////////////////////////////////////////////////////
	//	Private
	//


	/**
	 *	load all threads
	 *
	 *	@private
	 * 	@param	{object}	oNode
	 * 	@param	{object}	oNode.client	null or undefined if this is not a client instance
	 * 	@param	{object}	oNode.server	null or undefined if this is not a server instance
	 * 	@param	{object}	oNode.log
	 *	@return {Promise<any>}
	 */
	async _load( oNode )
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let sDirectory;
			let arrFiles;
			let sFullFilename;
			let sFileMd5;
			let CTClass;
			let objTInstance;
			let arrAllMethods;

			//	...
			sDirectory	= `${ __dirname }/threads-enabled/`;
			arrFiles	= _fs.readdirSync( sDirectory );

			if ( ! Array.isArray( arrFiles ) )
			{
				return pfnResolve();
			}

			//	...
			for ( const [ nFileIndex, sFile ] of arrFiles.entries() )
			{
				//	...
				_p2pLog.info( `[${ this.constructor.name }] load thread from file ${ sFile }` );

				//	...
				sFullFilename	= `${ sDirectory }${ sFile }`;
				sFileMd5	= String( _crypto.createHash( 'md5' ).update( sFullFilename ).digest( 'hex' ) ).toLocaleLowerCase();
				CTClass		= require( sFullFilename );
				objTInstance	= new CTClass( oNode );
				arrAllMethods	= _p2pUtils.getAllMethodsOfClass( objTInstance );

				//
				// if ( ! arrAllMethods.includes( 'on' ) || ! arrAllMethods.includes( 'emmit' ) )
				// {
				// 	let eee = new EventEmitter();
				// 	for ( let key of Reflect.ownKeys( eee ) )
				// 	{
				// 		if ( key !== "constructor"
				// 			&& key !== "prototype"
				// 			&& key !== "name"
				// 		) {
				// 			let desc = Object.getOwnPropertyDescriptor( eee, key );
				// 			Object.defineProperty( objTInstance.__proto__, key, desc );
				// 		}
				// 	}
				// }

				//
				//	MUST throw a new Error and make process crashed while we loaded an invalid thread
				//
				if ( ! arrAllMethods.includes( 'eventMap' ) ||
					! _p2pUtils.isObject( objTInstance[ 'eventMap' ] ) )
				{
					throw new Error( `invalid thread ${ sFile }, please check the documentation.` );
				}
				if ( 0 === Object.keys( objTInstance[ 'eventMap' ] ).length )
				{
					throw new Error( `invalid thread ${ sFile } with empty eventMap, please check the documentation.` );
				}

				//
				//	set map with deep copying
				//
				//	this.m_mapThreadsMap = Map
				//	{
				//		md5	=>
				// 		{
				//			instance	: instance of dynamically loaded class,
				//			methods		: [ ... ],
				// 		}
				//		md5	=>
				// 		{
				//			instance	: instance of dynamically loaded class,
				//			methods		: [ ... ],
				// 		}
				// 	}
				//
				this.m_mapThreadsMap.set
				(
					sFileMd5,
					{
						//instance	: Object.assign( Object.create( Object.getPrototypeOf( objTInstance ) ), objTInstance ),
						instance	: objTInstance,
						methods		: arrAllMethods,
					}
				);


				//
				//	this.m_oEventsMap =
				//	{
				//		package1 :
				// 		{
				//			event1	:
				// 			[
				//				{
				//					md5	: md5 of class,
				// 					handler	: handler1_1
				// 				},
				//				{
				//					md5	: md5 of class,
				// 					handler	: handler1_2
				// 				},
				// 				...
				// 			],
				//			event2	:
				// 			[
				//				{
				//					md5	: md5 of class,
				// 					handler	: handler2_1
				// 				},
				//				{
				//					md5	: md5 of class,
				// 					handler	: handler2_2
				// 				},
				// 				...
				// 			],
				// 		},
				//		...
				// 	}
				//
				for ( const [ nPackageType, oHandlerMap ] of Object.entries( objTInstance[ 'eventMap' ] ) )
				{
					if ( _p2pUtils.isObject( oHandlerMap ) )
					{
						for ( const [ sEventName, pfnEventHandler ] of Object.entries( oHandlerMap ) )
						{
							if ( _p2pUtils.isString( sEventName ) &&
								sEventName.length > 0 &&
								_p2pUtils.isFunction( pfnEventHandler ) )
							{
								if ( ! this.m_oEventsMap.hasOwnProperty( nPackageType ) )
								{
									this.m_oEventsMap[ nPackageType ]	= {};
								}
								if ( ! this.m_oEventsMap[ nPackageType ].hasOwnProperty( sEventName ) )
								{
									this.m_oEventsMap[ nPackageType ][ sEventName ] = [];
								}

								//
								//	insert ...
								//
								this.m_oEventsMap[ nPackageType ][ sEventName ].push
								({
									md5	: sFileMd5,
									handler	: pfnEventHandler
								});

								// //
								// //	set event hooks
								// //
								// let sFullEventName = `${ String( nPackageType ) }-${ sEventName }`;
								// objTInstance.on( sFullEventName, ( oSocket, objMessage ) =>
								// {
								// 	pfnEventHandler.call( objTInstance, oSocket, objMessage );
								// });
							}
						}
					}
				}
			}

			//
			//	done
			//
			_p2pLog.info( `[${ this.constructor.name }] _load done. this.m_oEventsMap size ${ Object.keys( this.m_oEventsMap ).length }` );
			_p2pLog.info( `[${ this.constructor.name }] _load done. this.m_mapThreadsMap size ${ this.m_mapThreadsMap.size }` );

			pfnResolve();
		});
	}

	/**
	 *	install
	 *
	 *	@public
	 *	@return {Promise<void>}
	 */
	async _install()
	{
		_p2pLog.info( `[${ this.constructor.name }] install called.` );
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let objClassInstance;
			let sFullEventName;

			//
			//	setup event listener
			//
			_p2pLog.info( `[${ this.constructor.name }] install class, this.m_oEventsMap size = ${ Object.keys( this.m_oEventsMap ).length }` );
			for ( const [ nPackageType, oHandlerMap ] of Object.entries( this.m_oEventsMap ) )
			{
				for ( const [ sEventName, arrEventItems ] of Object.entries( oHandlerMap ) )
				{
					sFullEventName = this.getFullEventName( nPackageType, sEventName );
					for ( const [ nIndex, oItem ] of arrEventItems.entries() )
					{
						objClassInstance = this.m_mapThreadsMap.get( oItem.md5 ).instance;
						_p2pLog.info( `[${ this.constructor.name }] install class, set hook for event[${ sFullEventName }] to ${ objClassInstance.constructor.name }.` );
						objClassInstance.on( sFullEventName, ( oSocket, objMessage ) =>
						{
							oItem.handler.call( objClassInstance, oSocket, objMessage );
						});
					}
				}
			}

			//
			//	...
			//
			for ( const [ sFileMd5, oThread ] of this.m_mapThreadsMap )
			{
				//
				//	call start
				//
				if ( oThread.methods.includes( 'start' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'start' ] ) )
				{
					_p2pLog.info( `[${ this.constructor.name }] install class, call ${ oThread.instance.constructor.name }.start().` );
					oThread.instance[ 'start' ]();
				}

				//
				//	set hook for events : socket close
				//
				if ( oThread.methods.includes( 'onSocketClose' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'onSocketClose' ] ) )
				{
					sFullEventName = this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CLOSE );
					_p2pLog.info( `[${ this.constructor.name }] install class, set hook for event[${ sFullEventName }] to ${ oThread.instance.constructor.name }.onSocketClose.` );
					oThread.instance.on( sFullEventName, ( oSocket ) =>
					{
						oThread.instance[ 'onSocketClose' ].call( oThread.instance, oSocket );
					});
				}

				//
				//	set hook for events : socket error
				//
				if ( oThread.methods.includes( 'onSocketError' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'onSocketError' ] ) )
				{
					sFullEventName = this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_ERROR );
					_p2pLog.info( `[${ this.constructor.name }] install class, set hook for event[${ sFullEventName }] to ${ oThread.instance.constructor.name }.onSocketError.` );
					oThread.instance.on( sFullEventName, ( vError ) =>
					{
						oThread.instance[ 'onSocketError' ].call( oThread.instance, vError );
					});
				}
			}

			//	...
			pfnResolve();
		});
	}

	/**
	 *	install
	 *
	 *	@public
	 *	@return {Promise<void>}
	 */
	async _uninstall()
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let objClassInstance;
			let sFullEventName;

			//
			//	remove listener from this
			//
			this.removeAllListeners
			([
				`${ String( CP2pPackage.PACKAGE_SYSTEM ) }-${ CP2pDriver.EVENT_CLOSE }`,
				`${ String( CP2pPackage.PACKAGE_SYSTEM ) }-${ CP2pDriver.EVENT_ERROR }`
			]);

			//
			//	remove listener from all instances
			//
			for ( const [ nPackageType, oHandlerMap ] of Object.entries( this.m_oEventsMap ) )
			{
				for ( const [ sEventName, arrEventItems ] of oHandlerMap )
				{
					sFullEventName = this.getFullEventName( nPackageType, sEventName );
					for ( const [ nItemIndex, oItem ] of arrEventItems.entries() )
					{
						objClassInstance = this.m_mapThreadsMap.get( oItem.md5 ).instance;
						objClassInstance.removeAllListeners( [ sFullEventName ] );
					}
				}
			}

			//
			//	call .stop()
			//
			for ( const [ sFileMd5, oThread ] of this.m_mapThreadsMap )
			{
				if ( oThread.methods.includes( 'stop' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'stop' ] ) )
				{
					oThread.instance[ 'stop' ]();
				}
			}

			pfnResolve();
		});
	}

}





/**
 *	@exports
 */
module.exports	= CThreadBootstrap;
