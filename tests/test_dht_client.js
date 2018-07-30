/*jslint node: true */
"use strict";

let DHT		= require( 'bittorrent-dht' );
let _magnet	= require( 'magnet-uri' );
let _dht	= new DHT();

let uri		= 'magnet:?xt=urn:btih:e3811b9539cacff680e418124272177c47477157';
let parsed	= _magnet( uri );

console.log( parsed.infoHash ); // 'e3811b9539cacff680e418124272177c47477157'


_dht.listen( 1216, function()
{
	console.log( 'now listening', this.address() );
});

_dht.on( 'peer', function( peer, infoHash, from )
{
	console.log( 'found potential peer ' + peer.host + ':' + peer.port + ' through ' + from.address + ':' + from.port );
});

//	find peers for the given torrent info hash
_dht.lookup( parsed.infoHash );
