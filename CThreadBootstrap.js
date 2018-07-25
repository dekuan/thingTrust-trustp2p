const EventEmitter		= require( 'events' );

const _fs			= require( 'fs' );
const _crypto			= require( 'crypto' );

const _p2pUtils			= require( './CP2pUtils.js' );
const _p2pLog			= require( './CP2pLog.js' );




/**
 * 	@class	CThreadBootstrap
 */
class CThreadBootstrap
{
	constructor()
	{
		this.m_mapThreadsMap	= new Map();
		this.m_mapEventsMap	= new Map();
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

		_p2pLog.info( `[${ this.constructor.name }] ${ this.m_mapThreadsMap.size } threads loaded!` );
	}


	/**
	 *	transit a event to all listener
	 *
	 * 	@public
	 *	@param	{object}	oSocket
	 *	@param	{object}	objMessage
	 */
	transitEvent( oSocket, objMessage )
	{
		let arrEventItems;
		let objClassInstance;
		let sFullEventName;

		//
		//	setup event listener
		//
		if ( _p2pUtils.isObjectWithKeys( this.m_mapEventsMap, objMessage.type ) )
		{
			if ( _p2pUtils.isObjectWithKeys( this.m_mapEventsMap[ objMessage.type ], objMessage.event ) )
			{
				arrEventItems	= this.m_mapEventsMap[ objMessage.type ][ objMessage.event ];
				arrEventItems.forEach( oItem =>
				{
					sFullEventName = `${ String( objMessage.type ) }-${ objMessage.event }`;
					objClassInstance = this.m_mapThreadsMap.get( oItem.md5 );
					objClassInstance.emit
					(
						sFullEventName,
						oSocket,
						objMessage
					);
				});
			}
		}
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

			sDirectory	= `${ __dirname }/threads-enabled/`;
			arrFiles	= _fs.readdirSync( sDirectory );

			if ( ! Array.isArray( arrFiles ) )
			{
				return pfnResolve();
			}

			//	...
			arrFiles.forEach( sFile =>
			{
				let sFullFilename;
				let sFileMd5;
				let CTClass;
				let objTInstance;
				let arrAllMethods;

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
				//		md5	=> instance of dynamically loaded class,
				//		md5	=> instance of dynamically loaded class,
				//		...
				// 	}
				//
				this.m_mapThreadsMap.set
				(
					sFileMd5,
					Object.assign( Object.create( Object.getPrototypeOf( objTInstance ) ), objTInstance )
				);


				//
				//	this.m_mapEventsMap =
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
				Object.entries( objTInstance[ 'eventMap' ] ).forEach( ( [ nPackageType, oHandlerMap ] ) =>
				{
					if ( _p2pUtils.isObject( oHandlerMap ) )
					{
						Object.entries( oHandlerMap ).forEach( ( [ sEventName, pfnEventHandler ] ) =>
						{
							if ( _p2pUtils.isString( sEventName ) &&
								sEventName.length > 0 &&
								_p2pUtils.isFunction( pfnEventHandler ) )
							{
								if ( ! this.m_mapEventsMap.hasOwnProperty( nPackageType ) )
								{
									this.m_mapEventsMap[ nPackageType ] = {};
								}
								if ( ! this.m_mapEventsMap[ nPackageType ].hasOwnProperty( sEventName ) )
								{
									this.m_mapEventsMap[ nPackageType ][ sEventName ] = [];
								}

								//
								//	insert ...
								//
								this.m_mapEventsMap[ nPackageType ][ sEventName ].push
								({
									md5	: sFileMd5,
									handler	: pfnEventHandler
								});
							}
						});
					}
				});
			});

			//
			//	done
			//
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
		return new Promise( ( pfnResolve, pfnReject ) =>
		{
			let objClassInstance;
			let sFullEventName;
			let arrAllMethods;

			//
			//	setup event listener
			//
			for ( const [ nPackageType, oHandlerMap ] of this.m_mapEventsMap )
			{
				for ( const [ sEventName, arrEventItems ] of oHandlerMap )
				{
					sFullEventName = `${ String( nPackageType ) }-${ sEventName }`;
					arrEventItems.forEach( oItem =>
					{
						objClassInstance = this.m_mapThreadsMap.get( oItem.md5 );
						objClassInstance.on( sFullEventName, oItem.handler );
					});
				}
			}

			//
			//	call start
			//
			for ( const [ sFileMd5, objInstance ] of this.m_mapThreadsMap )
			{
				arrAllMethods	= _p2pUtils.getAllMethodsOfClass( objInstance );
				if ( arrAllMethods.includes( 'start' ) &&
					_p2pUtils.isFunction( objInstance[ 'start' ] ) )
				{
					_p2pLog.info( `[${ this.constructor.name }] install class * ${ objInstance.constructor.name }.` );
					objInstance[ 'start' ]();
				}
			}

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
			let arrAllMethods;

			//
			//	removeListener
			//
			for ( const [ nPackageType, oHandlerMap ] of this.m_mapEventsMap )
			{
				for ( const [ sEventName, arrEventItems ] of oHandlerMap )
				{
					sFullEventName = `${ String( nPackageType ) }-${ sEventName }`;
					arrEventItems.forEach( oItem =>
					{
						objClassInstance = this.m_mapThreadsMap.get( oItem.md5 );
						objClassInstance.removeAllListeners( [ sFullEventName ] );
					});
				}
			}

			for ( const [ sFileMd5, objInstance ] of this.m_mapThreadsMap )
			{
				arrAllMethods	= _p2pUtils.getAllMethodsOfClass( objInstance );
				if ( arrAllMethods.includes( 'stop' ) &&
					_p2pUtils.isFunction( objInstance[ 'stop' ] ) )
				{
					objInstance[ 'stop' ]();
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
