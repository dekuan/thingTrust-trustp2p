'use strict';


/**
 *	@class	CErrorRules
 */
class CErrorRules
{
	/**
	 *	Constructs a error rules instance in the context of a
	 *	{@link CKademliaNodeAbstract}
	 *	@constructor
	 *	@param {CKademliaNodeAbstract} node
	 */
	constructor( node )
	{
		this.node = node;
	}

	/**
	 *	Assumes if no error object exists, then there is simply no method defined
	 *	@param {error|null} err
	 *	@param {CKademliaNodeAbstract~request} request
	 *	@param {CKademliaNodeAbstract~response} response
	 *	@param {CKademliaNodeAbstract~next} next
	 */
	methodNotFound( err, request, response, next )
	{
		if ( err )
		{
			return next();
		}

		response.error('Method not found', -32601);
	}

	/**
	 *	Formats the errors response according to the error object given
	 *	@param {error|null} err
	 *	@param {CKademliaNodeAbstract~request} request
	 *	@param {CKademliaNodeAbstract~response} response
	 *	@param {CKademliaNodeAbstract~next} next
	 */
	internalError( err, request, response, next )
	{
		response.error( err.message, err.code || -32603 );
		next();
	}
}


/**
 *	@exports
 *	@type {CErrorRules}
 */
module.exports = CErrorRules;
