/*jslint node: true */
'use strict';


/**
 *	Used for debugging long sequences of calls not captured by stack traces.
 *	Should be included with bug reports.
 */
var MAX_LENGTH		= 200;
var m_arrBreadcrumbs	= [];



/**
 *	add new to the queue
 */
function add( breadcrumb )
{
	if ( m_arrBreadcrumbs.length > MAX_LENGTH )
	{
		//	forget the oldest breadcrumbs
		m_arrBreadcrumbs.shift();
	}

	//	...
	m_arrBreadcrumbs.push( Date().toString() + ': ' + breadcrumb );
	console.log( breadcrumb );
}


/**
 *	get full queue list
 */
function get()
{
	return m_arrBreadcrumbs;
}




/**
 *	exports
 */
exports.add	= add;
exports.get	= get;
