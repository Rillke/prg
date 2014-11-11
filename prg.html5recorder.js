/*! Copyright 2014 Rainer Rillke <lastname@wikipedia.de>
 * Quintuple-licensed under
 * - GPLv2 and, at your option any later version of that license,
 * - LGPL 2.1 and, at your option any later version of that license,
 * - Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0),
 * - GNU Free Documentation License (GNU FDL aka. GFDL) 1.2
 *   and, at your option any later version of that license.
 * - MIT (http://opensource.org/licenses/MIT)
 * For detailed information confer to LICENSE in the repository's root directory.
 *
 * @author Rainer Rillke
 *
 * TODO:
 * - Error handling everywhere
 * -- (try ... catch around things that may throw us with errors)
 * -- `.fail()` callbacks
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

/*global AudioContext:false, console:false, Recorder:false, URL:false, alert:false, prgRequestAnimationFrame:false, mediaWiki:false */
( function( $, global ) {
	'use strict';

	// Make sure the namespace exists
	if ( !global.prg ) {
		throw new Error( "Base class and namespace required by Pronunciation Recording Gadget (prg.Html5Recorder)!" );
	}

	// Normalize several vendor-specific methods and add shims
	try {
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		window.OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext || window.AudioContext;
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

		startRenderPPM: function() {
			if ( !this.html5Analyzer ) throw new Error( 'Visualizer must be created before starting rendering on it!' );
			this.html5Analyzer.connect( this.html5Recorder.audioContext, this.html5Recorder.input );
			this.html5Analyzer.startPPM();
		},

		startRenderWfD: function( cumulative ) {
			if ( !this.html5Analyzer ) throw new Error( 'Visualizer must be created before starting rendering on it!' );
			this.html5Analyzer.connect( this.html5Recorder.audioContext, this.html5Recorder.input );
			this.html5Analyzer.startWaveform( cumulative );
		},

		startRenderTimeWfD: function() {
			if ( !this.html5Analyzer ) throw new Error( 'Visualizer must be created before starting rendering on it!' );
			this.html5Analyzer.connect( this.html5Recorder.audioContext, this.html5Recorder.input );
			this.html5Analyzer.startTimeWaveform();
		},

		stopRenderPPM: function() {
			this.html5Analyzer.stopPPM();
		},

		getPPM: function() {
			if ( !this.$ppm ) {
				createMediaStreamSource( this.html5Recorder );
				if ( !this.html5Analyzer ) {
					this.html5Analyzer = new global.prg.Html5Analyzer();
				}
				this.$ppm = this.html5Analyzer.getPPM();
			}
			return this.$ppm;
		},

		getWfD: function( cumulative ) {
			var entity = cumulative ? '$ccwfd' : '$wfd';
			if ( !this[entity] ) {
				createMediaStreamSource( this.html5Recorder );
				if ( !this.html5Analyzer ) {
					this.html5Analyzer = new global.prg.Html5Analyzer();
				}
				this[entity] = this.html5Analyzer.getWfD( cumulative );
			}
			return this[entity];
		},

		getTimeWfD: function() {
			var entity = '$tcwfd';
			if ( !this[entity] ) {
				createMediaStreamSource( this.html5Recorder );
				if ( !this.html5Analyzer ) {
					this.html5Analyzer = new global.prg.Html5Analyzer();
				}
				this[entity] = this.html5Analyzer.getTimeWfD();
			}
			return this[entity];
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

		getCompressedPlayer: function() {
			var player, $def = $.Deferred();

			this.getCompressedData()
				.done( function( blob ) {
					player = $.parseHTML( '<audio controls class="prg-preview-audio"><source src="' + URL.createObjectURL( blob ) + '" type="' + blob.type + '"></audio>' );
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
			var $def = $.Deferred(),
				recording = this;

			if ( recording.waveBlob ) {
				$def.resolve( recording.waveBlob );
			} else {
				recording.recorder.exportWAV(
					function( blob ) {
						recording.waveBlob = blob;
						$def.resolve( blob );
					}
				);
			}
			return $def.promise();
		},

		getCompressedData: function() {
			var $def = $.Deferred(),
				acxt = new AudioContext(),
				audioBufferSourceNode = acxt.createBufferSource();

			this.getData().done( function( blob ) {
				if ( !window.MediaRecorder ) {
					// TODO: Emscripten or something thelike or zip and
					// oAuth or ... or speex.js
					return $def.resolve( blob );
				}

				var fileReader = new FileReader();
				fileReader.onload = function() {
					acxt.decodeAudioData( this.result, function( audioBuffer ) {
						audioBufferSourceNode.buffer = audioBuffer;

						// This won't work with an offline audio context
						var streamDest = acxt.createMediaStreamDestination();
						var recorder = new MediaRecorder( streamDest.stream );

						recorder.ondataavailable = function(e) {
							$def.resolve(e.data);
						};

						if ( audioBufferSourceNode.onended ) {
							audioBufferSourceNode.onended( function() {
								recorder.stop();
							} );
						} else {
							setTimeout( function() {
								recorder.stop();
							}, audioBuffer.duration * 1000 );
						}
						audioBufferSourceNode.connect( streamDest );
						
						// And Go!
						recorder.start();
						// See http://docs.webplatform.org/wiki/apis/webaudio/AudioBufferSourceNode
						audioBufferSourceNode.start( 0 );
					}, function( e ){
						// TODO: Make sure this error is handled
						throw new Error( "Error with decoding audio data" + e.err );
					} );
				};
				fileReader.readAsArrayBuffer( blob );
			} );
			return $def;
		}
	} );
	global.prg.Html5Recorder.prototype.recording = global.prg.Html5Recording;

	// A peak programme meter
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

	// A canvas waveform display
	global.prg.CanvasWaveformDisplay = function( options ) {
		this.options = $.extend( {}, this.defaults, options );

		this.$visualizer = $( '<div>' )
			.addClass( 'prg-visualizer' )
			.css( {
				background: '#000',
				position: 'relative',
				border: '1px solid grey',
				overflow: 'hidden'
			} );
		this.$canvas = $( '<canvas>' )
			.attr( this.getDimensions() )
			.appendTo( this.$visualizer );

		this.setDimensions( this.getDimensions() );
		this.ctx2Dcontext = this.$canvas[0].getContext('2d');
		this.ctx2Dcontext.fillStyle = "#AAAAAA";
	};
	$.extend( global.prg.CanvasWaveformDisplay.prototype, {
		defaults: {
			height: 256,
			width: 256,
			cumulative: false
		},

		getDimensions: function() {
			return {
				height: this.options.height,
				width: this.options.width
			};
		},
		setDimensions: function( values ) {
			this.dimensions = values;
			this.$visualizer.css( values );
			this.$canvas.attr( values );
			this.signalsPerPixel = Math.floor( 256 / values.width );
			if (this.lastValues) this.setValues( this.lastValues );
		},

		/**
		 * @param {Array} values Raw time domain values (exactly 256)
		 */
		setValues: function( values ) {
			// http://jsperf.com/loop-division-vs-equal-and-counters
			var i,
				ctx = this.ctx2Dcontext,
				h =  this.dimensions.height,
				w = this.dimensions.width,
				l = values.length,
				spp = this.signalsPerPixel,
				factor = h / 256,
				sshift = 0;

			this.lastValues = values;

			if ( !this.options.cumulative ) ctx.clearRect( 0, 0, w, h );
			for ( i = 0; i < l; ++i, ++sshift ) {
				if ( 0 === i % spp ) {
					--sshift;
				}
				ctx.fillRect( i - sshift, values[i] * factor, 1, 1 );
			}
		},
		get: function() {
			return this.$visualizer;
		}
	} );

	// A canvas waveform display for a time span
	global.prg.CanvasTimespanWaveformDisplay = function( options ) {
		this.options = $.extend( {}, this.defaults, options );

		this.cachedValues = [];
		this.offset = 0;

		this.$visualizer = $( '<div>' )
			.addClass( 'prg-visualizer' )
			.css( {
				background: '#000',
				position: 'relative',
				border: '1px solid grey',
				overflow: 'hidden'
			} );
		this.$canvas = $( '<canvas>' )
			.attr( this.getDimensions() )
			.appendTo( this.$visualizer );

		this.setDimensions( this.getDimensions() );
		this.ctx2Dcontext = this.$canvas[0].getContext('2d');
		this.ctx2Dcontext.fillStyle = "#AAAAAA";
	};
	$.extend( global.prg.CanvasTimespanWaveformDisplay.prototype, {
		defaults: {
			height: 256,
			width: 256,
			signalCountToShow: 556000
		},

		getDimensions: function() {
			return {
				height: this.options.height,
				width: this.options.width
			};
		},
		setDimensions: function( values ) {
			this.dimensions = values;
			this.$visualizer.css( values );
			this.$canvas.attr( values );
			this.signalsPerPixel = Math.floor( this.options.signalCountToShow / values.width );
			// if ( this.cachedValues.length ) this.setValues( this.lastValues );
		},

		/**
		 * @param {Array} values Raw time domain values (exactly 256)
		 */
		pushValues: function( values ) {
			this.cachedValues.push( values );
			this.render( values, this.offset );
			this.offset++;
		},

		render: function( values, offset ) {
			// http://jsperf.com/loop-division-vs-equal-and-counters
			var i, yPositionPos, yPositionNeg, xPosition, heightPos,
				ctx = this.ctx2Dcontext,
				l = values.length,
				h = this.options.height,
				spp = this.signalsPerPixel,
				factor = h / 256,
				sshift = 0,
				posAmpl = 128,
				negAmpl = 128;

			
			offset = Math.floor( offset * 256 / spp );

			for ( i = 0; i < l; ++i, ++sshift ) {
				if ( 0 === i % spp ) {
					xPosition = i - sshift + offset;
					yPositionPos = posAmpl * factor;
					yPositionNeg = negAmpl * factor;
					heightPos = Math.abs( 128 - posAmpl ) * factor;
					ctx.fillRect( xPosition, yPositionPos - heightPos, 1, heightPos );
					ctx.fillRect( xPosition, yPositionNeg, 1, Math.abs( 128 - negAmpl ) * factor );
					posAmpl = negAmpl = 128;
					--sshift;
				}
				posAmpl = Math.max( posAmpl, values[i] );
				negAmpl = Math.min( negAmpl, values[i] );
			}
			xPosition = i - sshift + offset;
			yPositionPos = posAmpl * factor;
			yPositionNeg = negAmpl * factor;
			heightPos = Math.abs( 128 - posAmpl ) * factor;
			ctx.fillRect( xPosition, yPositionPos - heightPos, 1, heightPos );
			ctx.fillRect( xPosition, yPositionNeg, 1, Math.abs( 128 - negAmpl ) * factor );
		},
		get: function() {
			return this.$visualizer;
		}
	} );


	global.prg.Html5Analyzer = function() {
		// Peak programme meter
		this.htmlPPM = new global.prg.HtmlPPM();
		this.$ppmVisualizer = this.htmlPPM.get();

		// WaveForm
		this.canvasWfD = new global.prg.CanvasWaveformDisplay();
		this.cumulativeCanvasWfD = new global.prg.CanvasWaveformDisplay( {
			cumulative: true
		} );
		this.timeCanvasWfD = new global.prg.CanvasTimespanWaveformDisplay();
		this.$wfVisualizer = this.canvasWfD.get();
		this.$ccwfVisualizer = this.cumulativeCanvasWfD.get();
		this.$tcwfVisualizer = this.timeCanvasWfD.get();

		this.smoothing = 0.8;
		this.fftSize = 256;
	};
	$.extend( global.prg.Html5Analyzer.prototype, {
		disconnect: function() {
			this.analyser = null;
			return this;
		},
		reset: function() {
			this.peak = 0;
			this.lastMeasurement = $.now();
			return this;
		},
		connect: function( audioContext, input ) {
			// Prevent running concurrency processes
			if ( this.isConnected ) return this;
			this.isConnected = true;

			// Use the AnalyserNode
			this.analyser = audioContext.createAnalyser();
			input.connect( this.analyser );

			this.analyser.smoothingTimeConstant = this.smoothing;
			this.analyser.fftSize = this.fftSize;
			this.analyser.minDecibels = -60;
			this.analyser.maxDecibels = 0;

			this.ppmTimes = new Uint8Array( this.fftSize );
			// monitoring for 1700ms = 1.7s
			this.maxVols = new Uint8Array( 1700 );
			return this;
		},
		startPPM: function() {
			var h5a = this;

			h5a.ppmStopped = false;
			h5a.reset();

			var render = function() {
				var maxVol = 0,
					clippings = 0,
					now = $.now(),
					indexFrom = h5a.lastMeasurement % 1700,
					indexNow = now % 1700,
					maxVols = h5a.maxVols,
					maxVol17 = 0,
					fftSize = h5a.fftSize,
					htmlPPM = h5a.htmlPPM,
					i, value, ratio;

				// Get the time data from the currently playing sound
				// Frequency data not required
				// Note that depending on the frame rate, we might miss some
				// clippings. And we'd also would have to oversample to
				// reliably detect them but for the purpose we're going to
				// use this meter, it should be sufficient just doing it this
				// way.
				if ( h5a.ppmStopped ) {
					return;
				}
				h5a.analyser.getByteTimeDomainData( h5a.ppmTimes );

				for ( i = 0; i < fftSize; ++i ) {
					value = h5a.ppmTimes[ i ];
					ratio = Math.abs( 128 - value );
					maxVol = Math.max( maxVol, ratio );

					if ( ratio > 126 ) {
						clippings++;
					}
				}
				maxVols[ indexNow ] = maxVol;
				// "0-out" everthing that happened more than 1.7s ago
				while ( true ) {
					indexFrom++;
					indexFrom %= 1700;
					if ( indexNow === indexFrom ) {
						break;
					} else {
						maxVols[ indexFrom ] = 0;
					}
				}
				// find maximum volume over 1.7s
				for ( i = 0; i < 1700; ++i ) {
					maxVol17 = Math.max( maxVol17, maxVols[ i ] );
				}


				h5a.peak = Math.max( h5a.peak, maxVol );
				htmlPPM.setValues( {
					volume: maxVol / 128,
					peakLevel: h5a.peak / 128,
					maxVol17: maxVol17 / 128
				} );
				if ( clippings ) {
					alert( 'Clipping detected! ' + clippings );
				}

				h5a.lastMeasurement = now;
				prgRequestAnimationFrame( render );
			};
			render();
			return this;
		},
		stopPPM: function() {
			this.ppmStopped = true;
			return this;
		},
		startWaveform: function( cumulative ) {
			var h5a = this,
				cwfd = cumulative ? this.cumulativeCanvasWfD : this.canvasWfD;

			if ( cumulative ) {
				h5a.ccwfStopped = false;
			} else {
				h5a.wfStopped = false;
			}

			var wfTimes = new Uint8Array( this.fftSize );

			var render = function() {
				if ( ( h5a.ccwfStopped && cumulative ) || ( h5a.wfStopped && !cumulative ) ) {
					return;
				}

				h5a.analyser.getByteTimeDomainData( wfTimes );
				cwfd.setValues( wfTimes );

				prgRequestAnimationFrame( render );
			};
			render();
			return this;
		},
		stopWavefrom: function( cumulative ) {
			if ( cumulative ) {
				this.wfStopped = true;
			} else {
				this.ccwfStopped = true;
			}
			return this;
		},
		startTimeWaveform: function() {
			var h5a = this,
				cwfd = this.timeCanvasWfD;

			var wfTimes = new Uint8Array( this.fftSize );
			h5a.tcwfStopped = false;

			var render = function() {
				if ( h5a.tcwfStopped ) {
					return;
				}

				h5a.analyser.getByteTimeDomainData( wfTimes );
				cwfd.pushValues( wfTimes );

				prgRequestAnimationFrame( render );
			};
			render();
			return this;
		},
		stopTimeWavefrom: function() {
			this.tcwfStopped = true;
			return this;
		},
		testEnvironment: function() {
			var testResult = $.Deferred();

			return testResult;
		},
		getPPM: function() {
			return this.$ppmVisualizer;
		},
		getWfD: function( cumulative ) {
			if ( cumulative ) {
				return this.$ccwfVisualizer;
			} else {
				return this.$wfVisualizer;
			}
		},
		getTimeWfD: function() {
			return this.$tcwfVisualizer;
		}
	} );


} )( jQuery, window.mediaWiki ? mediaWiki.libs : window );