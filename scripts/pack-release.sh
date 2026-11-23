#!/bin/sh
set -eu

# Package standalone release archives (.tar.gz) for both the combined suite
# and standalone theme, plus optional native OpenWrt 25.12 .apk packages when
# an apk binary supporting mkpkg is supplied.
#
# Usage: pack-release.sh --out-dir DIR [--version VER] [--apk-bin PATH]

OUT_DIR=''
VERSION=''
APK_BIN=''

while [ "$#" -gt 0 ]; do
	case "$1" in
		--out-dir) OUT_DIR="$2"; shift 2 ;;
		--version) VERSION="$2"; shift 2 ;;
		--apk-bin) APK_BIN="$2"; shift 2 ;;
		-h|--help)
			printf 'Usage: %s --out-dir DIR [--version VER] [--apk-bin PATH]\n' "$0"
			exit 0
			;;
		*)
			printf 'Unknown argument: %s\n' "$1" >&2
			exit 2
			;;
	esac
done

[ -n "$OUT_DIR" ] || { printf 'Missing --out-dir\n' >&2; exit 2; }

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

if [ -z "$VERSION" ]; then
	if [ -f "$REPO_ROOT/luci-theme-endfield/Makefile" ]; then
		VERSION="$(awk -F':=' '/^PKG_VERSION:=/ { gsub(/[[:space:]]+/, "", $2); print $2; exit }' "$REPO_ROOT/luci-theme-endfield/Makefile")"
	fi
	VERSION="${VERSION:-0.2.0}"
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(CDPATH= cd -- "$OUT_DIR" && pwd)"

TMP_WORK="$(mktemp -d)"
trap 'rm -rf "$TMP_WORK"' EXIT INT TERM

# 1. Combined suite tarball (theme + command console)
SUITE_STAGE="$TMP_WORK/luci-endfield-suite-$VERSION"
mkdir -p "$SUITE_STAGE/scripts" "$SUITE_STAGE/luci-theme-endfield" "$SUITE_STAGE/luci-app-endfield-console"
cp -a "$REPO_ROOT/luci-theme-endfield/." "$SUITE_STAGE/luci-theme-endfield/"
cp -a "$REPO_ROOT/luci-app-endfield-console/." "$SUITE_STAGE/luci-app-endfield-console/"
cp -f "$REPO_ROOT/scripts/stage-files.sh" "$REPO_ROOT/scripts/install.sh" "$REPO_ROOT/scripts/uninstall.sh" "$SUITE_STAGE/scripts/"
if [ -f "$REPO_ROOT/LICENSE" ]; then
	cp -f "$REPO_ROOT/LICENSE" "$SUITE_STAGE/LICENSE"
fi
chmod 0755 \
	"$SUITE_STAGE/scripts/"*.sh \
	"$SUITE_STAGE/luci-theme-endfield/root/etc/uci-defaults/35_luci-theme-endfield"

SUITE_TAR="$OUT_DIR/luci-endfield-suite-$VERSION.tar.gz"
tar -C "$TMP_WORK" -czf "$SUITE_TAR" "luci-endfield-suite-$VERSION"
printf '[pack-release] created %s\n' "$SUITE_TAR"

# 2. Standalone theme-only tarball
THEME_STAGE="$TMP_WORK/luci-theme-endfield-$VERSION"
mkdir -p "$THEME_STAGE/scripts" "$THEME_STAGE/luci-theme-endfield"
cp -a "$REPO_ROOT/luci-theme-endfield/." "$THEME_STAGE/luci-theme-endfield/"
cp -f "$REPO_ROOT/scripts/stage-files.sh" "$REPO_ROOT/scripts/install.sh" "$REPO_ROOT/scripts/uninstall.sh" "$THEME_STAGE/scripts/"
if [ -f "$REPO_ROOT/LICENSE" ]; then
	cp -f "$REPO_ROOT/LICENSE" "$THEME_STAGE/LICENSE"
fi
chmod 0755 \
	"$THEME_STAGE/scripts/"*.sh \
	"$THEME_STAGE/luci-theme-endfield/root/etc/uci-defaults/35_luci-theme-endfield"

THEME_TAR="$OUT_DIR/luci-theme-endfield-$VERSION.tar.gz"
tar -C "$TMP_WORK" -czf "$THEME_TAR" "luci-theme-endfield-$VERSION"
printf '[pack-release] created %s\n' "$THEME_TAR"

# 3. Optional native apk-v3 packages via apk mkpkg (when ImageBuilder host apk is available)
if [ -n "$APK_BIN" ] && [ -x "$APK_BIN" ]; then
	if "$APK_BIN" mkpkg --help >/dev/null 2>&1; then
		APK_THEME_ROOT="$TMP_WORK/apk-theme-root"
		"$SCRIPT_DIR/stage-files.sh" --theme-only "$APK_THEME_ROOT"

		THEME_POSTINST="$TMP_WORK/theme-post-install"
		THEME_PRERM="$TMP_WORK/theme-pre-deinstall"
		cat > "$THEME_POSTINST" <<'EOF'
#!/bin/sh
if [ -f /etc/uci-defaults/35_luci-theme-endfield ]; then
	sh /etc/uci-defaults/35_luci-theme-endfield && rm -f /etc/uci-defaults/35_luci-theme-endfield
fi
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
exit 0
EOF
		cat > "$THEME_PRERM" <<'EOF'
#!/bin/sh
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
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
exit 0
EOF
		chmod 0755 "$THEME_POSTINST" "$THEME_PRERM"

		APK_THEME_OUT="$OUT_DIR/luci-theme-endfield-$VERSION-r1.apk"
		"$APK_BIN" mkpkg \
			--files "$APK_THEME_ROOT" \
			--output "$APK_THEME_OUT" \
			--script "post-install:$THEME_POSTINST" \
			--script "pre-deinstall:$THEME_PRERM" \
			--info "name:luci-theme-endfield" \
			--info "version:${VERSION}-r1" \
			--info "arch:noarch" \
			--info "license:Apache-2.0" \
			--info "description:Endfield Industrial Theme for LuCI 25.12" \
			--info "url:https://github.com/HomoLand/luci-theme-endfield" \
			--info "depends:luci-base"
		printf '[pack-release] created %s\n' "$APK_THEME_OUT"

		APK_CONSOLE_ROOT="$TMP_WORK/apk-console-root"
		"$SCRIPT_DIR/stage-files.sh" --console-only "$APK_CONSOLE_ROOT"

		CONSOLE_POSTINST="$TMP_WORK/console-post-install"
		CONSOLE_PRERM="$TMP_WORK/console-pre-deinstall"
		cat > "$CONSOLE_POSTINST" <<'EOF'
#!/bin/sh
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1 || true
exit 0
EOF
		cat > "$CONSOLE_PRERM" <<'EOF'
#!/bin/sh
rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1 || true
exit 0
EOF
		chmod 0755 "$CONSOLE_POSTINST" "$CONSOLE_PRERM"

		APK_CONSOLE_OUT="$OUT_DIR/luci-app-endfield-console-$VERSION-r1.apk"
		"$APK_BIN" mkpkg \
			--files "$APK_CONSOLE_ROOT" \
			--output "$APK_CONSOLE_OUT" \
			--script "post-install:$CONSOLE_POSTINST" \
			--script "pre-deinstall:$CONSOLE_PRERM" \
			--info "name:luci-app-endfield-console" \
			--info "version:${VERSION}-r1" \
			--info "arch:noarch" \
			--info "license:Apache-2.0" \
			--info "description:Endfield Command Console for LuCI 25.12" \
			--info "url:https://github.com/HomoLand/luci-theme-endfield" \
			--info "depends:luci-base"
		printf '[pack-release] created %s\n' "$APK_CONSOLE_OUT"
	else
		printf '[pack-release] apk binary does not support mkpkg; skipping .apk\n'
	fi
fi
