import { progress } from './progress.js';
import { cache } from '../../connection/cache.js';
import { util } from '../../common/util.js';

export const audio = (() => {

    const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
    const statePause = '<i class="fa-solid fa-circle-play"></i>';

    /**
     * @type {HTMLAudioElement|null}
     */
    let audioEl = null;

    /**
     * @type {HTMLElement|null}
     */
    let music = null;

    /**
     * @type {string|null}
     */
    let url = null;

    let isPlay = false;
    let wired = false;

    /**
     * @returns {HTMLAudioElement}
     */
    const getAudioEl = () => {
        if (!audioEl) {
            audioEl = document.getElementById('wedding-audio');
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'wedding-audio';
                audioEl.hidden = true;
                document.body.appendChild(audioEl);
            }

            audioEl.loop = true;
            audioEl.preload = util.isInAppBrowser() ? 'none' : 'auto';
            audioEl.playsInline = true;
            audioEl.setAttribute('playsinline', '');
            audioEl.setAttribute('webkit-playsinline', '');
        }

        return audioEl;
    };

    /**
     * @param {string} src
     * @returns {void}
     */
    const applySrc = (src) => {
        const el = getAudioEl();
        if (el.getAttribute('data-src-applied') === src) {
            return;
        }

        el.src = src;
        el.setAttribute('data-src-applied', src);
        el.load();
    };

    /**
     * @returns {Promise<boolean>}
     */
    const waitUntilReady = () => new Promise((resolve) => {
        const el = getAudioEl();

        if (!el.error && el.readyState >= 2) {
            resolve(true);
            return;
        }

        let settled = false;
        const finish = (ok) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            el.removeEventListener('canplay', onReady);
            el.removeEventListener('loadeddata', onReady);
            el.removeEventListener('error', onError);
            resolve(ok);
        };

        const onReady = () => finish(!el.error);
        const onError = () => finish(false);
        const timer = window.setTimeout(() => finish(!el.error && el.readyState >= 1), 8000);

        el.addEventListener('canplay', onReady, { once: true });
        el.addEventListener('loadeddata', onReady, { once: true });
        el.addEventListener('error', onError, { once: true });
    });

    /**
     * @returns {void}
     */
    const showButton = () => {
        music?.classList.remove('d-none');
    };

    /**
     * Must start play() synchronously inside a user click/touch handler (Zalo WebView).
     * Do not await before calling play() or the user-gesture context is lost.
     * @returns {void}
     */
    const playFromGesture = () => {
        if (!url || !music) {
            return;
        }

        showButton();
        applySrc(url);

        const el = getAudioEl();
        el.muted = false;

        const attempt = el.play();
        if (!attempt || typeof attempt.then !== 'function') {
            isPlay = !el.paused;
            music.innerHTML = isPlay ? statePlay : statePause;
            return;
        }

        attempt.then(() => {
            isPlay = true;
            music.innerHTML = statePlay;
        }).catch(() => {
            isPlay = false;
            music.innerHTML = statePause;
        });
    };

    /**
     * @returns {void}
     */
    const pause = () => {
        if (!audioEl || !music) {
            return;
        }

        isPlay = false;
        audioEl.pause();
        music.innerHTML = statePause;
    };

    /**
     * @returns {void}
     */
    const wireControls = () => {
        if (wired || !music) {
            return;
        }

        wired = true;

        document.addEventListener('undangan.open', () => {
            showButton();
        });

        music.addEventListener('offline', pause);
        music.addEventListener('click', () => (isPlay ? pause() : playFromGesture()));
    };

    /**
     * @param {boolean} [playOnOpen=true]
     * @returns {Promise<void>}
     */
    const load = async (playOnOpen = true) => {
        const rawUrl = document.body.getAttribute('data-audio');
        music = document.getElementById('button-music');

        if (!rawUrl) {
            progress.complete('audio', true);
            return;
        }

        url = util.resolveUrl(rawUrl);
        wireControls();

        if (util.isInAppBrowser()) {
            progress.complete('audio');
            return;
        }

        try {
            let audioSrc = url;

            if (!util.shouldBypassBlobCache()) {
                try {
                    audioSrc = await cache('audio').withForceCache().get(url, progress.getAbort());
                } catch {
                    audioSrc = url;
                }
            }

            applySrc(audioSrc);
            const canPlay = await waitUntilReady();
            progress.complete('audio', !canPlay);
        } catch {
            progress.complete('audio', true);
        }

        if (!playOnOpen) {
            return;
        }
    };

    /**
     * @returns {object}
     */
    const init = () => {
        progress.add();

        return {
            load,
            playFromGesture,
        };
    };

    return {
        init,
        playFromGesture,
    };
})();
