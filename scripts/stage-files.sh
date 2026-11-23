#!/bin/sh
set -eu

# Stage luci-theme-endfield and/or luci-app-endfield-console into a target root directory.
# Usage: stage-files.sh [--with-console | --theme-only | --console-only] <dest-dir>

MODE='default'
DEST=''

usage() {
	printf 'Usage: %s [--with-console | --theme-only | --console-only] <dest-dir>\n' "$0" >&2
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--with-console)
			if [ "$MODE" = 'theme-only' ] || [ "$MODE" = 'console-only' ]; then
				printf 'Conflicting mode flag: %s\n' "$1" >&2
				exit 2
			fi
			MODE='with-console'
			shift
			;;
		--theme-only)
			if [ "$MODE" = 'with-console' ] || [ "$MODE" = 'console-only' ]; then
				printf 'Conflicting mode flag: %s\n' "$1" >&2
				exit 2
			fi
			MODE='theme-only'
			shift
			;;
		--console-only)
			if [ "$MODE" = 'with-console' ] || [ "$MODE" = 'theme-only' ]; then
				printf 'Conflicting mode flag: %s\n' "$1" >&2
				exit 2
			fi
			MODE='console-only'
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		-*)
			printf 'Unknown argument: %s\n' "$1" >&2
			usage
			exit 2
			;;
		*)
			if [ -n "$DEST" ]; then
				printf 'Unexpected extra argument: %s\n' "$1" >&2
				usage
				exit 2
			fi
			DEST="$1"
			shift
			;;
	esac
done

if [ -z "$DEST" ]; then
	usage
	exit 2
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
THEME_ROOT="$REPO_ROOT/luci-theme-endfield/root"
CONSOLE_ROOT="$REPO_ROOT/luci-app-endfield-console/root"

STAGE_THEME=1
STAGE_CONSOLE=1

case "$MODE" in
	theme-only)
		STAGE_THEME=1
		STAGE_CONSOLE=0
		;;
	console-only)
		STAGE_THEME=0
		STAGE_CONSOLE=1
		;;
	with-console)
		STAGE_THEME=1
		STAGE_CONSOLE=1
		;;
	default)
		STAGE_THEME=1
		if [ -d "$CONSOLE_ROOT" ]; then
			STAGE_CONSOLE=1
		else
			STAGE_CONSOLE=0
		fi
		;;
esac

if [ "$STAGE_THEME" = 1 ]; then
	[ -d "$THEME_ROOT" ] || {
		printf 'Missing theme source directory: %s\n' "$THEME_ROOT" >&2
		exit 1
	}

	mkdir -p \
		"$DEST/etc/uci-defaults" \
		"$DEST/usr/share/ucode/luci/template/themes/endfield" \
		"$DEST/www/luci-static/endfield" \
		"$DEST/www/luci-static/resources/view/endfield"

	cp -f "$THEME_ROOT/etc/uci-defaults/35_luci-theme-endfield" "$DEST/etc/uci-defaults/35_luci-theme-endfield"
	chmod 0755 "$DEST/etc/uci-defaults/35_luci-theme-endfield"

	cp -f "$THEME_ROOT/usr/share/ucode/luci/template/themes/endfield/"*.ut "$DEST/usr/share/ucode/luci/template/themes/endfield/"
	chmod 0644 "$DEST/usr/share/ucode/luci/template/themes/endfield/"*.ut
	ln -snf endfield "$DEST/usr/share/ucode/luci/template/themes/endfield-dark"
	ln -snf endfield "$DEST/usr/share/ucode/luci/template/themes/endfield-light"

	cp -f "$THEME_ROOT/www/luci-static/endfield/"* "$DEST/www/luci-static/endfield/"
	chmod 0644 "$DEST/www/luci-static/endfield/"*
	ln -snf endfield "$DEST/www/luci-static/endfield-dark"
	ln -snf endfield "$DEST/www/luci-static/endfield-light"

	cp -f "$THEME_ROOT/www/luci-static/resources/menu-endfield.js" "$DEST/www/luci-static/resources/menu-endfield.js"
	cp -f "$THEME_ROOT/www/luci-static/resources/view/endfield/sysauth.js" "$DEST/www/luci-static/resources/view/endfield/sysauth.js"
	chmod 0644 \
		"$DEST/www/luci-static/resources/menu-endfield.js" \
		"$DEST/www/luci-static/resources/view/endfield/sysauth.js"
fi

if [ "$STAGE_CONSOLE" = 1 ]; then
	[ -d "$CONSOLE_ROOT" ] || {
		printf 'Missing console source directory: %s\n' "$CONSOLE_ROOT" >&2
		exit 1
	}

	mkdir -p \
		"$DEST/usr/share/luci/menu.d" \
		"$DEST/usr/share/rpcd/acl.d" \
		"$DEST/www/luci-static/endfield" \
		"$DEST/www/luci-static/resources/view/endfield"

	cp -f "$CONSOLE_ROOT/usr/share/luci/menu.d/luci-app-endfield-console.json" "$DEST/usr/share/luci/menu.d/luci-app-endfield-console.json"
	cp -f "$CONSOLE_ROOT/usr/share/rpcd/acl.d/luci-app-endfield-console.json" "$DEST/usr/share/rpcd/acl.d/luci-app-endfield-console.json"
	cp -f "$CONSOLE_ROOT/www/luci-static/endfield/console.css" "$DEST/www/luci-static/endfield/console.css"
	cp -f "$CONSOLE_ROOT/www/luci-static/resources/view/endfield/console.js" "$DEST/www/luci-static/resources/view/endfield/console.js"
	chmod 0644 \
		"$DEST/usr/share/luci/menu.d/luci-app-endfield-console.json" \
		"$DEST/usr/share/rpcd/acl.d/luci-app-endfield-console.json" \
		"$DEST/www/luci-static/endfield/console.css" \
		"$DEST/www/luci-static/resources/view/endfield/console.js"
fi
