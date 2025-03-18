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
let hideIcon   = null; // Hide menu icon
let showIcon   = null; // Show menu icon

let latestStatus       = 'success';            // Latest status
let isEncoding         = false;                // Whether encoding is in progress
let currentMode        = Fragmen.MODE_CLASSIC; // Fixed to classic mode
let currentSource      = '';                   // Latest source code
let fragmen            = null;                 // Instance of fragmen.js

let urlParameter = null;  // searchParams object for parsing GET parameters
let vimMode      = false; // Vim mode
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
    hideIcon   = document.querySelector('#hidemenuicon');
    showIcon   = document.querySelector('#showmenuicon');

    // Get default source list from fragmen.js
    const fragmenDefaultSource = Fragmen.DEFAULT_SOURCE;

    // Flag to hide menu and editor
    let isLayerHidden = false;

    // Parse URL GET parameters
    urlParameter = getParameter();
    urlParameter.forEach((value, key) => {
        switch(key){
            case 'source':
                currentSource = value;
                break;
            case 'ol': // overlay (hide menu view)
                wrap.classList.add('overlay');
                isLayerHidden = true;
                break;
        }
    });
    // If currentSource is empty, use the default source for classic mode
    if(currentSource === ''){
        currentSource = fragmenDefaultSource[Fragmen.MODE_CLASSIC];
    }

    // Ace editor initialization
    let timeoutId = null;
    editor = editorSetting('editor', currentSource, (evt) => {
        // Only perform if event attachment is not suppressed
        if(disableAttachEvent !== true){
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

    // When the window is resized
    window.addEventListener('resize', () => {
        resize();
    }, false);
    // Perform resize processing once initially
    resize();

    // Toggle for enabling/disabling animation
    animate.addEventListener('change', () => {
        if(animate.checked === true){
            if(fragmen != null){
                fragmen.setAnimation(true);
                update(editor.getValue());
                fragmen.draw();
            }
        }else{
            if(fragmen != null){
                fragmen.setAnimation(false);
            }
        }
    }, false);

    // Download button
    download.addEventListener('click', () => {
        if(
            download.classList.contains('disabled') === true ||
            isEncoding === true
        ){
            return;
        }

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
            download.classList.add('disabled');
            download.textContent = 'generate...';
            isEncoding = true;
            let formatName = 'gif';
            if(typeRadioWebM.checked === true){
                formatName = 'webm';
            }else if(typeRadioJpeg.checked === true){
                formatName = 'jpg';
            }else if(typeRadioPng.checked === true){
                formatName = 'png';
            }
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

    // Link generation button
    link.addEventListener('click', () => {
        if(link.classList.contains('disabled') === true){return;}
        link.classList.add('disabled');

        const graphicsSource = editor.getValue();
        const snapshotLink = `${BASE_URL}?source=${encodeURIComponent(graphicsSource)}`;

        copyToClipboard(snapshotLink);
        alert('Copied link to the clipboard!');
        link.classList.remove('disabled');
    }, false);

    // Main fragmen instance
    const option = Object.assign(FRAGMEN_OPTION, {
        target: canvas,
        eventTarget: window,
    });
    fragmen = new Fragmen(option);
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
                link.classList.remove('disabled');
        }
    });
    counter.textContent = `${currentSource.length}`;
    message.textContent = ' ● ready';

    // Start rendering
    fragmen.mode = currentMode;
    fragmen.render(currentSource);

    window.addEventListener('keydown', (evt) => {
        // Vim mode toggle
        if(
            ((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true) &&
            (evt.key === 'v' || evt.key === 'V' || evt.key === '√')
        ){
            vimMode = !vimMode;
            if(vimMode === true){
                editor.setKeyboardHandler('ace/keyboard/vim');
            }else{
                editor.setKeyboardHandler(null);
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
        }
        // Increase editor font size
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '≥' || evt.key === '.')){
            ++editorFontSize;
            document.querySelector('#editor').style.fontSize = `${editorFontSize}px`;
        }
    }, false);

    // Fullscreen listeners
    const onFullscreenChange = (evt) => {
        if(
            document.fullscreenElement == null &&
            document.webkitFullscreenElement == null &&
            document.msFullscreenElement == null
        ){
            exitFullscreenMode();
        }
    };
    const onFullscreenKeyDown = (evt) => {
        if(evt.altKey === true && evt.ctrlKey === true && (evt.key.toLowerCase() === 'f' || evt.key === 'ƒ')){
            if(
                document.fullscreenElement != null ||
                document.webkitFullscreenElement != null ||
                document.msFullscreenElement != null
            ){
                exitFullscreen();
            }else{
                requestFullscreenMode();
            }
        }
    };
    const onFullscreenRequest = () => {
        if(
            document.fullscreenElement == null &&
            document.webkitFullscreenElement == null &&
            document.msFullscreenElement == null
        ){
            requestFullscreenMode();
        }
    };
    if(document.fullscreenEnabled === true){
        document.addEventListener('fullscreenchange', onFullscreenChange, false);
        window.addEventListener('keydown', onFullscreenKeyDown, false);
        fullIcon.addEventListener('click', onFullscreenRequest, false);
    }else if(document.webkitFullscreenEnabled === true){
        document.addEventListener('webkitfullscreenchange', onFullscreenChange, false);
        window.addEventListener('keydown', onFullscreenKeyDown, false);
        fullIcon.addEventListener('click', onFullscreenRequest, false);
    }else{
        fullIcon.classList.add('nevershow');
    }

    // Information icon click
    infoIcon.addEventListener('click', () => {
        const wrap = document.createElement('div');

        const infoHeader = document.createElement('h3');
        infoHeader.textContent = 'Information';
        const infoCaption = document.createElement('div');
        infoCaption.textContent = 'twigl.app is an online editor for One tweet shader with GIF generator.';
        wrap.appendChild(infoHeader);
        wrap.appendChild(infoCaption);

        const modeHeader = document.createElement('h3');
        modeHeader.textContent = 'Edit mode';
        const modeCaption = document.createElement('div');
        const modeMessage = [
            'This editor uses the classic mode, compatible with GLSLSandbox.',
            'The uniform variables are "resolution", "mouse", "time", "frame", and "backbuffer".',
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
 */
function setLayerView(value){
    if (value) {
        wrap.classList.add('hide');
    } else {
        wrap.classList.remove('hide');
    }
    editor.resize();
    resize();
    fragmen.rect();
}

/**
 * Toggle editor view
 */
function toggleEditorView(){
    wrap.classList.toggle('overlay');
    editor.resize();
    resize();
    fragmen.rect();
}

/**
 * Update shader source
 */
function update(source){
    if(fragmen == null){return;}
    fragmen.render(source);
}

/**
 * Ace editor settings
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
    edit.session.on('change', onChange);
    edit.selection.on('changeSelection', onSelectionChange);
    setTimeout(() => {edit.gotoLine(1);}, 100);
    return edit;
}

/**
 * Capture GIF or WebM
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
 * Capture a still image
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
 * Get searchParams
 */
function getParameter(){
    return new URL(document.location).searchParams;
}

/**
 * Copy a string to the clipboard
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
 */
function setLayerVisible(visible){
    if(visible === true){
        layer.classList.add('visible');
    }else{
        layer.classList.remove('visible');
    }
}

/**
 * Exit fullscreen
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
    resize();
    fragmen.rect();
}

})();