/*jslint node: true */
"use strict";

let Discovery	= require('torrent-discovery');
let DHT		= require('bittorrent-dht');
let randombytes	= require('randombytes');


let dht		= new DHT();
let discovery	= new Discovery
({
	infoHash: randombytes(20),
	peerId: randombytes(20),
	port: 6000,
	dht: dht
});


discovery.on( 'peer', function( peer, source )
{
	console.log( '#on peer :: ', peer, source );
});

discovery.on( 'dhtAnnounce', function()
{
	console.log( '#on dhtAnnounce' );
});

discovery.on( 'warning', function( err )
{
	console.log( '#on warning', err );
});

discovery.on( 'error', function( err )
{
	console.log( '#on error', err );
});



