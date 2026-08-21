/* Android compatibility bridge. The legacy browser path remains the fallback. */
(function (global) {
    'use strict';
    const bridge = global.AndroidBridge;
    global.AndroidFileBridge = {
        isAvailable() {
            return !!(bridge && typeof bridge.saveTextFile === 'function');
        },
        saveText(fileName, content, mimeType) {
            try {
                return this.isAvailable() && bridge.saveTextFile(String(fileName), String(content), String(mimeType || 'application/octet-stream'));
            } catch (error) {
                console.warn('[AndroidBridge] text export failed', error);
                return false;
            }
        },
        saveDataUrl(fileName, dataUrl, mimeType) {
            try {
                return !!(bridge && typeof bridge.saveDataUrl === 'function' && bridge.saveDataUrl(String(fileName), String(dataUrl), String(mimeType || 'image/png')));
            } catch (error) {
                console.warn('[AndroidBridge] image export failed', error);
                return false;
            }
        }
    };
})(window);
