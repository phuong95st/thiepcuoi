import { progress } from './progress.js';
import { cache } from '../../connection/cache.js';

export const audio = (() => {

    const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
    const statePause = '<i class="fa-solid fa-circle-play"></i>';

    /**
     * @returns {boolean}
     */
    const isIOS = () => (
        /iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    /**
     * @param {boolean} [playOnOpen=true]
     * @returns {Promise<void>}
     */
    const load = async (playOnOpen = true) => {

        const rawUrl = document.body.getAttribute('data-audio');
        if (!rawUrl) {
            progress.complete('audio', true);
            return;
        }

        const url = new URL(rawUrl, window.location.href).href;

        /**
         * @type {HTMLAudioElement|null}
         */
        let audioEl = null;

        const music = document.getElementById('button-music');
        let isPlay = false;

        try {
            let audioSrc = url;

            // iOS Safari: blob cache can cause NotSupportedError — use direct URL
            if (!isIOS()) {
                try {
                    audioSrc = await cache('audio').withForceCache().get(url, progress.getAbort());
                } catch {
                    audioSrc = url;
                }
            }

            audioEl = new Audio();
            audioEl.loop = true;
            audioEl.muted = false;
            audioEl.autoplay = false;
            audioEl.controls = false;
            audioEl.volume = 1.0;
            audioEl.preload = 'auto';
            audioEl.playsInline = true;
            audioEl.setAttribute('playsinline', '');
            audioEl.setAttribute('webkit-playsinline', '');
            audioEl.src = audioSrc;
            audioEl.load();

            const canPlay = await new Promise((resolve) => {
                if (audioEl.error) {
                    resolve(false);
                    return;
                }

                if (audioEl.readyState >= 1) {
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
                    audioEl.removeEventListener('loadedmetadata', onReady);
                    audioEl.removeEventListener('canplay', onReady);
                    audioEl.removeEventListener('error', onError);
                    resolve(ok);
                };
                const onReady = () => finish(!audioEl.error);
                const onError = () => finish(false);
                const timer = setTimeout(() => finish(!audioEl.error && audioEl.readyState >= 1), 8000);

                audioEl.addEventListener('loadedmetadata', onReady, { once: true });
                audioEl.addEventListener('canplay', onReady, { once: true });
                audioEl.addEventListener('error', onError, { once: true });
            });

            progress.complete('audio', !canPlay);

            if (!canPlay) {
                return;
            }
        } catch {
            progress.complete('audio', true);
            return;
        }

        /**
         * @returns {Promise<void>}
         */
        const play = async () => {
            if (!audioEl || !music || !navigator.onLine) {
                return;
            }

            music.disabled = true;
            try {
                audioEl.muted = false;
                await audioEl.play();
                isPlay = true;
                music.innerHTML = statePlay;
            } catch {
                // iOS may block autoplay — silent fail; user can tap music button
                isPlay = false;
                music.innerHTML = statePause;
            } finally {
                music.disabled = false;
            }
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

        document.addEventListener('undangan.open', () => {
            music?.classList.remove('d-none');
            if (playOnOpen) {
                play();
            }
        });

        music?.addEventListener('offline', pause);
        music?.addEventListener('click', () => (isPlay ? pause() : play()));
    };

    /**
     * @returns {object}
     */
    const init = () => {
        progress.add();

        return {
            load,
        };
    };

    return {
        init,
    };
})();
