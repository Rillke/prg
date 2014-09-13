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
 * @class prg.RecorderUI
 * Basic recorder User Interface
 *
 * @requires OO.ui
 * @requires jQuery
 */

 /*global mediaWiki:false, OO:false, jQuery:false*/
 
( function( $, global ) {
	// Make sure the namespace exists
	if ( !global.prg ) {
		throw new Error( "Namespace required by Pronunciation Recording Gadget (prg.RecorderUI)!" );
	}

	prg.RecorderUI = function ( config ) {
		prg.RecorderUI.super.call( this, config );
	};
	OO.inheritClass( prg.RecorderUI, OO.ui.ProcessDialog );
	
	prg.RecorderUI.static.title = "Pronunciation recording gadget (" + prg.version + ")";
	prg.RecorderUI.static.actions = [
		{ action: 'save', label: "Proceed", flags: 'primary' },
		{ action: 'cancel', label: "Cancel", flags: 'safe' }
	];
	prg.RecorderUI.prototype.initialize = function () {
		prg.RecorderUI.super.prototype.initialize.apply( this, arguments );
		this.content = new OO.ui.PanelLayout( { $: this.$, padded: true, expanded: false } );
		this.content.$element.append( '<div class="prg-dialog-content">Dialog content</div>' );
		this.$body.append( this.content.$element );
	};
	prg.RecorderUI.prototype.getSetupProcess = function ( data ) {
		console.log( data.message )
		this.content.$element.empty().append( data.message );
		return prg.RecorderUI.super.prototype.getSetupProcess.call( this, data );
	};
	prg.RecorderUI.prototype.getActionProcess = function ( action ) {
		var dialog = this;
		return prg.RecorderUI.super.prototype.getActionProcess
			.call( this, action )
			.next( function () {
				console.log('compat recorder');
				var Recorder = prg.getCompatibleRecorder(),
					recorder = new Recorder(),
					accessGranted = $.Deferred();

				this.content.$element.empty().append( 'Please grant pronunciation recording gadget access to your microphone.' );

				recorder.requestMicrophoneAccess().done( function () {
					accessGranted.resolve();
				} ).fail( function () {
					dialog.showErrors( [new OO.ui.Error( 'Without access to you microphone, pronunciation recordings cannot be created.' )] );
					accessGranted.reject();
				} );
				return accessGranted;

			}, this )
			.next( function () {
				dialog.close( { action: action } );
			} );
	};
	prg.RecorderUI.prototype.getBodyHeight = function () {
		return this.content.$element.outerHeight( true );
	};

	// Setup
	var windows = {},
		windowManager = new OO.ui.WindowManager();

	// Templates
	var $prgWelcomeHeading = $( '<h1>' )
			.text( "New to pronunciation recording gadget?" ),
		$prgWelcomeText = $( '<p>' )
			.text( "This tool facilates recording uploading and embedding pronunciation recordings with just a few clicks." ),
		$prgAdviceIntro = $( '<p>' )
			.text( "It's easy but please read the following advice before starting." ),
		$prgAdviceMicroHead = $( '<h2>' )
			.text( "The microphone:" ),
		$prgAdviceMicroText = $( '<p>' )
			.addClass( 'prg-indeted' )
			.text( "With a good microphone you can achieve significantally better results. If you only own a cheap one, try the following: Mount it at a distance of about 10\u00A0cm and slighly below your mouth so you avoid clipping while speaking 'p' or 's' tones." ),
		$prgAdvicePronunciationHead = $( '<h2>' )
			.text( "Pronunciation:" ),
		$prgAdvicePronunciatioText = $( '<p>' )
			.addClass( 'prg-indeted' )
			.text( "If possible, choose a calm environment, stand up while speaking, speak the word in one or more clearly intonated sentences before recording." ),
		$prgMicrophoneCheckPermissionText = $( '<a>' )
			.attr( 'href', '#' )
			.text( "All right? Let's proceed to the next and check whether your microphone is correctly installed." );

	windows['RecorderUI'] = new prg.RecorderUI( { size: 'large' } );
	windowManager.addWindows( windows );
	var openDlg = function() {
		windowManager.openWindow( 'RecorderUI', {
			title: 'Pronunciation recording',
			message: $().add( $prgWelcomeHeading ).add( $prgWelcomeText )
				.add( $prgAdviceIntro ).add( $prgAdviceMicroHead ).add( $prgAdviceMicroText )
				.add( $prgAdvicePronunciationHead ).add( $prgAdvicePronunciatioText )
				.add( $prgMicrophoneCheckPermissionText ),
			verbose: true
		} ).done(function() {
			console.log('window open');
		} );
	};
	var $el = $( '#bodyContent' ).length ? $( '#bodyContent' ) : $( 'body' );
	windowManager.$element.appendTo( $el );
	$('<button>').text('Open Dlg').click(openDlg).appendTo( $el );
}( jQuery, window ) );
