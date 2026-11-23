#!/bin/sh
set -eu

# Universal standalone installer for OpenWrt / ImmortalWrt 25.12 routers.
# Installs luci-theme-endfield and (by default) luci-app-endfield-console.
# Does NOT change your active default theme unless --set-default is passed.

SET_DEFAULT=0
MODE_FLAG=''

usage() {
	printf 'Usage: %s [--set-default] [--with-console | --theme-only | --console-only]\n' "$0"
}

for arg in "$@"; do
	case "$arg" in
		--set-default)
			SET_DEFAULT=1
			;;
		--with-console|--theme-only|--console-only)
			if [ -n "$MODE_FLAG" ] && [ "$MODE_FLAG" != "$arg" ]; then
				printf 'Conflicting mode flags: %s and %s\n' "$MODE_FLAG" "$arg" >&2
				exit 2
			fi
			MODE_FLAG="$arg"
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			printf 'Unknown argument: %s\n' "$arg" >&2
			usage >&2
			exit 2
			;;
	esac
done

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

if [ -n "$MODE_FLAG" ]; then
	"$SCRIPT_DIR/stage-files.sh" "$MODE_FLAG" /
else
	"$SCRIPT_DIR/stage-files.sh" /
fi

if [ "$MODE_FLAG" != '--console-only' ] && [ -f /etc/uci-defaults/35_luci-theme-endfield ]; then
	sh /etc/uci-defaults/35_luci-theme-endfield
	rm -f /etc/uci-defaults/35_luci-theme-endfield
fi

if [ "$SET_DEFAULT" = 1 ] && [ "$MODE_FLAG" != '--console-only' ]; then
	uci set luci.main.mediaurlbase='/luci-static/endfield'
	uci commit luci
fi

rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true

if [ "$MODE_FLAG" != '--theme-only' ] && [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd reload >/dev/null 2>&1 || true
fi

if [ "$MODE_FLAG" != '--console-only' ]; then
	printf 'luci-theme-endfield installed.\n'
	printf 'Registered themes: Endfield (auto), EndfieldDark, EndfieldLight\n'
fi

if [ "$MODE_FLAG" = '--console-only' ] || { [ "$MODE_FLAG" != '--theme-only' ] && [ -d "$REPO_ROOT/luci-app-endfield-console/root" ]; }; then
	printf 'luci-app-endfield-console installed (Admin -> Console).\n'
fi

printf 'Active mediaurlbase: %s\n' "$(uci -q get luci.main.mediaurlbase || echo unknown)"
