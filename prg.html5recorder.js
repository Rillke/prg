/*! Copyright 2014 Rainer Rillke <lastname@wikipedia.de>
 * Quadrouple-licensed under
 * - GPLv2 and, at your option any later version of that license,
 * - LGPL 2.1 and, at your option any later version of that license,
 * - Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0),
 * - GNU Free Documentation License (GNU FDL aka. GFDL) 1.2
 *   and, at your option any later version of that license.
 *
 * @author Rainer Rillke
 */

/**
 * Pronunciation recording gadget.
 * Framework for recording audio in a browser.
 *
 * Funded by the Wikimedia Foundation as part of an Individual Investment Grant.
 * This means the Wikimedia Foundation supported creation materially
 * but did not directly endorse creation of this software.
 * More information about
 * [Individual Investment Grants](https://meta.wikimedia.org/wiki/Grants:IEG).
 *
 * @class prg.Html5Recorder
 * Recording using HTML5's APIs.
 *
 * @inheritdoc prg.Recorder
 * @requires jQuery
 */


( function( $, global ) {


	// Make sure the namespace exists
	if ( !global.prg ) {
		throw new Error( "Base class and namespace required here!" );
	}

	// Normalize several vendor-specific methods
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		navigator.getUserMedia = ( navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia );
		window.URL = window.URL || window.webkitURL;
	} catch ( writeProtected ) {}

	global.prg.Html5Recorder = function() {};

	// Register as recorder
	global.prg.recorders.push( global.prg.Html5Recorder );

	$.extend( global.prg.Html5Recorder.prototype, Object.create( global.prg.Recorder ), {
		isCompatible: function() {
			var $def = $.Deferred(),
				compat = !!( ( window.URL ) && ( window.AudioContext ) && ( navigator.getUserMedia ) && ( window.Blob && window.File ) );
			if ( compat ) {
				$def.resolve();
			} else {
				$def.reject();
			}
			return $def.promise();
		},

		hasMicrophoneAccess: false,

		requestMicrophoneAccess: function() {
			var $def = $.Deferred(),
				html5Recorder = this;

			if ( this.hasMicrophoneAccess ) {
				return $def.resolve()
					.promise();
			}
			try {
				html5Recorder.audioContext = new AudioContext();
			} catch ( e ) {
				// This should never happen but better safe than sorry
				mw.log( 'WebAudio API is not properly supported for this browser' );
				throw e;
			}
			navigator.getUserMedia( {
				audio: true
			}, function( stream ) {
				html5Recorder.stream = stream;
				html5Recorder.hasMicrophoneAccess = true;

				$def.resolve();
			}, function() {
				$def.reject();
			} );
			return $def.promise();
		},

		getRecording: function() {
			var $def = $.Deferred();
			if ( !this.hasMicrophoneAccess ) {
				throw new Error( 'Request access to the microphone before attempting to record!' );
			}
			$def.resolve( new this.recording( this ) );
			return $def;
		}
	} );

	/**
	 * @class prg.Html5Recording
	 * Represents a recording.
	 *
	 * @inheritdoc prg.Html5Recording
	 * @requires jQuery
	 */
	global.prg.Html5Recording = function( html5Recorder ) {
		this.html5Recorder = html5Recorder;
	};
	$.extend( global.prg.Html5Recording.prototype, {
		start: function() {
			var recorder,
				$def = $.Deferred();

			if ( !this.html5Recorder.input ) {
				// audio playback from the MediaStream will be re-routed into the processing graph of the AudioContext
				this.html5Recorder.input = this.html5Recorder.audioContext.createMediaStreamSource( this.html5Recorder.stream );
			}
			try {
				recorder = this.recorder = new Recorder( this.html5Recorder.input );
			} catch ( ex ) {
				return $def.reject()
					.promise();
			}
			this.waveBlob = null;
			recorder.clear();
			recorder.record();
			this.recorder = recorder;
			$def.resolve();
			return $def.promise();
		},

		stopRecording: function() {
			var $def = $.Deferred();

			this.recorder.stop();
			$def.resolve();
			return $def.promise();
		},

		getPlayer: function() {
			var player, $def = $.Deferred();

			if ( !this.waveBlob ) return $def.reject()
				.promise();

			player = $.parseHTML( '<audio controls class="prg-preview-audio"><source src="' + URL.createObjectURL( this.waveBlob ) + '" type="audio/wav"></audio>' );
			$def.resolve( player );
			return $def.promise();
		},

		play: function() {
			var $def = $.Deferred(),
				audioElem;

			if ( !this.waveBlob ) return $def.reject()
				.promise();

			audioElem = document.createElement( 'audio' );

			player.on( 'load', function() {
				audioElem.play();
			}, true );
			audioElem.setAttribute( 'src', URL.createObjectURL( this.waveBlob ) );
			audioElem.play();
			$def.resolve( audioElem );
			return $def.promise();
		},

		stopPlay: function( player ) {
			var $def = $.Deferred();
			if ( !player ) return $def.reject()
				.promise();

			$def.resolve();
			return $def.promise();
		},

		/**
		 * Not implemented
		 * @method upload
		 */
		upload: null,

		getData: function() {
			var $def = $.Deferred();
			if ( this.waveBlob ) {
				$def.resolve( this.waveBlob );
			} else {
				this.recorder.exportWAV(
					function( blob ) {
						this.waveBlob = blob;
						$def.resolve( blob );
					}
				);
			}
			return $def.promise();
		}
	} );
	global.prg.Html5Recorder.prototype.recording = global.prg.Html5Recording;

} )( jQuery, window.mediaWiki ? mediaWiki.libs : window );
