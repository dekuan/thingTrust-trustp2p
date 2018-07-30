// let oObject	= {
// 	arrKeys		: [ 'key1', 'key2' ],
// 	procedure	: function( callback ) {
// 		return true;
// 	},
// 	nextProcedure	: function( callback ) {
// 		return true;
// 	},
// 	ts		: Date.now()
// };
//
// let aaa = oObject.toString();
// console.log( aaa );





var crypto		= require( 'crypto' );
var base32		= require( 'thirty-two' );

var PI			= "14159265358979323846264338327950288419716939937510";
var zeroString		= "00000000";

var arrRelativeOffsets	= PI.split("");
var arrOffsets160	= calcOffsets( 160 );
var arrOffsets288	= calcOffsets( 288 );


function checkLength( chash_length )
{
	if ( chash_length !== 160 && chash_length !== 288 )
	{
		throw Error( "unsupported c-hash length: " + chash_length );
	}
}

function calcOffsets( chash_length )
{
	var arrOffsets;
	var offset;
	var index;
	var i;
	var relative_offset;

	//	...
	checkLength( chash_length );

	arrOffsets	= [];
	offset		= 0;
	index		= 0;


	for ( i = 0; offset < chash_length; i ++ )
	{
		relative_offset	= parseInt( arrRelativeOffsets[ i ] );

		if ( relative_offset === 0 )
		{
			continue;
		}

		offset += relative_offset;
		if ( chash_length === 288 )
		{
			offset += 4;
		}
		if ( offset >= chash_length )
		{
			break;
		}

		arrOffsets.push( offset );
		//	console.log("index="+index+", offset="+offset);
		index ++;
	}

	if ( index !== 32 )
	{
		throw Error( "wrong number of checksum bits" );
	}

	return arrOffsets;
}





function functionReplacer(key, value) {
	if (typeof(value) === 'function') {
		return value.toString();
	}
	return value;
}

function functionReviver(key, value)
{
	if ( key === '' )
	{
		return value;
	}

	if ( typeof value === 'string' )
	{
		let rfunc	= /function[^\(]*\(([^\)]*)\)[^\{]*{([^\}]*)\}/;
		let match	= value.match( rfunc );

		if ( match && match.length >= 3 )
		{
			let args	= match[ 1 ].split( ',' ).map( function( arg ) { return arg.replace( /\s+/, '' ); } );
			return new Function( args, match[ 2 ] );
		}
	}
	return value;
}

var person = {
	name : 'John Smith',
	age : 42,
	isJohn: function() {
		return !!this.name.match(/John/);
	},
	calcOffsets : calcOffsets
};

jsonString	= JSON.stringify(person, functionReplacer);
restoredPerson	= JSON.parse(jsonString, functionReviver);

console.log( restoredPerson.isJohn(), restoredPerson.calcOffsets( 160 ) );