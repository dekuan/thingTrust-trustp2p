/*jslint node: true */
"use strict";

var _				= require( 'lodash' );
var _crypto			= require( 'crypto' );
var _async			= require( 'async' );
var _logex			= require( './logex.js' );
var _db				= require( './db.js' );
var _constants			= require( './constants.js' );
var _storage			= require( './storage.js' );
var _my_witnesses		= require( './my_witnesses.js' );
var _joint_storage		= require( './joint_storage.js' );
var _validation			= require( './validation.js' );
var _validation_utils		= require( './validation_utils.js' );
var _writer			= require( './writer.js' );
var _conf			= require( '../conf.js' );
var _mutex			= require( './mutex.js' );
var _catchup			= require( './catchup.js' );
var _private_payment		= require( './private_payment.js' );
var _object_hash		= require( './object_hash.js' );
var _ecdsa_sig			= require( './signature.js' );
var _event_bus			= require( './event_bus.js' );
var _light			= require( './light.js' );
var _utils			= require( './utils.js' );
var _breadcrumbs		= require( './breadcrumbs.js' );
var _profilerex			= require( './profilerex.js' );

var _mail			= process.browser ? null : require( './mail.js' + '' );

var _network_consts		= require( './network_consts.js' );
var _network_message		= require( './network_message.js' );
var _network_request		= require( './network_request.js' );
var _network_peer		= require( './network_peer.js' );
var _network_heartbeat		= require( './network_heartbeat.js' );



var m_oAssocUnitsInWork				= {};
var m_oAssocRequestedUnits			= {};
var m_bCatchingUp				= false;
var m_bWaitingForCatchupChain			= false;
var m_bWaitingTillIdle				= false;
var m_nComingOnlineTime				= Date.now();
var m_arrWatchedAddresses			= [];		//	does not include my addresses, therefore always empty
var m_arrPeerEventsBuffer			= [];
var m_exchangeRates				= {};




/**
 *	if not using a hub and accepting messages directly (be your own hub)
 */
var m_sMyDeviceAddress;
var m_objMyTempPubkeyPackage;


exports.light_vendor_url = null;







function setMyDeviceProps( device_address, objTempPubkey )
{
	m_sMyDeviceAddress		= device_address;
	m_objMyTempPubkeyPackage	= objTempPubkey;
}

function sendAllInboundJustSaying( subject, body )
{
	_network_peer.getInboundClients().forEach( function( ws )
	{
		_network_message.sendMessage( ws, 'justsaying', { subject: subject, body: body } );
	});
}







//////////////////////////////////////////////////////////////////////
//	peers
//////////////////////////////////////////////////////////////////////





/**
 *	@public
 *
 *	@param command
 *	@param params
 *	@param pfnResponseHandler
 *	@returns {number}
 */
function requestFromLightVendor( command, params, pfnResponseHandler )
{
	if ( ! exports.light_vendor_url )
	{
		console.log( "light_vendor_url not set yet" );
		return setTimeout
		(
			function()
			{
				requestFromLightVendor( command, params, pfnResponseHandler );
			},
			1000
		);
	}

	//	...
	_network_peer.findOutboundPeerOrConnect
	(
		exports.light_vendor_url,
		function( err, ws )
		{
			if ( err )
			{
				return pfnResponseHandler( null, null, { error : "[connect to light vendor failed]: " + err } );
			}

			//	...
			_network_request.sendRequest
			(
				ws,
				command,
				params,
				false,
				pfnResponseHandler
			);
		}
	);
}


function _printConnectionStatus()
{
	console.log
	(
		_network_peer.getInboundClients().length + " incoming connections, "
		+ _network_peer.getOutboundPeers().length + " outgoing connections, "
		+ Object.keys( _network_peer.getAssocConnectingOutboundWebSockets() ).length + " outgoing connections being opened"
	);
}




/**
 *	subscribe data from others
 */
function _subscribe( ws )
{
	//
	//	this is to detect self-connect
	//
	ws.subscription_id	= _crypto.randomBytes( 30 ).toString( "base64" );

	//
	//	obtain the value of the last main chain index
	//	from database
	//
	_storage.readLastMainChainIndex( function( last_mci )
	{
		//
		//	send subscribe request with subscription id and last mci
		//
		_network_request.sendRequest
		(
			ws,
			'subscribe',
			{
				subscription_id	: ws.subscription_id,
				last_mci	: last_mci
			},
			false,
			function( ws, request, response )
			{
				delete ws.subscription_id;
				ws.subscription_id = null;

				if ( response.error )
				{
					console.log( "network::_subscribe, occurred a error: ", response.error );
					return;
				}

				//
				//	emit event connected_to_source to tell all listeners that:
				//	we have connected to source successfully
				//	and, now start to do what you should do.
				//
				ws.bSource	= true;
				_event_bus.emit
				(
					'connected_to_source',
					ws
				);
			}
		);
	});
}










//////////////////////////////////////////////////////////////////////
//	joints
//////////////////////////////////////////////////////////////////////

/**
 *	sent as justsaying or as response to a request
 */
function _sendJoint( ws, objJoint, tag )
{
	console.log( 'sending joint identified by unit ' + objJoint.unit.unit + ' to', ws.peer );

	//	...
	tag
		?
		_network_message.sendResponse( ws, tag, { joint : objJoint } )
		:
		_network_message.sendTalk( ws, 'joint', objJoint );
}

/**
 * 	@public
 *	sent by light clients to their vendors
 */
function postJointToLightVendor( objJoint, pfnHandleResponse )
{
	console.log( 'posing joint identified by unit ' + objJoint.unit.unit + ' to light vendor' );
	requestFromLightVendor
	(
		'post_joint',
		objJoint,
		function( ws, request, response )
		{
			pfnHandleResponse( response );
		}
	);
}

function _sendFreeJoints( ws )
{
	_storage.readFreeJoints
	(
		function( objJoint )
		{
			_sendJoint( ws, objJoint );
		},
		function()
		{
			_network_message.sendTalk( ws, 'free_joints_end', null );
		}
	);
}

function _sendJointsSinceMci( ws, mci )
{
	_joint_storage.readFreeJointsSinceMci
	(
		mci,
		function( objJoint )
		{
			_sendJoint( ws, objJoint );
		},
		function()
		{
			_network_message.sendTalk( ws, 'free_joints_end', null );
		}
	);
}

function _requestFreeJointsFromAllOutboundPeers()
{
	var i;

	for ( i = 0; i < _network_peer.getOutboundPeers().length; i ++ )
	{
		//
		//	send 'refresh' command
		//
		_network_message.sendTalk
		(
			_network_peer.getOutboundPeers()[ i ],
			'refresh',
			null
		);
	}
}

function _requestNewJoints( ws )
{
	_storage.readLastMainChainIndex
	(
		function( last_mci )
		{
			//
			//	send 'refresh' command
			//
			_network_message.sendTalk
			(
				ws,
				'refresh',
				last_mci
			);
		}
	);
}

function _reRequestLostJoints()
{
	//	console.log("_reRequestLostJoints");
	if ( m_bCatchingUp )
	{
		return;
	}

	//
	//	select * from depends_on_unit, unhandled_joints ...
	//
	_joint_storage.findLostJoints
	(
		function( arrUnits )
		{
			console.log( "lost units", arrUnits );
			_network_peer.tryFindNextPeer
			(
				null,
				function( ws )
				{
					if ( ! ws )
					{
						return;
					}

					//	...
					console.log( "found next peer " + ws.peer );
					_requestJoints
					(
						ws,
						arrUnits.filter
						(
							function( unit )
							{
								return ( ! m_oAssocUnitsInWork[ unit ] && ! _havePendingJointRequest( unit ) );
							}
						)
					);
				}
			);
		}
	);
}

function _requestNewMissingJoints( ws, arrUnits )
{
	var arrNewUnits;

	//	...
	arrNewUnits	= [];
	_async.eachSeries
	(
		arrUnits,
		function( unit, cb )
		{
			if ( m_oAssocUnitsInWork[ unit ] )
			{
				return cb();
			}
			if ( _havePendingJointRequest( unit ) )
			{
				console.log( "unit " + unit + " was already requested" );
				return cb();
			}

			//	...
			_joint_storage.checkIfNewUnit
			(
				unit,
				{
					ifNew : function()
					{
						arrNewUnits.push( unit );
						cb();
					},
					ifKnown : function()
					{
						//	it has just been handled
						console.log( "known" );
						cb();
					},
					ifKnownUnverified : function()
					{
						//	I was already waiting for it
						console.log( "known unverified" );
						cb();
					},
					ifKnownBad : function( error )
					{
						throw Error( "known bad " + unit + ": " + error );
					}
				}
			);
		},
		function()
		{
			//
			//	console.log(arrNewUnits.length+" of "+arrUnits.length+" left", m_oAssocUnitsInWork);
			//	filter again as something could have changed each time we were paused in checkIfNewUnit
			arrNewUnits	= arrNewUnits.filter
			(
				function( unit )
				{
					return ( ! m_oAssocUnitsInWork[ unit ] && ! _havePendingJointRequest( unit ) );
				}
			);

			if ( arrNewUnits.length > 0 )
			{
				_requestJoints( ws, arrNewUnits );
			}
		}
	);
}

function _requestJoints( ws, arrUnits )
{
	if ( arrUnits.length === 0 )
	{
		return;
	}

	//	...
	arrUnits.forEach
	(
		function( unit )
		{
			var diff;

			if ( m_oAssocRequestedUnits[ unit ] )
			{
				diff	= Date.now() - m_oAssocRequestedUnits[ unit ];

				//
				//	since response handlers are called in nextTick(),
				//	there is a period when the pending request is already cleared but the response
				//	handler is not yet called, hence m_oAssocRequestedUnits[unit] not yet cleared
				//
				if ( diff <= _network_consts.STALLED_TIMEOUT )
				{
					return console.log( "unit " + unit + " already requested " + diff + " ms ago, m_oAssocUnitsInWork=" + m_oAssocUnitsInWork[ unit ] );
					//	throw new Error("unit "+unit+" already requested "+diff+" ms ago, m_oAssocUnitsInWork="+m_oAssocUnitsInWork[unit]);
				}
			}
			if ( ws.readyState === ws.OPEN )
			{
				m_oAssocRequestedUnits[ unit ] = Date.now();
				// even if readyState is not ws.OPEN, we still send the request, it'll be rerouted after timeout
			}

			//
			//	*
			//	send request for getting joints
			//
			_network_request.sendRequest
			(
				ws,
				'get_joint',
				unit,
				true,
				_handleResponseToJointRequest
			);
		}
	);
}
function _handleResponseToJointRequest( ws, request, response )
{
	var unit;
	var objJoint;

	//	...
	delete m_oAssocRequestedUnits[ request.params ];

	if ( ! response.joint )
	{
		//	...
		unit	= request.params;
		if ( response.joint_not_found === unit )
		{
			//
			//	we trust the light vendor that if it doesn't know about the unit after 1 day, it doesn't exist
			//
			if ( _conf.bLight )
			{
				_db.query
				(
					"DELETE FROM unhandled_private_payments WHERE unit = ? AND creation_date < " + _db.addTime( '-1 DAY' ),
					[ unit ]
				);
			}

			//
			//	if it is in unhandled_joints, it'll be deleted in 1 hour
			//
			if ( ! m_bCatchingUp )
			{
				return console.log( "unit " + unit + " does not exist" );
			}
			//	return _purgeDependenciesAndNotifyPeers(unit, "unit "+unit+" does not exist");

			_db.query
			(
				"SELECT 1 FROM hash_tree_balls WHERE unit = ?",
				[ unit ],
				function( rows )
				{
					if ( rows.length === 0 )
					{
						return console.log( "unit " + unit + " does not exist (catching up)" );
						//	return _purgeDependenciesAndNotifyPeers(unit, "unit "+unit+" does not exist (catching up)");
					}

					_network_peer.findNextPeer
					(
						ws,
						function( next_ws )
						{
							_breadcrumbs.add( "found next peer to reroute joint_not_found " + unit + ": " + next_ws.peer );
							_requestJoints( next_ws, [ unit ] );
						}
					);
				}
			);
		}

		//
		//	if it still exists, we'll request it again
		//	we requst joints in two cases:
		//	- when referenced from parents, in this case we request it from the same peer who sent us the referencing joint,
		//	he should know, or he is attempting to DoS us
		//	- when catching up and requesting old joints from random peers, in this case we are pretty sure it should exist
		//
		return;
	}

	//	...
	objJoint	= response.joint;
	if ( ! objJoint.unit || ! objJoint.unit.unit )
	{
		return _network_message.sendError( ws, 'no unit' );
	}

	//	...
	unit	= objJoint.unit.unit;
	if ( request.params !== unit )
	{
		return _network_message.sendError( ws, "I didn't request this unit from you: " + unit );
	}

	if ( _conf.bLight && objJoint.ball && ! objJoint.unit.content_hash )
	{
		//	accept it as unfinished (otherwise we would have to require a proof)
		delete objJoint.ball;
		delete objJoint.skiplist_units;
	}

	_conf.bLight
		? _handleLightOnlineJoint( ws, objJoint )
		: handleOnlineJoint( ws, objJoint );
}

function _havePendingRequest( command )
{
	var arrPeers;
	var i;
	var assocPendingRequests;
	var tag;

	//	...
	arrPeers = _network_peer.getAllInboundClientsAndOutboundPeers();

	for ( i = 0; i < arrPeers.length; i++ )
	{
		assocPendingRequests	= arrPeers[ i ].assocPendingRequests;
		for ( tag in assocPendingRequests )
		{
			if ( assocPendingRequests[ tag ].request.command === command )
			{
				return true;
			}
		}
	}

	return false;
}

function _havePendingJointRequest( unit )
{
	var arrPeers;
	var i;
	var assocPendingRequests;
	var tag;
	var request;

	//	...
	arrPeers	= _network_peer.getAllInboundClientsAndOutboundPeers();

	for ( i = 0; i < arrPeers.length; i ++ )
	{
		assocPendingRequests	= arrPeers[ i ].assocPendingRequests;
		for ( tag in assocPendingRequests )
		{
			request	= assocPendingRequests[ tag ].request;
			if ( request.command === 'get_joint' && request.params === unit )
			{
				return true;
			}
		}
	}

	return false;
}

/**
 *	We may receive a reference to a nonexisting unit in parents. We are not going to keep the referencing joint forever.
 */
function _purgeJunkUnhandledJoints()
{
	if ( m_bCatchingUp || Date.now() - m_nComingOnlineTime < 3600*1000 )
	{
		return;
	}

	_db.query
	(
		"DELETE FROM unhandled_joints WHERE creation_date < " + _db.addTime( "-1 HOUR" ),
		function()
		{
			_db.query
			(
				"DELETE FROM dependencies WHERE NOT EXISTS (SELECT * FROM unhandled_joints WHERE unhandled_joints.unit=dependencies.unit)"
			);
		}
	);
}

function _purgeJointAndDependenciesAndNotifyPeers( objJoint, error, onDone )
{
	if ( error.indexOf( 'is not stable in view of your parents' ) >= 0 )
	{
		//	give it a chance to be retried after adding other units
		_event_bus.emit
		(
			'nonfatal_error',
			"error on unit " + objJoint.unit.unit + ": " + error + "; " + JSON.stringify( objJoint ),
			new Error()
		);
		return onDone();
	}

	_joint_storage.purgeJointAndDependencies
	(
		objJoint, 
		error,
		function( purged_unit, peer )
		{
			//
			//	this callback is called for each dependent unit
			//
			var ws;

			//	...
			ws = _network_peer.getPeerWebSocket( peer );
			if ( ws )
			{
				_network_message.sendErrorResult
				(
					ws,
					purged_unit,
					"error on (indirect) parent unit " + objJoint.unit.unit + ": " + error
				);
			}
		},
		onDone
	);
}

function _purgeDependenciesAndNotifyPeers( unit, error, onDone )
{
	_joint_storage.purgeDependencies
	(
		unit, 
		error,
		function( purged_unit, peer )
		{
			//
			//	this callback is called for each dependent unit
			//
			var ws;

			//	...
			ws = _network_peer.getPeerWebSocket( peer );
			if ( ws )
			{
				_network_message.sendErrorResult( ws, purged_unit, "error on (indirect) parent unit " + unit + ": " + error );
			}
		},
		onDone
	);
}

function _forwardJoint( ws, objJoint )
{
	_network_peer.getAllInboundClientsAndOutboundPeers().forEach
	(
		function( client )
		{
			if ( client !== ws && client.bSubscribed )
			{
				_sendJoint( client, objJoint );
			}
		}
	);
}

function _handleJoint( ws, objJoint, bSaved, callbacks )
{
	var unit;
	var validate;

	//	...
	unit = objJoint.unit.unit;

	if ( m_oAssocUnitsInWork[ unit ] )
	{
		return callbacks.ifUnitInWork();
	}

	//	...
	m_oAssocUnitsInWork[ unit ]	= true;
	validate			= function()
	{
		_validation.validate
		(
			objJoint,
			{
				ifUnitError : function( error )
				{
					console.log( objJoint.unit.unit + " validation failed: " + error );
					callbacks.ifUnitError( error );
					//	throw Error(error);

					_purgeJointAndDependenciesAndNotifyPeers
					(
						objJoint,
						error,
						function()
						{
							delete m_oAssocUnitsInWork[ unit ];
						}
					);

					if ( ws && error !== 'authentifier verification failed' && ! error.match( /bad merkle proof at path/ ) )
					{
						_writeEvent('invalid', ws.host);
					}

					if ( objJoint.unsigned )
					{
						_event_bus.emit( "validated-" + unit, false );
					}
				},
				ifJointError : function( error )
				{
					callbacks.ifJointError( error );
					//	throw Error(error);
					_db.query
					(
						"INSERT INTO known_bad_joints (joint, json, error) VALUES (?,?,?)",
						[
							_object_hash.getJointHash( objJoint ),
							JSON.stringify( objJoint ),
							error
						],
						function()
						{
							delete m_oAssocUnitsInWork[ unit ];
						}
					);

					if ( ws )
					{
						_writeEvent( 'invalid', ws.host );
					}
					if ( objJoint.unsigned )
					{
						_event_bus.emit( "validated-" + unit, false );
					}
				},
				ifTransientError : function( error )
				{
					//
					//	TODO
					//	memory lack ?
					//
					console.log( "############################## transient error " + error );
					throw Error( error );
					delete m_oAssocUnitsInWork[ unit ];
				},
				ifNeedHashTree : function()
				{
					console.log('need hash tree for unit '+unit);

					if ( objJoint.unsigned )
					{
						throw Error( "ifNeedHashTree() unsigned" );
					}

					//	...
					callbacks.ifNeedHashTree();

					//	we are not saving unhandled joint because we don't know dependencies
					delete m_oAssocUnitsInWork[ unit ];
				},
				ifNeedParentUnits : callbacks.ifNeedParentUnits,
				ifOk : function( objValidationState, validation_unlock )
				{
					if ( objJoint.unsigned )
					{
						throw Error( "ifOk() unsigned" );
					}

					//
					//	###
					//
					_profilerex.begin( "#saveJoint" );
					_writer.saveJoint
					(
						objJoint,
						objValidationState,
						null,
						function()
						{
							//	...
							_profilerex.end( "#saveJoint" );

							//	...
							validation_unlock();
							callbacks.ifOk();

							if ( ws )
							{
								_writeEvent
								(
									( objValidationState.sequence !== 'good' ) ? 'nonserial' : 'new_good',
									ws.host
								);
							}

							//
							//	notify all watchers
							//	....
							//
							_notifyWatchers( objJoint, ws );

							//
							//
							//
							if ( ! m_bCatchingUp )
							{
								_event_bus.emit( 'new_joint', objJoint );
							}
						}
					);
				},
				ifOkUnsigned : function( bSerial )
				{
					if ( ! objJoint.unsigned )
					{
						throw Error( "ifOkUnsigned() signed" );
					}

					//	...
					callbacks.ifOkUnsigned();
					_event_bus.emit
					(
						"validated-" + unit,
						bSerial
					);
				}
			}
		);
	};

	_joint_storage.checkIfNewJoint
	(
		objJoint,
		{
			ifNew : function()
			{
				bSaved ? callbacks.ifNew() : validate();
			},
			ifKnown : function()
			{
				callbacks.ifKnown();
				delete m_oAssocUnitsInWork[ unit ];
			},
			ifKnownBad : function()
			{
				callbacks.ifKnownBad();
				delete m_oAssocUnitsInWork[ unit ];
			},
			ifKnownUnverified : function()
			{
				bSaved ? validate() : callbacks.ifKnownUnverified();
			}
		}
	);
}


/**
 *	handle joint posted to me by a light client
 */
function _handlePostedJoint( ws, objJoint, onDone )
{
	var unit;

	if ( ! objJoint || ! objJoint.unit || ! objJoint.unit.unit )
	{
		return onDone( 'no unit' );
	}

	//	...
	unit	= objJoint.unit.unit;
	delete objJoint.unit.main_chain_index;

	//	...
	_handleJoint
	(
		ws,
		objJoint,
		false,
		{
			ifUnitInWork : function()
			{
				onDone( "already handling this unit" );
			},
			ifUnitError : function( error )
			{
				onDone( error );
			},
			ifJointError : function( error )
			{
				onDone( error );
			},
			ifNeedHashTree : function()
			{
				onDone( "need hash tree" );
			},
			ifNeedParentUnits : function( arrMissingUnits )
			{
				onDone( "unknown parents" );
			},
			ifOk : function()
			{
				onDone();

				//
				//	forward to other peers
				//
				if ( ! m_bCatchingUp && ! _conf.bLight )
				{
					//
					//	@@@@@ JOINT
					//
					_forwardJoint( ws, objJoint );
				}

				delete m_oAssocUnitsInWork[ unit ];
			},
			ifOkUnsigned : function()
			{
				delete m_oAssocUnitsInWork[unit];
				onDone( "you can't send unsigned units" );
			},
			ifKnown : function()
			{
				if ( objJoint.unsigned )
				{
					throw Error( "known unsigned" );
				}

				//	...
				onDone( "known" );
				_writeEvent( 'known_good', ws.host );
			},
			ifKnownBad : function()
			{
				onDone( "known bad" );
				_writeEvent( 'known_bad', ws.host );
			},
			ifKnownUnverified : function()
			{
				//	impossible unless the peer also sends this joint by 'joint' justsaying
				onDone( "known unverified" );
				delete m_oAssocUnitsInWork[ unit ];
			}
		}
	);
}

/**
 *	@public
 *
 *	@param ws
 *	@param objJoint
 *	@param onDone
 */
function handleOnlineJoint( ws, objJoint, onDone )
{
	var unit;

	if ( ! onDone )
	{
		onDone = function(){};
	}

	//	...
	unit = objJoint.unit.unit;
	delete objJoint.unit.main_chain_index;

	//	...
	_handleJoint
	(
		ws,
		objJoint,
		false,
		{
			ifUnitInWork : onDone,
			ifUnitError : function( error )
			{
				_network_message.sendErrorResult( ws, unit, error );
				onDone();
			},
			ifJointError : function( error )
			{
				_network_message.sendErrorResult( ws, unit, error );
				onDone();
			},
			ifNeedHashTree : function()
			{
				if ( ! m_bCatchingUp && ! m_bWaitingForCatchupChain )
				{
					_requestCatchup( ws );
				}

				//
				//	we are not saving the joint so that in case _requestCatchup() fails,
				//	the joint will be requested again via findLostJoints,
				//	which will trigger another attempt to request catchup
				//
				onDone();
			},
			ifNeedParentUnits : function( arrMissingUnits )
			{
				_network_message.sendInfo( ws, { unit : unit, info : "unresolved dependencies: " + arrMissingUnits.join( ", " ) } );
				_joint_storage.saveUnhandledJointAndDependencies( objJoint, arrMissingUnits, ws.peer, function()
				{
					delete m_oAssocUnitsInWork[unit];
				});
				_requestNewMissingJoints( ws, arrMissingUnits );
				onDone();
			},
			ifOk : function()
			{
				_network_message.sendResult( ws, { unit: unit, result: 'accepted' } );

				//
				//	forward received joint to other peers which subscribed from me
				//
				if ( ! m_bCatchingUp && ! _conf.bLight )
				{
					//
					//	@@@@@ JOINT
					//
					_forwardJoint( ws, objJoint );
				}

				//	...
				delete m_oAssocUnitsInWork[ unit ];

				//
				//	***
				//	wake up other joints that depend on me
				//
				_findAndHandleJointsThatAreReady( unit );

				//
				//	callback
				//
				onDone();
			},
			ifOkUnsigned : function()
			{
				delete m_oAssocUnitsInWork[ unit ];
				onDone();
			},
			ifKnown : function()
			{
				if ( objJoint.unsigned )
				{
					throw Error( "known unsigned" );
				}

				//	...
				_network_message.sendResult( ws, { unit: unit, result: 'known' } );
				_writeEvent( 'known_good', ws.host );
				onDone();
			},
			ifKnownBad : function()
			{
				_network_message.sendResult( ws, { unit : unit, result : 'known_bad' } );
				_writeEvent( 'known_bad', ws.host );
				if ( objJoint.unsigned )
				{
					_event_bus.emit( "validated-" + unit, false );
				}

				//	...
				onDone();
			},
			ifKnownUnverified : function()
			{
				_network_message.sendResult( ws, { unit : unit, result : 'known_unverified' } );
				delete m_oAssocUnitsInWork[ unit ];
				onDone();
			}
		}
	);
}

function _handleSavedJoint( objJoint, creation_ts, peer )
{
	var unit	= objJoint.unit.unit;
	var ws		= _network_peer.getPeerWebSocket( peer );

	if ( ws && ws.readyState !== ws.OPEN )
	{
		ws = null;
	}

	//	...
	_handleJoint
	(
		ws,
		objJoint,
		true,
		{
			ifUnitInWork : function(){},
			ifUnitError : function( error )
			{
				if ( ws )
				{
					_network_message.sendErrorResult( ws, unit, error );
				}
			},
			ifJointError : function( error )
			{
				if ( ws )
				{
					_network_message.sendErrorResult( ws, unit, error );
				}
			},
			ifNeedHashTree : function()
			{
				throw Error( "handleSavedJoint: need hash tree" );
			},
			ifNeedParentUnits : function( arrMissingUnits )
			{
				_db.query
				(
					"SELECT 1 FROM archived_joints WHERE unit IN(?) LIMIT 1",
					[
						arrMissingUnits
					],
					function( rows )
					{
						if ( rows.length === 0 )
						{
							throw Error( "unit " + unit + " still has unresolved dependencies: " + arrMissingUnits.join( ", " ) );
						}

						//	...
						_breadcrumbs.add
						(
							"unit " + unit + " has unresolved dependencies that were archived: " + arrMissingUnits.join( ", " )
						);
						if ( ws )
						{
							_requestNewMissingJoints( ws, arrMissingUnits );
						}
						else
						{
							_network_peer.findNextPeer
							(
								null,
								function( next_ws )
								{
									_requestNewMissingJoints( next_ws, arrMissingUnits );
								}
							);
						}

						//	...
						delete m_oAssocUnitsInWork[ unit ];
					}
				);
			},
			ifOk : function()
			{
				if ( ws )
				{
					_network_message.sendResult( ws, { unit : unit, result : 'accepted' } );
				}

				//	forward to other peers
				if ( ! m_bCatchingUp &&
					! _conf.bLight &&
					creation_ts > Date.now() - _network_consts.FORWARDING_TIMEOUT )
				{
					//
					//	@@@@@ JOINT
					//
					_forwardJoint( ws, objJoint );
				}

				_joint_storage.removeUnhandledJointAndDependencies
				(
					unit,
					function()
					{
						delete m_oAssocUnitsInWork[ unit ];

						//	wake up other saved joints that depend on me
						_findAndHandleJointsThatAreReady( unit );
					}
				);
			},
			ifOkUnsigned : function()
			{
				_joint_storage.removeUnhandledJointAndDependencies( unit, function()
				{
					delete m_oAssocUnitsInWork[ unit ];
				}
			);
		},
		//	readDependentJointsThatAreReady can read the same joint twice before it's handled. If not new, just ignore (we've already responded to peer).
		ifKnown : function(){},
		ifKnownBad : function(){},
		ifNew : function()
		{
			//	that's ok: may be simultaneously selected by readDependentJointsThatAreReady and deleted by _purgeJunkUnhandledJoints when we wake up after sleep
			delete m_oAssocUnitsInWork[unit];
			console.log("new in handleSavedJoint: "+unit);
			//	throw Error("new in handleSavedJoint: "+unit);
		}
	});
}

function _handleLightOnlineJoint( ws, objJoint )
{
	//	the lock ensures that we do not overlap with history processing which might also write new joints
	_mutex.lock
	(
		[ "light_joints" ],
		function( unlock )
		{
			_breadcrumbs.add( 'got light_joints for _handleLightOnlineJoint ' + objJoint.unit.unit );
			handleOnlineJoint
			(
				ws,
				objJoint,
				function()
				{
					_breadcrumbs.add('_handleLightOnlineJoint done');
					unlock();
				}
			);
		}
	);
}


/**
 *	@public
 *
 *	@param _arrWatchedAddresses
 */
function setWatchedAddresses( _arrWatchedAddresses )
{
	m_arrWatchedAddresses = _arrWatchedAddresses;
}


/**
 *	@public
 *
 *	@param address
 */
function addWatchedAddress( address )
{
	m_arrWatchedAddresses.push( address );
}


/**
 *	if any of the watched addresses are affected, notifies:
 *	1. own UI
 *	2. light clients
 */
function _notifyWatchers( objJoint, source_ws )
{
	var objUnit;
	var arrAddresses;
	var i;
	var j;
	var message;
	var payload;
	var address;

	//	...
	objUnit		= objJoint.unit;
	arrAddresses	= objUnit.authors.map( function( author ) { return author.address; } );

	if ( ! objUnit.messages )
	{
		//	voided unit
		return;
	}

	for ( i = 0; i < objUnit.messages.length; i++ )
	{
		message	= objUnit.messages[ i ];
		if ( message.app !== "payment" || ! message.payload )
		{
			continue;
		}

		//	...
		payload	= message.payload;
		for ( j = 0; j < payload.outputs.length; j++ )
		{
			address	= payload.outputs[ j ].address;
			if ( arrAddresses.indexOf( address ) === -1 )
			{
				arrAddresses.push( address );
			}
		}
	}

	//
	//	_.intersection( [ arrays ] )
	//	Creates an array of unique values that are included in all given arrays using SameValueZero for equality comparisons.
	//	The order and references of result values are determined by the first array.
	//
	if ( _.intersection( m_arrWatchedAddresses, arrAddresses ).length > 0 )
	{
		//
		//	Array m_arrWatchedAddresses and arrAddresses both contain unique values.
		//
		_event_bus.emit( "new_my_transactions", [ objJoint.unit.unit ] );
		_event_bus.emit( "new_my_unit-" + objJoint.unit.unit, objJoint );
	}
	else
	{
		_db.query
		(
			"SELECT 1 FROM my_addresses WHERE address IN( ? ) \
			UNION \
			SELECT 1 FROM shared_addresses WHERE shared_address IN( ? )",
			[
				arrAddresses,
				arrAddresses
			],
			function( rows )
			{
				if ( rows.length > 0 )
				{
					_event_bus.emit( "new_my_transactions", [ objJoint.unit.unit ] );
					_event_bus.emit( "new_my_unit-" + objJoint.unit.unit, objJoint );
				}
			}
		);
	}

	if ( _conf.bLight )
	{
		return;
	}

	if ( objJoint.ball )
	{
		//	already stable, light clients will require a proof
		return;
	}

	//
	//	this is a new unstable joint,
	//	light clients will accept it without proof
	//
	_db.query
	(
		"SELECT peer \
		FROM watched_light_addresses \
		WHERE address IN( ? )",
		[
			arrAddresses
		],
		function( rows )
		{
			if ( rows.length === 0 )
			{
				return;
			}

			//	...
			objUnit.timestamp	= Math.round( Date.now() / 1000 );	//	light clients need timestamp
			rows.forEach
			(
				function( row )
				{
					var ws;

					//	...
					ws = _network_peer.getPeerWebSocket( row.peer );
					if ( ws && ws.readyState === ws.OPEN && ws !== source_ws )
					{
						_sendJoint( ws, objJoint );
					}
				}
			);
		}
	);
}


function _notifyWatchersAboutStableJoints( mci )
{
	//
	//	the event was emitted from inside mysql transaction, make sure it completes so that the changes are visible
	//	If the mci became stable in determineIfStableInLaterUnitsAndUpdateStableMcFlag (rare), write lock is released before the validation commits,
	//	so we might not see this mci as stable yet. Hopefully, it'll complete before light/have_updates roundtrip
	//
	_mutex.lock
	(
		[ "write" ],
		function( unlock )
		{
			//
			//	we don't need to block writes,
			//	we requested the lock just to wait that the current write completes
			//
			unlock();

			//	...
			_notifyLocalWatchedAddressesAboutStableJoints( mci );
			console.log( "_notifyWatchersAboutStableJoints " + mci );

			if ( mci <= 1 )
			{
				return;
			}

			//
			//	find last ball ...
			//
			_storage.findLastBallMciOfMci
			(
				_db,
				mci,
				function( last_ball_mci )
				{
					_storage.findLastBallMciOfMci
					(
						_db,
						mci - 1,
						function( prev_last_ball_mci )
						{
							if ( prev_last_ball_mci === last_ball_mci )
							{
								return;
							}

							//	...
							_notifyLightClientsAboutStableJoints( prev_last_ball_mci, last_ball_mci );
						}
					);
				}
			);
		}
	);
}


/**
 *	from_mci is non-inclusive, to_mci is inclusive
 *	@param	from_mci
 *	@param	to_mci
 */
function _notifyLightClientsAboutStableJoints( from_mci, to_mci )
{
	//
	//	watched_light_addresses
	//	stored all light wallets connected to this hub
	//
	_db.query
	(
		"SELECT peer FROM units JOIN unit_authors USING(unit) JOIN watched_light_addresses USING(address) \
		WHERE main_chain_index>? AND main_chain_index<=? \
		UNION \
		SELECT peer FROM units JOIN outputs USING(unit) JOIN watched_light_addresses USING(address) \
		WHERE main_chain_index>? AND main_chain_index<=? \
		UNION \
		SELECT peer FROM units JOIN watched_light_units USING(unit) \
		WHERE main_chain_index>? AND main_chain_index<=?",
		[
			from_mci, to_mci,
			from_mci, to_mci,
			from_mci, to_mci
		],
		function( rows )
		{
			rows.forEach
			(
				function( row )
				{
					var ws;

					//	...
					ws = _network_peer.getPeerWebSocket( row.peer );
					if ( ws && ws.readyState === ws.OPEN )
					{
						_network_message.sendTalk( ws, 'light/have_updates' );
					}
				}
			);
			_db.query
			(
				"DELETE FROM watched_light_units \n\
					WHERE unit IN (SELECT unit FROM units WHERE main_chain_index > ? AND main_chain_index<=?)",
				[ from_mci, to_mci ],
				function()
				{
				}
			);
		}
	);
}


function _notifyLocalWatchedAddressesAboutStableJoints( mci )
{
	function handleRows( rows )
	{
		if ( rows.length > 0 )
		{
			_event_bus.emit
			(
				'my_transactions_became_stable',
				rows.map
				(
					function( row )
					{
						return row.unit;
					}
				)
			);
			rows.forEach
			(
				function( row )
				{
					_event_bus.emit( 'my_stable-' + row.unit );
					console.log( "_notifyLocalWatchedAddressesAboutStableJoints, handleRows, emit event: my_stable-" + row.unit );
				}
			);
		}
	}

	if ( m_arrWatchedAddresses.length > 0 )
	{
		_db.query
		(
			"SELECT unit FROM units JOIN unit_authors USING(unit) WHERE main_chain_index = ? AND address IN( ? ) AND sequence='good' \n\
			UNION \n\
			SELECT unit FROM units JOIN outputs USING(unit) WHERE main_chain_index = ? AND address IN( ? ) AND sequence='good'",
			[
				mci,
				m_arrWatchedAddresses,
				mci,
				m_arrWatchedAddresses
			],
			handleRows
		);
	}

	//
	//	TODO
	//	multi-table UNION ?
	//
	_db.query
	(
		"SELECT unit FROM units JOIN unit_authors USING(unit) JOIN my_addresses USING(address) WHERE main_chain_index=? AND sequence='good' \n\
		UNION \n\
		SELECT unit FROM units JOIN outputs USING(unit) JOIN my_addresses USING(address) WHERE main_chain_index=? AND sequence='good' \n\
		UNION \n\
		SELECT unit FROM units JOIN unit_authors USING(unit) JOIN shared_addresses ON address=shared_address WHERE main_chain_index=? AND sequence='good' \n\
		UNION \n\
		SELECT unit FROM units JOIN outputs USING(unit) JOIN shared_addresses ON address=shared_address WHERE main_chain_index=? AND sequence='good'",
		[
			mci,
			mci,
			mci,
			mci
		],
		handleRows
	);
}


/**
 *	@public
 *	@param address
 */
function addLightWatchedAddress( address )
{
	if ( ! _conf.bLight || ! exports.light_vendor_url)
	{
		return;
	}

	//	...
	_network_peer.findOutboundPeerOrConnect
	(
		exports.light_vendor_url,
		function( err, ws )
		{
			if ( err )
			{
				return;
			}

			//	...
			_network_message.sendTalk( ws, 'light/new_address_to_watch', address );
		}
	);
}


/**
 *
 *	@param forceFlushing
 */
function _flushEvents( forceFlushing )
{
	var arrQueryParams;
	var objUpdatedHosts;
	var host;
	var columns_obj;
	var sql_columns_updates;
	var column;

	if ( m_arrPeerEventsBuffer.length === 0 || ( ! forceFlushing && m_arrPeerEventsBuffer.length !== 100 ) )
	{
		return;
	}

	//	...
	arrQueryParams	= [];
	objUpdatedHosts	= {};

	//	...
	m_arrPeerEventsBuffer.forEach( function( event_row )
	{
		var host;
		var event;
		var event_date;
		var column;

		//	...
		host		= event_row.host;
		event		= event_row.event;
		event_date	= event_row.event_date;

		if ( event === 'new_good' )
		{
			//
			//	increase value by step 1
			//	objUpdatedHosts.host.column ++
			//
			column	= "count_" + event + "_joints";
			_.set
			(
				objUpdatedHosts,
				[
					host,
					column
				],
				_.get( objUpdatedHosts, [ host, column ], 0 ) + 1
			);
		}

		arrQueryParams.push
		(
			"(" + _db.escape( host ) + "," + _db.escape( event ) + "," + _db.getFromUnixTime( event_date ) + ")"
		);
	});

	//	...
	for ( host in objUpdatedHosts )
	{
		columns_obj		= objUpdatedHosts[ host ];
		sql_columns_updates	= [];

		for ( column in columns_obj )
		{
			sql_columns_updates.push( column + "=" + column + "+" + columns_obj[ column ] );
		}
		_db.query
		(
			"UPDATE peer_hosts SET " + sql_columns_updates.join() + " WHERE peer_host=?",
			[ host ]
		);
	}

	_db.query
	(
		"INSERT INTO peer_events ( peer_host, event, event_date ) VALUES " + arrQueryParams.join()
	);

	m_arrPeerEventsBuffer	= [];
	objUpdatedHosts		= {};
}


function _writeEvent( event, host )
{
	var column;
	var event_date;

	if ( _conf.bLight )
	{
		return;
	}

	if ( event === 'invalid' || event === 'nonserial' )
	{
		column	= "count_" + event + "_joints";

		_db.query
		(
			"UPDATE peer_hosts SET " + column + "=" + column + "+1 WHERE peer_host=?",
			[ host ]
		);
		_db.query
		(
			"INSERT INTO peer_events (peer_host, event) VALUES (?,?)",
			[ host, event ]
		);

		return;
	}

	//	...
	event_date	= Math.floor( Date.now() / 1000 );
	m_arrPeerEventsBuffer.push( { host : host, event : event, event_date : event_date } );

	//	...
	_flushEvents();
}



function _findAndHandleJointsThatAreReady( unit )
{
	_joint_storage.readDependentJointsThatAreReady( unit, _handleSavedJoint );
	_handleSavedPrivatePayments( unit );
}


function _comeOnline()
{
	m_bCatchingUp		= false;
	m_nComingOnlineTime	= Date.now();

	_waitTillIdle
	(
		function()
		{
			_requestFreeJointsFromAllOutboundPeers();

			//	...
			setTimeout
			(
				_cleanBadSavedPrivatePayments,
				300 * 1000
			);
		}
	);
	_event_bus.emit( 'catching_up_done' );
}


function _isIdle()
{
	//	console.log(_db._freeConnections.length +"/"+ _db._allConnections.length+" connections are free, "+_mutex.getCountOfQueuedJobs()+" jobs queued, "+_mutex.getCountOfLocks()+" locks held, "+Object.keys(m_oAssocUnitsInWork).length+" units in work");
	return (
		_db.getCountUsedConnections() === 0 &&
		_mutex.getCountOfQueuedJobs() === 0 &&
		_mutex.getCountOfLocks() === 0 &&
		Object.keys( m_oAssocUnitsInWork ).length === 0
	);
}


function _waitTillIdle( onIdle )
{
	if ( _isIdle() )
	{
		m_bWaitingTillIdle	= false;
		onIdle();
	}
	else
	{
		m_bWaitingTillIdle	= true;
		setTimeout
		(
			function()
			{
				_waitTillIdle( onIdle );
			},
			100
		);
	}
}


/**
 *	@public
 *
 *	* NOT FOR LIGHT
 *	@param	objJoint
 */
function broadcastJoint( objJoint )
{
	//
	//	the joint was already posted to light vendor before saving
	//
	if ( _conf.bLight )
	{
		return;
	}

	//	...
	_network_peer.getAllInboundClientsAndOutboundPeers().forEach
	(
		function( client )
		{
			if ( client.bSubscribed )
			{
				_sendJoint( client, objJoint );
			}
		}
	);

	//	...
	_notifyWatchers( objJoint );
}





//////////////////////////////////////////////////////////////////////
//	catchup
//////////////////////////////////////////////////////////////////////

function _checkCatchupLeftovers()
{
	_db.query
	(
		"SELECT 1 FROM hash_tree_balls \
		UNION \
		SELECT 1 FROM catchup_chain_balls \
		LIMIT 1",
		function( rows )
		{
			if ( rows.length === 0 )
			{
				return console.log( 'no leftovers' );
			}

			//	...
			console.log( 'have catchup leftovers from the previous run' );
			_network_peer.findNextPeer
			(
				null,
				function( ws )
				{
					console.log( 'will request leftovers from ' + ws.peer );
					if ( ! m_bCatchingUp && ! m_bWaitingForCatchupChain )
					{
						_requestCatchup( ws );
					}
				}
			);
		}
	);
}


/**
 *	request catchup
 *	@param ws
 */
function _requestCatchup( ws )
{
	console.log( "will request catchup from " + ws.peer );

	_event_bus.emit( 'catching_up_started' );

	if ( _conf.storage === 'sqlite' )
	{
		_db.query( "PRAGMA cache_size=-200000", function(){} );
	}

	//
	//	purge [hash_tree_balls] by removing balls that already existed in table [balls]
	//
	_catchup.purgeHandledBallsFromHashTree( _db, function()
	{
		//
		//	units
		//	query leftover units from [hash_tree_balls]
		//
		_db.query
		(
			"SELECT hash_tree_balls.unit \
			FROM hash_tree_balls LEFT JOIN units USING(unit) \
			WHERE units.unit IS NULL ORDER BY ball_index",
			function( tree_rows )
			{
				//	leftovers from previous run
				if ( tree_rows.length > 0 )
				{
					m_bCatchingUp	= true;
					console.log( "will request balls found in hash tree" );

					//	...
					_requestNewMissingJoints
					(
						ws,
						tree_rows.map( function( tree_row ) { return tree_row.unit; } )
					);

					//	...
					_waitTillHashTreeFullyProcessedAndRequestNext( ws );

					//	...
					return;
				}

				//	...
				_db.query
				(
					"SELECT 1 FROM catchup_chain_balls LIMIT 1",
					function( chain_rows )
					{
						//
						//	leftovers from previous run
						//
						if ( chain_rows.length > 0 )
						{
							m_bCatchingUp = true;
							_requestNextHashTree( ws );
							return;
						}

						//
						//	we are not switching to catching up mode until we receive a catchup chain
						// 	- don't allow peers to throw us into
						//	catching up mode by just sending a ball
						//
						//	to avoid duplicate requests, we are raising this flag before actually sending the request
						//	(will also reset the flag only after the response is fully processed)
						//
						m_bWaitingForCatchupChain = true;

						console.log( 'will read last stable mci for catchup' );

						//
						//	obtain : stable last main chain index
						//
						_storage.readLastStableMcIndex( _db, function( last_stable_mci )
						{
							//
							//	obtain : last main chain index
							//
							_storage.readLastMainChainIndex( function( last_known_mci )
							{
								//
								//	obtain 12 witnesses from table [my_witnesses]
								//
								_my_witnesses.readMyWitnesses
								(
									function( arrWitnesses )
									{
										//
										//	send 'catchup' request
										//
										var params =
										{
											witnesses	: arrWitnesses,
											last_stable_mci	: last_stable_mci,
											last_known_mci	: last_known_mci
										};
										_network_request.sendRequest
										(
											ws,
											'catchup',
											params,
											true,
											_handleCatchupChain
										);
									},
									'wait'
								);
							});
						} );
					}
				);
			}
		);
	} );
}
function _handleCatchupChain( ws, request, response )
{
	var catchupChain;

	if ( response.error )
	{
		m_bWaitingForCatchupChain = false;
		console.log( 'catchup request got error response: ' + response.error );
		//	findLostJoints will wake up and trigger another attempt to request catchup
		return;
	}

	//	...
	catchupChain = response;
	_catchup.processCatchupChain
	(
		catchupChain,
		ws.peer,
		{
			ifError	: function( error )
			{
				m_bWaitingForCatchupChain = false;
				_network_message.sendError( ws, error );
			},
			ifOk	: function()
			{
				m_bWaitingForCatchupChain = false;
				m_bCatchingUp = true;
				_requestNextHashTree( ws );
			},
			ifCurrent : function()
			{
				m_bWaitingForCatchupChain = false;
			}
		}
	);
}








//////////////////////////////////////////////////////////////////////
//	hash tree
//////////////////////////////////////////////////////////////////////


function _requestNextHashTree( ws )
{
	//
	//	...
	//
	_event_bus.emit( 'catchup_next_hash_tree' );

	//
	//	...
	//
	_db.query
	(
		"SELECT ball FROM catchup_chain_balls ORDER BY member_index LIMIT 2",
		function( rows )
		{
			var from_ball;
			var to_ball;
			var tag;

			if ( rows.length === 0 )
			{
				return _comeOnline();
			}
			if ( rows.length === 1 )
			{
				_db.query
				(
					"DELETE FROM catchup_chain_balls WHERE ball = ?",
					[
						rows[ 0 ].ball
					],
					function()
					{
						_comeOnline();
					}
				);
				return;
			}

			//	...
			from_ball	= rows[ 0 ].ball;
			to_ball		= rows[ 1 ].ball;

			//	don't send duplicate requests
			for ( tag in ws.assocPendingRequests )
			{
				if ( ws.assocPendingRequests[ tag ].request.command === 'get_hash_tree' )
				{
					console.log( "already requested hash tree from this peer" );
					return;
				}
			}

			//
			//	send request
			//
			_network_request.sendRequest
			(
				ws,
				'get_hash_tree',
				{
					from_ball	: from_ball,
					to_ball		: to_ball
				},
				true,
				_handleHashTree
			);
		}
	);
}
function _handleHashTree( ws, request, response )
{
	var hashTree;

	if ( response.error )
	{
		console.log( 'get_hash_tree got error response: ' + response.error );
		_waitTillHashTreeFullyProcessedAndRequestNext( ws );
		//	after 1 sec, it'll request the same hash tree, likely from another peer
		return;
	}

	//	...
	hashTree	= response;
	_catchup.processHashTree
	(
		hashTree.balls,
		{
			ifError : function( error )
			{
				//
				//	...
				//
				_network_message.sendError( ws, error );

				//
				//	...
				//
				_waitTillHashTreeFullyProcessedAndRequestNext( ws );
				//	after 1 sec, it'll request the same hash tree, likely from another peer
			},
			ifOk : function()
			{
				//
				//	...
				//
				_requestNewMissingJoints
				(
					ws,
					hashTree.balls.map
					(
						function( objBall )
						{
							return objBall.unit;
						}
					)
				);

				//
				//	...
				//
				_waitTillHashTreeFullyProcessedAndRequestNext( ws );
			}
		}
	);
}

function _waitTillHashTreeFullyProcessedAndRequestNext( ws )
{
	setTimeout( function()
	{
		_db.query
		(
			"SELECT 1 \
			FROM hash_tree_balls LEFT JOIN units USING(unit) \
			WHERE units.unit IS NULL LIMIT 1",
			function( rows )
			{
				if ( rows.length === 0 )
				{
					_network_peer.findNextPeer
					(
						ws,
						function( next_ws )
						{
							_requestNextHashTree( next_ws );
						}
					);
				}
				else
				{
					_waitTillHashTreeFullyProcessedAndRequestNext( ws );
				}
			}
		);

	}, 1000 );
}








//////////////////////////////////////////////////////////////////////
//	private payments
//////////////////////////////////////////////////////////////////////

function _sendPrivatePaymentToWs( ws, arrChains )
{
	//	each chain is sent as separate ws message
	arrChains.forEach( function( arrPrivateElements )
	{
		_network_message.sendTalk( ws, 'private_payment', arrPrivateElements );
	});
}

/**
 *	@public
 *	sends multiple private payloads and their corresponding chains
 *
 *	@param peer
 *	@param arrChains
 */
function sendPrivatePayment( peer, arrChains )
{
	var ws;

	//	...
	ws = _network_peer.getPeerWebSocket( peer );
	if ( ws )
	{
		return _sendPrivatePaymentToWs(ws, arrChains);
	}

	//	...
	_network_peer.findOutboundPeerOrConnect( peer, function( err, ws )
	{
		if ( ! err )
		{
			_sendPrivatePaymentToWs( ws, arrChains );
		}
	});
}


/**
 * 	@public
 *	handles one private payload and its chain
 *
 *	@param ws
 *	@param arrPrivateElements
 *	@param bViaHub
 *	@param callbacks
 *	@returns {*}
 */
function handleOnlinePrivatePayment( ws, arrPrivateElements, bViaHub, callbacks )
{
	var unit;
	var message_index;
	var output_index;
	var savePrivatePayment;

	if ( ! _validation_utils.isNonemptyArray( arrPrivateElements ) )
	{
		return callbacks.ifError("private_payment content must be non-empty array");
	}

	//	...
	unit			= arrPrivateElements[ 0 ].unit;
	message_index		= arrPrivateElements[ 0 ].message_index;
	output_index		= arrPrivateElements[ 0 ].payload.denomination ? arrPrivateElements[0].output_index : -1;
	savePrivatePayment	= function( cb )
	{
		//
		//	we may receive the same unit and message index but different output indexes if recipient and cosigner are on the same device.
		//	in this case,
		//	we also receive the same (unit, message_index, output_index) twice - as cosigner and as recipient.
		//	That's why IGNORE.
		//
		_db.query
		(
			"INSERT " + _db.getIgnore()
			+ " INTO unhandled_private_payments "
			+ "( unit, message_index, output_index, json, peer ) "
			+ " VALUES ( ?, ?, ?, ?, ? )",
			[
				unit,
				message_index,
				output_index,
				JSON.stringify( arrPrivateElements ),
				bViaHub ? '' : ws.peer
			],
			//	forget peer if received via hub
			function()
			{
				callbacks.ifQueued();
				if ( cb )
				{
					cb();
				}
			}
		);
	};

	if ( _conf.bLight && arrPrivateElements.length > 1 )
	{
		savePrivatePayment( function()
		{
			_updateLinkProofsOfPrivateChain( arrPrivateElements, unit, message_index, output_index );

			//	will request the head element
			_reRequestLostJointsOfPrivatePayments();
		});
		return;
	}

	_joint_storage.checkIfNewUnit
	(
		unit,
		{
			ifKnown : function()
			{
				//	m_oAssocUnitsInWork[ unit ] = true;
				_private_payment.validateAndSavePrivatePaymentChain
				(
					arrPrivateElements,
					{
						ifOk : function()
						{
							//	delete m_oAssocUnitsInWork[unit];
							callbacks.ifAccepted( unit );
							_event_bus.emit( "new_my_transactions", [ unit ] );
						},
						ifError : function( error )
						{
							//	delete m_oAssocUnitsInWork[unit];
							callbacks.ifValidationError( unit, error );
						},
						ifWaitingForChain : function()
						{
							savePrivatePayment();
						}
					}
				);
			},
			ifNew : function()
			{
				savePrivatePayment();
				//
				//	if received via hub,
				//		I'm requesting from the same hub,
				// 		thus telling the hub that this unit contains a private payment for me.
				//	It would be better to request missing joints from somebody else
				//
				_requestNewMissingJoints( ws, [ unit ] );
			},
			ifKnownUnverified : savePrivatePayment,
			ifKnownBad : function()
			{
				callbacks.ifValidationError( unit, "known bad" );
			}
		}
	);
}

/**
 *	if unit is undefined, find units that are ready
 */
function _handleSavedPrivatePayments( unit )
{
	//	if (unit && m_oAssocUnitsInWork[unit])
	//		return;
	_mutex.lock
	(
		[ "saved_private" ],
		function( unlock )
		{
			var sql;

			//	...
			sql = unit
				? "SELECT json, peer, unit, message_index, output_index, linked \
				   FROM unhandled_private_payments \
				   WHERE unit = " + _db.escape( unit )
				: "SELECT json, peer, unit, message_index, output_index, linked \
				   FROM unhandled_private_payments CROSS JOIN units USING( unit )";
			_db.query
			(
				sql,
				function( rows )
				{
					var assocNewUnits;

					if ( rows.length === 0 )
					{
						return unlock();
					}

					//	...
					assocNewUnits	= {};
					_async.each
					(
						//	handle different chains in parallel
						rows,
						function( row, cb )
						{
							var arrPrivateElements;
							var ws;
							var validateAndSave;

							//	...
							arrPrivateElements = JSON.parse( row.json );
							ws = _network_peer.getPeerWebSocket( row.peer );

							if ( ws && ws.readyState !== ws.OPEN )
							{
								ws = null;
							}

							//	...
							validateAndSave = function()
							{
								var objHeadPrivateElement	= arrPrivateElements[ 0 ];
								var payload_hash		= _object_hash.getBase64Hash( objHeadPrivateElement.payload );
								var key				= 'private_payment_validated-' + objHeadPrivateElement.unit + '-' + payload_hash + '-' + row.output_index;

								_private_payment.validateAndSavePrivatePaymentChain
								(
									arrPrivateElements,
									{
										ifOk : function()
										{
											if ( ws )
											{
												_network_message.sendResult
												(
													ws,
													{
														private_payment_in_unit : row.unit,
														result : 'accepted'
													}
												);
											}

											//	received directly from a peer, not through the hub
											if ( row.peer )
											{
												_event_bus.emit( "new_direct_private_chains", [ arrPrivateElements ] );
											}

											//	...
											assocNewUnits[ row.unit ]	= true;
											_deleteHandledPrivateChain
											(
												row.unit,
												row.message_index,
												row.output_index,
												cb
											);
											console.log( 'emit ' + key );
											_event_bus.emit( key, true );
										},
										ifError : function( error )
										{
											console.log( "validation of priv: " + error );
											//	throw Error(error);

											if ( ws )
											{
												_network_message.sendResult
												(
													ws,
													{
														private_payment_in_unit : row.unit,
														result : 'error',
														error : error
													}
												);
											}

											//	...
											_deleteHandledPrivateChain
											(
												row.unit,
												row.message_index,
												row.output_index,
												cb
											);

											_event_bus.emit( key, false );
										},
										//	light only. Means that chain joints (excluding the head) not downloaded yet or not stable yet
										ifWaitingForChain : function()
										{
											cb();
										}
									}
								);
							};
					
							if ( _conf.bLight && arrPrivateElements.length > 1 && !row.linked )
							{
								_updateLinkProofsOfPrivateChain
								(
									arrPrivateElements,
									row.unit,
									row.message_index,
									row.output_index,
									cb,
									validateAndSave
								);
							}
							else
							{
								validateAndSave();
							}
						},
						function()
						{
							var arrNewUnits;

							//	...
							unlock();

							//	...
							arrNewUnits = Object.keys(assocNewUnits);

							if ( arrNewUnits.length > 0 )
							{
								_event_bus.emit( "new_my_transactions", arrNewUnits );
							}
						}
					);
				}
			);
		}
	);
}

function _deleteHandledPrivateChain( unit, message_index, output_index, cb )
{
	_db.query
	(
		"DELETE FROM unhandled_private_payments WHERE unit = ? AND message_index = ? AND output_index = ?",
		[
			unit,
			message_index,
			output_index
		],
		function()
		{
			cb();
		}
	);
}

/**
 *	* full only
 */
function _cleanBadSavedPrivatePayments()
{
	if ( _conf.bLight || m_bCatchingUp )
	{
		return;
	}

	_db.query
	(
		"SELECT DISTINCT unhandled_private_payments.unit \
		FROM unhandled_private_payments LEFT JOIN units USING( unit ) \n\
		WHERE units.unit IS NULL AND unhandled_private_payments.creation_date < " + _db.addTime( '-1 DAY' ),
		function( rows )
		{
			rows.forEach( function( row )
			{
				_breadcrumbs.add( 'deleting bad saved private payment ' + row.unit );
				_db.query
				(
					"DELETE FROM unhandled_private_payments WHERE unit = ?",
					[
						row.unit
					]
				);
			});
		}
	);
}

/**
 *	* light only
 */
function _reRequestLostJointsOfPrivatePayments()
{
	if ( ! _conf.bLight || ! exports.light_vendor_url )
	{
		return;
	}

	//	...
	_db.query
	(
		"SELECT DISTINCT unhandled_private_payments.unit \
		FROM unhandled_private_payments LEFT JOIN units USING(unit) \
		WHERE units.unit IS NULL",
		function( rows )
		{
			var arrUnits;

			if ( rows.length === 0 )
			{
				return;
			}

			//	...
			arrUnits = rows.map( function( row ) { return row.unit; } );

			//	...
			_network_peer.findOutboundPeerOrConnect
			(
				exports.light_vendor_url,
				function( err, ws )
				{
					if ( err )
					{
						return;
					}

					_requestNewMissingJoints( ws, arrUnits );
				}
			);
		}
	);
}


/**
 *	@public
 *	* light only
 *
 *	@param arrChains
 *	@param onDone
 */
function requestUnfinishedPastUnitsOfPrivateChains( arrChains, onDone )
{
	if ( ! onDone )
	{
		onDone = function(){};
	}

	//	...
	_private_payment.findUnfinishedPastUnitsOfPrivateChains
	(
		arrChains,
		true,
		function( arrUnits )
		{
			if ( arrUnits.length === 0 )
			{
				return onDone();
			}

			//	...
			_breadcrumbs.add( arrUnits.length + " unfinished past units of private chains" );
			requestHistoryFor( arrUnits, [], onDone );
		}
	);
}




/**
 *	@public
 *
 *	@param arrUnits
 *	@param arrAddresses
 *	@param onDone
 */
function requestHistoryFor( arrUnits, arrAddresses, onDone )
{
	if ( ! onDone )
	{
		onDone = function(){};
	}

	//	...
	_my_witnesses.readMyWitnesses
	(
		function( arrWitnesses )
		{
			var objHistoryRequest;

			//	...
			objHistoryRequest	= { witnesses : arrWitnesses };

			if ( arrUnits.length )
			{
				objHistoryRequest.requested_joints = arrUnits;
			}
			if ( arrAddresses.length )
			{
				objHistoryRequest.addresses = arrAddresses;
			}

			//	...
			requestFromLightVendor
			(
				'light/get_history',
				objHistoryRequest,
				function( ws, request, response )
				{
					if ( response.error )
					{
						console.log( response.error );
						return onDone( response.error );
					}

					_light.processHistory
					(
						response,
						{
							ifError : function( err )
							{
								_network_message.sendError( ws, err );
								onDone( err );
							},
							ifOk : function()
							{
								onDone();
							}
						}
					);
				}
			);
		},
		'wait'
	);
}


/**
 *	@public
 *
 *	@param arrUnits
 *	@param onDone
 */
function requestProofsOfJointsIfNewOrUnstable( arrUnits, onDone )
{
	if ( ! onDone )
	{
		onDone = function(){};
	}

	//	...
	_storage.filterNewOrUnstableUnits
	(
		arrUnits,
		function( arrNewOrUnstableUnits )
		{
			if ( arrNewOrUnstableUnits.length === 0 )
			{
				return onDone();
			}

			//	...
			requestHistoryFor( arrUnits, [], onDone );
		}
	);
}


/**
 *	* light only
 */
function _requestUnfinishedPastUnitsOfSavedPrivateElements()
{
	_mutex.lock
	(
		[ 'private_chains' ],
		function( unlock )
		{
			_db.query
			(
				"SELECT json FROM unhandled_private_payments",
				function( rows )
				{
					var arrChains;

					//	...
					_event_bus.emit( 'unhandled_private_payments_left', rows.length );
					if ( rows.length === 0 )
					{
						return unlock();
					}

					//	...
					_breadcrumbs.add( rows.length + " unhandled private payments" );
					arrChains	= [];

					//	...
					rows.forEach( function( row )
					{
						var arrPrivateElements;

						//	...
						arrPrivateElements = JSON.parse( row.json );
						arrChains.push( arrPrivateElements );
					});

					//	...
					requestUnfinishedPastUnitsOfPrivateChains
					(
						arrChains,
						function onPrivateChainsReceived( err )
						{
							if ( err )
							{
								return unlock();
							}

							_handleSavedPrivatePayments();
							setTimeout( unlock, 2000 );
						}
					);
				}
			);
		}
	);
}


/**
 *	* light only
 *
 *	Note that we are leaking to light vendor information about the full chain.
 *	If the light vendor was a party to any previous transaction in this chain, he'll know how much we received.
 */
function _checkThatEachChainElementIncludesThePrevious( arrPrivateElements, handleResult )
{
	var arrUnits;

	//	an issue
	if ( arrPrivateElements.length === 1 )
	{
		return handleResult( true );
	}

	//	...
	arrUnits = arrPrivateElements.map
	(
		function( objPrivateElement )
		{
			return objPrivateElement.unit;
		}
	);
	requestFromLightVendor
	(
		'light/get_link_proofs',
		arrUnits,
		function( ws, request, response )
		{
			var arrChain;

			if ( response.error )
			{
				return handleResult( null );	//	undefined result
			}

			//	...
			arrChain = response;
			if ( ! _validation_utils.isNonemptyArray( arrChain ) )
			{
				//	undefined result
				return handleResult( null );
			}

			_light.processLinkProofs
			(
				arrUnits,
				arrChain,
				{
					ifError : function( err )
					{
						//
						//	TODO
						//	memery lack ?
						//
						console.log( "linkproof validation failed: " + err );
						throw Error( err );
						handleResult( false );
					},
					ifOk : function()
					{
						console.log("linkproof validated ok");
						handleResult( true );
					}
				}
			);
		}
	);
}


/**
 *	* light only
 */
function _updateLinkProofsOfPrivateChain( arrPrivateElements, unit, message_index, output_index, onFailure, onSuccess )
{
	if ( ! _conf.bLight )
	{
		throw Error( "not light but _updateLinkProofsOfPrivateChain" );
	}
	if ( ! onFailure )
	{
		onFailure = function(){};
	}
	if ( ! onSuccess )
	{
		onSuccess = function(){};
	}

	//	...
	_checkThatEachChainElementIncludesThePrevious
	(
		arrPrivateElements,
		function( bLinked )
		{
			if ( bLinked === null )
			{
				return onFailure();
			}
			if ( ! bLinked )
			{
				return _deleteHandledPrivateChain( unit, message_index, output_index, onFailure );
			}

			//	the result cannot depend on output_index
			_db.query
			(
				"UPDATE unhandled_private_payments SET linked = 1 WHERE unit = ? AND message_index = ?",
				[
					unit,
					message_index
				],
				function()
				{
					onSuccess();
				}
			);
		}
	);
}


/**
 * 	@public
 *
 *	initialize witnesses
 */
function initWitnessesIfNecessary( ws, onDone )
{
	onDone = onDone || function(){};
	_my_witnesses.readMyWitnesses( function( arrWitnesses )
	{
		//	already have witnesses
		if ( arrWitnesses.length > 0 )
		{
			return onDone();
		}

		//	...
		_network_request.sendRequest
		(
			ws,
			'get_witnesses',
			null,
			false,
			function( ws, request, arrWitnesses )
			{
				if ( arrWitnesses.error )
				{
					console.log( 'get_witnesses returned error: ' + arrWitnesses.error );
					return onDone();
				}

				_my_witnesses.insertWitnesses( arrWitnesses, onDone );
			}
		);

	}, 'ignore');
}







//////////////////////////////////////////////////////////////////////
//	hub
//////////////////////////////////////////////////////////////////////


function _sendStoredDeviceMessages( ws, device_address )
{
	_db.query
	(
		"SELECT message_hash, message \
		FROM device_messages \
		WHERE device_address = ? \
		ORDER BY creation_date LIMIT 100",
		[
			device_address
		],
		function( rows )
		{
			rows.forEach( function( row )
			{
				_network_message.sendTalk
				(
					ws,
					'hub/message',
					{
						message_hash	: row.message_hash,
						message		: JSON.parse( row.message )
					}
				);
			});

			//	...
			_network_message.sendInfo( ws, rows.length + " messages sent" );
			_network_message.sendTalk( ws, 'hub/message_box_status', ( rows.length === 100 ) ? 'has_more' : 'empty' );
		}
	);
}






//////////////////////////////////////////////////////////////////////
//	main process
//////////////////////////////////////////////////////////////////////



/**
 * 	switch/case different message types
 */
function _handleMessageJustSaying( ws, subject, body )
{
	var echo_string;

	switch ( subject )
	{
		case 'refresh':
			//
			//	receive a 'refresh' subject
			//	we will response free/young joint
			//
			var mci;

			if ( m_bCatchingUp )
			{
				return;
			}

			//	...
			mci = body;
			if ( _validation_utils.isNonnegativeInteger( mci ) )
			{
				return _sendJointsSinceMci( ws, mci );
			}
			else
			{
				return _sendFreeJoints( ws );
			}

		case 'version':
			//
			//	receive a 'version' subject
			//	we will check it
			//
			if ( ! body )
			{
				return;
			}

			if ( body.protocol_version !== _constants.version )
			{
				_network_message.sendError( ws, 'Incompatible versions, mine ' + _constants.version + ', yours ' + body.protocol_version );
				ws.close( 1000, 'incompatible versions' );
				return;
			}
			if ( body.alt !== _constants.alt )
			{
				_network_message.sendError( ws, 'Incompatible alts, mine ' + _constants.alt + ', yours ' + body.alt );
				ws.close( 1000, 'incompatible alts' );
				return;
			}

			//	...
			ws.library_version	= body.library_version;
			if ( typeof ws.library_version === 'string' &&
				_utils.version2int( ws.library_version ) < _utils.version2int( _constants.minCoreVersion ) )
			{
				//
				//	the core version of remote peer was old
				//
				ws.old_core = true;
			}

			//	handled elsewhere
			_event_bus.emit( 'peer_version', ws, body );
			break;

		case 'new_version':
			//
			//	receive a 'new_version' subject
			//	a new version is available
			//
			if ( ! body )
			{
				return;
			}
			if ( ws.bLoggingIn || ws.bLoggedIn )
			{
				//	accept from hub only
				_event_bus.emit( 'new_version', ws, body );
			}
			break;

		case 'hub/push_project_number':
			if ( ! body )
			{
				return;
			}
			if ( ws.bLoggingIn || ws.bLoggedIn )
			{
				_event_bus.emit( 'receivedPushProjectNumber', ws, body );
			}
			break;

		case 'bugreport':
			if ( ! body )
			{
				return;
			}
			if ( _conf.ignoreBugreportRegexp &&
				new RegExp( _conf.ignoreBugreportRegexp ).test( body.message + ' ' + body.exception.toString() ) )
			{
				return console.log( 'ignoring bugreport' );
			}

			_mail.sendBugEmail( body.message, body.exception );
			break;

		case 'joint':
			//
			//	receive a joint
			//
			var objJoint;

			//	...
			objJoint = body;

			if ( ! objJoint ||
				! objJoint.unit ||
				! objJoint.unit.unit )
			{
				return _network_message.sendError( ws, 'no unit' );
			}
			if ( objJoint.ball &&
				! _storage.isGenesisUnit( objJoint.unit.unit ) )
			{
				return _network_message.sendError( ws, 'only requested joint can contain a ball' );
			}
			if ( _conf.bLight &&
				! ws.bLightVendor )
			{
				return _network_message.sendError( ws, "I'm a light client and you are not my vendor" );
			}

			//
			//	check received joint to avoid an 'uncovered' joint ...
			//
			_db.query
			(
				"SELECT 1 FROM archived_joints \
				WHERE unit = ? AND reason = 'uncovered'",
				[
					objJoint.unit.unit
				],
				function( rows )
				{
					//	ignore it as long is it was unsolicited
					if ( rows.length > 0 )
					{
						return _network_message.sendError( ws, "this unit is already known and archived" );
					}

					//
					//	light clients accept the joint without proof,
					//	it'll be saved as unconfirmed (non-stable)
					//
					return _conf.bLight
						? _handleLightOnlineJoint( ws, objJoint )
						: handleOnlineJoint( ws, objJoint );
				}
			);

		case 'free_joints_end':
		case 'result':
		case 'info':
		case 'error':
			break;

		case 'private_payment':
			var arrPrivateElements;

			if ( ! body )
			{
				return;
			}

			//	...
			arrPrivateElements = body;
			handleOnlinePrivatePayment
			(
				ws,
				arrPrivateElements,
				false,
				{
					ifError : function( error )
					{
						_network_message.sendError( ws, error );
					},
					ifAccepted : function( unit )
					{
						_network_message.sendResult
						(
							ws,
							{
								private_payment_in_unit : unit,
								result : 'accepted'
							}
						);

						_event_bus.emit( "new_direct_private_chains", [ arrPrivateElements ] );
					},
					ifValidationError : function( unit, error )
					{
						_network_message.sendResult
						(
							ws,
							{
								private_payment_in_unit : unit,
								result : 'error',
								error : error
							}
						);
					},
					ifQueued : function()
					{
					}
				}
			);
			break;

		case 'my_url':
			//
			//	THIS MIGHT BE A HUB/SERVER
			//	receive 'my_url' subject
			//
			//	the sender say:
			//	I can listen too, this is my url which you can connect to me by
			//
			//	CLIENT			SERVER
			//	send 'my_url'		receive 'my_url'
			//
			//
			//
			//
			//
			//
			//
			var url;

			if ( ! body )
			{
				return;
			}

			//	...
			url	= body;
			if ( ws.bOutbound )
			{
				//	ignore: if you are outbound, I already know your url
				break;
			}

			//	inbound only
			if ( ws.bAdvertisedOwnUrl )
			{
				//	allow it only once per driver
				break;
			}

			//	...
			ws.bAdvertisedOwnUrl	= true;
			if ( url.indexOf( 'ws://' ) !== 0 && url.indexOf( 'wss://' ) !== 0 )
			{
				// invalid url
				break;
			}

			//	...
			ws.claimed_url	= url;
			_db.query
			(
				"SELECT creation_date AS latest_url_change_date, url \
				FROM peer_host_urls \
				WHERE peer_host = ? \
				ORDER BY creation_date DESC \
				LIMIT 1",
				[
					ws.host
				],
				function( rows )
				{
					var latest_change;

					//	...
					latest_change	= rows[ 0 ];
					if ( latest_change &&
						latest_change.url === url )
					{
						//	advertises the same url
						return;
					}

					//
					//	var elapsed_time = Date.now() - Date.parse(latest_change.latest_url_change_date);
					//	if (elapsed_time < 24*3600*1000) // change allowed no more often than once per day
					//		return;

					//
					//	verify it is really your url by connecting to this url,
					//	sending a random string through this new driver,
					//	and expecting this same string over existing inbound driver
					//
					ws.sent_echo_string	= _crypto.randomBytes( 30 ).toString( "base64" );
					_network_peer.findOutboundPeerOrConnect
					(
						url,
						function( err, reverse_ws )
						{
							if ( ! err )
							{
								//
								//	respond 'want_echo' subject
								//
								_network_message.sendTalk
								(
									reverse_ws,
									'want_echo',
									ws.sent_echo_string
								);
							}
						}
					);
				}
			);
			break;

		case 'want_echo':
			//
			//	THIS MIGHT BE A CLIENT
			//
			//
			var reverse_ws;

			//	...
			echo_string	= body;
			if ( ws.bOutbound || ! echo_string )
			{
				//
				//	ignore
				//	1, inbound only, if this is an outbound driver
				//	2, if no echo_string received
				//
				break;
			}

			//
			//	self ?
			//
			if ( ! ws.claimed_url )
			{
				break;
			}

			//	...
			reverse_ws = _network_peer.getOutboundPeerWsByUrl( ws.claimed_url );
			if ( ! reverse_ws )
			{
				//	no reverse outbound driver
				break;
			}

			//	...
			_network_message.sendTalk( reverse_ws, 'your_echo', echo_string );
			break;

		case 'your_echo':
			//
			//	comes on the same ws as my_url, claimed_url is already set
			//
			var outbound_host;
			var arrQueries;

			//	...
			echo_string = body;

			if ( ws.bOutbound || ! echo_string )
			{
				// ignore
				break;
			}

			//	inbound only
			if ( ! ws.claimed_url )
			{
				break;
			}
			if ( ws.sent_echo_string !== echo_string )
			{
				break;
			}

			//	...
			outbound_host	= _network_peer.getHostByPeer( ws.claimed_url );
			arrQueries	= [];

			_db.addQuery
			(
				arrQueries,
				"INSERT " + _db.getIgnore() + " INTO peer_hosts (peer_host) VALUES (?)",
				[
					outbound_host
				]
			);
			_db.addQuery
			(
				arrQueries,
				"INSERT " + _db.getIgnore() + " INTO peers (peer_host, peer, learnt_from_peer_host) VALUES (?,?,?)",
				[
					outbound_host,
					ws.claimed_url,
					ws.host
				]
			);
			_db.addQuery
			(
				arrQueries,
				"UPDATE peer_host_urls SET is_active=NULL, revocation_date=" + _db.getNow() + " WHERE peer_host=?",
				[
					ws.host
				]
			);
			_db.addQuery
			(
				arrQueries,
				"INSERT INTO peer_host_urls (peer_host, url) VALUES (?,?)",
				[
					ws.host,
					ws.claimed_url
				]
			);

			_async.series
			(
				arrQueries
			);
			ws.sent_echo_string = null;
			break;

		case 'hub/login':
			//
			//	receive a 'hub/login' subject from remote peer
			//
			//	I'm a hub,
			//	the remote peer wants to authenticate
			//
			var objLogin;
			var pfnFinishLogin;

			if ( ! body )
			{
				return;
			}
			if ( ! _conf.bServeAsHub )
			{
				return _network_message.sendError( ws, "I'm not a hub" );
			}

			//
			//	objLogin
			//	{
			//		challenge	: '',
			//		pubkey		: '',
			//		signature	: ''
			//	}
			//
			objLogin = body;

			if ( objLogin.challenge !== ws.challenge )
			{
				return _network_message.sendError( ws, "wrong challenge" );
			}
			if ( ! objLogin.pubkey ||
				! objLogin.signature )
			{
				return _network_message.sendError( ws, "no login params" );
			}
			if ( objLogin.pubkey.length !== _constants.PUBKEY_LENGTH )
			{
				return _network_message.sendError( ws, "wrong pubkey length" );
			}
			if ( objLogin.signature.length !== _constants.SIG_LENGTH )
			{
				return _network_message.sendError( ws, "wrong signature length" );
			}
			if ( ! _ecdsa_sig.verify( _object_hash.getDeviceMessageHashToSign( objLogin ), objLogin.signature, objLogin.pubkey ) )
			{
				return _network_message.sendError( ws, "wrong signature" );
			}

			//	...
			ws.device_address	= _object_hash.getDeviceAddress( objLogin.pubkey );

			//	after this point the device is authenticated and can send further commands
			pfnFinishLogin = function()
			{
				ws.bLoginComplete	= true;
				if ( ws.onLoginComplete )
				{
					ws.onLoginComplete();
					delete ws.onLoginComplete;
				}
			};

			_db.query
			(
				"SELECT 1 FROM devices WHERE device_address = ?",
				[
					ws.device_address
				],
				function( rows )
				{
					if ( rows.length === 0 )
					{
						_db.query
						(
							"INSERT INTO devices ( device_address, pubkey ) VALUES ( ?, ? )",
							[
								ws.device_address,
								objLogin.pubkey
							],
							function()
							{
								_network_message.sendInfo( ws, "address created" );
								pfnFinishLogin();
							}
						);
					}
					else
					{
						_sendStoredDeviceMessages( ws, ws.device_address );
						pfnFinishLogin();
					}
				}
			);

			if ( _conf.pushApiProjectNumber && _conf.pushApiKey )
			{
				_network_message.sendTalk
				(
					ws,
					'hub/push_project_number',
					{
						projectNumber : _conf.pushApiProjectNumber
					}
				);
			}
			else
			{
				_network_message.sendTalk
				(
					ws,
					'hub/push_project_number',
					{
						projectNumber : 0
					}
				);
			}

			//	...
			_event_bus.emit( 'client_logged_in', ws );
			break;

		case 'hub/refresh':
			//
			//	I'm a hub, the peer wants to download new messages
			//
			if ( ! _conf.bServeAsHub )
			{
				return _network_message.sendError( ws, "I'm not a hub" );
			}
			if ( ! ws.device_address )
			{
				return _network_message.sendError( ws, "please log in first" );
			}

			//	...
			_sendStoredDeviceMessages( ws, ws.device_address );
			break;

		case 'hub/delete':
			//
			//	I'm a hub, the peer wants to remove a message that he's just handled
			//
			var message_hash;

			if ( ! _conf.bServeAsHub )
			{
				return _network_message.sendError( ws, "I'm not a hub" );
			}

			//	...
			message_hash = body;
			if ( ! message_hash )
			{
				return _network_message.sendError( ws, "no message hash" );
			}
			if ( ! ws.device_address )
			{
				return _network_message.sendError( ws, "please log in first" );
			}

			//	...
			_db.query
			(
				"DELETE FROM device_messages WHERE device_address = ? AND message_hash = ?",
				[
					ws.device_address,
					message_hash
				],
				function()
				{
					_network_message.sendInfo( ws, "deleted message " + message_hash );
				}
			);
			break;

		//
		//	I'm connected to a hub
		//
		case 'hub/challenge':
		case 'hub/message':
		case 'hub/message_box_status':
			if ( ! body )
			{
				return;
			}

			//	...
			_event_bus.emit( "message_from_hub", ws, subject, body );
			break;

		//
		//	I'm light client
		//
		case 'light/have_updates':
			if ( ! _conf.bLight )
			{
				return _network_message.sendError( ws, "I'm not light" );
			}
			if ( ! ws.bLightVendor )
			{
				return _network_message.sendError( ws, "You are not my light vendor" );
			}

			//	...
			_event_bus.emit( "message_for_light", ws, subject, body );
			break;

		//
		//	I'm light vendor
		//
		case 'light/new_address_to_watch':
			var address;

			if ( _conf.bLight )
			{
				return _network_message.sendError( ws, "I'm light myself, can't serve you" );
			}
			if ( ws.bOutbound )
			{
				return _network_message.sendError( ws, "light clients have to be inbound" );
			}

			//	...
			address = body;
			if ( ! _validation_utils.isValidAddress( address ) )
			{
				return _network_message.sendError( ws, "address not valid" );
			}

			_db.query
			(
				"INSERT " + _db.getIgnore() + " INTO watched_light_addresses ( peer, address ) VALUES ( ?, ? )",
				[
					ws.peer,
					address
				],
				function()
				{
					_network_message.sendInfo( ws, "now watching " + address );

					//
					//	check if we already have something on this address
					//
					_db.query
					(
						"SELECT unit, is_stable FROM unit_authors JOIN units USING(unit) WHERE address=? \
						UNION \
						SELECT unit, is_stable FROM outputs JOIN units USING(unit) WHERE address=? \
						ORDER BY is_stable LIMIT 10",
						[
							address,
							address
						],
						function( rows )
						{
							if ( rows.length === 0 )
							{
								return;
							}
							if ( rows.length === 10 || rows.some( function( row ){ return row.is_stable; } ) )
							{
								_network_message.sendTalk( ws, 'light/have_updates' );
							}

							//	...
							rows.forEach
							(
								function( row )
								{
									if ( row.is_stable )
									{
										return;
									}

									//	...
									_storage.readJoint
									(
										_db,
										row.unit,
										{
											ifFound : function( objJoint )
											{
												_sendJoint( ws, objJoint );
											},
											ifNotFound : function()
											{
												throw Error( "watched unit " + row.unit + " not found" );
											}
										}
									);
								}
							);
						}
					);
				}
			);
			break;

		case 'exchange_rates':
			if ( ! ws.bLoggingIn &&
				! ws.bLoggedIn )
			{
				//
				//	accept from hub only
				//
				return;
			}

			//	...
			_.assign( m_exchangeRates, body );
			_event_bus.emit( 'rates_updated' );
			break;

		case 'upgrade_required':
			if ( ! ws.bLoggingIn &&
				! ws.bLoggedIn )
			{
				//
				//	accept from hub only
				//
				return;
			}

			throw Error( "Mandatory upgrade required, please check the release notes at https://github.com/byteball/byteball/releases and upgrade." );
			break;
	}
}


/**
 *	receive a message with type of 'request'
 *
 *	@param	ws
 *	@param	tag
 *	@param	command
 *	@param	params
 *	@returns {*}
 */
function _handleMessageRequest( ws, tag, command, params )
{
	//
	//	ignore repeated request while still preparing response to a previous identical request
	//
	if ( ws.assocInPreparingResponse[ tag ] )
	{
		return console.log( "ignoring identical " + command + " request" );
	}

	//	...
	ws.assocInPreparingResponse[ tag ] = true;
	switch ( command )
	{
		case 'heartbeat':

			//
			//	we received a message with command of 'heartbeat'
			//
			_network_heartbeat.heartbeatAcceptor( ws, tag );
			break;

		case 'subscribe':
			//
			//	we received a message with command of 'subscribe'
			//
			var subscription_id;

			if ( ! _validation_utils.isNonemptyObject( params ) )
			{
				return _network_message.sendErrorResponse( ws, tag, 'no params' );
			}

			//	...
			subscription_id = params.subscription_id;

			if ( typeof subscription_id !== 'string' )
			{
				return _network_message.sendErrorResponse( ws, tag, 'no subscription_id' );
			}

			//
			//	*
			//	make sure we don't subscribe to ourself.
			//
			if ( _network_peer.getAllInboundClientsAndOutboundPeers()
				.some( function( other_ws ){ return ( other_ws.subscription_id === subscription_id ); } ) )
			{
				//
				//	ws.bOutbound tell us this is an outbound driver
				//
				if ( ws.bOutbound )
				{
					_db.query
					(
						"UPDATE peers SET is_self = 1 WHERE peer = ?",
						[
							ws.peer
						]
					);
				}

				//	...
				_network_message.sendErrorResponse( ws, tag, "self-connect" );
				return ws.close( 1000, "self-connect" );
			}

			if ( _conf.bLight )
			{
				//
				//	if ( ws.peer === exports.light_vendor_url )
				//		_sendFreeJoints( ws );
				//
				return _network_message.sendErrorResponse( ws, tag, "I'm light, cannot subscribe you to updates" );
			}
			if ( ws.old_core )
			{
				_network_message.sendTalk( ws, 'upgrade_required' );
				_network_message.sendErrorResponse( ws, tag, "old core" );
				return ws.close( 1000, "old core" );
			}

			//
			//	mark as 'subscribed' on the socket driver
			//
			ws.bSubscribed = true;

			//
			//	send response to tell the peer that you have already subscribed successfully.
			//
			_network_message.sendResponse( ws, tag, 'subscribed' );

			//
			//	if we already catch up ...
			//
			if ( m_bCatchingUp )
			{
				return;
			}

			if ( _validation_utils.isNonnegativeInteger( params.last_mci ) )
			{
				_sendJointsSinceMci( ws, params.last_mci );
			}
			else
			{
				_sendFreeJoints( ws );
			}

			break;
			
		case 'get_joint':
			//
			//	received a 'get_joint' message
			//	we will try to send joint to this peer
			//
			//	peer needs a specific joint
			//
			var unit;

			//	if ( m_bCatchingUp )
			//		return;
			if ( ws.old_core )
			{
				return _network_message.sendErrorResponse( ws, tag, "old core, will not serve get_joint" );
			}

			//	...
			unit = params;
			_storage.readJoint
			(
				_db,
				unit,
				{
					ifFound : function( objJoint )
					{
						_sendJoint( ws, objJoint, tag );
					},
					ifNotFound : function()
					{
						_network_message.sendResponse( ws, tag, { joint_not_found : unit } );
					}
				}
			);
			break;
			
		case 'post_joint':
			//
			//	only for light clients
			//	this command to post joints they created
			//
			var objJoint;

			//	...
			objJoint = params;
			_handlePostedJoint
			(
				ws,
				objJoint,
				function( error )
				{
					error
						? _network_message.sendErrorResponse( ws, tag, error )
						: _network_message.sendResponse( ws, tag, 'accepted' );
				}
			);
			break;
			
		case 'catchup':
			//
			//	client need data from me
			//
			var catchupRequest;

			if ( ! ws.bSubscribed )
			{
				return _network_message.sendErrorResponse( ws, tag, "not subscribed, will not serve catchup" );
			}

			//	...
			catchupRequest = params;
			_mutex.lock
			(
				[ 'catchup_request' ],
				function( unlock )
				{
					if ( ! ws || ws.readyState !== ws.OPEN )
					{
						//	may be already gone when we receive the lock
						return process.nextTick( unlock );
					}

					//
					//	...
					//
					_catchup.prepareCatchupChain
					(
						catchupRequest,
						{
							ifError : function( error )
							{
								_network_message.sendErrorResponse( ws, tag, error );
								unlock();
							},
							ifOk : function( objCatchupChain )
							{
								_network_message.sendResponse( ws, tag, objCatchupChain );
								unlock();
							}
						}
					);
				}
			);
			break;

		case 'get_hash_tree':
			var hashTreeRequest;

			if ( ! ws.bSubscribed )
			{
				return _network_message.sendErrorResponse( ws, tag, "not subscribed, will not serve get_hash_tree" );
			}

			//	...
			hashTreeRequest	= params;
			_mutex.lock
			(
				[ 'get_hash_tree_request' ],
				function( unlock )
				{
					if ( ! ws || ws.readyState !== ws.OPEN )
					{
						//	may be already gone when we receive the lock
						return process.nextTick(unlock);
					}

					_catchup.readHashTree
					(
						hashTreeRequest,
						{
							ifError : function( error )
							{
								_network_message.sendErrorResponse( ws, tag, error );
								unlock();
							},
							ifOk : function( arrBalls )
							{
								//
								//	we have to wrap arrBalls into an object because the peer
								//	will check .error property first
								//
								_network_message.sendResponse( ws, tag, { balls: arrBalls } );
								unlock();
							}
						}
					);
				}
			);
			break;

		case 'get_peers':
			var arrPeerUrls;

			//	...
			arrPeerUrls	= _network_peer.getOutboundPeers().map( function( ws ){ return ws.peer; } );
			//	empty array is ok
			_network_message.sendResponse( ws, tag, arrPeerUrls );
			break;

		case 'get_witnesses':
			_my_witnesses.readMyWitnesses
			(
				function( arrWitnesses )
				{
					_network_message.sendResponse( ws, tag, arrWitnesses );
				},
				'wait'
			);
			break;

		case 'get_last_mci':
			_storage.readLastMainChainIndex
			(
				function( last_mci )
				{
					_network_message.sendResponse( ws, tag, last_mci );
				}
			);
			break;

		//	I'm a hub, the peer wants to deliver a message to one of my clients
		case 'hub/deliver':
			var objDeviceMessage;
			var bToMe;

			//	...
			objDeviceMessage = params;

			if ( ! objDeviceMessage || ! objDeviceMessage.signature || ! objDeviceMessage.pubkey || ! objDeviceMessage.to
					|| ! objDeviceMessage.encrypted_package || ! objDeviceMessage.encrypted_package.dh
					|| ! objDeviceMessage.encrypted_package.dh.sender_ephemeral_pubkey
					|| ! objDeviceMessage.encrypted_package.encrypted_message
					|| ! objDeviceMessage.encrypted_package.iv || ! objDeviceMessage.encrypted_package.authtag )
			{
				return _network_message.sendErrorResponse(ws, tag, "missing fields");
			}

			//	...
			bToMe	= ( m_sMyDeviceAddress && m_sMyDeviceAddress === objDeviceMessage.to );
			if ( ! _conf.bServeAsHub && ! bToMe )
			{
				return _network_message.sendErrorResponse( ws, tag, "I'm not a hub" );
			}
			if ( ! _ecdsa_sig.verify( _object_hash.getDeviceMessageHashToSign( objDeviceMessage ), objDeviceMessage.signature, objDeviceMessage.pubkey ) )
			{
				return _network_message.sendErrorResponse(ws, tag, "wrong message signature");
			}

			//	if i'm always online and i'm my own hub
			if ( bToMe )
			{
				_network_message.sendResponse( ws, tag, "accepted" );
				_event_bus.emit
				(
					"message_from_hub",
					ws,
					'hub/message',
					{
						message_hash : _object_hash.getBase64Hash( objDeviceMessage ),
						message : objDeviceMessage
					}
				);
				return;
			}

			_db.query
			(
				"SELECT 1 FROM devices WHERE device_address=?",
				[ objDeviceMessage.to ],
				function( rows )
				{
					var message_hash;

					if ( rows.length === 0 )
					{
						return _network_message.sendErrorResponse( ws, tag, "address " + objDeviceMessage.to + " not registered here" );
					}

					//	...
					message_hash = _object_hash.getBase64Hash( objDeviceMessage );

					_db.query
					(
						"INSERT " + _db.getIgnore() + " INTO device_messages (message_hash, message, device_address) VALUES (?,?,?)",
						[
							message_hash,
							JSON.stringify( objDeviceMessage ),
							objDeviceMessage.to
						],
						function()
						{
							//	if the addressee is connected, deliver immediately
							_network_peer.getInboundClients().forEach
							(
								function( client )
								{
									if ( client.device_address === objDeviceMessage.to )
									{
										_network_message.sendTalk
										(
											client,
											'hub/message',
											{
												message_hash	: message_hash,
												message		: objDeviceMessage
											}
										);
									}
								}
							);

							_network_message.sendResponse( ws, tag, "accepted" );
							_event_bus.emit( 'peer_sent_new_message', ws, objDeviceMessage );
						}
					);
				}
			);
			break;

		//
		//	I'm a hub, the peer wants to get a correspondent's temporary pubkey
		//
		case 'hub/get_temp_pubkey':
			var permanent_pubkey;
			var device_address;

			//	...
			permanent_pubkey = params;

			if ( ! permanent_pubkey )
			{
				return _network_message.sendErrorResponse( ws, tag, "no permanent_pubkey" );
			}
			if ( permanent_pubkey.length !== _constants.PUBKEY_LENGTH )
			{
				return _network_message.sendErrorResponse(ws, tag, "wrong permanent_pubkey length");
			}

			//	...
			device_address	= _object_hash.getDeviceAddress( permanent_pubkey );

			if ( device_address === m_sMyDeviceAddress )
			{
				//	to me
				//	this package signs my permanent key
				return _network_message.sendResponse( ws, tag, m_objMyTempPubkeyPackage );
			}
			if ( ! _conf.bServeAsHub )
			{
				return _network_message.sendErrorResponse( ws, tag, "I'm not a hub" );
			}

			_db.query
			(
				"SELECT temp_pubkey_package FROM devices WHERE device_address=?",
				[
					device_address
				],
				function( rows )
				{
					var objTempPubkey;

					if ( rows.length === 0 )
					{
						return _network_message.sendErrorResponse( ws, tag, "device with this pubkey is not registered here" );
					}
					if ( ! rows[ 0 ].temp_pubkey_package )
					{
						return _network_message.sendErrorResponse( ws, tag, "temp pub key not set yet" );
					}

					//	...
					objTempPubkey	= JSON.parse( rows[ 0 ].temp_pubkey_package );
					_network_message.sendResponse( ws, tag, objTempPubkey );
				}
			);
			break;

		//	I'm a hub, the peer wants to update its temporary pubkey
		case 'hub/temp_pubkey':
			var objTempPubkey;
			var fnUpdate;

			if ( ! _conf.bServeAsHub )
			{
				return _network_message.sendErrorResponse( ws, tag, "I'm not a hub" );
			}
			if ( ! ws.device_address )
			{
				return _network_message.sendErrorResponse( ws, tag, "please log in first" );
			}

			//	...
			objTempPubkey = params;

			if ( ! objTempPubkey || ! objTempPubkey.temp_pubkey || ! objTempPubkey.pubkey || ! objTempPubkey.signature )
			{
				return _network_message.sendErrorResponse( ws, tag, "no temp_pubkey params" );
			}
			if ( objTempPubkey.temp_pubkey.length !== _constants.PUBKEY_LENGTH )
			{
				return _network_message.sendErrorResponse( ws, tag, "wrong temp_pubkey length" );
			}
			if ( _object_hash.getDeviceAddress( objTempPubkey.pubkey ) !== ws.device_address )
			{
				return _network_message.sendErrorResponse( ws, tag, "signed by another pubkey" );
			}
			if ( ! _ecdsa_sig.verify( _object_hash.getDeviceMessageHashToSign( objTempPubkey ), objTempPubkey.signature, objTempPubkey.pubkey ) )
			{
				return _network_message.sendErrorResponse(ws, tag, "wrong signature");
			}

			//	...
			fnUpdate = function( onDone )
			{
				_db.query
				(
					"UPDATE devices SET temp_pubkey_package = ? WHERE device_address = ?",
					[
						JSON.stringify( objTempPubkey ),
						ws.device_address
					],
					function()
					{
						if ( onDone )
						{
							onDone();
						}
					}
				);
			};

			//	...
			fnUpdate
			(
				function()
				{
					_network_message.sendResponse( ws, tag, "updated" );
				}
			);
			if ( ! ws.bLoginComplete )
			{
				ws.onLoginComplete = fnUpdate;
			}
			break;

		case 'light/get_history':
			if ( _conf.bLight )
			{
				return _network_message.sendErrorResponse(ws, tag, "I'm light myself, can't serve you");
			}
			if ( ws.bOutbound )
			{
				return _network_message.sendErrorResponse(ws, tag, "light clients have to be inbound");
			}

			_mutex.lock
			(
				[ 'get_history_request' ],
				function( unlock )
				{
					if ( ! ws || ws.readyState !== ws.OPEN )
					{
						//	may be already gone when we receive the lock
						return process.nextTick( unlock );
					}

					_light.prepareHistory
					(
						params,
						{
							ifError : function( err )
							{
								_network_message.sendErrorResponse( ws, tag, err );
								unlock();
							},
							ifOk : function( objResponse )
							{
								_network_message.sendResponse( ws, tag, objResponse );

								if ( params.addresses )
								{
									_db.query
									(
										"INSERT " + _db.getIgnore()
										+ " INTO watched_light_addresses (peer, address) VALUES "
										+ params.addresses.map( function( address ){ return "(" + _db.escape( ws.peer ) + ", " + _db.escape( address ) + ")"; } ).join( ", " )
									);
								}

								if ( params.requested_joints )
								{
									_storage.sliceAndExecuteQuery
									(
										"SELECT unit FROM units WHERE main_chain_index >= ? AND unit IN(?)",
										[
											_storage.getMinRetrievableMci(),
											params.requested_joints
										],
										params.requested_joints,
										function( rows )
										{
											if ( rows.length )
											{
												_db.query
												(
													"INSERT " + _db.getIgnore()
													+ " INTO watched_light_units (peer, unit) VALUES "
													+ rows.map( function( row )
													{
														return "(" + _db.escape( ws.peer ) + ", " + _db.escape( row.unit ) + ")";
													}).join( ", " )
												);
											}
										}
									);
								}

								//	_db.query("INSERT "+_db.getIgnore()+" INTO light_peer_witnesses (peer, witness_address) VALUES "+
								//	params.witnesses.map(function(address){ return "("+_db.escape(ws.peer)+", "+_db.escape(address)+")"; }).join(", "));
								unlock();
							}
						}
					);
				}
			);
			break;

		case 'light/get_link_proofs':
			if ( _conf.bLight )
			{
				return _network_message.sendErrorResponse( ws, tag, "I'm light myself, can't serve you" );
			}
			if ( ws.bOutbound )
			{
				return _network_message.sendErrorResponse( ws, tag, "light clients have to be inbound" );
			}

			_mutex.lock
			(
				[ 'get_link_proofs_request' ],
				function( unlock )
				{
					if ( ! ws ||
						ws.readyState !== ws.OPEN )
					{
						//	may be already gone when we receive the lock
						return process.nextTick( unlock );
					}

					_light.prepareLinkProofs
					(
						params,
						{
							ifError : function( err )
							{
								_network_message.sendErrorResponse( ws, tag, err );
								unlock();
							},
							ifOk : function( objResponse )
							{
								_network_message.sendResponse( ws, tag, objResponse );
								unlock();
							}
						}
					);
				}
			);
			break;

	   case 'light/get_parents_and_last_ball_and_witness_list_unit' :
			if ( _conf.bLight )
			{
				return _network_message.sendErrorResponse( ws, tag, "I'm light myself, can't serve you" );
			}
			if ( ws.bOutbound )
			{
				return _network_message.sendErrorResponse( ws, tag, "light clients have to be inbound" );
			}
			if ( ! params )
			{
				return _network_message.sendErrorResponse( ws, tag, "no params in get_parents_and_last_ball_and_witness_list_unit" );
			}

			//	...
			_light.prepareParentsAndLastBallAndWitnessListUnit
			(
				params.witnesses,
				{
					ifError : function( err )
					{
						_network_message.sendErrorResponse( ws, tag, err );
					},
					ifOk : function( objResponse )
					{
						_network_message.sendResponse( ws, tag, objResponse );
					}
				}
			);
			break;

	   case 'light/get_attestation':
			var order;
			var join;

			if ( _conf.bLight )
			{
				return _network_message.sendErrorResponse( ws, tag, "I'm light myself, can't serve you" );
			}
			if ( ws.bOutbound )
			{
				return _network_message.sendErrorResponse( ws, tag, "light clients have to be inbound" );
			}
			if ( ! params )
			{
				return _network_message.sendErrorResponse( ws, tag, "no params in light/get_attestation" );
			}
			if ( ! params.attestor_address || ! params.field || ! params.value )
			{
				return _network_message.sendErrorResponse( ws, tag, "missing params in light/get_attestation" );
			}

			//	...
			order	= ( _conf.storage === 'sqlite' ) ? 'rowid' : 'creation_date';
			join	= ( _conf.storage === 'sqlite' ) ? '' : 'JOIN units USING(unit)';

			_db.query
			(
				"SELECT unit FROM attested_fields " + join + " WHERE attestor_address=? AND field=? AND value=? ORDER BY " + order + " DESC LIMIT 1",
				[
					params.attestor_address,
					params.field,
					params.value
				],
				function( rows )
				{
					var attestation_unit;

					//	...
					attestation_unit	= ( rows.length > 0 ) ? rows[ 0 ].unit : "";
					_network_message.sendResponse( ws, tag, attestation_unit );
				}
			);
			break;

		//	I'm a hub, the peer wants to enable push notifications
		case 'hub/enable_notification':
			if ( ws.device_address )
			{
				_event_bus.emit( "enableNotification", ws.device_address, params );
			}

			_network_message.sendResponse( ws, tag, 'ok' );
			break;

		//	I'm a hub, the peer wants to disable push notifications
		case 'hub/disable_notification':
			if ( ws.device_address )
			{
				_event_bus.emit( "disableNotification", ws.device_address, params );
			}

			_network_message.sendResponse( ws, tag, 'ok' );
			break;

		case 'hub/get_bots':
			_db.query
			(
				"SELECT id, name, pairing_code, description FROM bots ORDER BY rank DESC, id",
				[],
				function( rows )
				{
					_network_message.sendResponse( ws, tag, rows );
				}
			);
			break;

		case 'hub/get_asset_metadata':
			var asset;

			//	...
			asset	= params;
			if ( ! _validation_utils.isStringOfLength( asset, _constants.HASH_LENGTH ) )
			{
				return _network_message.sendErrorResponse(ws, tag, "bad asset: "+asset);
			}

			_db.query
			(
				"SELECT metadata_unit, registry_address, suffix FROM asset_metadata WHERE asset=?",
				[
					asset
				],
				function( rows )
				{
					if ( rows.length === 0 )
					{
						return _network_message.sendErrorResponse( ws, tag, "no metadata" );
					}

					_network_message.sendResponse( ws, tag, rows[ 0 ] );
				}
			);
			break;
	}
}







function _onWebSocketMessage( message )
{
	var ws;
	var arrMessage;
	var sMessageType;
	var oContent;

	//	...
	ws = this;

	if ( ws.readyState !== ws.OPEN )
	{
		return;
	}

	//	...
	//console.log( 'RECEIVED ' + ( message.length > 1000 ? message.substr( 0, 1000 ) + '... (' + message.length + ' chars)' : message ) + ' from ' + ws.peer );
	_logex.push( 'RECEIVED ' + ( message.length > 1000 ? message.substr( 0, 1000 ) + '... (' + message.length + ' chars)' : message ) + ' from ' + ws.peer );

	//	...
	ws.last_ts	= Date.now();

	try
	{
		arrMessage	= JSON.parse( message );
	}
	catch( e )
	{
		return console.log( 'failed to json.parse message ' + message );
	}

	//	...
	sMessageType	= arrMessage[ 0 ];
	oContent	= arrMessage[ 1 ];

	switch ( sMessageType )
	{
		case 'justsaying':
			return _handleMessageJustSaying( ws, oContent.subject, oContent.body );

		case 'request':
			return _handleMessageRequest( ws, oContent.tag, oContent.command, oContent.params );

		case 'response':
			return _handleMessageResponse( ws, oContent.tag, oContent.response );

		default: 
			console.log( "unknown type: " + sMessageType );
			//	throw Error("unknown type: " + sMessageType);
	}
}





/**
 *	start relay(hub)
 */
function _startRelay()
{
	if ( process.browser || ! _conf.port )
	{
		//
		//	no listener on mobile
		//
		_network_peer.initWebSocketServer();
	}
	else
	{
		//
		//	user configuration a port, so we will start a listening socket service
		//	*
		//	prepare to accepting connections
		//
		_network_peer.startWebSocketServer
		({
			subscribe	: _subscribe,
			onMessage	: _onWebSocketMessage,
			onClose		: _onWebSocketClosed
		});
	}

	//	...
	_checkCatchupLeftovers();


	//
	//	the default value of _conf.bWantNewPeers is true
	//
	if ( _conf.bWantNewPeers )
	{
		console.log( "network::_startRelay, _conf.bWantNewPeers = true" );

		//
		//	add outbound connections
		//
		//	retry lost and failed connections
		//	every 1 minute
		//
		_network_peer.addOutboundPeers();
		setInterval
		(
			_network_peer.addOutboundPeers,
			60 * 1000
		);

		//
		//	...
		//
		setTimeout
		(
			_network_peer.checkIfHaveEnoughOutboundPeersAndAdd,
			30 * 1000
		);

		//
		//	purge dead peers
		//	every half hour
		//
		setInterval
		(
			_network_peer.purgeDeadPeers,
			30 * 60 * 1000
		);
	}

	//
	//	purge peer_events
	//	removing those older than 3 days ago.
	//	every 6 hours
	//
	setInterval
	(
		_network_peer.purgePeerEvents,
		6 * 60 * 60 * 1000
	);

	//
	//	request needed joints that were not received during the previous session
	//	every 8 seconds
	//
	_reRequestLostJoints();
	setInterval
	(
		_reRequestLostJoints,
		8 * 1000
	);

	//
	//	purge junk unhandled joints
	//	every half an hour
	//
	setInterval
	(
		_purgeJunkUnhandledJoints,
		30 * 60 * 1000
	);

	//
	//	purge uncovered nonserial joints under lock
	//	every 1 minute
	//
	setInterval
	(
		_joint_storage.purgeUncoveredNonserialJointsUnderLock,
		60 * 1000
	);

	//
	//	find and handle joints that are ready
	//	every 5 seconds
	//
	setInterval
	(
		_findAndHandleJointsThatAreReady,
		5 * 1000
	);
}


/**
 *	start light client
 */
function _startLightClient()
{
	//
	//	initialize web socket server
	//
	_network_peer.initWebSocketServer();


	//
	//	re-request lost joints of private payment
	//
	_reRequestLostJointsOfPrivatePayments();
	setInterval
	(
		_reRequestLostJointsOfPrivatePayments,
		5 * 1000
	);

	//
	//	handle saved private payment
	//	every 5 seconds
	//
	setInterval
	(
		_handleSavedPrivatePayments,
		5 * 1000
	);

	//
	//	request unfinished post units of saved private elements
	//	every 12 seconds
	//
	setInterval
	(
		_requestUnfinishedPastUnitsOfSavedPrivateElements,
		12 * 1000
	);
}



/**
 *	@public
 *
 *	network start
 */
function start()
{
	console.log( "############################################################" );
	console.log( "starting network" );
	console.log( "############################################################" );

	//	...
	_conf.bLight ? _startLightClient() : _startRelay();

	//	...
	setInterval
	(
		_printConnectionStatus,
		6 * 1000
	);

	//
	//	if we have exactly same intervals on two clints,
	//	they might send heartbeats to each other at the same time
	//
	setInterval
	(
		_network_heartbeat.heartbeatEmitter,
		3 * 1000 + _network_peer.getRandomInt( 0, 1000 )
	);
}


/**
 *	@public
 */
function closeAllWsConnections()
{
	_network_peer.getOutboundPeers().forEach( function( ws )
	{
		ws.close( 1000, 'Re-connect' );
	});
}

/**
 *	@public
 *	@returns {*}
 */
function isConnected()
{
	return ( _network_peer.getOutboundPeers().length + _network_peer.getInboundClients().length );
}

/**
 *	@public
 *	@returns {boolean}
 */
function isCatchingUp()
{
	return m_bCatchingUp;
}











/**
 *	initialize
 */
_network_peer.setAddressOnWebSocketMessage( _onWebSocketMessage );
_network_peer.setAddressOnWebSocketClosed( _onWebSocketClosed );
_network_peer.setAddressSubscribe( _subscribe );




/**
 *	...
 */
if ( ! _conf.bLight )
{
	setInterval
	(
		function()
		{
			_flushEvents( true );
		},
		1000 * 60
	);
}



/**
 *	mci
 */
_event_bus.on
(
	'mci_became_stable',
	_notifyWatchersAboutStableJoints
);


/**
 *	start
 */
start();






/**
 *	exports
 */
exports.start						= start;
exports.postJointToLightVendor				= postJointToLightVendor;
exports.broadcastJoint					= broadcastJoint;
exports.sendPrivatePayment				= sendPrivatePayment;

exports.sendTalk					= _network_message.sendTalk;
exports.sendError					= _network_message.sendError;
exports.sendAllInboundJustSaying			= sendAllInboundJustSaying;

exports.sendRequest					= _network_request.sendRequest;
exports.findOutboundPeerOrConnect			= _network_peer.findOutboundPeerOrConnect;
exports.handleOnlineJoint				= handleOnlineJoint;

exports.handleOnlinePrivatePayment			= handleOnlinePrivatePayment;
exports.requestUnfinishedPastUnitsOfPrivateChains	= requestUnfinishedPastUnitsOfPrivateChains;
exports.requestProofsOfJointsIfNewOrUnstable		= requestProofsOfJointsIfNewOrUnstable;

exports.requestFromLightVendor				= requestFromLightVendor;

exports.addPeer						= _network_peer.addPeer;

exports.initWitnessesIfNecessary			= initWitnessesIfNecessary;

exports.setMyDeviceProps				= setMyDeviceProps;

exports.setWatchedAddresses				= setWatchedAddresses;
exports.addWatchedAddress				= addWatchedAddress;
exports.addLightWatchedAddress				= addLightWatchedAddress;

exports.closeAllWsConnections				= closeAllWsConnections;
exports.isConnected					= isConnected;
exports.isCatchingUp					= isCatchingUp;
exports.requestHistoryFor				= requestHistoryFor;
exports.exchangeRates					= m_exchangeRates;
