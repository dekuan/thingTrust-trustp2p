const _protobuf		= require( 'protobufjs' );



_protobuf.load
(
	"test_protobuf.proto",
	function( err, root )
	{
		if ( err )
		{
			throw err;
		}

		// Obtain a message type
		let TrustNoteP2pSaying = root.lookupType( 'trust_note_p2p_package.TrustNoteP2p' );
		let enumPackTypes	= root.lookupEnum( 'trust_note_p2p_package.TrustNoteP2p.PackType' );
		let arrPackTypeValues	= Object.values( enumPackTypes.values );

		//	Exemplary payload
		let oPayloadNormal	=
			{
				type	: "saying",
				subject	: "subscribe",
				body	: "hello"
			};
		// let oPayloadWithOmitting	=
		// 	{
		// 		subject	: "subscribe",
		// 		body	: "hello"
		// 	};
		let oPayloadWithOmitting	=
			{
			};

		//	Verify the oPayload if necessary (i.e. when possibly incomplete or invalid)
		let errMsgNormal	= TrustNoteP2pSaying.verify( oPayloadNormal );
		let errMsgWithOmitting	= TrustNoteP2pSaying.verify( oPayloadWithOmitting );
		if ( errMsgNormal )
		{
			throw Error( errMsgNormal );
		}
		if ( errMsgWithOmitting )
		{
			throw Error( errMsgWithOmitting );
		}

		//
		//	Create a new message
		//	or use .fromObject if conversion is necessary
		//
		let oMessage 			= TrustNoteP2pSaying.create( oPayloadNormal );
		let oMessageWithOmitting 	= TrustNoteP2pSaying.create( oPayloadWithOmitting );

		//
		// 	Encode a message to an Uint8Array (browser) or Buffer (node)
		//
		let oEncodedBuffer		= TrustNoteP2pSaying.encode( oMessage ).finish();
		let oEncodedBufferWithOmitting	= TrustNoteP2pSaying.encode( oMessageWithOmitting ).finish();
		//	... do something with buffer

		//	Decode an Uint8Array (browser) or Buffer (node) to a message
		let oDecodeMessage		= TrustNoteP2pSaying.decode( oEncodedBuffer );
		let oDecodeMessageWithOmitting	= TrustNoteP2pSaying.decode( oEncodedBufferWithOmitting );
		//	... do something with message

		let sTypeWithOmitting		= oDecodeMessageWithOmitting.type;


		//	If the application uses length-delimited buffers, there is also encodeDelimited and decodeDelimited.

		//
		//	Convert the message back to a plain object / Javascript object
		//
		let oPlainObject = TrustNoteP2pSaying.toObject( oDecodeMessage, {
			longs: String,
			enums: String,
			bytes: String,
			// see ConversionOptions
		});
	}
);