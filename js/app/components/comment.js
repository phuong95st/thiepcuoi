import { gif } from './gif.js';
import { card } from './card.js';
import { like } from './like.js';
import { util } from '../../common/util.js';
import { pagination } from './pagination.js';
import { dto } from '../../connection/dto.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import * as confetti from '../../libs/confetti.js';
import { request, HTTP_GET, HTTP_POST, HTTP_DELETE, HTTP_PUT, HTTP_STATUS_CREATED } from '../../connection/request.js';

export const comment = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let owns = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let showHide = null;

    /**
     * @type {HTMLElement|null}
     */
    let comments = null;

    /**
     * @type {string[]}
     */
    const lastRender = [];

    /**
     * @returns {string}
     */
    const onNullComment = () => {
        const desc = lang
            .on('id', '📢 Yuk, share undangan ini biar makin rame komentarnya! 🎉')
            .on('en', '📢 Let\'s share this invitation to get more comments! 🎉')
            .get();

        return `<div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow"><p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">${desc}</p></div>`;
    };

    /**
     * @param {string} id 
     * @param {boolean} disabled 
     * @returns {void}
     */
    const changeActionButton = (id, disabled) => {
        document.querySelector(`[data-button-action="${id}"]`).childNodes.forEach((e) => {
            e.disabled = disabled;
        });
    };

    /**
     * @param {string} id
     * @returns {void}
     */
    const removeInnerForm = (id) => {
        changeActionButton(id, false);
        document.getElementById(`inner-${id}`).remove();
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {void}
     */
    const showOrHide = (button) => {
        const ids = button.getAttribute('data-uuids').split(',');
        const isShow = button.getAttribute('data-show') === 'true';
        const uuid = button.getAttribute('data-uuid');
        const currentShow = showHide.get('show');

        button.setAttribute('data-show', isShow ? 'false' : 'true');
        button.innerText = isShow ? `Show replies (${ids.length})` : 'Hide replies';
        showHide.set('show', isShow ? currentShow.filter((i) => i !== uuid) : [...currentShow, uuid]);

        for (const id of ids) {
            showHide.set('hidden', showHide.get('hidden').map((i) => {
                if (i.uuid === id) {
                    i.show = !isShow;
                }

                return i;
            }));

            document.getElementById(id).classList.toggle('d-none', isShow);
        }
    };

    /**
     * @param {HTMLAnchorElement} anchor 
     * @param {string} uuid 
     * @returns {void}
     */
    const showMore = (anchor, uuid) => {
        const content = document.getElementById(`content-${uuid}`);
        const original = util.base64Decode(content.getAttribute('data-comment'));
        const isCollapsed = anchor.getAttribute('data-show') === 'false';

        util.safeInnerHTML(content, util.convertMarkdownToHTML(util.escapeHtml(isCollapsed ? original : original.slice(0, card.maxCommentLength) + '...')));
        anchor.innerText = isCollapsed ? 'Sebagian' : 'Selengkapnya';
        anchor.setAttribute('data-show', isCollapsed ? 'true' : 'false');
    };

    /**
     * @param {ReturnType<typeof dto.getCommentResponse>} c
     * @returns {Promise<void>}
     */
    const fetchTracker = async (c) => {
        if (c.comments) {
            await Promise.all(c.comments.map((v) => fetchTracker(v)));
        }

        if (!c.ip || !c.user_agent || c.is_admin) {
            return;
        }

        /**
         * @param {string} result 
         * @returns {void}
         */
        const setResult = (result) => {
            const commentIp = document.getElementById(`ip-${util.escapeHtml(c.uuid)}`);
            util.safeInnerHTML(commentIp, `<i class="fa-solid fa-location-dot me-1"></i>${util.escapeHtml(c.ip)} <strong>${util.escapeHtml(result)}</strong>`);
        };

        // Free for commercial and non-commercial use.
        await request(HTTP_GET, `https://apip.cc/api-json/${c.ip}`)
            .withCache()
            .withRetry()
            .default()
            .then((res) => res.json())
            .then((res) => {
                let result = 'localhost';

                if (res.status === 'success') {
                    if (res.City.length !== 0 && res.RegionName.length !== 0) {
                        result = res.City + ' - ' + res.RegionName;
                    } else if (res.Capital.length !== 0 && res.CountryName.length !== 0) {
                        result = res.Capital + ' - ' + res.CountryName;
                    }
                }

                setResult(result);
            })
            .catch((err) => setResult(err.message));
    };

    /**
     * @param {ReturnType<typeof dto.getCommentsResponse>} items 
     * @param {ReturnType<typeof dto.commentShowMore>[]} hide 
     * @returns {ReturnType<typeof dto.commentShowMore>[]}
     */
    const traverse = (items, hide = []) => {
        const dataShow = showHide.get('show');

        const buildHide = (lists) => lists.forEach((item) => {
            if (hide.find((i) => i.uuid === item.uuid)) {
                buildHide(item.comments);
                return;
            }

            hide.push(dto.commentShowMore(item.uuid));
            buildHide(item.comments);
        });

        const setVisible = (lists) => lists.forEach((item) => {
            if (!dataShow.includes(item.uuid)) {
                setVisible(item.comments);
                return;
            }

            item.comments.forEach((c) => {
                const i = hide.findIndex((h) => h.uuid === c.uuid);
                if (i !== -1) {
                    hide[i].show = true;
                }
            });

            setVisible(item.comments);
        });

        buildHide(items);
        setVisible(items);

        return hide;
    };

    /**
     * @returns {Promise<ReturnType<typeof dto.getCommentsResponse>>}
     */
    const show = () => {

        // remove all event listener.
        lastRender.forEach((u) => {
            like.removeListener(u);
        });

        if (comments.getAttribute('data-loading') === 'false') {
            comments.setAttribute('data-loading', 'true');
            comments.innerHTML = card.renderLoading().repeat(pagination.getPer());
        }

        return request(HTTP_GET, `/api/v2/comment?per=${pagination.getPer()}&next=${pagination.getNext()}&lang=${lang.getLanguage()}`)
            .token(session.getToken())
            .withCache(1000 * 30)
            .withForceCache()
            .send(dto.getCommentsResponseV2)
            .then(async (res) => {
                comments.setAttribute('data-loading', 'false');

                for (const u of lastRender) {
                    await gif.remove(u);
                }

                if (res.data.lists.length === 0) {
                    comments.innerHTML = onNullComment();
                    return res;
                }

                const flatten = (ii) => ii.flatMap((i) => [i.uuid, ...flatten(i.comments)]);
                lastRender.splice(0, lastRender.length, ...flatten(res.data.lists));
                showHide.set('hidden', traverse(res.data.lists, showHide.get('hidden')));

                let data = await card.renderContentMany(res.data.lists);
                if (res.data.lists.length < pagination.getPer()) {
                    data += onNullComment();
                }

                util.safeInnerHTML(comments, data);

                lastRender.forEach((u) => {
                    like.addListener(u);
                });

                return res;
            })
            .then(async (res) => {
                comments.dispatchEvent(new Event('undangan.comment.result'));

                if (res.data.lists && session.isAdmin()) {
                    await Promise.all(res.data.lists.map((v) => fetchTracker(v)));
                }

                pagination.setTotal(res.data.count);
                comments.dispatchEvent(new Event('undangan.comment.done'));
                return res;
            });
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {Promise<void>}
     */
    const remove = async (button) => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        const id = button.getAttribute('data-uuid');

        if (session.isAdmin()) {
            owns.set(id, button.getAttribute('data-own'));
        }

        changeActionButton(id, true);
        const btn = util.disableButton(button);
        const likes = like.getButtonLike(id);
        likes.disabled = true;

        const status = await request(HTTP_DELETE, '/api/comment/' + owns.get(id))
            .token(session.getToken())
            .send(dto.statusResponse)
            .then((res) => res.data.status);

        if (!status) {
            btn.restore();
            likes.disabled = false;
            changeActionButton(id, false);
            return;
        }

        document.querySelectorAll('a[onclick="undangan.comment.showOrHide(this)"]').forEach((n) => {
            const oldUuids = n.getAttribute('data-uuids').split(',');

            if (oldUuids.includes(id)) {
                const uuids = oldUuids.filter((i) => i !== id).join(',');
                uuids.length === 0 ? n.remove() : n.setAttribute('data-uuids', uuids);
            }
        });

        owns.unset(id);
        document.getElementById(id).remove();

        if (comments.children.length === 0) {
            comments.innerHTML = onNullComment();
        }
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {Promise<void>}
     */
    const update = async (button) => {
        const id = button.getAttribute('data-uuid');

        let isPresent = false;
        const presence = document.getElementById(`form-inner-presence-${id}`);
        if (presence) {
            presence.disabled = true;
            isPresent = presence.value === '1';
        }

        const badge = document.getElementById(`badge-${id}`);
        const isChecklist = !!badge && badge.getAttribute('data-is-presence') === 'true';

        const gifIsOpen = gif.isOpen(id);
        const gifId = gif.getResultId(id);
        const gifCancel = gif.buttonCancel(id);

        if (gifIsOpen && gifId) {
            gifCancel.hide();
        }

        const form = document.getElementById(`form-inner-${id}`);

        if (id && !gifIsOpen && util.base64Encode(form.value) === form.getAttribute('data-original') && isChecklist === isPresent) {
            removeInnerForm(id);
            return;
        }

        if (!gifIsOpen && form.value?.trim().length === 0) {
            util.notify('Comments cannot be empty.').warning();
            return;
        }

        if (form) {
            form.disabled = true;
        }

        const cancel = document.querySelector(`[onclick="undangan.comment.cancel(this, '${id}')"]`);
        if (cancel) {
            cancel.disabled = true;
        }

        const btn = util.disableButton(button);

        const status = await request(HTTP_PUT, `/api/comment/${owns.get(id)}?lang=${lang.getLanguage()}`)
            .token(session.getToken())
            .body(dto.updateCommentRequest(presence ? isPresent : null, gifIsOpen ? null : form.value, gifId))
            .send(dto.statusResponse)
            .then((res) => res.data.status);

        if (form) {
            form.disabled = false;
        }

        if (cancel) {
            cancel.disabled = false;
        }

        if (presence) {
            presence.disabled = false;
        }

        btn.restore();

        if (gifIsOpen && gifId) {
            gifCancel.show();
        }

        if (!status) {
            return;
        }

        if (gifIsOpen && gifId) {
            document.getElementById(`img-gif-${id}`).src = document.getElementById(`gif-result-${id}`)?.querySelector('img').src;
            gifCancel.click();
        }

        removeInnerForm(id);

        if (!gifIsOpen) {
            const showButton = document.querySelector(`[onclick="undangan.comment.showMore(this, '${id}')"]`);

            const content = document.getElementById(`content-${id}`);
            content.setAttribute('data-comment', util.base64Encode(form.value));

            const original = util.convertMarkdownToHTML(util.escapeHtml(form.value));
            if (form.value.length > card.maxCommentLength) {
                util.safeInnerHTML(content, showButton?.getAttribute('data-show') === 'false' ? original.slice(0, card.maxCommentLength) + '...' : original);
                showButton?.classList.replace('d-none', 'd-block');
            } else {
                util.safeInnerHTML(content, original);
                showButton?.classList.replace('d-block', 'd-none');
            }
        }

        if (presence) {
            document.getElementById('form-presence').value = isPresent ? '1' : '2';
            storage('information').set('presence', isPresent);
        }

        if (!presence || !badge) {
            return;
        }

        badge.classList.toggle('fa-circle-xmark', !isPresent);
        badge.classList.toggle('text-danger', !isPresent);

        badge.classList.toggle('fa-circle-check', isPresent);
        badge.classList.toggle('text-success', isPresent);
    };

    let localCurrentPage = 1;
    const LOCAL_PER_PAGE = 5;
    let localSearchKeyword = '';

    const formatTimeAgo = (dateInput) => {
        if (!dateInput) {
            return 'Vừa xong';
        }

        let timeMs = 0;
        if (typeof dateInput === 'number') {
            timeMs = dateInput;
        } else if (typeof dateInput === 'string') {
            const parsed = Date.parse(dateInput);
            if (!isNaN(parsed)) {
                timeMs = parsed;
            } else {
                return dateInput;
            }
        }

        const diffSeconds = Math.floor((Date.now() - timeMs) / 1000);
        if (diffSeconds < 45) {
            return 'Vừa xong';
        }

        const diffMinutes = Math.floor(diffSeconds / 60);
        if (diffMinutes < 60) {
            return `${diffMinutes} phút trước`;
        }

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return `${diffHours} giờ trước`;
        }

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) {
            return `${diffDays} ngày trước`;
        }

        const d = new Date(timeMs);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes} ${day}/${month}/${year}`;
    };

    const INITIAL_WISH_OFFSETS = {
        'wish-1': 8 * 60 * 1000,          // 8 phút trước
        'wish-2': 25 * 60 * 1000,         // 25 phút trước
        'wish-3': 2 * 60 * 60 * 1000,     // 2 giờ trước
        'wish-4': 5 * 60 * 60 * 1000,     // 5 giờ trước
        'wish-5': 22 * 60 * 60 * 1000,    // 22 giờ trước
        'wish-6': 30 * 60 * 60 * 1000,    // 30 giờ trước (~1 ngày trước)
    };

    const getInitialSampleWishes = (now) => [
        {
            id: 'wish-1',
            name: 'Gia đình Bác Vũ',
            presence: true,
            comment: 'Chúc hai cháu Hữu Phương và Phương Quỳnh trăm năm hạnh phúc, đầu bạc răng long, gia đình êm ấm thuận hòa! 🎉💑',
            created_at: new Date(now - INITIAL_WISH_OFFSETS['wish-1']).toISOString(),
            likes: 18,
        },
        {
            id: 'wish-2',
            name: 'Hội bạn thân',
            presence: true,
            comment: 'Chúc mừng hạnh phúc người anh em Phương! Quỳnh xinh gái tuyệt vời nhất hôm nay rồi, chúc hai bạn một đời an yên, hạnh phúc viên mãn nha! 🥂❤️',
            created_at: new Date(now - INITIAL_WISH_OFFSETS['wish-2']).toISOString(),
            likes: 14,
        },
        {
            id: 'wish-3',
            name: 'Thanh Thảo & Bạn bè',
            presence: true,
            comment: 'Cô dâu Phương Quỳnh xinh đẹp rạng rỡ của chúng mình! Chúc cậu và anh Phương mãi mãi ngọt ngào, cùng nhau nắm tay đi qua mọi thăng trầm của cuộc đời! 🌸✨',
            created_at: new Date(now - INITIAL_WISH_OFFSETS['wish-3']).toISOString(),
            likes: 21,
        },
        {
            id: 'wish-4',
            name: 'Anh Tuấn & Minh Hạnh',
            presence: true,
            comment: 'Chúc hai em có một ngày cưới thật trọn vẹn và ý nghĩa. Hạnh phúc ngập tràn mái ấm nhỏ nhé! 💖',
            created_at: new Date(now - INITIAL_WISH_OFFSETS['wish-4']).toISOString(),
            likes: 9,
        },
        {
            id: 'wish-5',
            name: 'Bác Thành (Sơn Tây)',
            presence: true,
            comment: 'Mừng hạnh phúc hai cháu Phương và Quỳnh. Chúc hai cháu sớm sinh quý tử, vạn sự cát tường, gia đình thịnh vượng! 💐🥂',
            created_at: new Date(now - INITIAL_WISH_OFFSETS['wish-5']).toISOString(),
            likes: 12,
        },
        {
            id: 'wish-6',
            name: 'Hồng Ánh & Nhóm bạn cấp 3',
            presence: true,
            comment: 'Cuối cùng ngày này cũng tới! Nhìn Quỳnh lộng lẫy sánh đôi bên anh Phương mà mừng phát khóc. Trăm năm gắn kết nha hai bạn yêu! 💖🌸',
            created_at: new Date(now - INITIAL_WISH_OFFSETS['wish-6']).toISOString(),
            likes: 16,
        },
    ];

    const saveLocalWishes = (wishes) => {
        try {
            localStorage.setItem('wedding_wishes_phuong_quynh', JSON.stringify(wishes));
        } catch {
            // ignore
        }
    };

    const getLocalWishes = () => {
        let wishes = null;
        try {
            const raw = localStorage.getItem('wedding_wishes_phuong_quynh');
            if (raw) {
                wishes = JSON.parse(raw);
            }
        } catch {
            // ignore
        }

        const now = Date.now();
        if (!Array.isArray(wishes) || wishes.length === 0) {
            wishes = getInitialSampleWishes(now);
            saveLocalWishes(wishes);
            return wishes;
        }

        // Ensure every wish (including initial seed wishes and any previously saved wishes)
        // has a valid, realistic ISO created_at timestamp
        let needsSave = false;
        wishes.forEach((w) => {
            if (INITIAL_WISH_OFFSETS[w.id]) {
                const parsed = w.created_at ? Date.parse(w.created_at) : NaN;
                if (isNaN(parsed) || (now - parsed) > 48 * 60 * 60 * 1000 || (now - parsed) < 0) {
                    w.created_at = new Date(now - INITIAL_WISH_OFFSETS[w.id]).toISOString();
                    needsSave = true;
                }
            } else if (!w.created_at || isNaN(Date.parse(w.created_at))) {
                w.created_at = new Date(now - 10 * 60 * 1000).toISOString();
                needsSave = true;
            }
        });

        if (needsSave) {
            saveLocalWishes(wishes);
        }

        return wishes;
    };

    const likeWish = (id, button) => {
        const wishes = getLocalWishes();
        const w = wishes.find((item) => item.id === id);
        if (w) {
            w.likes = (w.likes || 0) + 1;
            saveLocalWishes(wishes);
            const countEl = button.querySelector('.like-count');
            if (countEl) {
                countEl.innerText = w.likes;
            }
            button.classList.add('text-danger');
        }
    };

    const renderLocalWishes = () => {
        const container = document.getElementById('comments');
        if (!container) {
            return;
        }

        const allWishes = getLocalWishes();
        const clearBtn = document.getElementById('search-wishes-clear');
        const searchInfo = document.getElementById('search-wishes-info');
        const paginationNav = document.getElementById('pagination');

        if (clearBtn) {
            clearBtn.classList.toggle('d-none', !localSearchKeyword);
        }

        const filtered = localSearchKeyword
            ? allWishes.filter((w) => {
                const name = (w.name || '').toLowerCase();
                const comm = (w.comment || '').toLowerCase();
                return name.includes(localSearchKeyword) || comm.includes(localSearchKeyword);
            })
            : allWishes;

        if (searchInfo) {
            if (localSearchKeyword) {
                searchInfo.classList.remove('d-none');
                searchInfo.innerHTML = `<i class="fa-solid fa-filter me-1 text-danger"></i>Tìm thấy <strong>${filtered.length}</strong> lời chúc phù hợp với "<em>${util.escapeHtml(localSearchKeyword)}</em>"`;
            } else {
                searchInfo.classList.add('d-none');
            }
        }

        if (filtered.length === 0) {
            if (localSearchKeyword) {
                container.innerHTML = `
                    <div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow-sm border">
                        <i class="fa-solid fa-magnifying-glass fa-2x text-secondary opacity-50 mb-2"></i>
                        <p class="p-0 m-0 text-secondary" style="font-size: 0.95rem;">
                            Không tìm thấy lời chúc nào phù hợp với "<strong>${util.escapeHtml(localSearchKeyword)}</strong>".
                        </p>
                        <button type="button" class="btn btn-outline-auto btn-sm rounded-pill mt-3 px-3" onclick="undangan.comment.clearSearch()">
                            <i class="fa-solid fa-rotate-left me-1"></i>Xem tất cả lời chúc
                        </button>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow-sm border">
                        <p class="p-0 m-0 text-secondary" style="font-size: 0.95rem;">
                            <i class="fa-solid fa-feather-pointed me-2 text-danger"></i>Hãy là người đầu tiên gửi lời chúc mừng hạnh phúc đến Phương & Quỳnh! 🎉
                        </p>
                    </div>
                `;
            }

            if (paginationNav) {
                paginationNav.classList.add('d-none');
                paginationNav.innerHTML = '';
            }
            return;
        }

        // Pagination calculation
        const totalPages = Math.max(1, Math.ceil(filtered.length / LOCAL_PER_PAGE));
        if (localCurrentPage > totalPages) {
            localCurrentPage = totalPages;
        }
        if (localCurrentPage < 1) {
            localCurrentPage = 1;
        }

        const startIndex = (localCurrentPage - 1) * LOCAL_PER_PAGE;
        const pageItems = filtered.slice(startIndex, startIndex + LOCAL_PER_PAGE);

        const html = pageItems.map((w) => {
            let badgeHtml = '<span class="badge bg-secondary-subtle text-secondary border rounded-pill px-2 py-1"><i class="fa-solid fa-heart me-1 text-danger"></i>Gửi lời chúc</span>';
            if (w.presence === true) {
                badgeHtml = '<span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1"><i class="fa-solid fa-circle-check me-1"></i>Tham dự</span>';
            }
            if (w.presence === false) {
                badgeHtml = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill px-2 py-1"><i class="fa-solid fa-circle-xmark me-1"></i>Báo vắng</span>';
            }

            const timeDisplay = formatTimeAgo(w.created_at || w.date);

            return `
            <div class="bg-theme-auto shadow-sm p-3 mx-0 mt-0 mb-3 rounded-4 border border-1 border-opacity-25" data-wish-id="${w.id}">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle rounded-circle me-2 text-white d-flex align-items-center justify-content-center fw-bold shadow-sm" style="width: 2.3rem; height: 2.3rem; font-size: 0.95rem; background: linear-gradient(135deg, #e91e63, #9c27b0) !important;">
                            ${util.escapeHtml(w.name).trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <strong class="d-block text-theme-auto" style="font-size: 0.95rem;">${util.escapeHtml(w.name)}</strong>
                            <small class="text-secondary wish-time-badge" data-created-at="${w.created_at || ''}" style="font-size: 0.75rem;" title="${w.created_at ? new Date(w.created_at).toLocaleString('vi-VN') : ''}"><i class="fa-regular fa-clock me-1"></i><span class="wish-time-text">${timeDisplay}</span></small>
                        </div>
                    </div>
                    ${badgeHtml}
                </div>
                <hr class="my-2 opacity-25">
                <p class="text-theme-auto mb-2" style="font-size: 0.9rem; line-height: 1.5;">${util.escapeHtml(w.comment)}</p>
                <div class="d-flex justify-content-end">
                    <button type="button" class="btn btn-sm btn-outline-auto rounded-pill px-2 py-0 d-flex align-items-center shadow-sm" onclick="undangan.comment.likeWish('${w.id}', this)" style="font-size: 0.8rem;">
                        <i class="fa-solid fa-heart text-danger me-1"></i>
                        <span class="like-count">${w.likes || 1}</span>
                    </button>
                </div>
            </div>
            `;
        }).join('');
        container.innerHTML = html;

        // Render pagination controls
        if (paginationNav) {
            if (totalPages > 1) {
                paginationNav.classList.remove('d-none');
                paginationNav.innerHTML = `
                <ul class="pagination pagination-sm mb-2 shadow-sm rounded-pill overflow-hidden border">
                    <li class="page-item ${localCurrentPage <= 1 ? 'disabled' : ''}">
                        <button class="page-link border-0 px-3 py-2" onclick="undangan.comment.prevPage()" aria-label="Trang trước" ${localCurrentPage <= 1 ? 'disabled' : ''}>
                            <i class="fa-solid fa-chevron-left me-1"></i>Trước
                        </button>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link border-0 text-theme-auto fw-semibold px-3 py-2 bg-transparent">
                            Trang ${localCurrentPage} / ${totalPages} (${filtered.length})
                        </span>
                    </li>
                    <li class="page-item ${localCurrentPage >= totalPages ? 'disabled' : ''}">
                        <button class="page-link border-0 px-3 py-2" onclick="undangan.comment.nextPage()" aria-label="Trang sau" ${localCurrentPage >= totalPages ? 'disabled' : ''}>
                            Sau<i class="fa-solid fa-chevron-right ms-1"></i>
                        </button>
                    </li>
                </ul>
                `;
            } else {
                paginationNav.classList.remove('d-none');
                paginationNav.innerHTML = `
                    <small class="text-secondary my-1">Hiển thị <strong>${filtered.length}</strong> lời chúc phúc</small>
                `;
            }
        }
    };

    const search = (keyword) => {
        localSearchKeyword = (keyword || '').trim().toLowerCase();
        localCurrentPage = 1;
        renderLocalWishes();
    };

    const clearSearch = () => {
        localSearchKeyword = '';
        localCurrentPage = 1;
        const input = document.getElementById('search-wishes-input');
        if (input) {
            input.value = '';
        }
        renderLocalWishes();
    };

    const nextPage = () => {
        localCurrentPage += 1;
        renderLocalWishes();
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    };

    const prevPage = () => {
        if (localCurrentPage > 1) {
            localCurrentPage -= 1;
            renderLocalWishes();
            document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const updateRealtimeTimestamps = () => {
        const badges = document.querySelectorAll('.wish-time-badge');
        badges.forEach((el) => {
            const raw = el.getAttribute('data-created-at');
            if (raw) {
                const textEl = el.querySelector('.wish-time-text');
                if (textEl) {
                    textEl.innerText = formatTimeAgo(raw);
                }
            }
        });
    };

    let realtimeTimerId = null;
    const initLocal = () => {
        renderLocalWishes();
        if (!realtimeTimerId) {
            realtimeTimerId = setInterval(updateRealtimeTimestamps, 15000);
        }
    };

    const sendLocal = async (button) => {
        const name = document.getElementById('form-name');
        const presence = document.getElementById('form-presence');
        const form = document.getElementById('form-comment');

        if (!name || name.value.trim().length === 0) {
            util.notify('Vui lòng nhập họ và tên của bạn.').warning();
            name?.focus();
            return;
        }

        if (!presence || presence.value === '0' || presence.value === '') {
            util.notify('Vui lòng chọn xác nhận tham dự (Chắc chắn tham dự hoặc Rất tiếc không thể tham dự).').warning();
            presence?.focus();
            return;
        }

        if (!form || form.value.trim().length === 0) {
            util.notify('Vui lòng nhập lời chúc phúc của bạn.').warning();
            form?.focus();
            return;
        }

        const btn = util.disableButton(button, 'Đang gửi...');
        await new Promise((r) => setTimeout(r, 200));

        const wishes = getLocalWishes();
        const presenceVal = presence ? presence.value : '0';
        let isPresent = null;
        if (presenceVal === '1') {
            isPresent = true;
        } else if (presenceVal === '2') {
            isPresent = false;
        }

        const newWish = {
            id: `wish-${Date.now()}`,
            name: name.value.trim(),
            presence: isPresent,
            comment: form.value.trim(),
            date: 'Vừa xong',
            likes: 1,
            created_at: new Date().toISOString(),
        };

        wishes.unshift(newWish);
        saveLocalWishes(wishes);

        // Optional webhook sync (Google Sheets)
        const webhookUrl = localStorage.getItem('wedding_webhook_url');
        if (webhookUrl && webhookUrl.startsWith('http')) {
            try {
                let presenceText = 'Gửi lời chúc';
                if (isPresent === true) {
                    presenceText = 'Tham dự';
                } else if (isPresent === false) {
                    presenceText = 'Báo vắng';
                }
                fetch(webhookUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newWish.name,
                        presence: presenceText,
                        comment: newWish.comment,
                        date: new Date().toLocaleString('vi-VN'),
                    }),
                }).catch(() => null);
            } catch {
                // ignore webhook failure
            }
        }

        form.value = '';
        btn.restore();

        try {
            confetti.basicAnimation();
        } catch {
            // ignore
        }

        localCurrentPage = 1;
        localSearchKeyword = '';
        const searchInput = document.getElementById('search-wishes-input');
        if (searchInput) {
            searchInput.value = '';
        }

        renderLocalWishes();
        util.notify('Cảm ơn bạn đã gửi lời chúc mừng hạnh phúc đến Phương & Quỳnh! 💖').success();
        document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {Promise<void>}
     */
    const send = async (button) => {
        if (!document.body.getAttribute('data-key') || !session.getToken()) {
            await sendLocal(button);
            return;
        }

        const id = button.getAttribute('data-uuid');

        const name = document.getElementById('form-name');
        const nameValue = name.value;

        if (nameValue.length === 0) {
            util.notify('Name cannot be empty.').warning();

            if (id) {
                // scroll to form.
                name.scrollIntoView({ block: 'center' });
            }
            return;
        }

        const presence = document.getElementById('form-presence');
        if (!id && presence && presence.value === '0') {
            util.notify('Please select your attendance status.').warning();
            return;
        }

        const gifIsOpen = gif.isOpen(id ? id : gif.default);
        const gifId = gif.getResultId(id ? id : gif.default);
        const gifCancel = gif.buttonCancel(id);

        if (gifIsOpen && !gifId) {
            util.notify('Gif cannot be empty.').warning();
            return;
        }

        if (gifIsOpen && gifId) {
            gifCancel.hide();
        }

        const form = document.getElementById(`form-${id ? `inner-${id}` : 'comment'}`);
        if (!gifIsOpen && form.value?.trim().length === 0) {
            util.notify('Comments cannot be empty.').warning();
            return;
        }

        if (!id && name && !session.isAdmin()) {
            name.disabled = true;
        }

        if (!session.isAdmin() && presence && presence.value !== '0') {
            presence.disabled = true;
        }

        if (form) {
            form.disabled = true;
        }

        const cancel = document.querySelector(`[onclick="undangan.comment.cancel(this, '${id}')"]`);
        if (cancel) {
            cancel.disabled = true;
        }

        const btn = util.disableButton(button);
        const isPresence = presence ? presence.value === '1' : true;

        if (!session.isAdmin()) {
            const info = storage('information');
            info.set('name', nameValue);

            if (!id) {
                info.set('presence', isPresence);
            }
        }

        const response = await request(HTTP_POST, `/api/comment?lang=${lang.getLanguage()}`)
            .token(session.getToken())
            .body(dto.postCommentRequest(id, nameValue, isPresence, gifIsOpen ? null : form.value, gifId))
            .send(dto.getCommentResponse);

        if (name) {
            name.disabled = false;
        }

        if (form) {
            form.disabled = false;
        }

        if (cancel) {
            cancel.disabled = false;
        }

        if (presence) {
            presence.disabled = false;
        }

        if (gifIsOpen && gifId) {
            gifCancel.show();
        }

        btn.restore();

        if (!response || response.code !== HTTP_STATUS_CREATED) {
            return;
        }

        owns.set(response.data.uuid, response.data.own);

        if (form) {
            form.value = null;
        }

        if (gifIsOpen && gifId) {
            gifCancel.click();
        }

        if (!id) {
            if (pagination.reset()) {
                await show();
                comments.scrollIntoView();
                return;
            }

            pagination.setTotal(pagination.geTotal() + 1);
            if (comments.children.length === pagination.getPer()) {
                comments.lastElementChild.remove();
            }

            response.data.is_parent = true;
            response.data.is_admin = session.isAdmin();
            comments.insertAdjacentHTML('afterbegin', await card.renderContentMany([response.data]));
            comments.scrollIntoView();
        }

        if (id) {
            showHide.set('hidden', showHide.get('hidden').concat([dto.commentShowMore(response.data.uuid, true)]));
            showHide.set('show', showHide.get('show').concat([id]));

            removeInnerForm(id);

            response.data.is_parent = false;
            response.data.is_admin = session.isAdmin();
            document.getElementById(`reply-content-${id}`).insertAdjacentHTML('beforeend', await card.renderContentSingle(response.data));

            const anchorTag = document.getElementById(`button-${id}`).querySelector('a');
            if (anchorTag) {
                if (anchorTag.getAttribute('data-show') === 'false') {
                    showOrHide(anchorTag);
                }

                anchorTag.remove();
            }

            const uuids = [response.data.uuid];
            const readMoreElement = document.createRange().createContextualFragment(card.renderReadMore(id, anchorTag ? anchorTag.getAttribute('data-uuids').split(',').concat(uuids) : uuids));

            const buttonLike = like.getButtonLike(id);
            buttonLike.parentNode.insertBefore(readMoreElement, buttonLike);
        }

        like.addListener(response.data.uuid);
        lastRender.push(response.data.uuid);
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {string} id
     * @returns {Promise<void>}
     */
    const cancel = async (button, id) => {
        const presence = document.getElementById(`form-inner-presence-${id}`);
        const isPresent = presence ? presence.value === '1' : false;

        const badge = document.getElementById(`badge-${id}`);
        const isChecklist = badge && owns.has(id) && presence ? badge.getAttribute('data-is-presence') === 'true' : false;

        const btn = util.disableButton(button);

        if (gif.isOpen(id) && ((!gif.getResultId(id) && isChecklist === isPresent) || util.ask('Are you sure?'))) {
            await gif.remove(id);
            removeInnerForm(id);
            return;
        }

        const form = document.getElementById(`form-inner-${id}`);
        if (form.value.length === 0 || (util.base64Encode(form.value) === form.getAttribute('data-original') && isChecklist === isPresent) || util.ask('Are you sure?')) {
            removeInnerForm(id);
            return;
        }

        btn.restore();
    };

    /**
     * @param {string} uuid 
     * @returns {void}
     */
    const reply = (uuid) => {
        changeActionButton(uuid, true);

        gif.remove(uuid).then(() => {
            gif.onOpen(uuid, () => gif.removeGifSearch(uuid));
            document.getElementById(`button-${uuid}`).insertAdjacentElement('afterend', card.renderReply(uuid));
        });
    };

    /**
     * @param {HTMLButtonElement} button 
     * @param {boolean} is_parent
     * @returns {Promise<void>}
     */
    const edit = async (button, is_parent) => {
        const id = button.getAttribute('data-uuid');

        changeActionButton(id, true);

        if (session.isAdmin()) {
            owns.set(id, button.getAttribute('data-own'));
        }

        const badge = document.getElementById(`badge-${id}`);
        const isChecklist = !!badge && badge.getAttribute('data-is-presence') === 'true';

        const gifImage = document.getElementById(`img-gif-${id}`);
        if (gifImage) {
            await gif.remove(id);
        }

        const isParent = is_parent && !session.isAdmin();
        document.getElementById(`button-${id}`).insertAdjacentElement('afterend', card.renderEdit(id, isChecklist, isParent, !!gifImage));

        if (gifImage) {
            gif.onOpen(id, () => {
                gif.removeGifSearch(id);
                gif.removeButtonBack(id);
            });

            await gif.open(id);
            return;
        }

        const formInner = document.getElementById(`form-inner-${id}`);
        const original = util.base64Decode(document.getElementById(`content-${id}`)?.getAttribute('data-comment'));

        formInner.value = original;
        formInner.setAttribute('data-original', util.base64Encode(original));
    };

    /**
     * @returns {void}
     */
    const init = () => {
        gif.init();
        like.init();
        card.init();
        pagination.init();

        comments = document.getElementById('comments');
        if (comments) {
            comments.addEventListener('undangan.comment.show', show);
        }

        owns = storage('owns');
        showHide = storage('comment');

        if (!showHide.has('hidden')) {
            showHide.set('hidden', []);
        }

        if (!showHide.has('show')) {
            showHide.set('show', []);
        }

        if (!document.body.getAttribute('data-key')) {
            renderLocalWishes();
        }
    };

    return {
        gif,
        like,
        pagination,
        init,
        send,
        edit,
        reply,
        remove,
        update,
        cancel,
        show,
        showMore,
        showOrHide,
        initLocal,
        sendLocal,
        likeWish,
        search,
        clearSearch,
        nextPage,
        prevPage,
    };
})();