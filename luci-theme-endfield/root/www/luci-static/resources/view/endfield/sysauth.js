'use strict';
'require view';

return view.extend({
	render: function() {
		var root = document.documentElement;
		var form = document.getElementById('ef-login-form');
		var pass = document.getElementById('luci_password');
		var passToggle = document.getElementById('ef-pass-toggle');
		var submitBtn = document.getElementById('ef-login-submit');
		var modeBtn = document.getElementById('ef-login-mode-toggle');
		var modeLabel = document.getElementById('ef-login-mode-label');

		function syncModeUI() {
			var isDark = root.getAttribute('data-darkmode') === 'true';
			if (modeLabel) modeLabel.textContent = isDark ? 'DARK' : 'LIGHT';
			if (modeBtn) {
				var sun = modeBtn.querySelector('[data-mode-icon="sun"]');
				var moon = modeBtn.querySelector('[data-mode-icon="moon"]');
				if (sun) sun.style.display = isDark ? 'block' : 'none';
				if (moon) moon.style.display = isDark ? 'none' : 'block';
			}
		}

		syncModeUI();

		if (modeBtn) {
			modeBtn.addEventListener('click', function() {
				var next = root.getAttribute('data-darkmode') !== 'true';
				root.setAttribute('data-darkmode', next ? 'true' : 'false');
				try { localStorage.setItem('luci_endfield_darkmode', next ? 'true' : 'false'); } catch (e) {}
				syncModeUI();
			});
		}

		if (passToggle && pass) {
			passToggle.addEventListener('click', function() {
				var hidden = pass.type === 'password';
				pass.type = hidden ? 'text' : 'password';
				passToggle.textContent = hidden ? 'HIDE' : 'SHOW';
			});
		}

		if (form && submitBtn) {
			form.addEventListener('submit', function() {
				submitBtn.disabled = true;
				submitBtn.classList.add('spinning');
				submitBtn.textContent = _('Logging in…');
			});
		}

		if (pass) {
			pass.focus();
		}

		return '';
	},

	addFooter: function() {}
});
