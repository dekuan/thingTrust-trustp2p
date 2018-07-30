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
	constructor( oOptions )
	{
		super();

		this.m_oOptions		= { cwd : __dirname };
		this.m_oOptions		= Object.assign( {}, this.m_oOptions, oOptions );

		this.m_oThreadsMap	= {};
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

		await this._load( oNode );
		await this._install();

		_p2pLog.info( `* [${ this.constructor.name }] ${ Object.keys( this.m_oThreadsMap ).length } threads loaded!` );
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
		return `event-${ String( nPackageType ) }-${ String( sEventName ) }`;
	}

	/**
	 *	transit socket message to all listeners
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
					//
					//	emit event to the instance
					//
					objClassInstance = this.m_oThreadsMap[ oItem.md5 ].instance;
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
	 *	transit socket connection event to all listeners
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 */
	transitSocketConnection( oSocket )
	{
		Object.values( this.m_oThreadsMap ).forEach( oThread =>
		{
			oThread.instance.emit( this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CONNECTION ), oSocket );
		});
	}

	/**
	 *	transit socket open event to all listeners
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 */
	transitSocketOpen( oSocket )
	{
		Object.values( this.m_oThreadsMap ).forEach( oThread =>
		{
			oThread.instance.emit( this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_OPEN ), oSocket );
		});
	}

	/**
	 *	transit socket close event to all listeners
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 */
	transitSocketClose( oSocket )
	{
		Object.values( this.m_oThreadsMap ).forEach( oThread =>
		{
			oThread.instance.emit( this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CLOSE ), oSocket );
		});
	}

	/**
	 *	transit socket error event to all listeners
	 *
	 * 	@public
	 *	@param	{string}	vError
	 */
	transitSocketError( vError )
	{
		Object.values( this.m_oThreadsMap ).forEach( oThread =>
		{
			oThread.instance.emit( this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_ERROR ), vError );
		});
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
	 *
	 * 	@description
	 * 	DO NOT USE forEach
	 *
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

			//
			//	If any of the accessibility checks fail, an Error will be thrown.
			// 	Otherwise, this will return undefined.
			//
			_fs.accessSync( this.m_oOptions.cwd, _fs.constants.F_OK | _fs.constants.R_OK );


			//	...
			sDirectory	= `${ this.m_oOptions.cwd }/threads-enabled/`;
			arrFiles	= _fs.readdirSync( sDirectory );

			if ( ! Array.isArray( arrFiles ) )
			{
				return pfnResolve();
			}

			//	...
			for ( const [ nFileIndex, sFile ] of arrFiles.entries() )
			{
				//	...
				sFullFilename	= `${ sDirectory }${ sFile }`;

				//
				//	If any of the accessibility checks fail, an Error will be thrown.
				// 	Otherwise, this will return undefined.
				//
				_fs.accessSync( sFullFilename, _fs.constants.F_OK | _fs.constants.R_OK );
				_p2pLog.info( `* [${ this.constructor.name }] load thread from file (${ sFullFilename }).` );

				//	...
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
				//	this.m_oThreadsMap =
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
				this.m_oThreadsMap[ sFileMd5 ] =
					{
						filename	: sFullFilename,
						instance	: objTInstance,
						methods		: arrAllMethods,
					};


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
			_p2pLog.info( `* [${ this.constructor.name }] _load done. this.m_oEventsMap size ${ Object.keys( this.m_oEventsMap ).length }` );
			_p2pLog.info( `* [${ this.constructor.name }] _load done. this.m_oThreadsMap size ${ Object.keys( this.m_oThreadsMap).length }` );

			pfnResolve();
		});
	}

	/**
	 *	install
	 *
	 *	@public
	 *	@return {Promise<void>}
	 *
	 * 	@description
	 * 	DO NOT USE forEach
	 *
	 */
	async _install()
	{
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let objClassInstance;
			let sFullEventName;

			//
			//	set hook for all event to listeners
			//
			_p2pLog.info( `* [${ this.constructor.name }] install class, this.m_oEventsMap size = ${ Object.keys( this.m_oEventsMap ).length }` );
			for ( const [ nPackageType, oHandlerMap ] of Object.entries( this.m_oEventsMap ) )
			{
				for ( const [ sEventName, arrEventItems ] of Object.entries( oHandlerMap ) )
				{
					sFullEventName = this.getFullEventName( nPackageType, sEventName );
					for ( const [ nIndex, oItem ] of arrEventItems.entries() )
					{
						//
						//	set hook for listening events
						//
						objClassInstance = this.m_oThreadsMap[ oItem.md5 ].instance;
						_p2pLog.info( `* [${ this.constructor.name }] install class, set hook for event[${ sFullEventName }] to ${ objClassInstance.constructor.name }.` );
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
			for ( const [ sFileMd5, oThread ] of Object.entries( this.m_oThreadsMap ) )
			{
				//
				//	set hook for events : socket connection
				//
				if ( oThread.methods.includes( 'onSocketConnection' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'onSocketConnection' ] ) )
				{
					sFullEventName = this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CONNECTION );
					_p2pLog.info( `* [${ this.constructor.name }] set hook for event[${ sFullEventName }] to ${ oThread.instance.constructor.name }.onSocketConnection.` );
					oThread.instance.on( sFullEventName, ( oSocket ) =>
					{
						oThread.instance[ 'onSocketConnection' ].call( oThread.instance, oSocket );
					});
				}

				//
				//	set hook for events : socket open
				//
				if ( oThread.methods.includes( 'onSocketOpen' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'onSocketOpen' ] ) )
				{
					sFullEventName = this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_OPEN );
					_p2pLog.info( `* [${ this.constructor.name }] set hook for event[${ sFullEventName }] to ${ oThread.instance.constructor.name }.onSocketOpen.` );
					oThread.instance.on( sFullEventName, ( oSocket ) =>
					{
						oThread.instance[ 'onSocketOpen' ].call( oThread.instance, oSocket );
					});
				}

				//
				//	set hook for events : socket close
				//
				if ( oThread.methods.includes( 'onSocketClose' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'onSocketClose' ] ) )
				{
					sFullEventName = this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CLOSE );
					_p2pLog.info( `* [${ this.constructor.name }] set hook for event[${ sFullEventName }] to ${ oThread.instance.constructor.name }.onSocketClose.` );
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
					_p2pLog.info( `* [${ this.constructor.name }] set hook for event[${ sFullEventName }] to ${ oThread.instance.constructor.name }.onSocketError.` );
					oThread.instance.on( sFullEventName, ( vError ) =>
					{
						oThread.instance[ 'onSocketError' ].call( oThread.instance, vError );
					});
				}


				//
				//	call start
				//
				if ( oThread.methods.includes( 'start' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'start' ] ) )
				{
					_p2pLog.info( `* [${ this.constructor.name }] install class, call ${ oThread.instance.constructor.name }.start().` );
					oThread.instance[ 'start' ]();
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
				this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CONNECTION ),
				this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_OPEN  ),
				this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_CLOSE ),
				this.getFullEventName( CP2pPackage.PACKAGE_SYSTEM, CP2pDriver.EVENT_ERROR ),
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
						//
						//	remove all listeners from the instance
						//
						objClassInstance = this.m_oThreadsMap[ oItem.md5 ].instance;
						objClassInstance.removeAllListeners( [ sFullEventName ] );
					}
				}
			}

			//
			//	call .stop()
			//
			for ( const [ sFileMd5, oThread ] of Object.entries( this.m_oThreadsMap ) )
			{
				if ( oThread.methods.includes( 'stop' ) &&
					_p2pUtils.isFunction( oThread.instance[ 'stop' ] ) )
				{
					oThread.instance[ 'stop' ]();
				}
			}

			//
			//	...
			//
			pfnResolve();
		});
	}

}





/**
 *	@exports
 */
module.exports	= CThreadBootstrap;
