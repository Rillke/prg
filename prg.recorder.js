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
 * @class prg.Recorder
 * Base recorder class.
 * Each recording approach must implement prg.Recorder
 * and prg.Recording and those must be shipped together.
 *
 * @abstract
 * @requires jQuery
 */

 /*global mediaWiki:false*/

( function( $, global ) {
	'use strict';

	/**
	 * Object.create polyfill
	 * source:
	 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create#Polyfill
	 */
	if ( typeof Object.create !== 'function' ) {
		( function() {
			var F = function() {};
			Object.create = function( o ) {
				if ( arguments.length > 1 ) {
					throw new Error( 'Second argument not supported' );
				}
				if ( o === null ) {
					throw new Error( 'Cannot set a null [[Prototype]]' );
				}
				if ( typeof o !== 'object' ) {
					throw new TypeError( 'Argument must be an object' );
				}
				F.prototype = o;
				return new F();
			};
		} )();
	}


	// Make sure the namespace exists
	if ( !global.prg ) {
		global.prg = {
			recorders: [],
			compatibleRecorder: null
		};
	}

	global.prg.Recorder = function() {};
	$.extend( global.prg.Recorder.prototype, {
		/**
		 * Compatiblity check for the recorder type on the currently chosen client
		 *
		 * @abstract
		 * @static
		 * @return {jQuery.Promise}
		 */
		isCompatible: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		hasMicrophoneAccess: false,

		/**
		 * Requests access to the microphone.
		 * This may open a confirmation dialog.
		 * Must set .hasMicrophoneAccess to true when
		 * successful and before resolving the Deferred.
		 *
		 * @abstract
		 * @return {jQuery.Promise}
		 */
		requestMicrophoneAccess: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Create a recording and return a reference to
		 * that recording.
		 *
		 * @abstract
		 * @return {prg.Recording}
		 */
		getRecording: function() {
			if ( !this.hasMicrophoneAccess ) {
				throw new Error( 'Request access to the microphone before attempting to record!' );
			}
			return new global.prg.Recording();
		}
	} );

	/**
	 * @class prg.Recording
	 * Base recording class.
	 * Represents a recording.
	 *
	 * @abstract
	 * @requires jQuery
	 */
	global.prg.Recording = function() {};
	$.extend( global.prg.Recording.prototype, {
		/**
		 * Starts recording.
		 *
		 * @abstract
		 * @return {jQuery.Promise}
		 */
		start: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Stops recording.
		 *
		 * @abstract
		 * @return {jQuery.Deferred}
		 */
		stopRecording: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Get a player element.
		 * First and only argument to the .done() callback
		 * of the Deferred is the HTMLElement containing the player.
		 *
		 * @abstract
		 * @return {jQuery.Promise}
		 */
		getPlayer: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Get a player element containing compressed audio.
		 * First and only argument to the .done() callback
		 * of the Deferred is the HTMLElement containing the player.
		 *
		 * @abstract
		 * @return {jQuery.Promise}
		 */
		getCompressedPlayer: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Plays the previously recorded sound.
		 *
		 * @abstract
		 * @return {jQuery.Promise}
		 */
		play: function() {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Stops playing the previously recorded sound.
		 *
		 * @abstract
		 * @param {Object} player obtained through `.play()`
		 * @return {jQuery.Promise}
		 */
		stopPlay: function( player ) {
			var $def = $.Deferred();
			$def.reject();
			return $def.promise();
		},

		/**
		 * Uploads the previously recorded sound.
		 * Note derived classes can either implement
		 * `.upload()` or `.getData()` or both.
		 *
		 * @abstract
		 * @method upload
		 * @return {jQuery.Promise}
		 */
		upload: null,

		/**
		 * Get the data of the previously recorded sound.
		 * Note derived classes can either implement
		 * `.upload()` or `.getData()` or both.
		 * First and only argument to the .done() callback
		 * of the Deferred is a blob of the structure
		 *
		 * @abstract
		 * @method getData
		 * @return {jQuery.Promise}
		 */
		getData: null,

		/**
		 * Get the data of the previously recorded sound.
		 * Note derived classes can either implement
		 * `.upload()` or `.getData()` and `.getCompressedData()`
		 * or both.
		 * First and only argument to the .done() callback
		 * of the Deferred returned by calling this function is a
		 * blob of the structure
		 *
		 * @abstract
		 * @method getCompressedData
		 * @return {jQuery.Promise}
		 */
		getCompressedData: null
	} );

	/**
	 * Returns the recorder class that fits best with the
	 * current hardware.
	 *
	 * @abstract
	 * @method prg.getCompatibleRecorder
	 * @return {prg.Recorder}
	 */
	global.prg.getCompatibleRecorder = function() {
		var compatibleRecorder = null;
		if ( global.prg.compatibleRecorder ) return global.prg.compatibleRecorder;

		$.each( global.prg.recorders, function( i, recorder ) {
			if ( recorder.prototype.isCompatible() ) {
				compatibleRecorder = recorder;
				return false;
			}
		} );
		return ( global.prg.compatibleRecorder = compatibleRecorder );
	};
} )( jQuery, window.mediaWiki ? mediaWiki.libs : window );
