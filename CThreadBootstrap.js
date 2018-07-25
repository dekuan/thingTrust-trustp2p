const _fs		= require('fs');
const _crypto		= require( 'crypto' );

const _p2pUtils		= require( './p2pUtils.js' );





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
	 *	@param	{object}	cServerInstance
	 *	@param	{object}	cClientInstance
	 *	@return {void}
	 */
	async run( cServerInstance, cClientInstance )
	{
		await this._load( cServerInstance, cClientInstance );
		await this._install();

		console.log( `all threads loaded!` );
	}




	/**
	 *	load all threads
	 *
	 *	@private
	 *	@param	{object}	cServerInstance
	 *	@param	{object}	cClientInstance
	 *	@return {Promise<any>}
	 */
	async _load( cServerInstance, cClientInstance )
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
				console.log( `[${ this.constructor.name }] load thread from file ${ sFile }` );

				//	...
				sFullFilename	= `${ sDirectory }${ sFile }`;
				sFileMd5	= String( _crypto.createHash( 'md5' ).update( sFullFilename ).digest( 'hex' ) ).toLocaleLowerCase();
				CTClass		= require( sFullFilename );
				objTInstance	= new CTClass( cServerInstance, cClientInstance );
				arrAllMethods	= _p2pUtils.getAllMethodsOfClass( objTInstance );

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
			let arrAllMethods;

			for ( const [ sFileMd5, objInstance ] of this.m_mapThreadsMap )
			{
				arrAllMethods	= _p2pUtils.getAllMethodsOfClass( objInstance );
				if ( arrAllMethods.includes( 'start' ) &&
					_p2pUtils.isFunction( objInstance[ 'start' ] ) )
				{
					console.log( `[${ this.constructor.name }] install class * ${ objInstance.constructor.name }.` );
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
			let arrAllMethods;

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
