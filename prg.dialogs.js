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

	// Setup
	var windows = {},
		windowManager = new OO.ui.WindowManager();

	// Templates
	var $prgContent = $( '<div>' )
			.addClass( 'prg-content' ),
		$prgWelcomeHeading = $( '<h1>' )
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
		$prgMicrophoneCheckPermissionText = $( '<p>' )
			.text( "All right? Let's proceed to the next and check whether your microphone is correctly installed." );

	prg.RecorderUI = function ( config ) {
		prg.RecorderUI.super.call( this, config );
	};
	OO.inheritClass( prg.RecorderUI, OO.ui.ProcessDialog );
	
	prg.RecorderUI.static.title = "Pronunciation recording gadget (" + prg.version + ")";
	prg.RecorderUI.static.actions = [
		{ action: 'continue', label: "Proceed", flags: 'primary' },
		{ action: 'cancel', label: "Cancel", flags: ['safe', 'destructive'] }
	];
	prg.RecorderUI.prototype.initialize = function () {
		var dialog = this;

		prg.RecorderUI.super.prototype.initialize.apply( dialog, arguments );
		dialog.content = new OO.ui.PanelLayout( { $: dialog.$, padded: true, expanded: false } );
		dialog.content.$element.append( '<div class="prg-dialog-content">If you see this text, Pronunciation Recording has an error that should be reported to its software developer.</div>' );

		dialog.$body.append( dialog.content.$element );
	};
	prg.RecorderUI.prototype.getReadyProcess = function ( data ) {
		var process,
			dialog = this;

		process = prg.RecorderUI.super.prototype.getReadyProcess.call( this, data );
		dialog.getActions().get( { actions: ['cancel'] } )[0].on( 'click', function() {
			dialog.close( { action: 'cancel' } );
			if ( dialog.accessGranted ) {
				var error = [new OO.ui.Error( 'User aborted.' )];
				dialog.accessGranted.reject( [] );
				dialog.hideErrors();
			}
		} );
		return process;
	};
	prg.RecorderUI.prototype.getSetupProcess = function ( data ) {
		this.content.$element.empty().append( data.message );
		return prg.RecorderUI.super.prototype.getSetupProcess.call( this, data );
	};
	prg.RecorderUI.prototype.getActionProcess = function ( action ) {
		var dialog = this;

		if ( action === 'cancel' ) {
			dialog.close( { action: action } );
			return prg.RecorderUI.super.prototype.getActionProcess.call( this, action );
		} else {
			return prg.RecorderUI.super.prototype.getActionProcess
				.call( this, action )
				.next( function () {
					this.getActions().get( { actions: ['continue'] } )[0].setDisabled( true );

					var Recorder = prg.getCompatibleRecorder(),
						recorder = new Recorder(),
						accessGranted = $.Deferred();

					dialog.accessGranted = accessGranted;
					$prgContent
						.empty()
						.append( 'Please grant pronunciation recording gadget access to your microphone and only select microphones, i.e. not "stereo mix".' );

					recorder.requestMicrophoneAccess().done( function () {
						$prgContent
							.empty()
							.append( 'Superb: Pronunciation Recorder has now access to your microphone. Now, let\'s check the input level.' );
						accessGranted.resolve();
					} ).fail( function () {
						var error = [new OO.ui.Error( 'Without access to your microphone, pronunciation recordings cannot be created.' )];
						// dialog.showErrors( error );
						accessGranted.reject( error );
					} );
					return accessGranted;

				}, this )
				.next( 1000 )
				.next( function () {
					dialog.close( { action: action } );
				} );
		}
	};
	prg.RecorderUI.prototype.getBodyHeight = function () {
		return this.content.$element.outerHeight( true );
	};

	windows['RecorderUI'] = new prg.RecorderUI( { size: 'large' } );
	windowManager.addWindows( windows );
	var openDlg = function() {
		var nextButton = new OO.ui.ActionWidget( {
					label: 'Okay, let\'s start!',
					icon: 'next',
					framed: true
				} ).on( 'click', function () {
					windows['RecorderUI'].executeAction( 'continue' );
				} );
		
		windowManager.openWindow( 'RecorderUI', {
			title: 'Pronunciation recording',
			message: $prgContent
							.empty()
							.append( $prgWelcomeHeading, $prgWelcomeText )
							.append( $prgAdviceIntro, $prgAdviceMicroHead, $prgAdviceMicroText )
							.append( $prgAdvicePronunciationHead, $prgAdvicePronunciatioText )
							.append( $prgMicrophoneCheckPermissionText )
							.append( nextButton.$element ),
			verbose: true
		} ).done(function() {
			console.log('window open');
		} );
		console.log( nextButton.$element )
	};
	var $el = $( '#bodyContent' ).length ? $( '#bodyContent' ) : $( 'body' );
	windowManager.$element.appendTo( $el );
	$('<button>').text( 'Open Dlg' ).click(openDlg).appendTo( $el );
}( jQuery, window ) );
