#!/bin/sh
set -eu

# Clean uninstaller for luci-theme-endfield and luci-app-endfield-console
# on OpenWrt / ImmortalWrt 25.12.
# Usage: uninstall.sh [--console-only]

CONSOLE_ONLY=0

for arg in "$@"; do
	case "$arg" in
		--console-only)
			CONSOLE_ONLY=1
			;;
		-h|--help)
			printf 'Usage: %s [--console-only]\n' "$0"
			exit 0
			;;
		*)
			printf 'Unknown argument: %s\n' "$arg" >&2
			exit 2
			;;
	esac
done

rm -f \
	/usr/share/luci/menu.d/luci-app-endfield-console.json \
	/usr/share/rpcd/acl.d/luci-app-endfield-console.json \
	/www/luci-static/resources/view/endfield/console.js \
	/www/luci-static/endfield/console.css

if [ "$CONSOLE_ONLY" = 0 ]; then
	cur="$(uci -q get luci.main.mediaurlbase || true)"
	case "$cur" in
		/luci-static/endfield*)
			uci set luci.main.mediaurlbase='/luci-static/bootstrap'
			;;
	esac

	uci -q delete luci.themes.Endfield || true
	uci -q delete luci.themes.EndfieldDark || true
	uci -q delete luci.themes.EndfieldLight || true
	uci commit luci || true

	rm -rf \
		/usr/share/ucode/luci/template/themes/endfield \
		/usr/share/ucode/luci/template/themes/endfield-dark \
		/usr/share/ucode/luci/template/themes/endfield-light \
		/www/luci-static/endfield \
		/www/luci-static/endfield-dark \
		/www/luci-static/endfield-light \
		/www/luci-static/resources/menu-endfield.js \
		/www/luci-static/resources/view/endfield \
		/etc/uci-defaults/35_luci-theme-endfield
fi

rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true

if [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true
fi

if [ "$CONSOLE_ONLY" = 1 ]; then
	printf 'luci-app-endfield-console uninstalled cleanly.\n'
else
	printf 'luci-theme-endfield and luci-app-endfield-console uninstalled cleanly.\n'
	printf 'Active mediaurlbase: %s\n' "$(uci -q get luci.main.mediaurlbase || echo unknown)"
fi
