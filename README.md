# luci-theme-endfield

An industrial LuCI 25.12 UI suite for **OpenWrt / ImmortalWrt 25.12.x**, inspired by the official *Arknights: Endfield* (`endfield.hypergryph.com`) visual language.

一套面向 **OpenWrt / ImmortalWrt 25.12.x** 的工业风 LuCI 主题与全景状态控制台套件，深度还原《明日方舟：终末地》官网视觉语法：**零外部 CDN、零私有硬编码、零后台守护进程**，即装即用。

---

## Packages Included / 包含组件

| Package | Path | Description |
| --- | --- | --- |
| **`luci-theme-endfield`** | `luci-theme-endfield/` | Universal zero-CDN LuCI 25.12 theme (`Endfield`, `EndfieldDark`, `EndfieldLight`) with collapsible rail, `Ctrl+K` command palette, standalone `sysauth` terminal, and OpenClash `.oc` theme bridge. |
| **`luci-app-endfield-console`** *(optional)* | `luci-app-endfield-console/` | iStoreOS-grade universal `ubus` Command Console (`admin/endfield`) with live CPU/memory/WAN sparklines, physical port telemetry, logical interface cards, auto-discovered installed services dock, storage mounts, and searchable active LAN clients. |

Both packages work independently or together. `luci-app-endfield-console` harmonizes with `luci-theme-endfield` CSS tokens (`--ef-*`) and falls back gracefully on Bootstrap or other LuCI themes.

---

## Visual & Technical Highlights / 核心特性

### 1. Official Endfield Visual Language (`luci-theme-endfield`)
- **Dual High-Contrast Industrial Palettes**:
  - **Light Mode (Gallery Architectural White)**: Crisp `#F6F7F9` topographic contour canvas, `#FFFFFF` elevated plates with `1px solid #E5E7EC` hairlines, `#191919` ink, and signature Endfield Yellow (`#FFE600`) structural highlights.
  - **Dark Mode (DIJIANG Telemetry HUD)**: Deep obsidian `#111318` crosshair coordinate canvas, `#191C23` / `#20242D` cards, `#FFFFFF` primary ink, and `#FFF000` / `#FFE600` primary rails.
- **Signature Micro-Motifs**: 2px tri-color spectrum top rules (`#FF2E93 → #00D4B4 → #FFE600`), 6×2 square dot-matrix stamps, `↘` diagonal telemetry badges, 45° hatched watermarks, and chamfered/corner-notched primary actions.
- **Collapsible Navigation Rail (`64px ↔ 236px`) & `Ctrl+K` Command Palette**: Dynamically indexes every installed LuCI route via `ui.menu.load()`, paired with `[` rail collapse, Light/Dark mode toggle, and keyboard quick jump (`Ctrl+K` / `⌘K`).
- **Native OpenClash `.oc` Variable Bridge**: Automatically adapts OpenClash `0.48.x` UI to Endfield Light & Dark modes when OpenClash is on its default `classic` theme (`html:root:not([data-oc-theme])` and `html:root[data-oc-theme="classic"]`), while respecting explicit user overrides inside OpenClash.
- **Zero External CDN Dependencies**: Loads completely offline over LAN with crisp tabular numerals and responsive mobile layout (`<= 860px`).
- **Clean LuCI 25.12 Compatibility**: Preserves native `cbi-tab` switching, unclipped `.cbi-progressbar` labels, clean `<select>` rendering without duplicate Chromium picker arrows, and overflow-safe `.table` controls.

### 2. Universal `ubus` Command Console (`luci-app-endfield-console`)
- **Zero Daemon, Pure Client-Side `ubus` RPC**: Queries standard OpenWrt / ImmortalWrt RPC endpoints (`system.board`, `system.info`, `luci.*`, `luci-rpc.*`, `network.interface.dump`) with `L.resolveDefault(..., null)` fallbacks so minimal or vanilla OpenWrt 25.12 routers never error out.
- **4-Column Live Telemetry Strip**: `01 // CPU & LOAD` (temperature badge + rolling SVG sparkline), `02 // MEMORY`, `03 // WAN UPLINK` (delta RX/TX throughput + dual-line SVG sparkline), and `04 // ACTIVE NODES` (online DHCP leases + conntrack count).
- **Physical Ports & Logical Interfaces**: Visual RJ45 port carrier/speed strip alongside dynamic WAN/WAN6/LAN/VPN logical interface cards.
- **Installed Services Quick-Launch Dock & Storage Mounts**: Auto-discovers installed LuCI menu apps (`services`, `vpn`, `docker`, `nas`, `statistics`) matched against `getInitList`, paired with segmented mount usage bars.
- **Searchable Active LAN Clients Table**: Real-time hostname / IPv4 / IPv6 / MAC filtering, `DHCP LEASES` vs `ALL HOSTS` view toggle, and DHCP lease countdown updated smoothly every 3 seconds via `poll.add(...)` without resetting search input.

---

## Quick Install / 快速安装

### Option A: Standalone Tarball (Any OpenWrt / ImmortalWrt 25.12 Router)

Download `luci-endfield-suite-<version>.tar.gz` (theme + console) or `luci-theme-endfield-<version>.tar.gz` (theme only) from [GitHub Releases](https://github.com/HomoLand/luci-theme-endfield/releases):

```sh
# 1. Full suite (theme + Command Console), keeping your current default theme:
tar -xzf luci-endfield-suite-*.tar.gz
sh luci-endfield-suite-*/scripts/install.sh

# Or install AND set Endfield as the active default LuCI theme:
sh luci-endfield-suite-*/scripts/install.sh --set-default

# 2. Theme-only archive (no Command Console):
tar -xzf luci-theme-endfield-*.tar.gz
sh luci-theme-endfield-*/scripts/install.sh --set-default

# Optional flags on install.sh:
#   --with-console   Install both theme and Command Console (default when console files are present)
#   --theme-only     Install only luci-theme-endfield
#   --console-only   Install only luci-app-endfield-console
```

Switch themes anytime under **System → System → Language and Style** (**Endfield** auto, **EndfieldDark**, or **EndfieldLight**), and access the Command Console under **Console** (`admin/endfield`).

> **Native OpenWrt 25.12 `.apk` packages**: If you build `.apk` packages via `scripts/pack-release.sh --apk-bin <host-apk>` or the OpenWrt SDK/Buildroot feed, install them directly with `apk add --allow-untrusted luci-theme-endfield-*.apk luci-app-endfield-console-*.apk`.

### Option B: Uninstall Cleanly / 干净卸载

```sh
# Removes both theme and console (reverts to Bootstrap if Endfield was active):
sh luci-endfield-suite-*/scripts/uninstall.sh

# Or remove only the Command Console while keeping the theme:
sh luci-endfield-suite-*/scripts/uninstall.sh --console-only
```

---

## OpenWrt / ImmortalWrt Feed & ImageBuilder Integration

### 1. OpenWrt SDK / Buildroot Feed
Add this repository to `feeds.conf.default`:

```text
src-git endfield https://github.com/HomoLand/luci-theme-endfield.git
```

Then update and select packages in `make menuconfig`:

```sh
./scripts/feeds update endfield
./scripts/feeds install -a -p endfield
# LuCI -> Themes -> luci-theme-endfield
# LuCI -> Applications -> luci-app-endfield-console
```

### 2. ImageBuilder `/rom` Overlay Staging
When building custom firmware images (such as [`HomoLand/homorouter-image`](https://github.com/HomoLand/homorouter-image)), stage files directly into your ImageBuilder `FILES` directory:

```sh
sh scripts/stage-files.sh --with-console /tmp/extra-files
# Or stage only one component:
# sh scripts/stage-files.sh --theme-only /tmp/extra-files
# sh scripts/stage-files.sh --console-only /tmp/extra-files
```

Build standalone release tarballs (and optional native `.apk` v3 packages when supplying an OpenWrt 25.12 host `apk` binary supporting `mkpkg`):

```sh
sh scripts/pack-release.sh --out-dir dist --version 0.2.0
# Optional native .apk output:
# sh scripts/pack-release.sh --out-dir dist --version 0.2.0 --apk-bin /path/to/staging_dir/host/bin/apk
```

---

## Repository Structure

```text
luci-theme-endfield/
├── .github/workflows/ci.yml          # Syntax, JSON, privacy guard & release CI
├── luci-theme-endfield/              # Universal LuCI 25.12 theme package
│   ├── Makefile
│   └── root/
├── luci-app-endfield-console/        # Universal ubus Command Console package
│   ├── Makefile
│   └── root/
├── scripts/
│   ├── stage-files.sh                # Overlay stager for ImageBuilder /rom
│   ├── install.sh                    # Standalone router installer
│   ├── uninstall.sh                  # Standalone router uninstaller
│   └── pack-release.sh               # Release .tar.gz / optional .apk packer
├── LICENSE                           # Apache-2.0
└── README.md
```

---

## License

Licensed under the [Apache License 2.0](LICENSE).
