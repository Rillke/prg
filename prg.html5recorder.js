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

	// Normalize several vendor-specific methods and add shims
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		navigator.getUserMedia = ( navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia );
		window.URL = window.URL || window.webkitURL;
		window.prgRequestAnimationFrame = ( function() {
			return ( window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				window.oRequestAnimationFrame ||
				window.msRequestAnimationFrame ||
				function( callback ) {
					window.setTimeout( callback, 1000 / 60 );
				} );
		} )();
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
				if ( window.console ) console.log( 'WebAudio API is not properly supported for this browser' );
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

	function createMediaStreamSource( html5Recorder ) {
		if ( !html5Recorder.input ) {
			// audio playback from the MediaStream will be re-routed into the processing graph of the AudioContext
			html5Recorder.input = html5Recorder.audioContext.createMediaStreamSource( html5Recorder.stream );
		}
	}
	$.extend( global.prg.Html5Recording.prototype, {
		record: function() {
			var recorder,
				$def = $.Deferred();

			createMediaStreamSource( this.html5Recorder );
			try {
				recorder = new Recorder( this.html5Recorder.input, {
					// TODO: Must be somehow adjusted
					workerPath: 'recorder.js/recorderWorker.js'
				} );
			} catch ( ex ) {
				return $def.reject()
					.promise();
			}
			this.waveBlob = null;
			recorder.clear();
			recorder.record();
			this.recorder = recorder;
			this.isRecording = true;
			$def.resolve();
			return $def.promise();
		},

		startRender: function() {
			if ( !this.html5PPM ) throw new Error( 'Visualizer must be created before starting rendering on it!' );
			this.html5PPM.connect( this.html5Recorder.audioContext, this.html5Recorder.input );
		},

		stopRender: function() {
			this.html5PPM.disconnect();
		},

		getVisualizer: function() {
			if ( !this.$visualizer ) {
				if ( this.html5PPM ) return;
				createMediaStreamSource( this.html5Recorder );
				this.html5PPM = new global.prg.Html5PPM();
				this.$visualizer = this.html5PPM.get();
			}
			return this.$visualizer;
		},

		stopRecording: function() {
			var $def = $.Deferred();

			this.isRecording = false;
			this.recorder.stop();
			$def.resolve();
			return $def.promise();
		},

		getPlayer: function() {
			var player, $def = $.Deferred();

			this.getData()
				.done( function( blob ) {
					player = $.parseHTML( '<audio controls class="prg-preview-audio"><source src="' + URL.createObjectURL( blob ) + '" type="audio/wav"></audio>' );
					$def.resolve( player );
				} );
			return $def.promise();
		},

		play: function() {
			var $def = $.Deferred(),
				audioElem;

			this.getData()
				.done( function( blob ) {
					audioElem = document.createElement( 'audio' );

					$( audioElem )
						.on( 'load', function() {
							audioElem.play();
						}, true );
					audioElem.setAttribute( 'src', URL.createObjectURL( blob ) );
					audioElem.play();
					$def.resolve( audioElem );
				} )
				.fail( function() {
					$def.reject();
				} );


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

	global.prg.HtmlPPM = function() {
		var HEIGHT = this.height = 20,
			WIDTH = this.width = 128;

		this.$visualizer = $( '<div>' )
			.addClass( 'prg-visualizer' )
			.css( {
				width: WIDTH,
				height: HEIGHT,
				background: '#000',
				position: 'relative',
				border: '1px solid grey'
			} );
		this.$volume = $( '<div>' )
			.css( {
				background: '#AAF',
				width: 0,
				height: HEIGHT,
				position: 'absolute',
				left: 0,
				top: 0
			} )
			.appendTo( this.$visualizer );
		this.$peakLevel = $( '<div>' )
			.css( {
				background: '#BB3',
				width: Math.round( WIDTH / 40 ),
				height: HEIGHT,
				position: 'absolute',
				left: 0,
				top: 0
			} )
			.appendTo( this.$visualizer );
		this.$maxVol17 = $( '<div>' )
			.css( {
				background: '#33F',
				width: Math.round( WIDTH / 40 ),
				height: HEIGHT,
				position: 'absolute',
				left: 0,
				top: 0
			} )
			.appendTo( this.$visualizer );
	};
	$.extend( global.prg.HtmlPPM.prototype, {
		setDimensions: function() {
			throw new Error( 'not implemented yet' );
		},
		setValues: function( values ) {
			this.$volume.css( 'width', values.volume * this.width );
			this.$peakLevel.css( 'left', values.peakLevel * this.width );
			this.$maxVol17.css( 'left', values.maxVol17 * this.width );
		},
		get: function() {
			return this.$visualizer;
		}
	} );


	global.prg.Html5PPM = function() {
		this.htmlPPM = new global.prg.HtmlPPM();
		this.$visualizer = this.htmlPPM.get();
		this.smoothing = 0.8;
		this.fftSize = 256;
	};
	$.extend( global.prg.Html5PPM.prototype, {
		setDimensions: function() {
			throw new Error( 'not implemented yet' );
		},
		disconnect: function() {
			this.analyser = null;
		},
		connect: function( audioContext, input ) {
			var ppm = this,
				peak = 0,
				lastMeasurement = $.now();

			// Prevent running concurrency processes
			if ( this.isRenderning ) return;
			this.isRenderning = true;

			// Use the AnalyserNode
			this.analyser = audioContext.createAnalyser();
			input.connect( this.analyser );

			this.analyser.smoothingTimeConstant = this.smoothing;
			this.analyser.fftSize = this.fftSize;
			this.analyser.minDecibels = -60;
			this.analyser.maxDecibels = 0;

			this.times = new Uint8Array( this.fftSize );
			this.maxVols = new Uint8Array( 1700 );

			var render = function() {
				var maxVol = 0,
					clippings = 0,
					now = $.now(),
					indexFrom = lastMeasurement % 1700,
					indexNow = now % 1700,
					maxVols = ppm.maxVols,
					maxVol17 = 0,
					fftSize = ppm.fftSize,
					htmlPPM = ppm.htmlPPM,
					i, value, ratio;

				// Get the time data from the currently playing sound
				// Frequency data not required
				// Note that depending on the frame rate, we might miss some
				// clippings. And we'd also would have to oversample to
				// reliably detect them but for the purpose we're going to
				// use this meter, it should be sufficient just doing it this
				// way.
				if ( !ppm.analyser ) {
					ppm.isRenderning = false;
					return;
				}
				ppm.analyser.getByteTimeDomainData( ppm.times );

				for ( i = 0; i < fftSize; ++i ) {
					value = ppm.times[ i ];
					ratio = Math.abs( 128 - value );
					maxVol = Math.max( maxVol, ratio );

					if ( ratio > 126 ) {
						clippings++;
					}
				}
				maxVols[ indexNow ] = maxVol;
				while ( true ) {
					indexFrom++;
					indexFrom %= 1700;
					if ( indexNow === indexFrom ) {
						break;
					} else {
						maxVols[ indexFrom ] = 0;
					}
				}
				for ( i = 0; i < 1700; ++i ) {
					maxVol17 = Math.max( maxVol17, maxVols[ i ] );
				}


				peak = Math.max( peak, maxVol );
				htmlPPM.setValues( {
					volume: maxVol / 128,
					peakLevel: peak / 128,
					maxVol17: maxVol17 / 128
				} );
				if ( clippings ) {
					alert( 'Clipping detected! ' + clippings );
				}

				lastMeasurement = now;
				prgRequestAnimationFrame( render );
			};
			render();
		},
		get: function() {
			return this.$visualizer;
		}
	} );


} )( jQuery, window.mediaWiki ? mediaWiki.libs : window );
