// Include in <head> of every page that needs a logged-in user.
// Checks the session with the server (the real source of truth), keeps the
// currentUserId the pages read from localStorage in sync with it, and adds a
// "Log out" link to the nav.
(function () {
    var root = document.documentElement;
    root.style.visibility = 'hidden'; // avoid flashing a page the user cannot use

    function reveal() { root.style.visibility = ''; }

    function toLogin() {
        try { localStorage.removeItem('currentUserId'); localStorage.removeItem('currentUserName'); } catch (e) {}
        var next = encodeURIComponent(location.pathname + location.search);
        location.replace('/login.html?next=' + next);
    }

    // Never leave the page blank if something goes wrong
    var failsafe = setTimeout(reveal, 4000);

    fetch('/api/auth/me', { credentials: 'same-origin' })
        .then(function (res) {
            if (res.status === 401) { toLogin(); return null; }
            return res.json();
        })
        .then(function (data) {
            if (!data || !data.user) return;
            clearTimeout(failsafe);

            var stored = null;
            try { stored = localStorage.getItem('currentUserId'); } catch (e) {}
            if (stored !== data.user.id) {
                try {
                    localStorage.setItem('currentUserId', data.user.id);
                    localStorage.setItem('currentUserName', data.user.fullName || '');
                } catch (e) {}
                // Pages read the id when they load, so load once more with the right one
                var flag = 'qsAuthReloaded';
                if (!sessionStorage.getItem(flag)) {
                    sessionStorage.setItem(flag, '1');
                    location.reload();
                    return;
                }
            }
            sessionStorage.removeItem('qsAuthReloaded');
            reveal();

            document.addEventListener('DOMContentLoaded', addLogout);
            if (document.readyState !== 'loading') addLogout();

            var user = data.user;
            var showNotices = function () { addEmailNotices(user); };
            document.addEventListener('DOMContentLoaded', showNotices);
            if (document.readyState !== 'loading') showNotices();
        })
        .catch(reveal);

    // A small bar at the bottom of the screen. Used to ask people to confirm their
    // email (we only send request, message and payment updates to confirmed
    // addresses) and to say whether the confirmation link worked.
    function noticeBar(id, html) {
        var bar = document.createElement('div');
        bar.id = id;
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;' +
            'max-width:calc(100% - 32px);display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;' +
            'background:#14141f;color:#f4f3f0;border:1px solid rgba(88,32,247,0.6);border-radius:14px;' +
            'padding:12px 16px;font:500 14px/1.4 "Space Grotesk",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.45);';
        bar.innerHTML = html;
        document.body.appendChild(bar);
        return bar;
    }

    function addEmailNotices(user) {
        var params = new URLSearchParams(location.search);
        var result = params.get('verified');
        if (result !== null) {
            params.delete('verified');
            var qs = params.toString();
            try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
        }

        if (result === '1' && user.emailVerified) {
            var ok = noticeBar('qsVerifyOk', 'Your email is confirmed. We will send you request, message and payment updates.');
            setTimeout(function () { ok.remove(); }, 6000);
            return;
        }

        if (!user.email || user.emailVerified) return;
        try { if (sessionStorage.getItem('qsVerifyDismissed')) return; } catch (e) {}
        if (document.getElementById('qsVerifyBar')) return;

        var lead = result === '0' ? 'That confirmation link did not work or has expired.' : 'Confirm your email to get request, message and payment updates.';
        var bar = noticeBar('qsVerifyBar',
            '<span>' + lead + '</span>' +
            '<button type="button" id="qsVerifySend" style="background:#5820F7;color:#fff;border:0;border-radius:100px;padding:8px 16px;font:700 13px \'Space Grotesk\',sans-serif;cursor:pointer;">Send the email</button>' +
            '<button type="button" id="qsVerifyClose" aria-label="Dismiss" style="background:none;border:0;color:rgba(244,243,240,0.55);font-size:20px;line-height:1;cursor:pointer;">&times;</button>');

        bar.querySelector('#qsVerifyClose').addEventListener('click', function () {
            try { sessionStorage.setItem('qsVerifyDismissed', '1'); } catch (e) {}
            bar.remove();
        });
        var send = bar.querySelector('#qsVerifySend');
        send.addEventListener('click', function () {
            send.disabled = true;
            send.textContent = 'Sending...';
            fetch('/api/auth/resend-verification', { method: 'POST', credentials: 'same-origin' })
                .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
                .then(function (r) {
                    if (!r.ok) throw new Error((r.d && r.d.message) || 'Could not send the email.');
                    bar.querySelector('span').textContent = r.d.alreadyVerified
                        ? 'Your email is already confirmed.'
                        : 'Sent. Check your inbox and spam folder for the confirmation link.';
                    send.remove();
                })
                .catch(function (err) {
                    bar.querySelector('span').textContent = err.message;
                    send.disabled = false;
                    send.textContent = 'Try again';
                });
        });
    }

    function addLogout() {
        var nav = document.querySelector('.nav-links');
        if (!nav || document.getElementById('qsLogout')) return;
        var a = document.createElement('a');
        a.id = 'qsLogout';
        a.href = '#';
        a.textContent = 'Log out';
        a.addEventListener('click', function (e) {
            e.preventDefault();
            fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
                .finally(function () {
                    try { localStorage.removeItem('currentUserId'); localStorage.removeItem('currentUserName'); } catch (err) {}
                    location.href = '/login.html';
                });
        });
        nav.appendChild(a);
    }
})();
