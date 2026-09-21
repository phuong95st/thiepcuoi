import { progress } from './progress.js';
import { cache } from '../../connection/cache.js';
import { util } from '../../common/util.js';

export const image = (() => {

    /**
     * @type {NodeListOf<HTMLImageElement>|null}
     */
    let images = null;

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @type {object[]}
     */
    const urlCache = [];

    /**
     * @param {string} src 
     * @returns {Promise<HTMLImageElement>}
     */
    const loadedImage = (src) => new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
    });

    /**
     * @param {HTMLImageElement} el 
     * @param {string} src 
     * @returns {Promise<void>}
     */
    const appendImage = (el, src) => loadedImage(src).then((img) => {
        el.width = img.naturalWidth;
        el.height = img.naturalHeight;
        el.classList.remove('opacity-0');
        el.src = img.src;
        img.remove();

        progress.complete('image');
    });

    /**
     * @param {HTMLImageElement} el
     * @returns {void}
     */
    const fallbackImage = (el) => {
        const directSrc = el.getAttribute('data-src');
        if (!directSrc) {
            progress.complete('image');
            return;
        }

        el.removeAttribute('data-src');
        el.onerror = () => progress.complete('image');
        el.onload = () => {
            el.width = el.naturalWidth;
            el.height = el.naturalHeight;
            el.classList.remove('opacity-0');
            progress.complete('image');
        };
        el.src = util.resolveUrl(directSrc);
    };

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByFetch = (el) => {
        const dataSrc = el.getAttribute('data-src');
        if (!dataSrc) {
            progress.complete('image');
            return;
        }

        if (util.shouldBypassBlobCache()) {
            fallbackImage(el);
            return;
        }

        urlCache.push({
            url: util.resolveUrl(dataSrc),
            res: (url) => appendImage(el, url).catch(() => fallbackImage(el)),
            rej: (err) => {
                console.error(err);
                fallbackImage(el);
            },
        });
    };

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByDefault = (el) => {
        el.onerror = () => fallbackImage(el);
        el.onload = () => {
            el.width = el.naturalWidth;
            el.height = el.naturalHeight;
            progress.complete('image');
        };

        if (el.complete && el.naturalWidth !== 0 && el.naturalHeight !== 0) {
            progress.complete('image');
        } else if (el.complete) {
            fallbackImage(el);
        }
    };

    /**
     * @returns {boolean}
     */
    const hasDataSrc = () => Array.from(images).some((i) => i.hasAttribute('data-src'));

    /**
     * @returns {Promise<void>}
     */
    const load = async () => {
        const imgs = Array.from(images);

        /**
         * @param {function} filter 
         * @returns {Promise<void>}
         */
        const runGroup = async (filter) => {
            urlCache.length = 0;
            imgs.filter(filter).forEach((el) => el.hasAttribute('data-src') ? getByFetch(el) : getByDefault(el));
            await c.run(urlCache, progress.getAbort());
        };

        await runGroup((el) => el.hasAttribute('fetchpriority'));
        await runGroup((el) => !el.hasAttribute('fetchpriority'));
    };

    /**
     * @param {string} blobUrl 
     * @returns {void}
     */
    const download = (blobUrl) => {
        c.download(blobUrl, `${window.location.hostname}_image_${Date.now()}`);
    };

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('image').withForceCache();
        images = document.querySelectorAll('img');
        images.forEach(progress.add);

        return {
            load,
            download,
            hasDataSrc,
        };
    };

    return {
        init,
    };
})();