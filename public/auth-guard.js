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
        })
        .catch(reveal);

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
