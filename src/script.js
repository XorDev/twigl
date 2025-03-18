import 'whatwg-fetch';
import Promise from 'promise-polyfill';
import {Fragmen} from './fragmen.js';
import {registerCursorTimeout} from './registerCursorTimeout.js';

(() => {

let wrap       = null; // Wrapper DOM that wraps almost everything
let canvas     = null; // Screen
let editor     = null; // Ace editor instance
let lineout    = null; // Status bar DOM
let counter    = null; // Character count DOM
let message    = null; // Message DOM
let mode       = null; // Variable mode select
let animate    = null; // Toggle for animation
let frames     = null; // Render frame select
let size       = null; // Resolution select
let download   = null; // Download button
let link       = null; // Generate link button
let layer      = null; // Dialog layer
let dialog     = null; // Dialog message wrapper
let infoIcon   = null; // Information icon
let fullIcon   = null; // Fullscreen icon
let menuIcon   = null; // Menu icon
let noteIcon   = null; // Note icon
let hideIcon   = null; // Hide menu icon
let showIcon   = null; // Show menu icon
let syncToggle = null; // Checkbox for scroll synchronization

let audioWrap     = null; // Wrapper for sound shader pane
let audioEditor   = null; // Ace editor instance for sound shader
let audioLineout  = null; // Status bar DOM for sound shader
let audioCounter  = null; // Character count DOM for sound shader
let audioMessage  = null; // Message DOM for sound shader
let audioToggle   = null; // Toggle button for sound shader
let audioPlayIcon = null; // Play button for sound shader
let audioStopIcon = null; // Stop button for sound shader

let latestStatus       = 'success';            // Latest status
let latestAudioStatus  = 'success';            // Latest status for sound shader
let isEncoding         = false;                // Whether encoding is in progress
let currentMode        = Fragmen.MODE_CLASSIC; // Current Fragmen mode
let currentSource      = '';                   // Latest source code
let currentAudioSource = '';                   // Latest sound shader source code
let fragmen            = null;                 // Instance of fragmen.js

let urlParameter = null;  // searchParams object for parsing GET parameters
let vimMode      = false; // Vim mode
let syncScroll   = true;  // Whether to synchronize scroll when receiving broadcast on the editor
let editorFontSize = 17;  // Font size of the editor
let isEdit = false;       // Whether the code has been edited
let disableAttachEvent = false;   // Set to true to prevent setting beforeunload on code edit

/** Function to remove the process added by {@link registerCursorTimeout} */
let unregisterCursorTimeout = null;

// Template for options for fragmen.js
const FRAGMEN_OPTION = {
    target: null,
    eventTarget: null,
    mouse: true,
    resize: true,
    escape: false
}
// Base URL for requesting external services
const BASE_URL = location.origin;

window.addEventListener('DOMContentLoaded', () => {
    // References to DOM elements
    wrap       = document.querySelector('#wrap');
    canvas     = document.querySelector('#webgl');
    lineout    = document.querySelector('#lineout');
    counter    = document.querySelector('#counter');
    message    = document.querySelector('#message');
    mode       = document.querySelector('#modeselect');
    animate    = document.querySelector('#pausetoggle');
    frames     = document.querySelector('#frameselect');
    size       = document.querySelector('#sizeselect');
    download   = document.querySelector('#downloadgif');
    link       = document.querySelector('#permanentlink');
    layer      = document.querySelector('#layer');
    dialog     = document.querySelector('#dialogmessage');
    infoIcon   = document.querySelector('#informationicon');
    fullIcon   = document.querySelector('#fullscreenicon');
    menuIcon   = document.querySelector('#togglemenuicon');
    noteIcon   = document.querySelector('#noteicon');
    hideIcon   = document.querySelector('#hidemenuicon');
    showIcon   = document.querySelector('#showmenuicon');
    syncToggle = document.querySelector('#syncscrolltoggle');

    audioWrap     = document.querySelector('#audio');
    audioLineout  = document.querySelector('#lineoutaudio');
    audioCounter  = document.querySelector('#counteraudio');
    audioMessage  = document.querySelector('#messageaudio');
    audioToggle   = document.querySelector('#audiotoggle');
    audioPlayIcon = document.querySelector('#playicon');
    audioStopIcon = document.querySelector('#stopicon');

    // Get default source list from fragmen.js
    const fragmenDefaultSource = Fragmen.DEFAULT_SOURCE;

    // Flag to hide menu and editor
    let isLayerHidden = false;

    // Parse URL GET parameters
    urlParameter = getParameter();
    urlParameter.forEach((value, key) => {
        switch(key){
            case 'mode':
                currentMode = parseInt(value);
                break;
            case 'sound':
                audioToggle.checked = value === 'true';
                break;
            case 'source':
                currentSource = value;
                break;
            case 'soundsource':
                currentAudioSource = value;
                break;
            case 'ol': // overlay (hide menu view)
                wrap.classList.add('overlay');
                isLayerHidden = true;
                break;
        }
    });
    // Check if current mode exists in fragmenDefaultSource
    if(fragmenDefaultSource[currentMode] != null){
        mode.selectedIndex = currentMode;
    }else{
        currentMode = Fragmen.MODE_CLASSIC;
    }
    // If currentSource is empty at this point, use the default source
    if(currentSource === ''){
        currentSource = fragmenDefaultSource[currentMode];
    }
    // If audioToggle is not checked or the sound shader source is empty, use the default source
    if(audioToggle.checked !== true || currentAudioSource === ''){
        currentAudioSource = Onomat.FRAGMENT_SHADER_SOURCE_DEFAULT;
    }

    // Ace editor initialization
    let timeoutId = null;
    editor = editorSetting('editor', currentSource, (evt) => {
        // Only perform if event attachment is not suppressed
        if(disableAttachEvent !== true){
          // If haven’t edited yet, set beforeunload once
          if(isEdit !== true){
              isEdit = true;
              window.addEventListener('beforeunload', (evt) => {
                  evt.preventDefault();
                  evt.returnValue = '';
              }, false);
          }
          isEdit = true;
        }else{
          disableAttachEvent = false;
        }
        // Cancel timer if within 1 second
        if(timeoutId != null){clearTimeout(timeoutId);}
        timeoutId = setTimeout(() => {
            timeoutId = null;
            update(editor.getValue());
        }, 1000);
        // Output character count
        counter.textContent = `${editor.getValue().length}`;
    }, (evt) => {});
    let audioTimeoutId = null;
    audioEditor = editorSetting('editoraudio', currentAudioSource, (evt) => {
        // Only perform if event attachment is not suppressed
        if(disableAttachEvent !== true){
          // If haven’t edited yet, set beforeunload once
          if(isEdit !== true){
              isEdit = true;
              window.addEventListener('beforeunload', (evt) => {
                  evt.preventDefault();
                  evt.returnValue = '';
              }, false);
          }
          isEdit = true;
        }else{
          disableAttachEvent = false;
        }
        // Cancel timer if within 1 second
        if(audioTimeoutId != null){clearTimeout(audioTimeoutId);}
        audioTimeoutId = setTimeout(() => {
            audioTimeoutId = null;
            updateAudio(audioEditor.getValue());
        }, 1000);
        // Output character count
        audioCounter.textContent = `${audioEditor.getValue().length}`;
    }, (evt) => {});
    // If audioToggle is checked, the sound shader is enabled from the URL
    if(audioToggle.checked === true){
        // First, display a custom dialog to get user click input
        showDialog('This URL enables sound shader.\nIs it OK to play the audio?', {
            okLabel: 'yes',
            cancelLabel: 'no',
        })
        .then((result) => {
            // Pass whether the user clicked OK or Cancel as an argument
            onomatSetting(result);
            // If OK was clicked, update character count, etc.
            if(result === true){
                update(editor.getValue());
                counter.textContent = `${editor.getValue().length}`;
                audioCounter.textContent = `${audioEditor.getValue().length}`;
            }
        });
    }

    // When the window is resized
    window.addEventListener('resize', () => {
        resize();
    }, false);
    // Perform resize processing once initially
    resize();

    // Processing when mode changes
    mode.addEventListener('change', () => {
        const defaultSourceInPrevMode = fragmenDefaultSource[currentMode];

        const source = editor.getValue();
        currentMode = parseInt(mode.value);
        fragmen.mode = currentMode;

        // If the same as the default source, replace with the default source for the mode
        if(source === defaultSourceInPrevMode){
            const defaultSource = fragmenDefaultSource[currentMode];
            editor.setValue(defaultSource);
            setTimeout(() => {editor.gotoLine(1);}, 100);
        }else{
            // Even if not replacing the source, rebuild
            update(editor.getValue());
        }
    }, false);

    // Toggle for enabling/disabling animation
    animate.addEventListener('change', () => {
        if(animate.checked === true){
            // If turned on, compile
            if(fragmen != null){
                fragmen.setAnimation(true);
                update(editor.getValue());
                fragmen.draw();
            }
        }else{
            // If turned off, set not to animate
            if(fragmen != null){
                fragmen.setAnimation(false);
            }
        }
    }, false);

    // Download button
    download.addEventListener('click', () => {
        // If the button is disabled or encoding is in progress, exit immediately
        if(
            download.classList.contains('disabled') === true ||
            isEncoding === true
        ){
            return;
        }

        // Show dialog to set parameters for download
        const wrap = document.createElement('div');
        wrap.setAttribute('id', 'downloadconfig');
        const infoHeader = document.createElement('h3');
        infoHeader.textContent = 'Download';
        wrap.appendChild(infoHeader);
        // Export type
        const typeWrap = document.createElement('div');
        const typeRadioGif = document.createElement('input');
        typeRadioGif.setAttribute('type', 'radio');
        typeRadioGif.setAttribute('name', 'typeradio');
        typeRadioGif.checked = true;
        const typeRadioGifLabel = document.createElement('label');
        const typeRadioGifCaption = document.createElement('span');
        typeRadioGifCaption.textContent = 'Gif';
        typeRadioGifLabel.appendChild(typeRadioGif);
        typeRadioGifLabel.appendChild(typeRadioGifCaption);
        const typeRadioWebM = document.createElement('input');
        typeRadioWebM.setAttribute('type', 'radio');
        typeRadioWebM.setAttribute('name', 'typeradio');
        const typeRadioWebMLabel = document.createElement('label');
        const typeRadioWebMCaption = document.createElement('span');
        typeRadioWebMCaption.textContent = 'WebM';
        typeRadioWebMLabel.appendChild(typeRadioWebM);
        typeRadioWebMLabel.appendChild(typeRadioWebMCaption);
        const typeRadioJpeg = document.createElement('input');
        typeRadioJpeg.setAttribute('type', 'radio');
        typeRadioJpeg.setAttribute('name', 'typeradio');
        const typeRadioJpegLabel = document.createElement('label');
        const typeRadioJpegCaption = document.createElement('span');
        typeRadioJpegCaption.textContent = 'JPEG';
        typeRadioJpegLabel.appendChild(typeRadioJpeg);
        typeRadioJpegLabel.appendChild(typeRadioJpegCaption);
        const typeRadioPng = document.createElement('input');
        typeRadioPng.setAttribute('type', 'radio');
        typeRadioPng.setAttribute('name', 'typeradio');
        const typeRadioPngLabel = document.createElement('label');
        const typeRadioPngCaption = document.createElement('span');
        typeRadioPngCaption.textContent = 'PNG';
        typeRadioPngLabel.appendChild(typeRadioPng);
        typeRadioPngLabel.appendChild(typeRadioPngCaption);
        typeWrap.appendChild(typeRadioGifLabel);
        typeWrap.appendChild(typeRadioWebMLabel);
        typeWrap.appendChild(typeRadioJpegLabel);
        typeWrap.appendChild(typeRadioPngLabel);
        wrap.appendChild(typeWrap);
        // Number of frames
        const frameWrap = document.createElement('div');
        const frameInput = document.createElement('input');
        frameInput.setAttribute('type', 'number');
        frameInput.value = parseInt(frames.value);
        frameInput.min = 1;
        frameInput.addEventListener('change', () => {
            frameInput.value = Math.max(frameInput.value, 1);
        }, false);
        const frameCaption = document.createElement('span');
        frameCaption.textContent = 'frames';
        frameWrap.appendChild(frameCaption);
        frameWrap.appendChild(frameInput);
        wrap.appendChild(frameWrap);
        // Resolution
        const sizes = size.value.split('x');
        const resolutionWrap = document.createElement('div');
        const resolutionCaption = document.createElement('span');
        resolutionCaption.textContent = 'resolution';
        const widthInput = document.createElement('input');
        widthInput.setAttribute('type', 'number');
        widthInput.value = parseInt(sizes[0]);
        widthInput.min = 1;
        widthInput.addEventListener('change', () => {
            widthInput.value = Math.max(widthInput.value, 1);
        }, false);
        const heightInput = document.createElement('input');
        heightInput.setAttribute('type', 'number');
        heightInput.value = parseInt(sizes[1]);
        heightInput.min = 1;
        heightInput.addEventListener('change', () => {
            heightInput.value = Math.max(heightInput.value, 1);
        }, false);
        const resolutionCross = document.createElement('span');
        resolutionCross.classList.add('cross');
        resolutionCross.textContent = 'x';
        resolutionWrap.appendChild(resolutionCaption);
        resolutionWrap.appendChild(widthInput);
        resolutionWrap.appendChild(resolutionCross);
        resolutionWrap.appendChild(heightInput);
        wrap.appendChild(resolutionWrap);
        // Framerate
        const framerateWrap = document.createElement('div');
        const framerateInput = document.createElement('input');
        framerateInput.setAttribute('type', 'number');
        framerateInput.value = 60;
        framerateInput.min = 10;
        framerateInput.max = 60;
        framerateInput.addEventListener('change', () => {
            framerateInput.value = Math.min(Math.max(framerateInput.value, 10), 60);
        }, false);
        const framerateCaption = document.createElement('span');
        framerateCaption.textContent = 'framerate';
        framerateWrap.appendChild(framerateCaption);
        framerateWrap.appendChild(framerateInput);
        wrap.appendChild(framerateWrap);
        // Quality
        const qualityWrap = document.createElement('div');
        const qualityInput = document.createElement('input');
        qualityInput.setAttribute('type', 'number');
        qualityInput.value = 100;
        qualityInput.min = 10;
        qualityInput.max = 100;
        qualityInput.addEventListener('change', () => {
            qualityInput.value = Math.min(Math.max(qualityInput.value, 0), 100);
        }, false);
        const qualityCaption = document.createElement('span');
        qualityCaption.textContent = 'quality';
        qualityWrap.appendChild(qualityCaption);
        qualityWrap.appendChild(qualityInput);
        wrap.appendChild(qualityWrap);
        // Time specification
        const timeWrap = document.createElement('div');
        const timeInput = document.createElement('input');
        timeInput.setAttribute('type', 'number');
        timeInput.value = parseInt(0);
        timeInput.min = 0;
        timeInput.step = 0.1;
        const timeCaption = document.createElement('span');
        timeCaption.textContent = 'start time';
        timeWrap.appendChild(timeCaption);
        timeWrap.appendChild(timeInput);
        wrap.appendChild(timeWrap);

        // Enable/disable based on radio button changes
        const radioListener = () => {
            const flag = typeRadioGif.checked === true || typeRadioWebM.checked === true;
            frameInput.disabled = !flag;
            framerateInput.disabled = !flag;
            qualityInput.disabled = !flag;
        };
        typeRadioGif.addEventListener('change', radioListener, false);
        typeRadioWebM.addEventListener('change', radioListener, false);
        typeRadioJpeg.addEventListener('change', radioListener, false);
        typeRadioPng.addEventListener('change', radioListener, false);
        typeRadioGif.checked = true;
        typeRadioWebM.checked = false;
        typeRadioJpeg.checked = false;
        typeRadioPng.checked = false;
        radioListener();

        showDialog(wrap, {okLabel: 'start'})
        .then((isOk) => {
            if(isOk !== true){return;}
            if(
                isNaN(parseInt(frameInput.value)) === true ||
                isNaN(parseInt(widthInput.value)) === true ||
                isNaN(parseInt(heightInput.value)) === true ||
                isNaN(parseInt(framerateInput.value)) === true ||
                isNaN(parseInt(qualityInput.value)) === true
            ){
                alert('Should not be blank.');
                return;
            }
            // Add disabled to prevent consecutive clicks
            download.classList.add('disabled');
            // Change download button text
            download.textContent = 'generate...';
            // Set encoding flag
            isEncoding = true;
            // Determine format
            let formatName = 'gif';
            if(typeRadioWebM.checked === true){
                formatName = 'webm';
            }else if(typeRadioJpeg.checked === true){
                formatName = 'jpg';
            }else if(typeRadioPng.checked === true){
                formatName = 'png';
            }
            // Get parameters from DOM and start capture
            setTimeout(() => {
                switch(formatName){
                    case 'gif':
                    case 'webm':
                        captureAnimation(
                            parseInt(frameInput.value),
                            parseInt(widthInput.value),
                            parseInt(heightInput.value),
                            formatName,
                            parseInt(framerateInput.value),
                            parseInt(qualityInput.value) * 0.99999,
                            parseInt(timeInput.value),
                        );
                        break;
                    case 'jpg':
                    case 'png':
                        captureImage(
                            parseInt(timeInput.value),
                            parseInt(widthInput.value),
                            parseInt(heightInput.value),
                            formatName,
                            parseInt(qualityInput.value) * 0.99999,
                        );
                        break;
                }
            }, 100);
        });
    }, false);

    // Link generation button (simplified without Firebase)
    link.addEventListener('click', () => {
        if(link.classList.contains('disabled') === true){return;}
        link.classList.add('disabled');

        const graphicsSource = editor.getValue();
        const graphicsMode = parseInt(mode.value);
        const soundSource = audioToggle.checked && latestAudioStatus === 'success' ? audioEditor.getValue() : undefined;
        const params = [
            `mode=${graphicsMode}`,
            `source=${encodeURIComponent(graphicsSource)}`,
            soundSource ? `soundsource=${encodeURIComponent(soundSource)}` : '',
            `sound=${audioToggle.checked}`
        ].filter(Boolean).join('&');
        const snapshotLink = `${BASE_URL}?${params}`;

        copyToClipboard(snapshotLink);
        alert('Copied link to the clipboard!');
        link.classList.remove('disabled');
    }, false);

    // Scroll synchronization (kept for local use)
    syncToggle.addEventListener('change', () => {
        syncScroll = syncToggle.checked;
    }, false);

    // Main fragmen instance
    const option = Object.assign(FRAGMEN_OPTION, {
        target: canvas,
        eventTarget: window,
    });
    fragmen = new Fragmen(option);
    // Update message when shader is updated
    fragmen.onBuild((status, msg) => {
        latestStatus = status;
        lineout.classList.remove('warn');
        lineout.classList.remove('error');
        lineout.classList.add(status);
        message.textContent = msg;
        switch(status){
            case 'warn':
            case 'error':
                download.classList.add('disabled');
                link.classList.add('disabled');
                break;
            default:
                download.classList.remove('disabled');
                if(latestStatus === 'success' && latestAudioStatus === 'success'){
                    link.classList.remove('disabled');
                }else{
                    link.classList.add('disabled');
                }
        }
    });
    fragmen.onDraw(() => {
        let freq = 0.0;
        if(musician != null && musician.isPlay === true){
            freq += musician.getFrequencyFloat();
        }
        if(onomat != null && audioToggle.checked === true && latestAudioStatus === 'success'){
            freq += onomat.getFrequencyFloat();
        }
        if(freq > 0.0){
            fragmen.setFrequency(freq);
        }
    });
    // Output default message
    counter.textContent = `${currentSource.length}`;
    message.textContent = ' ● ready';

    // Start rendering
    fragmen.mode = currentMode;
    fragmen.render(currentSource);

    // Change dropdown list state based on WebGL 2.0 support
    if(fragmen.isWebGL2 !== true){
        for(let i = 0; i < mode.children.length; ++i){
            mode.children[i].disabled = Fragmen.MODE_WITH_ES_300.includes(i);
        }
    }

    // Sound shader related
    audioToggle.addEventListener('change', () => {
        onomatSetting();
    }, false);
    audioPlayIcon.addEventListener('click', () => {
        if(audioToggle.checked !== true || latestAudioStatus !== 'success'){return;}
        updateAudio(audioEditor.getValue(), true);
    }, false);
    audioStopIcon.addEventListener('click', () => {
        if(musician != null){musician.stop();}
        if(audioToggle.checked !== true){return;}
        onomat.stop();
    }, false);
    window.addEventListener('keydown', (evt) => {
        // Vim mode toggle
        if(
            ((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true) &&
            (evt.key === 'v' || evt.key === 'V' || evt.key === '√')
        ){
            vimMode = !vimMode;
            if(vimMode === true){
                editor.setKeyboardHandler('ace/keyboard/vim');
                audioEditor.setKeyboardHandler('ace/keyboard/vim');
            }else{
                editor.setKeyboardHandler(null);
                audioEditor.setKeyboardHandler(null);
            }
        }
        // Toggle editor view
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '†' || evt.key === 't')){
            toggleEditorView();
        }
        // Decrease editor font size
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '≤' || evt.key === ',')){
            --editorFontSize;
            document.querySelector('#editor').style.fontSize = `${editorFontSize}px`;
            document.querySelector('#editoraudio').style.fontSize = `${editorFontSize}px`;
        }
        // Increase editor font size
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '≥' || evt.key === '.')){
            ++editorFontSize;
            document.querySelector('#editor').style.fontSize = `${editorFontSize}px`;
            document.querySelector('#editoraudio').style.fontSize = `${editorFontSize}px`;
        }
        // Stop musician if Ctrl+Alt+Enter
        if(evt.key === 'Enter' && evt.altKey === true && evt.ctrlKey === true){
            if(musician != null){musician.stop();}
        }
        // Onomat controls
        if(audioToggle.checked !== true || latestAudioStatus !== 'success'){return;}
        // Alt+Enter to play, Ctrl+Alt+Enter to stop
        if(evt.key === 'Enter' && evt.altKey === true){
            if(evt.ctrlKey === true){
                if(musician != null){musician.stop();}
                onomat.stop();
            }else{
                updateAudio(audioEditor.getValue(), true);
            }
        }
    }, false);
    // Output default message for sound shader
    audioCounter.textContent = `${Onomat.FRAGMENT_SHADER_SOURCE_DEFAULT.length}`;
    audioMessage.textContent = ' ● ready';

    // Listener to restore DOM when exiting fullscreen
    const onFullscreenChange = (evt) => {
        if(
            document.fullscreenElement == null &&
            document.webkitFullscreenElement == null &&
            document.msFullscreenElement == null
        ){
            // If all elements are null, perform DOM operations to show the editor
            exitFullscreenMode();
        }
    };
    // Listener for intentional fullscreen toggle via shortcut (not F11)
    const onFullscreenKeyDown = (evt) => {
        if(evt.altKey === true && evt.ctrlKey === true && (evt.key.toLowerCase() === 'f' || evt.key === 'ƒ')){
            if(
                document.fullscreenElement != null ||
                document.webkitFullscreenElement != null ||
                document.msFullscreenElement != null
            ){
                // In this case, it’s definitely fullscreened via JavaScript, so force exit
                exitFullscreen();
            }else{
                requestFullscreenMode();
            }
        }
    };
    // Listener when the fullscreen icon is clicked
    const onFullscreenRequest = () => {
        if(
            document.fullscreenElement == null &&
            document.webkitFullscreenElement == null &&
            document.msFullscreenElement == null
        ){
            requestFullscreenMode();
        }
    };
    // Register fullscreen-related listeners only if the API is supported
    if(document.fullscreenEnabled === true){
        document.addEventListener('fullscreenchange', onFullscreenChange, false);
        window.addEventListener('keydown', onFullscreenKeyDown, false);
        fullIcon.addEventListener('click', onFullscreenRequest, false);
    }else if(document.webkitFullscreenEnabled === true){
        document.addEventListener('webkitfullscreenchange', onFullscreenChange, false);
        window.addEventListener('keydown', onFullscreenKeyDown, false);
        fullIcon.addEventListener('click', onFullscreenRequest, false);
    }else{
        // If neither is supported, hide the icon
        fullIcon.classList.add('nevershow');
    }

    // When the information icon is clicked
    infoIcon.addEventListener('click', () => {
        const wrap = document.createElement('div');

        const infoHeader = document.createElement('h3');
        infoHeader.textContent = 'Information';
        const infoCaption = document.createElement('div');
        infoCaption.textContent = 'twigl.app is an online editor for One tweet shader, with GIF generator and sound shader.';
        wrap.appendChild(infoHeader);
        wrap.appendChild(infoCaption);

        const modeHeader = document.createElement('h3');
        modeHeader.textContent = 'Edit mode';
        const modeCaption = document.createElement('div');
        const modeMessage = [
            'There are four modes in twigl.app, each of which has a sub-mode that uses GLSL ES 3.0, or in addition to it, a mode that enables MRT.',
            'classic:',
            'This mode is compatible with GLSLSandbox.',
            'The uniform variables are "resolution", "mouse", "time", "frame", and "backbuffer".',
            'geek:',
            'In this mode, the various uniform variables are in a single-character style.',
            '"r", "m", "t", "f", and "b", respectively.',
            'geeker:',
            'In this mode, there is no need to declare precision and uniform. They are automatically complemented on the implementation side. Otherwise, it is the same as in geek mode.',
            'geekest:',
            'In this mode, the description of "void main(){}" can be omitted (or not), and "gl_FragCoord" can be described as "FC". In addition, a variety of GLSL snippets are available.',
            'The reason why we support the notation that does not omit the definition of the main function is to allow users to define their own functions.',
            'For more information on snippets, please see below.',
        ];
        modeMessage.forEach((v) => {
            const e = document.createElement('div');
            e.textContent = v;
            modeCaption.appendChild(e);
        });
        const modeInfoAnchorWrap = document.createElement('div');
        const modeInfoAnchor = document.createElement('a');
        modeInfoAnchor.setAttribute('href', 'https://github.com/doxas/twigl');
        modeInfoAnchor.setAttribute('target', '_blank');
        modeInfoAnchor.textContent = 'doxas/twigl - GitHub';
        modeInfoAnchorWrap.appendChild(modeInfoAnchor);
        modeCaption.appendChild(modeInfoAnchorWrap);
        wrap.appendChild(modeHeader);
        wrap.appendChild(modeCaption);

        const soundHeader = document.createElement('h3');
        soundHeader.textContent = 'Sound Shader';
        const soundCaption = document.createElement('div');
        const soundMessage = [
            'Sound Shader is compatible with the great pioneer, Shadertoy.',
            'Also, the output from the "mainSound" function can be referred to as a uniform variable with the name "sound" or "s" in various graphics modes.',
        ];
        soundMessage.forEach((v) => {
            const e = document.createElement('div');
            e.textContent = v;
            soundCaption.appendChild(e);
        });
        wrap.appendChild(soundHeader);
        wrap.appendChild(soundCaption);

        const authorHeader = document.createElement('h3');
        authorHeader.textContent = 'Author';
        const authorCaption = document.createElement('div');
        const authorAnchor = document.createElement('a');
        authorAnchor.textContent = 'doxas';
        authorAnchor.setAttribute('href', 'https://twitter.com/h_doxas');
        authorAnchor.setAttribute('target', '_blank');
        authorCaption.appendChild(authorAnchor);
        wrap.appendChild(authorHeader);
        wrap.appendChild(authorCaption);

        const sourceHeader = document.createElement('h3');
        sourceHeader.textContent = 'Source Code';
        const sourceCaption = document.createElement('div');
        const sourceAnchor = document.createElement('a');
        sourceAnchor.textContent = 'doxas/twigl';
        sourceAnchor.setAttribute('href', 'https://github.com/doxas/twigl');
        sourceAnchor.setAttribute('target', '_blank');
        sourceCaption.appendChild(sourceAnchor);
        wrap.appendChild(sourceHeader);
        wrap.appendChild(sourceCaption);

        showDialog(wrap, {
            okVisible: true,
            cancelVisible: false,
            okLabel: 'close',
        });
    }, false);

    // Hide menu icon click
    hideIcon.addEventListener('click', () => {
        setLayerView(true);
    }, false);

    // Show menu icon click
    showIcon.addEventListener('click', () => {
        setLayerView(false);
    }, false);

    // Toggle menu icon click
    menuIcon.addEventListener('click', () => {
        toggleEditorView();
    }, false);

    // Import local sound icon click
    noteIcon.addEventListener('click', () => {
        execMusician();
    }, false);

    // If menu and editor are hidden
    if(isLayerHidden === true){setLayerView(true);}

}, false);

/**
 * Processing on window resize
 */
function resize(){
    const canvas = document.querySelector('#webgl');
    const bound = canvas.parentElement.getBoundingClientRect();
    canvas.width = bound.width;
    canvas.height = bound.height;
}

/**
 * Change layer view
 *
 * Passing `true` hides the editor and runs the shader in fullscreen
 * Passing `false` reverts that state
 */
function setLayerView(value){
    if (value) {
        wrap.classList.add('hide');
    } else {
        wrap.classList.remove('hide');
    }

    editor.resize();
    audioEditor.resize();
    resize();
    fragmen.rect();
}

/**
 * Toggle editor view
 */
function toggleEditorView(){
    wrap.classList.toggle('overlay');

    editor.resize();
    audioEditor.resize();
    resize();
    fragmen.rect();
}

/**
 * Load and play a local audio file
 */
function execMusician(){
    if(musician == null){
        musician = new Musician();
    }
    musician.loadFile()
    .then(() => {
        musician.play();
    });
}

/**
 * Update shader source
 */
function update(source){
    if(fragmen == null){return;}
    fragmen.render(source);
}

/**
 * Update sound shader source
 */
function updateAudio(source, force){
    if(onomat == null){return;}
    onomat.render(source, force);
}

/**
 * Ace editor settings
 * @param {string} id - ID attribute of the target DOM
 * @param {string} source - Initial source code to set
 * @param {function} onChange - Callback for change event
 * @param {function} onSelectionChange - Callback for selection change event
 * @param {string} [theme='chaos'] - Theme
 */
function editorSetting(id, source, onChange, onSelectionChange, theme = 'chaos'){
    const edit = ace.edit(id);
    edit.setTheme(`ace/theme/${theme}`);
    edit.session.setOption('indentedSoftWrap', false);
    edit.session.setUseWrapMode(true);
    edit.session.setMode('ace/mode/glsl');
    edit.session.setTabSize(2);
    edit.session.setUseSoftTabs(true);
    edit.$blockScrolling = Infinity;
    edit.setShowPrintMargin(false);
    edit.setShowInvisibles(true);
    edit.setHighlightSelectedWord(true);
    edit.setValue(source);

    // Set listener for content changes
    edit.session.on('change', onChange);

    // Set listener for selection changes
    edit.selection.on('changeSelection', onSelectionChange);

    // Focus on line 1
    setTimeout(() => {edit.gotoLine(1);}, 100);
    return edit;
}

/**
 * Capture GIF or WebM
 * @param {number} [frame=180] - Number of frames to capture
 * @param {number} [width=512] - Width of the capture canvas
 * @param {number} [height=256] - Height of the capture canvas
 * @param {string} [format='gif'] - Capture output format
 * @param {number} [framerate=60] - Capture framerate
 * @param {number} [quality=100] - Capture quality
 * @param {number} [offset=0.0] - Offset base time
 */
function captureAnimation(frame = 180, width = 512, height = 256, format = 'gif', framerate = 60, quality = 100, offset = 0.0){
    const ccapture = new CCapture({
        verbose: false,
        format: format,
        workersPath: './js/',
        framerate: framerate,
        quality: quality,
        onProgress: (range) => {
            const p = Math.floor(range * 100);
            download.textContent = `${p}%`;
        },
    });

    let captureCanvas = document.createElement('canvas');
    captureCanvas.width          = width;
    captureCanvas.height         = height;
    captureCanvas.style.position = 'absolute';
    captureCanvas.style.top      = '-9999px';
    captureCanvas.style.left     = '-9999px';
    document.body.appendChild(captureCanvas);
    const option = Object.assign(FRAGMEN_OPTION, {
        target: captureCanvas,
        eventTarget: captureCanvas,
        offsetTime: offset,
    });
    let frag = new Fragmen(option);
    frag.mode = currentMode;
    let frameCount = 0;
    frag.onDraw(() => {
        if(frameCount < frame){
            ccapture.capture(captureCanvas);
        }else{
            frag.run = false;
            ccapture.stop();
            ccapture.save((blob) => {
                setTimeout(() => {
                    const url = URL.createObjectURL(blob);
                    let anchor = document.createElement('a');
                    document.body.appendChild(anchor);
                    anchor.download = `${uuid()}.${format}`;
                    anchor.href = url;
                    anchor.click();
                    document.body.removeChild(anchor);
                    document.body.removeChild(captureCanvas);
                    URL.revokeObjectURL(url);
                    download.classList.remove('disabled');
                    download.textContent = 'Download';
                    isEncoding = false;
                    captureCanvas = null;
                    frag = null;
                    anchor = null;
                }, 500);
            });
        }
        ++frameCount;
    });
    ccapture.start();
    frag.render(editor.getValue());
}

/**
 * Capture a still image at a specified time
 * @param {number} [time=0] - Capture time
 * @param {number} [width=512] - Width of the capture canvas
 * @param {number} [height=256] - Height of the capture canvas
 * @param {string} [format='jpg'] - Capture output format
 * @param {number} [quality=100] - Capture quality
 */
function captureImage(time = 0, width = 512, height = 256, format = 'jpg', quality = 100){
    let captureCanvas = document.createElement('canvas');
    captureCanvas.width          = width;
    captureCanvas.height         = height;
    captureCanvas.style.position = 'absolute';
    captureCanvas.style.top      = '-9999px';
    captureCanvas.style.left     = '-9999px';
    document.body.appendChild(captureCanvas);
    const option = Object.assign(FRAGMEN_OPTION, {
        target: captureCanvas,
        eventTarget: captureCanvas,
    });
    let frag = new Fragmen(option);
    frag.mode = currentMode;
    frag.onDraw(() => {
        frag.run = false;
        const formatName = format === 'jpg' ? 'jpeg' : format;
        const url = captureCanvas.toDataURL(`image/${formatName}`, quality / 100);
        let anchor = document.createElement('a');
        document.body.appendChild(anchor);
        anchor.download = `${uuid()}.${format}`;
        anchor.href = url;
        anchor.click();
        document.body.removeChild(anchor);
        document.body.removeChild(captureCanvas);
        download.classList.remove('disabled');
        download.textContent = 'Download';
        isEncoding = false;
        captureCanvas = null;
        frag = null;
        anchor = null;
    });
    frag.render(editor.getValue(), time);
}

/**
 * Toggle editor visibility based on audioToggle state and initialize Onomat if necessary
 * @param {boolean} [play=true] - Whether to play immediately
 */
function onomatSetting(play = true){
    if(onomat == null){
        onomat = new Onomat();
        onomat.on('build', (res) => {
            latestAudioStatus = res.status;
            audioLineout.classList.remove('warn');
            audioLineout.classList.remove('error');
            audioLineout.classList.add(res.status);
            audioMessage.textContent = res.message;
            if(latestStatus === 'success' && latestAudioStatus === 'success'){
                link.classList.remove('disabled');
            }else{
                link.classList.add('disabled');
            }
        });
        if(play === true){
            setTimeout(() => {
                updateAudio(audioEditor.getValue(), true);
            }, 500);
        }
    }
    if(audioToggle.checked === true){
        audioWrap.classList.remove('invisible');
        audioPlayIcon.classList.remove('disabled');
        audioStopIcon.classList.remove('disabled');
    }else{
        audioWrap.classList.add('invisible');
        audioPlayIcon.classList.add('disabled');
        audioStopIcon.classList.add('disabled');
    }
    editor.resize();
    audioEditor.resize();
}

/**
 * Get searchParams
 * @return {URLSearchParams}
 */
function getParameter(){
    return new URL(document.location).searchParams;
}

/**
 * Copy a string to the clipboard
 * @param {string} str - String to copy
 */
function copyToClipboard(str){
    const t = document.createElement('textarea');
    t.value = str;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
}

/**
 * Generate a UUID
 * @return {string}
 */
function uuid(){
    const chars = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.split('');
    for(let i = 0, j = chars.length; i < j; i++){
        switch(chars[i]){
            case 'x':
                chars[i] = Math.floor(Math.random() * 16).toString(16);
                break;
            case 'y':
                chars[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
                break;
        }
    }
    return chars.join('');
}

/**
 * Show custom dialog
 * @param {string|HTMLElement} message - Message string or DOM to append
 * @param {object}
 * @property {string} [okLabel='ok'] - Text to display on the OK button
 * @property {string} [cancelLabel='cancel'] - Text to display on the cancel button
 * @property {boolean} [okVisible=true] - Whether to show the OK button
 * @property {boolean} [cancelVisible=true] - Whether to show the cancel button
 * @property {boolean} [okDisable=false] - Whether to disable the OK button
 * @property {boolean} [cancelDisable=false] - Whether to disable the cancel button
 * @return {Promise} - Promise resolved when OK or cancel is pressed
 */
function showDialog(message, option){
    const dialogOption = Object.assign({
        okLabel: 'ok',
        cancelLabel: 'cancel',
        okVisible: true,
        cancelVisible: true,
        okDisable: false,
        cancelDisable: false,
    }, option);
    return new Promise((resolve) => {
        while(dialog.firstChild != null){
            dialog.removeChild(dialog.firstChild);
        }
        if(message instanceof HTMLElement === true){
            dialog.appendChild(message);
        }else{
            const sentence = message.split('\n');
            sentence.forEach((s) => {
                const div = document.createElement('div');
                div.textContent = s;
                dialog.appendChild(div);
            });
        }
        const ok = document.querySelector('#dialogbuttonok');
        const cancel = document.querySelector('#dialogbuttoncancel');
        ok.textContent = dialogOption.okLabel;
        cancel.textContent = dialogOption.cancelLabel;
        if(dialogOption.okVisible === true){
            ok.classList.remove('invisible');
        }else{
            ok.classList.add('invisible');
        }
        if(dialogOption.cancelVisible === true){
            cancel.classList.remove('invisible');
        }else{
            cancel.classList.add('invisible');
        }
        if(dialogOption.okDisable === true){
            ok.classList.add('disabled');
        }else{
            ok.classList.remove('disabled');
            const okClick = () => {
                ok.removeEventListener('click', okClick);
                resolve(true);
                hideDialog();
            };
            ok.addEventListener('click', okClick, false);
        }
        if(dialogOption.cancelDisable === true){
            cancel.classList.add('disabled');
        }else{
            cancel.classList.remove('disabled');
            const cancelClick = () => {
                cancel.removeEventListener('click', cancelClick);
                resolve(false);
                hideDialog();
            };
            cancel.addEventListener('click', cancelClick, false);
        }

        setLayerVisible(true);
    });
}

/**
 * Hide dialog (and layer)
 */
function hideDialog(){
    setLayerVisible(false);
}

/**
 * Set float layer visibility
 * @param {boolean} visible - Whether to show
 */
function setLayerVisible(visible){
    if(visible === true){
        layer.classList.add('visible');
    }else{
        layer.classList.remove('visible');
    }
}

/**
 * Exit fullscreen (without DOM manipulation)
 */
function exitFullscreen(){
    if(
        document.fullscreenEnabled !== true &&
        document.webkitFullscreenEnabled !== true
    ){
        return;
    }
    if(document.exitFullscreen != null){
        document.exitFullscreen();
    }else if(document.webkitExitFullscreen != null){
        document.webkitExitFullscreen();
    }
}

/**
 * Perform DOM operations and resize editor area after exiting fullscreen
 */
function exitFullscreenMode(){
    wrap.classList.remove('fullscreen');

    if (unregisterCursorTimeout != null) {
        unregisterCursorTimeout();
    }

    editor.resize();
    audioEditor.resize();
    resize();
    fragmen.rect();
}

/**
 * Enter fullscreen mode and resize editor area
 */
function requestFullscreenMode(){
    if(
        document.fullscreenEnabled !== true &&
        document.webkitFullscreenEnabled !== true
    ){
        return;
    }
    if(document.body.requestFullscreen != null){
        document.body.requestFullscreen();
    }else if(document.body.webkitRequestFullscreen != null){
        document.body.webkitRequestFullscreen();
    }

    wrap.classList.add('fullscreen');
    unregisterCursorTimeout = registerCursorTimeout(wrap);

    editor.resize();
    audioEditor.resize();
    resize();
    fragmen.rect();
}

})();