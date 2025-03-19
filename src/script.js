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
let render     = null; // Render button
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
    render     = document.querySelector('#render');
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
        if(timeoutId != null){clearTimeout(timeoutId);}
        timeoutId = setTimeout(() => {
            timeoutId = null;
            update(editor.getValue());
        }, 1000);
        counter.textContent = `${editor.getValue().length}`;
    }, (evt) => {});

    // Window resize
    window.addEventListener('resize', () => {
        resize();
    }, false);
    resize();

    // Animation toggle
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
    render.addEventListener('click', () => {
        // ... (existing code to check if encoding, create dialog, etc.)
    
        const typeWrap = document.createElement('div');
    
        // WebM radio button (video/animation)
        const typeRadioWebM = document.createElement('input');
        typeRadioWebM.setAttribute('type', 'radio');
        typeRadioWebM.setAttribute('name', 'typeradio');
        typeRadioWebM.value = 'webm';
        const typeRadioWebMLabel = document.createElement('label');
        const typeRadioWebMCaption = document.createElement('span');
        typeRadioWebMCaption.textContent = 'WebM';
        typeRadioWebMLabel.appendChild(typeRadioWebM);
        typeRadioWebMLabel.appendChild(typeRadioWebMCaption);
        typeWrap.appendChild(typeRadioWebMLabel);
    
        // MP4 radio button (video/animation), added if supported
        const isMp4Supported = MediaRecorder.isTypeSupported('video/mp4');
        let typeRadioMp4; // Declare outside to use in event listener
        if (isMp4Supported) {
            typeRadioMp4 = document.createElement('input');
            typeRadioMp4.setAttribute('type', 'radio');
            typeRadioMp4.setAttribute('name', 'typeradio');
            typeRadioMp4.value = 'mp4';
            const typeRadioMp4Label = document.createElement('label');
            const typeRadioMp4Caption = document.createElement('span');
            typeRadioMp4Caption.textContent = 'MP4';
            typeRadioMp4Label.appendChild(typeRadioMp4);
            typeRadioMp4Label.appendChild(typeRadioMp4Caption);
            typeWrap.appendChild(typeRadioMp4Label);
        }
    
        // PNG radio button (still image)
        const typeRadioPng = document.createElement('input');
        typeRadioPng.setAttribute('type', 'radio');
        typeRadioPng.setAttribute('name', 'typeradio');
        typeRadioPng.value = 'png';
        const typeRadioPngLabel = document.createElement('label');
        const typeRadioPngCaption = document.createElement('span');
        typeRadioPngCaption.textContent = 'PNG';
        typeRadioPngLabel.appendChild(typeRadioPng);
        typeRadioPngLabel.appendChild(typeRadioPngCaption);
        typeWrap.appendChild(typeRadioPngLabel);
    
        // Set WebM as the default selection
        typeRadioWebM.checked = true;
    
        // Add radio button listener to enable/disable animation-specific inputs
        const radioListener = () => {
            const selectedValue = document.querySelector('input[name="typeradio"]:checked').value;
            const isVideo = selectedValue === 'webm' || selectedValue === 'mp4';
            frameInput.disabled = !isVideo;
            framerateInput.disabled = !isVideo;
            qualityInput.disabled = !isVideo;
        };
    
        // Attach event listeners
        typeRadioWebM.addEventListener('change', radioListener, false);
        if (isMp4Supported) {
            typeRadioMp4.addEventListener('change', radioListener, false);
        }
        typeRadioPng.addEventListener('change', radioListener, false);
        radioListener(); // Set initial state
    
        // Append typeWrap to dialogWrap (assuming dialogWrap is the container)
        dialogWrap.appendChild(typeWrap);
    
        // ... (rest of the dialog setup: inputs, buttons, etc.)
    
        showDialog(dialog).then(() => {
            const selectedType = document.querySelector('input[name="typeradio"]:checked').value;
            if (selectedType === 'png') {
                captureImage(
                    parseInt(timeInput.value),
                    parseInt(widthInput.value),
                    parseInt(heightInput.value),
                    selectedType,
                    parseInt(qualityInput.value) * 0.99999
                );
            } else {
                captureAnimation(
                    parseInt(frameInput.value),
                    parseInt(widthInput.value),
                    parseInt(heightInput.value),
                    selectedType,
                    parseInt(framerateInput.value),
                    parseInt(qualityInput.value) * 0.99999,
                    parseInt(timeInput.value)
                );
            }
        });
    });

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
                render.classList.add('disabled');
                break;
            default:
                render.classList.remove('disabled');
        }
    });
    counter.textContent = `${currentSource.length}`;
    message.textContent = ' ● ready';

    // Start rendering
    fragmen.mode = currentMode;
    fragmen.render(currentSource);

    window.addEventListener('keydown', (evt) => {
        if(((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true) &&
            (evt.key === 'v' || evt.key === 'V' || evt.key === '√')){
            vimMode = !vimMode;
            if(vimMode === true){
                editor.setKeyboardHandler('ace/keyboard/vim');
            }else{
                editor.setKeyboardHandler(null);
            }
        }
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '†' || evt.key === 't')){
            toggleEditorView();
        }
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '≤' || evt.key === ',')){
            --editorFontSize;
            document.querySelector('#editor').style.fontSize = `${editorFontSize}px`;
        }
        if((evt.ctrlKey === true || evt.metaKey === true) && evt.altKey === true && (evt.key === '≥' || evt.key === '.')){
            ++editorFontSize;
            document.querySelector('#editor').style.fontSize = `${editorFontSize}px`;
        }
    }, false);

    // Fullscreen listeners
    const onFullscreenChange = (evt) => {
        if(document.fullscreenElement == null && document.webkitFullscreenElement == null && document.msFullscreenElement == null){
            exitFullscreenMode();
        }
    };
    const onFullscreenKeyDown = (evt) => {
        if(evt.altKey === true && evt.ctrlKey === true && (evt.key.toLowerCase() === 'f' || evt.key === 'ƒ')){
            if(document.fullscreenElement != null || document.webkitFullscreenElement != null || document.msFullscreenElement != null){
                exitFullscreen();
            }else{
                requestFullscreenMode();
            }
        }
    };
    const onFullscreenRequest = () => {
        if(document.fullscreenElement == null && document.webkitFullscreenElement == null && document.msFullscreenElement == null){
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
        infoCaption.textContent = 'Rescreen is an online editor for one-tweet shaders with GIF or WebM generator.';
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

        showDialog(wrap, {okVisible: true, cancelVisible: false, okLabel: 'close'});
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

    if(isLayerHidden === true){setLayerView(true);}

}, false);

function resize(){
    const canvas = document.querySelector('#webgl');
    const bound = canvas.parentElement.getBoundingClientRect();
    canvas.width = bound.width;
    canvas.height = bound.height;
}

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

function toggleEditorView(){
    wrap.classList.toggle('overlay');
    editor.resize();
    resize();
    fragmen.rect();
}

function update(source){
    if(fragmen == null){return;}
    fragmen.render(source);
}

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

function captureAnimation(frame = 180, width = 512, height = 256, format = 'webm', framerate = 60, quality = 100, offset = 0.0) {
    let captureCanvas = document.createElement('canvas');
    captureCanvas.width = width;
    captureCanvas.height = height;
    captureCanvas.style.position = 'absolute';
    captureCanvas.style.top = '-9999px';
    captureCanvas.style.left = '-9999px';
    document.body.appendChild(captureCanvas);

    const option = Object.assign(FRAGMEN_OPTION, {
        target: captureCanvas,
        eventTarget: captureCanvas,
        offsetTime: offset,
    });
    let frag = new Fragmen(option);
    frag.mode = currentMode;

    if (format === 'webm') {
        const ccapture = new CCapture({
            verbose: false,
            format: 'webm',
            workersPath: './js/',
            framerate: framerate,
            quality: quality,
            onProgress: (range) => {
                const p = Math.floor(range * 100);
                render.textContent = `${p}%`;
            },
        });

        let frameCount = 0;
        frag.onDraw(() => {
            if (frameCount < frame) {
                ccapture.capture(captureCanvas);
            } else {
                frag.run = false;
                ccapture.stop();
                ccapture.save((blob) => {
                    setTimeout(() => {
                        const url = URL.createObjectURL(blob);
                        let anchor = document.createElement('a');
                        document.body.appendChild(anchor);
                        anchor.render = `${uuid()}.webm`;
                        anchor.href = url;
                        anchor.click();
                        document.body.removeChild(anchor);
                        document.body.removeChild(captureCanvas);
                        URL.revokeObjectURL(url);
                        render.classList.remove('disabled');
                        render.textContent = 'Download';
                        isEncoding = false;
                    }, 500);
                });
            }
            frameCount++;
        });

        ccapture.start();
        frag.render(editor.getValue());
    } else if (format === 'mp4') {
        const stream = captureCanvas.captureStream(framerate);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
        let chunks = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            let anchor = document.createElement('a');
            document.body.appendChild(anchor);
            anchor.render = `${uuid()}.mp4`;
            anchor.href = url;
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            render.classList.remove('disabled');
            render.textContent = 'Download';
            isEncoding = false;
            document.body.removeChild(captureCanvas);
        };

        recorder.start();
        frag.render(editor.getValue());
        const duration = (frame / framerate) * 1000; // Duration in milliseconds
        setTimeout(() => {
            frag.run = false;
            recorder.stop();
        }, duration);
    }
}

function captureImage(time = 0, width = 512, height = 256, format = 'png', quality = 100) {
    let captureCanvas = document.createElement('canvas');
    captureCanvas.width = width;
    captureCanvas.height = height;
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
        const url = captureCanvas.toDataURL(`image/${format}`, quality * 0.99999);
        let anchor = document.createElement('a');
        document.body.appendChild(anchor);
        anchor.render = `${uuid()}.${format}`;
        anchor.href = url;
        anchor.click();
        document.body.removeChild(anchor);
        document.body.removeChild(captureCanvas);
        render.classList.remove('disabled');
        render.textContent = 'Download';
        isEncoding = false;
        captureCanvas = null;
        frag = null;
        anchor = null;
    });
    frag.render(editor.getValue(), time);
}

function getParameter(){
    return new URL(document.location).searchParams;
}

function copyToClipboard(str){
    const t = document.createElement('textarea');
    t.value = str;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
}

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

function hideDialog(){
    setLayerVisible(false);
}

function setLayerVisible(visible){
    if(visible === true){
        layer.classList.add('visible');
    }else{
        layer.classList.remove('visible');
    }
}

function exitFullscreen(){
    if(document.fullscreenEnabled !== true && document.webkitFullscreenEnabled !== true){
        return;
    }
    if(document.exitFullscreen != null){
        document.exitFullscreen();
    }else if(document.webkitExitFullscreen != null){
        document.webkitExitFullscreen();
    }
}

function exitFullscreenMode(){
    wrap.classList.remove('fullscreen');
    if (unregisterCursorTimeout != null) {
        unregisterCursorTimeout();
    }
    editor.resize();
    resize();
    fragmen.rect();
}

function requestFullscreenMode(){
    if(document.fullscreenEnabled !== true && document.webkitFullscreenEnabled !== true){
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