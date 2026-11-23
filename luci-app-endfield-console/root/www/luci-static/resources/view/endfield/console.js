'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require dom';
'require uci';

var MAX_SPARK_POINTS = 28;
var POLL_SECONDS = 3;

var callSystemBoard = rpc.declare({
	object: 'system',
	method: 'board',
	expect: { '': {} }
});

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info',
	expect: { '': {} }
});

var callCPUUsage = rpc.declare({
	object: 'luci',
	method: 'getCPUUsage',
	expect: { '': {} }
});

var callCPUInfo = rpc.declare({
	object: 'luci',
	method: 'getCPUInfo',
	expect: { '': {} }
});

var callTempInfo = rpc.declare({
	object: 'luci',
	method: 'getTempInfo',
	expect: { '': {} }
});

var callOnlineUsers = rpc.declare({
	object: 'luci',
	method: 'getOnlineUsers',
	expect: { '': {} }
});

var callMountPoints = rpc.declare({
	object: 'luci',
	method: 'getMountPoints',
	expect: { '': {} }
});

var callRealtimeStats = rpc.declare({
	object: 'luci',
	method: 'getRealtimeStats',
	params: ['mode', 'device'],
	expect: { '': {} }
});

var callConntrackList = rpc.declare({
	object: 'luci',
	method: 'getConntrackList',
	expect: { '': {} }
});

var callBuiltinEthernetPorts = rpc.declare({
	object: 'luci',
	method: 'getBuiltinEthernetPorts',
	expect: { '': {} }
});

var callInitList = rpc.declare({
	object: 'luci',
	method: 'getInitList',
	expect: { '': {} }
});

var callNetworkDevices = rpc.declare({
	object: 'luci-rpc',
	method: 'getNetworkDevices',
	expect: { '': {} }
});

var callDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	params: ['family'],
	expect: { '': {} }
});

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

var callNetworkInterfaces = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { '': {} }
});

var callRcList = rpc.declare({
	object: 'rc',
	method: 'list',
	expect: { '': {} }
});

var SERVICE_ALIASES = {
	upnp: ['miniupnpd', 'upnpd', 'upnp'],
	dockerman: ['dockerd', 'dockerman'],
	samba4: ['samba4', 'smbd'],
	ksmbd: ['ksmbd'],
	adguardhome: ['adguardhome'],
	openclash: ['openclash'],
	tailscale: ['tailscale'],
	ddns: ['ddns'],
	sqm: ['sqm'],
	smartdns: ['smartdns'],
	mosdns: ['mosdns'],
	aria2: ['aria2'],
	transmission: ['transmission'],
	ttyd: ['ttyd'],
	acme: ['acme'],
	zerotier: ['zerotier'],
	frp: ['frpc', 'frps'],
	minidlna: ['minidlna'],
	cloudflared: ['cloudflared']
};

var CORE_DAEMON_CATALOG = [
	{ key: 'adguardhome', title: 'AdGuard Home', category: 'DNS // AIC' },
	{ key: 'tailscale', title: 'Tailscale', category: 'TP // MESH' },
	{ key: 'zerotier', title: 'ZeroTier', category: 'TP // MESH' },
	{ key: 'dockerd', title: 'Docker Engine', category: 'AIC // RUNTIME' },
	{ key: 'smartdns', title: 'SmartDNS', category: 'DNS // AIC' },
	{ key: 'mosdns', title: 'MosDNS', category: 'DNS // AIC' },
	{ key: 'sqm', title: 'SQM QoS', category: 'RELAY // QOS' },
	{ key: 'samba4', title: 'SMB Depot', category: 'DEPOT // SMB' },
	{ key: 'ksmbd', title: 'KSMBD Depot', category: 'DEPOT // SMB' },
	{ key: 'cloudflared', title: 'Cloudflare Tunnel', category: 'TP // TUNNEL' },
	{ key: 'sing-box', title: 'sing-box', category: 'TP // PROXY' },
	{ key: 'mihomo', title: 'Mihomo', category: 'TP // PROXY' },
	{ key: 'dae', title: 'dae', category: 'TP // PROXY' },
	{ key: 'daed', title: 'daed', category: 'TP // PROXY' },
	{ key: 'ttyd', title: 'Web Terminal', category: 'OPS // TTY' },
	{ key: 'frpc', title: 'FRP Client', category: 'TP // TUNNEL' },
	{ key: 'frps', title: 'FRP Server', category: 'TP // TUNNEL' },
	{ key: 'aria2', title: 'Aria2', category: 'DEPOT // SYNC' },
	{ key: 'transmission', title: 'Transmission', category: 'DEPOT // SYNC' },
	{ key: 'acme', title: 'ACME Certs', category: 'SEC // TLS' }
];

function resolveProtocolUnit(board, sysInfo) {
	var b = board || {};
	var release = b.release || {};
	var rawModel = String(b.model || '').trim();
	var rawSystem = String(b.system || '').trim();
	var target = String(release.target || '').trim();
	var boardName = String(b.board_name || '').trim();

	var rawSummary = [rawModel, rawSystem, target].filter(Boolean).join(' · ');

	var combined = (rawModel + ' ' + boardName + ' ' + rawSystem).toLowerCase();
	var isVm = /(qemu|kvm|vmware|virtualbox|hyper-v|xen|bochs|standard pc|virtual machine|virtio)/i.test(combined);

	var pacClass = 'PAC-01';
	if (isVm) pacClass = 'PAC-VM';
	else if (/^x86\/64/i.test(target)) pacClass = 'PAC-X64';
	else if (/^x86/i.test(target)) pacClass = 'PAC-X86';
	else if (/(mediatek|filogic)/i.test(target)) pacClass = 'PAC-MTK';
	else if (/rockchip/i.test(target)) pacClass = 'PAC-RK';
	else if (/(qualcomm|ipq)/i.test(target)) pacClass = 'PAC-IPQ';
	else if (/(bcm|armsr|armvirt|mvebu|sunxi)/i.test(target)) pacClass = 'PAC-ARM';

	var cleanedModel = rawModel
		.replace(/\bto\s+be\s+filled\s+by\s+o\.?e\.?m\.?\b/gi, '')
		.replace(/\bdefault\s+string\b/gi, '')
		.replace(/\bsystem\s+(?:product\s+name|manufacturer|version)\b/gi, '')
		.replace(/\bnot\s+specified\b/gi, '')
		.replace(/\bstandard\s+pc\b.*$/gi, '')
		.replace(/\b(?:o\.e\.m\.|oem)\b/gi, '')
		.replace(/^[\s\-_/:,.]+|[\s\-_/:,.]+$/g, '')
		.replace(/\s{2,}/g, ' ');

	var isGenericModel = !cleanedModel ||
		/^(?:none|unknown|generic|default|router(?:[-_\s]?\d+g)?|soft[-_\s]?router|x86(?:[/_-]?64)?|mini[-_\s]?pc|pc|desktop|board|mainboard|motherboard|virtual(?:\s+machine)?|intel|amd)$/i.test(cleanedModel);

	var cleanCpu = rawSystem
		.replace(/\(R\)|\(TM\)|\(C\)/gi, '')
		.replace(/\b(?:CPU|Processor)\b/gi, '')
		.replace(/@\s*[\d.]+\s*[GM]Hz/gi, '')
		.replace(/\bwith\s+Radeon.*$/gi, '')
		.replace(/\brev\s+\d+.*$/gi, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
	if (/^(?:unknown|generic|\?|-)$/i.test(cleanCpu))
		cleanCpu = '';

	var display;
	if (!isGenericModel && !isVm) {
		display = 'PAC // ' + cleanedModel;
	} else if (cleanCpu) {
		display = pacClass + ' // ' + cleanCpu;
	} else if (target) {
		display = pacClass + ' // ' + target.toUpperCase();
	} else {
		display = pacClass + ' // TALOS-II';
	}

	return {
		display: display,
		rawTitle: rawSummary ? ('Raw DMI: ' + rawSummary) : display
	};
}

function classifyMountRole(mountPath) {
	if (mountPath === '/' || mountPath === '/overlay') return 'CORE OVERLAY';
	if (mountPath === '/boot') return 'BOOT LOADER';
	if (mountPath === '/tmp') return 'VOLATILE RAM';
	if (/^\/(?:mnt|data|opt|srv|media|vol)/i.test(mountPath)) return 'EXT DEPOT';
	return 'VOLUME';
}

function classifyIfaceRole(ifaceName, proto) {
	var n = String(ifaceName || '').toLowerCase();
	var p = String(proto || '').toLowerCase();
	if (/^wan/.test(n)) return 'UPLINK';
	if (/^lan/.test(n)) return 'GRID';
	if (/(tailscale|wireguard|^wg|vpn|zerotier|tun)/.test(n) || /(wireguard|tailscale|openvpn)/.test(p)) return 'TUNNEL';
	return '';
}

function netmaskToPrefix(mask) {
	if (mask == null || mask === '') return null;
	if (typeof mask === 'number' && isFinite(mask)) return String(mask);
	var s = String(mask).trim();
	if (/^\d+$/.test(s)) return s;
	if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) {
		var bits4 = 0;
		var parts4 = s.split('.');
		for (var i = 0; i < 4; i++) {
			var oct = parseInt(parts4[i], 10);
			if (!isFinite(oct) || oct < 0 || oct > 255) return null;
			while (oct > 0) { bits4 += (oct & 1); oct >>= 1; }
		}
		return String(bits4);
	}
	if (s.indexOf(':') !== -1) {
		var bits6 = 0;
		var segs = s.split(':');
		for (var j = 0; j < segs.length; j++) {
			if (!segs[j]) continue;
			var v = parseInt(segs[j], 16);
			if (!isFinite(v)) return null;
			while (v > 0) { bits6 += (v & 1); v >>= 1; }
		}
		return String(bits6);
	}
	return null;
}

function buildPacWatermarkSvg() {
	return svgEl('svg', {
		'class': 'efc-hero-reticle',
		'viewBox': '0 0 180 180',
		'fill': 'none',
		'aria-hidden': 'true'
	}, [
		svgEl('polygon', {
			'points': '90,10 159,50 159,130 90,170 21,130 21,50',
			'stroke': 'currentColor', 'stroke-width': '1.2'
		}),
		svgEl('polygon', {
			'points': '90,34 138,62 138,118 90,146 42,118 42,62',
			'stroke': 'currentColor', 'stroke-width': '1', 'stroke-dasharray': '4 4'
		}),
		svgEl('polygon', {
			'points': '90,62 114,76 114,104 90,118 66,104 66,76',
			'stroke': 'currentColor', 'stroke-width': '1.4'
		}),
		svgEl('line', { 'x1': '90', 'y1': '2', 'x2': '90', 'y2': '34', 'stroke': 'currentColor', 'stroke-width': '1' }),
		svgEl('line', { 'x1': '90', 'y1': '146', 'x2': '90', 'y2': '178', 'stroke': 'currentColor', 'stroke-width': '1' }),
		svgEl('line', { 'x1': '6', 'y1': '90', 'x2': '42', 'y2': '90', 'stroke': 'currentColor', 'stroke-width': '1' }),
		svgEl('line', { 'x1': '138', 'y1': '90', 'x2': '174', 'y2': '90', 'stroke': 'currentColor', 'stroke-width': '1' })
	]);
}

function ensureConsoleStylesheet() {
	if (document.querySelector('link[data-ef-console-css="1"], link[href*="endfield/console.css"]'))
		return;
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = '/luci-static/endfield/console.css?v=25.12-ef31';
	link.setAttribute('data-ef-console-css', '1');
	document.head.appendChild(link);
}

function svgEl(tag, attrs, children) {
	var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
	if (attrs) {
		Object.keys(attrs).forEach(function(k) {
			if (attrs[k] != null)
				el.setAttribute(k, String(attrs[k]));
		});
	}
	if (Array.isArray(children)) {
		children.forEach(function(c) {
			if (c) el.appendChild(c);
		});
	}
	return el;
}

function unwrapArray(res, key) {
	if (Array.isArray(res)) return res;
	if (res && key && Array.isArray(res[key])) return res[key];
	return [];
}

function unwrapMap(res, key) {
	if (res && key && L.isObject(res[key])) return res[key];
	if (L.isObject(res)) return res;
	return {};
}

function formatUptime(sec) {
	var s = Math.max(0, Math.floor(Number(sec) || 0));
	var days = Math.floor(s / 86400);
	var hours = Math.floor((s % 86400) / 3600);
	var mins = Math.floor((s % 3600) / 60);
	var secs = s % 60;
	if (days > 0)
		return '%dd %02dh %02dm'.format(days, hours, mins);
	return '%02dh %02dm %02ds'.format(hours, mins, secs);
}

function formatBytes(bytes) {
	var n = Number(bytes);
	if (!isFinite(n) || n < 0) return '0 B';
	if (n < 1024) return Math.round(n) + ' B';
	var units = ['KiB', 'MiB', 'GiB', 'TiB'];
	var val = n / 1024;
	var idx = 0;
	while (val >= 1024 && idx < units.length - 1) {
		val /= 1024;
		idx++;
	}
	return (val >= 100 ? val.toFixed(0) : (val >= 10 ? val.toFixed(1) : val.toFixed(2))) + ' ' + units[idx];
}

function formatRate(bytesPerSec) {
	var bps = Math.max(0, Number(bytesPerSec) || 0);
	if (bps < 1024)
		return Math.round(bps) + ' B/s';
	var kb = bps / 1024;
	if (kb < 1024)
		return (kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)) + ' KB/s';
	var mb = kb / 1024;
	if (mb < 1024)
		return (mb >= 100 ? mb.toFixed(0) : mb.toFixed(2)) + ' MB/s';
	var gb = mb / 1024;
	return gb.toFixed(2) + ' GB/s';
}

function formatMbps(bytesPerSec) {
	var mbps = (Math.max(0, Number(bytesPerSec) || 0) * 8) / 1000000;
	if (mbps < 0.1) return (mbps * 1000).toFixed(0) + ' Kbps';
	return (mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1)) + ' Mbps';
}

function formatLeaseRemaining(expires) {
	if (expires === false) return _('Unlimited');
	if (expires == null) return _('Static');
	var s = Math.floor(Number(expires));
	if (!isFinite(s)) return '-';
	if (s <= 0) return _('Expired');
	var h = Math.floor(s / 3600);
	var m = Math.floor((s % 3600) / 60);
	var sec = s % 60;
	if (h >= 24) {
		var d = Math.floor(h / 24);
		return '%dd %02dh'.format(d, h % 24);
	}
	if (h > 0) return '%02dh %02dm'.format(h, m);
	return '%02dm %02ds'.format(m, sec);
}

function parseCpuTelemetry(cpuUsageRes, sysInfo, cpuInfoRes) {
	var infoStr = (cpuInfoRes && typeof cpuInfoRes.cpuinfo === 'string') ? cpuInfoRes.cpuinfo : '';
	var loadArr = (sysInfo && Array.isArray(sysInfo.load)) ? sysInfo.load : [];
	var load1 = loadArr.length > 0 ? (Number(loadArr[0]) / 65536) : 0;
	var load5 = loadArr.length > 1 ? (Number(loadArr[1]) / 65536) : 0;
	var load15 = loadArr.length > 2 ? (Number(loadArr[2]) / 65536) : 0;

	var coreMatch = infoStr.match(/(\d+)\s*[cC]\b/);
	var cores = coreMatch ? Math.max(1, parseInt(coreMatch[1], 10)) : 1;

	var pct = null;
	var isLoadFallback = false;
	if (cpuUsageRes && cpuUsageRes.cpuusage != null && cpuUsageRes.cpuusage !== '') {
		var parsed = parseFloat(String(cpuUsageRes.cpuusage).replace('%', '').trim());
		if (isFinite(parsed))
			pct = Math.max(0, Math.min(100, Math.round(parsed)));
	}
	if (pct === null) {
		isLoadFallback = true;
		pct = Math.max(0, Math.min(100, Math.round((load1 / cores) * 100)));
	}

	return {
		pct: pct,
		isLoadFallback: isLoadFallback,
		load1: load1,
		load5: load5,
		load15: load15,
		infoStr: infoStr
	};
}

function parseTemperatureC(tempRes, cpuInfoStr) {
	var tempCandidates = [];
	if (tempRes) {
		if (typeof tempRes === 'number') tempCandidates.push(String(tempRes));
		else if (typeof tempRes === 'string') tempCandidates.push(tempRes);
		else if (L.isObject(tempRes)) {
			if (tempRes.tempinfo != null) tempCandidates.push(String(tempRes.tempinfo));
			Object.keys(tempRes).forEach(function(k) {
				if (k !== 'tempinfo' && tempRes[k] != null)
					tempCandidates.push(String(tempRes[k]));
			});
		}
	}

	var allCandidates = tempCandidates.slice();
	if (cpuInfoStr) allCandidates.push(cpuInfoStr);

	for (var i = 0; i < allCandidates.length; i++) {
		var m = allCandidates[i].match(/(-?\d+(?:\.\d+)?)\s*(?:°\s*C|℃|deg\s*C)/i);
		if (m) {
			var v = parseFloat(m[1]);
			if (isFinite(v) && v > -30 && v < 150) return v;
		}
	}

	for (var j = 0; j < tempCandidates.length; j++) {
		if (/^\s*-?\d+(?:\.\d+)?\s*$/.test(tempCandidates[j])) {
			var raw = parseFloat(tempCandidates[j]);
			if (isFinite(raw)) {
				if (raw > 1000) raw = raw / 1000;
				if (raw > -30 && raw < 150) return raw;
			}
		}
	}
	return null;
}

function createSegBar(pct, toneOverride) {
	var clamped = Math.max(0, Math.min(100, Number(pct) || 0));
	var filled = Math.round((clamped / 100) * 20);
	var tone = toneOverride || (clamped >= 90 ? 'danger' : (clamped >= 75 ? 'warn' : 'ok'));
	var segs = [];
	for (var i = 0; i < 20; i++) {
		segs.push(E('span', { 'class': 'efc-segbar-seg' + (i < filled ? ' on' : '') }));
	}
	return E('div', { 'class': 'efc-segbar', 'data-tone': tone }, segs);
}

function updateSegBar(barEl, pct) {
	if (!barEl) return;
	var clamped = Math.max(0, Math.min(100, Number(pct) || 0));
	var filled = Math.round((clamped / 100) * 20);
	var tone = clamped >= 90 ? 'danger' : (clamped >= 75 ? 'warn' : 'ok');
	barEl.setAttribute('data-tone', tone);
	var children = barEl.children;
	for (var i = 0; i < children.length; i++) {
		if (i < filled) children[i].classList.add('on');
		else children[i].classList.remove('on');
	}
}

function createDotMatrix() {
	var dots = [];
	for (var i = 0; i < 12; i++) dots.push(E('span'));
	return E('span', { 'class': 'efc-dotmatrix', 'aria-hidden': 'true' }, dots);
}

function renderSparkSvg(seriesList, maxFixed) {
	var w = 220;
	var h = 40;
	var padY = 4;
	var innerH = h - padY * 2;

	var peak = maxFixed || 1;
	seriesList.forEach(function(s) {
		s.values.forEach(function(v) {
			if (v > peak) peak = v;
		});
	});
	if (peak <= 0) peak = 1;

	var svg = svgEl('svg', {
		'class': 'efc-spark-svg',
		'viewBox': '0 0 ' + w + ' ' + h,
		'preserveAspectRatio': 'none'
	});

	// Midline guide
	svg.appendChild(svgEl('line', {
		'x1': 0, 'y1': (h / 2), 'x2': w, 'y2': (h / 2),
		'stroke': 'currentColor', 'stroke-opacity': '0.10',
		'stroke-width': '1', 'stroke-dasharray': '3 3',
		'vector-effect': 'non-scaling-stroke'
	}));

	seriesList.forEach(function(s) {
		var vals = s.values;
		if (!vals.length) return;
		var pts = [];
		var stepX = vals.length > 1 ? (w / (vals.length - 1)) : w;
		for (var i = 0; i < vals.length; i++) {
			var x = (i * stepX).toFixed(1);
			var norm = Math.max(0, Math.min(1, vals[i] / peak));
			var y = (padY + innerH * (1 - norm)).toFixed(1);
			pts.push(x + ',' + y);
		}
		if (s.fill) {
			var areaPts = '0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h;
			svg.appendChild(svgEl('polygon', {
				'points': areaPts,
				'fill': s.fill,
				'fill-opacity': s.fillOpacity != null ? s.fillOpacity : '0.16'
			}));
		}
		svg.appendChild(svgEl('polyline', {
			'points': pts.join(' '),
			'fill': 'none',
			'stroke': s.stroke,
			'stroke-width': '1.8',
			'stroke-linejoin': 'round',
			'stroke-linecap': 'round',
			'vector-effect': 'non-scaling-stroke'
		}));
		if (s.dot && vals.length) {
			var lastParts = pts[pts.length - 1].split(',');
			svg.appendChild(svgEl('circle', {
				'cx': lastParts[0],
				'cy': lastParts[1],
				'r': '2.4',
				'fill': s.dotFill || '#FFE600',
				'stroke': s.stroke,
				'stroke-width': '1.3',
				'vector-effect': 'non-scaling-stroke'
			}));
		}
	});

	return svg;
}

function buildRj45Icon() {
	return svgEl('svg', {
		'class': 'efc-rj45-svg',
		'viewBox': '0 0 36 30',
		'fill': 'none',
		'aria-hidden': 'true'
	}, [
		svgEl('rect', {
			'x': '2', 'y': '3', 'width': '32', 'height': '24', 'rx': '2',
			'stroke': 'currentColor', 'stroke-width': '1.8'
		}),
		svgEl('path', {
			'd': 'M9 21V11H13V8H23V11H27V21H9Z',
			'stroke': 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'miter'
		}),
		svgEl('line', { 'x1': '12', 'y1': '18', 'x2': '12', 'y2': '21', 'stroke': 'currentColor', 'stroke-width': '1.4' }),
		svgEl('line', { 'x1': '15', 'y1': '18', 'x2': '15', 'y2': '21', 'stroke': 'currentColor', 'stroke-width': '1.4' }),
		svgEl('line', { 'x1': '18', 'y1': '18', 'x2': '18', 'y2': '21', 'stroke': 'currentColor', 'stroke-width': '1.4' }),
		svgEl('line', { 'x1': '21', 'y1': '18', 'x2': '21', 'y2': '21', 'stroke': 'currentColor', 'stroke-width': '1.4' }),
		svgEl('line', { 'x1': '24', 'y1': '18', 'x2': '24', 'y2': '21', 'stroke': 'currentColor', 'stroke-width': '1.4' })
	]);
}

function buildMenuIndex(tree) {
	var paths = {};
	var apps = [];
	var adminNode = tree && tree.children ? tree.children.admin : null;

	function walk(node, prefix) {
		if (!node || !node.children) return;
		var children = ui.menu.getChildren(node);
		children.forEach(function(c) {
			var p = prefix ? (prefix + '/' + c.name) : c.name;
			paths[p] = c;
			walk(c, p);
		});
	}

	if (tree) walk(tree, '');

	var quickSpecs = [
		{ candidates: ['admin/status/overview'], fallback: _('Overview'), primary: true },
		{ candidates: ['admin/network/network'], fallback: _('Interfaces') },
		{ candidates: ['admin/network/firewall'], fallback: _('Firewall') },
		{ candidates: ['admin/system/package-manager', 'admin/system/opkg'], fallback: _('Software') },
		{ candidates: ['admin/system/flash'], fallback: _('Backup / Flash Firmware') }
	];

	var quickOps = [];
	quickSpecs.forEach(function(spec) {
		for (var i = 0; i < spec.candidates.length; i++) {
			var cand = spec.candidates[i];
			var node = paths[cand];
			if (node) {
				quickOps.push({
					label: node.title ? _(node.title) : spec.fallback,
					url: L.url(cand),
					primary: !!spec.primary
				});
				break;
			}
		}
	});

	var dockCats = ['services', 'vpn', 'docker', 'nas', 'statistics'];
	if (adminNode && adminNode.children) {
		dockCats.forEach(function(catName) {
			var catNode = adminNode.children[catName];
			if (!catNode) return;
			var items = ui.menu.getChildren(catNode);
			items.forEach(function(item) {
				if (!item || !item.title || !item.name) return;
				var hasAction = !!(item.action && item.action.type);
				var hasSub = ui.menu.getChildren(item).length > 0;
				if (!hasAction && !hasSub) return;
				apps.push({
					category: catName.toUpperCase(),
					name: item.name,
					title: _(item.title),
					url: L.url('admin', catName, item.name)
				});
			});
		});
	}

	return {
		quickOps: quickOps,
		apps: apps,
		startupUrl: paths['admin/system/startup'] ? L.url('admin', 'system', 'startup') : null
	};
}

function lookupServiceEntry(map, candidates, key) {
	if (!map) return null;
	for (var i = 0; i < candidates.length; i++) {
		if (map[candidates[i]])
			return map[candidates[i]];
	}
	if (key.length >= 3) {
		var keys = Object.keys(map);
		for (var j = 0; j < keys.length; j++) {
			var kLower = keys[j].toLowerCase();
			if (kLower.indexOf(key) === 0 || key.indexOf(kLower) === 0)
				return map[keys[j]];
		}
	}
	return null;
}

function resolveServiceState(appName, rcMap, initMap) {
	if (!appName) return { state: null, label: 'READY' };
	var key = String(appName).toLowerCase();
	var candidates = [key];
	if (SERVICE_ALIASES[key]) {
		SERVICE_ALIASES[key].forEach(function(a) {
			if (candidates.indexOf(a) === -1) candidates.push(a);
		});
	}

	var rcEntry = lookupServiceEntry(rcMap, candidates, key);
	if (rcEntry && typeof rcEntry.running === 'boolean') {
		return rcEntry.running
			? { state: 'running', label: 'ONLINE' }
			: { state: 'stopped', label: 'STANDBY' };
	}

	var initEntry = lookupServiceEntry(initMap, candidates, key);
	if (initEntry) {
		if (typeof initEntry.started === 'boolean') {
			return initEntry.started
				? { state: 'running', label: 'ONLINE' }
				: { state: 'stopped', label: 'STANDBY' };
		}
		return initEntry.enabled
			? { state: 'enabled', label: 'ENABLED' }
			: { state: 'disabled', label: 'DISABLED' };
	}

	return { state: null, label: 'READY' };
}

function collectMergedModules(menuApps, rcMap, initMap, startupUrl) {
	var list = (menuApps || []).slice();
	var covered = {};

	list.forEach(function(app) {
		var key = String(app.name || '').toLowerCase();
		if (key) covered[key] = true;
		if (SERVICE_ALIASES[key]) {
			SERVICE_ALIASES[key].forEach(function(a) { covered[a] = true; });
		}
	});

	CORE_DAEMON_CATALOG.forEach(function(spec) {
		if (covered[spec.key]) return;
		var hasRc = rcMap && rcMap[spec.key];
		var hasInit = initMap && initMap[spec.key];
		if (!hasRc && !hasInit) return;
		covered[spec.key] = true;
		list.push({
			category: spec.category,
			name: spec.key,
			title: spec.title,
			url: startupUrl || null,
			isDaemon: true
		});
	});

	return list;
}

function resolveWanSummary(ifaces, devices) {
	var wan4 = null;
	var wan6 = null;

	function hasDefaultRoute(ifc, target) {
		return Array.isArray(ifc.route) && ifc.route.some(function(r) {
			return r && r.target === target && Number(r.mask) === 0;
		});
	}

	for (var i = 0; i < ifaces.length; i++) {
		var ifc = ifaces[i];
		if (!ifc || ifc['interface'] === 'loopback') continue;
		if (!wan4 && ifc['interface'] === 'wan') wan4 = ifc;
		if (!wan6 && ifc['interface'] === 'wan6') wan6 = ifc;
		if (ifc.up && hasDefaultRoute(ifc, '0.0.0.0')) wan4 = ifc;
		if (ifc.up && hasDefaultRoute(ifc, '::')) wan6 = ifc;
	}

	if (!wan4) {
		for (var j = 0; j < ifaces.length; j++) {
			var cand = ifaces[j];
			if (cand && cand.up && cand['interface'] !== 'loopback' && cand['interface'] !== 'lan' &&
				Array.isArray(cand['ipv4-address']) && cand['ipv4-address'].length > 0) {
				wan4 = cand;
				break;
			}
		}
	}

	var devName = (wan4 && (wan4.l3_device || wan4.device)) ||
		(wan6 && (wan6.l3_device || wan6.device)) || '';
	var devObj = devName && devices ? devices[devName] : null;

	var ip4 = (wan4 && Array.isArray(wan4['ipv4-address']) && wan4['ipv4-address'][0])
		? wan4['ipv4-address'][0].address : '';

	var ip6 = '';
	var ip6Sources = [wan6, wan4];
	for (var s = 0; s < ip6Sources.length && !ip6; s++) {
		var src = ip6Sources[s];
		if (!src) continue;
		if (Array.isArray(src['ipv6-address']) && src['ipv6-address'].length) {
			var global6 = src['ipv6-address'].filter(function(a) {
				return a && a.address && !/^fe80:/i.test(a.address);
			})[0] || src['ipv6-address'][0];
			if (global6 && global6.address) ip6 = global6.address;
		} else if (Array.isArray(src['ipv6-prefix']) && src['ipv6-prefix'][0] && src['ipv6-prefix'][0].address) {
			ip6 = src['ipv6-prefix'][0].address + '/' + src['ipv6-prefix'][0].mask;
		}
	}

	return {
		ifaceName: (wan4 && wan4['interface']) || (wan6 && wan6['interface']) || 'wan',
		devName: devName,
		rxBytes: devObj && devObj.stats ? Number(devObj.stats.rx_bytes || 0) : 0,
		txBytes: devObj && devObj.stats ? Number(devObj.stats.tx_bytes || 0) : 0,
		ip4: ip4,
		ip6: ip6,
		up: !!(wan4 && wan4.up) || !!(wan6 && wan6.up)
	};
}

function resolvePhysicalPorts(builtinPorts, devices, ifaces) {
	var portMap = {};
	var order = [];

	function ensurePort(devName, role) {
		if (!devName || portMap[devName]) {
			if (portMap[devName] && role && role !== 'unknown' && portMap[devName].role === 'unknown')
				portMap[devName].role = role;
			return;
		}
		portMap[devName] = { device: devName, role: role || 'unknown' };
		order.push(devName);
	}

	builtinPorts.forEach(function(p) {
		if (p && p.device) ensurePort(p.device, p.role);
	});

	if (devices) {
		Object.keys(devices).forEach(function(name) {
			var d = devices[name];
			if (!d || d.wireless) return;
			if (/^(lo|br-|tailscale|tun|tap|wg|docker|veth|ifb|sit|gre|pppoe|utun|mihomo)/i.test(name)) return;
			if (name.indexOf('.') !== -1) return;
			if (d.devtype === 'ethernet' || /^(eth|lan|wan|enp|eno|ens|sfp|port)\d*/i.test(name)) {
				ensurePort(name, 'unknown');
			}
		});
	}

	order.sort(L.naturalCompare);

	// Build interface-to-device role hints
	var wanDevs = {};
	var lanDevs = {};
	ifaces.forEach(function(ifc) {
		if (!ifc || !ifc['interface']) return;
		var dname = ifc.l3_device || ifc.device || '';
		var base = dname.split('.')[0];
		if (/^wan/i.test(ifc['interface'])) {
			if (dname) wanDevs[dname] = true;
			if (base) wanDevs[base] = true;
		} else if (/^lan/i.test(ifc['interface'])) {
			if (dname) lanDevs[dname] = true;
			if (base) lanDevs[base] = true;
		}
	});

	return order.map(function(name) {
		var p = portMap[name];
		var dev = devices ? devices[name] : null;
		var link = (dev && L.isObject(dev.link)) ? dev.link : {};
		var carrier = (typeof link.carrier === 'boolean') ? link.carrier :
			(typeof (dev && dev.carrier) === 'boolean' ? dev.carrier : !!(dev && dev.up && (link.speed > 0 || (dev && dev.speed > 0))));
		var speed = Number(link.speed != null ? link.speed : (dev && dev.speed)) || 0;
		var duplex = link.duplex || (dev && dev.duplex) || '';
		var stats = (dev && dev.stats) ? dev.stats : {};

		var role = (p.role && p.role !== 'unknown') ? String(p.role).toUpperCase() : '';
		if (!role) {
			if (wanDevs[name] || /^wan/i.test(name)) role = 'WAN';
			else if (lanDevs[name] || (dev && dev.master && /^br-lan/i.test(dev.master)) || /^lan/i.test(name)) role = 'LAN';
			else role = 'PORT';
		}

		var speedLabel;
		if (!carrier && !(dev && dev.up && speed > 0)) {
			speedLabel = _('DOWN');
		} else if (speed >= 10000) {
			speedLabel = (speed / 1000).toFixed(speed % 1000 === 0 ? 0 : 1) + 'GbE';
		} else if (speed === 2500) {
			speedLabel = '2.5GbE';
		} else if (speed === 1000) {
			speedLabel = '1GbE';
		} else if (speed > 0) {
			speedLabel = speed + 'Mb/s';
		} else {
			speedLabel = carrier ? _('LINK UP') : _('DOWN');
		}
		if (carrier && duplex) {
			speedLabel += duplex === 'half' ? ' (H)' : ' (F)';
		}

		return {
			device: name,
			role: role,
			up: carrier || !!(dev && dev.up && speed > 0),
			speedLabel: speedLabel,
			rxBytes: Number(stats.rx_bytes || 0),
			txBytes: Number(stats.tx_bytes || 0)
		};
	});
}

function resolveStorageMounts(mountPoints, sysInfo) {
	var seen = {};
	var list = [];

	mountPoints.forEach(function(m) {
		if (!m || !m.mount || !m.size || m.size <= 0) return;
		if (m.mount === '/dev') return;
		if (m.mount === '/rom' && !m.avail && !m.free) return;
		if (!seen[m.mount] || m.size > seen[m.mount].size) {
			seen[m.mount] = m;
		}
	});

	// Avoid showing duplicate /overlay when / already reports the identical overlayfs
	if (seen['/'] && seen['/overlay'] &&
		seen['/'].size === seen['/overlay'].size &&
		seen['/'].avail === seen['/overlay'].avail) {
		delete seen['/overlay'];
	}

	Object.keys(seen).forEach(function(k) {
		var m = seen[k];
		var avail = m.avail != null ? Number(m.avail) : Number(m.free || 0);
		var size = Number(m.size || 0);
		var used = Math.max(0, size - avail);
		var pct = size > 0 ? Math.min(100, Math.round((used / size) * 100)) : 0;
		list.push({
			mount: m.mount,
			device: m.device || '',
			size: size,
			used: used,
			avail: avail,
			pct: pct
		});
	});

	if (!list.length && sysInfo) {
		if (sysInfo.root && sysInfo.root.total > 0) {
			var rTotal = sysInfo.root.total * 1024;
			var rUsed = (sysInfo.root.used || 0) * 1024;
			list.push({
				mount: '/',
				device: 'rootfs',
				size: rTotal,
				used: rUsed,
				avail: Math.max(0, rTotal - rUsed),
				pct: Math.round((rUsed / rTotal) * 100)
			});
		}
		if (sysInfo.tmp && sysInfo.tmp.total > 0) {
			var tTotal = sysInfo.tmp.total * 1024;
			var tUsed = (sysInfo.tmp.used || 0) * 1024;
			list.push({
				mount: '/tmp',
				device: 'tmpfs',
				size: tTotal,
				used: tUsed,
				avail: Math.max(0, tTotal - tUsed),
				pct: Math.round((tUsed / tTotal) * 100)
			});
		}
	}

	var priority = { '/': 0, '/overlay': 1, '/boot': 2, '/tmp': 3 };
	list.sort(function(a, b) {
		var pa = priority[a.mount] != null ? priority[a.mount] : 10;
		var pb = priority[b.mount] != null ? priority[b.mount] : 10;
		if (pa !== pb) return pa - pb;
		return L.naturalCompare(a.mount, b.mount);
	});

	return list;
}

function buildClientRows(leases4Res, leases6Res, hostHintsRaw) {
	var leases4 = unwrapArray(leases4Res, 'dhcp_leases');
	var leases6 = unwrapArray(leases6Res, 'dhcp6_leases');
	if (!leases6.length && leases4Res && Array.isArray(leases4Res.dhcp6_leases))
		leases6 = leases4Res.dhcp6_leases;

	var hintsByMac = {};
	if (L.isObject(hostHintsRaw)) {
		Object.keys(hostHintsRaw).forEach(function(mac) {
			hintsByMac[mac.toUpperCase()] = hostHintsRaw[mac];
		});
	}

	var seenLeaseKeys = {};
	var dhcpRows = [];

	leases4.forEach(function(l) {
		if (!l || !l.ipaddr) return;
		var mac = l.macaddr ? String(l.macaddr).toUpperCase() : '';
		var hint = mac ? hintsByMac[mac] : null;
		var name = (l.hostname && l.hostname !== '*') ? l.hostname : (hint && hint.name ? hint.name : '-');
		var ip6 = (hint && Array.isArray(hint.ip6addrs) && hint.ip6addrs[0]) ? hint.ip6addrs[0] : '';
		if (mac) seenLeaseKeys[mac] = true;
		seenLeaseKeys[l.ipaddr] = true;
		dhcpRows.push({
			hostname: name,
			ip4: l.ipaddr,
			ip6: ip6,
			mac: mac || '-',
			expires: l.expires,
			isDhcp: true
		});
	});

	leases6.forEach(function(l) {
		if (!l) return;
		var ip6 = Array.isArray(l.ip6addrs) ? l.ip6addrs[0] : (l.ip6addr || '');
		if (!ip6) return;
		var mac = l.macaddr ? String(l.macaddr).toUpperCase() : '';
		if (mac && seenLeaseKeys[mac]) {
			for (var i = 0; i < dhcpRows.length; i++) {
				if (dhcpRows[i].mac === mac && !dhcpRows[i].ip6) {
					dhcpRows[i].ip6 = ip6;
					return;
				}
			}
		}
		var hint = mac ? hintsByMac[mac] : null;
		var name = (l.hostname && l.hostname !== '*') ? l.hostname : (hint && hint.name ? hint.name : '-');
		if (mac) seenLeaseKeys[mac] = true;
		dhcpRows.push({
			hostname: name,
			ip4: '-',
			ip6: ip6,
			mac: mac || (l.duid ? String(l.duid).slice(0, 17) : '-'),
			expires: l.expires,
			isDhcp: true
		});
	});

	var allRows = dhcpRows.slice();
	Object.keys(hintsByMac).forEach(function(mac) {
		if (seenLeaseKeys[mac]) return;
		var h = hintsByMac[mac];
		if (!h) return;
		var ip4 = (Array.isArray(h.ipaddrs) && h.ipaddrs[0]) ? h.ipaddrs[0] : '';
		var ip6 = (Array.isArray(h.ip6addrs) && h.ip6addrs[0]) ? h.ip6addrs[0] : '';
		if (!ip4 && !ip6) return;
		allRows.push({
			hostname: h.name || '-',
			ip4: ip4 || '-',
			ip6: ip6 || '',
			mac: mac,
			expires: null,
			isDhcp: false
		});
	});

	return {
		dhcpRows: dhcpRows,
		allRows: allRows
	};
}

return view.extend({
	load: function() {
		ensureConsoleStylesheet();
		return Promise.all([
			L.resolveDefault(callSystemBoard(), null),
			L.resolveDefault(callSystemInfo(), null),
			L.resolveDefault(callCPUUsage(), null),
			L.resolveDefault(callCPUInfo(), null),
			L.resolveDefault(callTempInfo(), null),
			L.resolveDefault(callOnlineUsers(), null),
			L.resolveDefault(callMountPoints(), null),
			L.resolveDefault(callConntrackList(), null),
			L.resolveDefault(callBuiltinEthernetPorts(), null),
			L.resolveDefault(callInitList(), null),
			L.resolveDefault(callNetworkDevices(), null),
			L.resolveDefault(callDHCPLeases(4), null),
			L.resolveDefault(callDHCPLeases(6), null),
			L.resolveDefault(callHostHints(), null),
			L.resolveDefault(callNetworkInterfaces(), null),
			ui.menu.load().catch(function() { return null; }),
			L.resolveDefault(callRcList(), null)
		]).then(L.bind(function(res) {
			// Seed initial WAN sparkline from realtime stats if available
			var ifaces = unwrapArray(res[14], 'interface');
			var devices = unwrapMap(res[10], null);
			var wan = resolveWanSummary(ifaces, devices);
			if (!wan.devName)
				return { initial: res, realtime: null };
			return L.resolveDefault(callRealtimeStats('interface', wan.devName), null).then(function(rt) {
				return { initial: res, realtime: rt };
			});
		}, this));
	},

	initHistory: function(cpuPct, wan, realtimeRes) {
		this.cpuHistory = [];
		this.rxHistory = [];
		this.txHistory = [];
		for (var i = 0; i < MAX_SPARK_POINTS - 1; i++) {
			this.cpuHistory.push(cpuPct);
			this.rxHistory.push(0);
			this.txHistory.push(0);
		}
		this.cpuHistory.push(cpuPct);

		var rtRows = unwrapArray(realtimeRes, 'result');
		if (rtRows.length >= 2) {
			var computedRx = [];
			var computedTx = [];
			for (var j = 1; j < rtRows.length; j++) {
				var prev = rtRows[j - 1];
				var cur = rtRows[j];
				var dt = (cur[0] - prev[0]);
				if (dt > 0 && cur.length >= 4 && prev.length >= 4) {
					computedRx.push(Math.max(0, (cur[1] - prev[1]) / dt));
					computedTx.push(Math.max(0, (cur[3] - prev[3]) / dt));
				}
			}
			if (computedRx.length) {
				var tailRx = computedRx.slice(-MAX_SPARK_POINTS);
				var tailTx = computedTx.slice(-MAX_SPARK_POINTS);
				while (tailRx.length < MAX_SPARK_POINTS) {
					tailRx.unshift(0);
					tailTx.unshift(0);
				}
				this.rxHistory = tailRx;
				this.txHistory = tailTx;
			}
		}
		if (this.rxHistory.length < MAX_SPARK_POINTS) this.rxHistory.push(0);
		if (this.txHistory.length < MAX_SPARK_POINTS) this.txHistory.push(0);

		this.prevWanSample = {
			devName: wan.devName,
			rxBytes: wan.rxBytes,
			txBytes: wan.txBytes,
			ts: Date.now()
		};
	},

	render: function(payload) {
		ensureConsoleStylesheet();
		var res = payload.initial || [];
		var board = res[0] || {};
		var sysInfo = res[1] || {};
		var cpuUsage = res[2];
		var cpuInfo = res[3];
		var tempInfo = res[4];
		var onlineUsers = res[5];
		var mountPoints = res[6];
		var conntrack = res[7];
		var builtinPorts = res[8];
		var initList = res[9];
		var devices = res[10];
		var leases4 = res[11];
		var leases6 = res[12];
		var hostHints = res[13];
		var ifacesRaw = res[14];
		var menuTree = res[15];
		var rcList = res[16];

		var menuIndex = buildMenuIndex(menuTree);
		this.menuApps = menuIndex.apps;
		this.startupUrl = menuIndex.startupUrl;
		this.clientSearchQuery = '';
		this.clientFilterMode = 'dhcp';

		var cpuInit = parseCpuTelemetry(cpuUsage, sysInfo, cpuInfo);
		var wanInit = resolveWanSummary(unwrapArray(ifacesRaw, 'interface'), unwrapMap(devices, null));
		this.initHistory(cpuInit.pct, wanInit, payload.realtime);

		var hostname = board.hostname || 'OpenWrt';
		var release = board.release || {};
		var fwStr = [release.distribution || 'OpenWrt', release.version || ''].filter(Boolean).join(' ');
		var unitInfo = resolveProtocolUnit(board, sysInfo);
		var kernelStr = [board.kernel || '-', release.target || ''].filter(Boolean).join(' · ');

		this.els = {};

		// --- 1. Hero Banner ---
		var opButtons = menuIndex.quickOps.map(function(op) {
			return E('a', {
				'class': 'efc-op-btn' + (op.primary ? ' efc-op-btn--primary' : ''),
				'href': op.url
			}, [op.label, E('span', { 'aria-hidden': 'true' }, ['↗'])]);
		});

		this.els.uptimeChip = E('span', { 'class': 'efc-spec-value' }, [formatUptime(sysInfo.uptime)]);
		this.els.heroStatusBadge = E('span', { 'class': 'efc-online-badge' }, [
			E('span', { 'class': 'efc-online-dot' }),
			'[ PROTOSYNC · ONLINE ]'
		]);

		var heroEl = E('section', { 'class': 'efc-hero' }, [
			E('div', { 'class': 'efc-hero-spectrum' }),
			buildPacWatermarkSvg(),
			E('div', { 'class': 'efc-hero-watermark ef-only-light', 'aria-hidden': 'true' }, ['// TALOS-II']),
			E('div', { 'class': 'efc-hero-watermark ef-only-dark', 'aria-hidden': 'true' }, ['// DIJIANG']),
			E('div', { 'class': 'efc-hero-top' }, [
				E('div', { 'class': 'efc-hero-titles' }, [
					E('div', { 'class': 'efc-eyebrow-row' }, [
						E('span', { 'class': 'efc-eyebrow ef-only-light' }, ['// ENDFIELD INDUSTRIES · TALOS-II SURFACE GRID']),
						E('span', { 'class': 'efc-eyebrow ef-only-dark' }, ['// ENDFIELD INDUSTRIES · OMV DIJIANG ORBITAL HUD']),
						createDotMatrix()
					]),
					E('span', { 'class': 'efc-console-pill' }, ['↘ PAC // COMMAND CONSOLE']),
					E('div', { 'class': 'efc-hostname-row' }, [
						E('h2', { 'class': 'efc-hostname' }, [hostname]),
						this.els.heroStatusBadge
					])
				]),
				E('div', { 'class': 'efc-hero-pills' }, [
					E('div', { 'class': 'efc-sector-pill' }, [
						E('span', { 'class': 'efc-sector-pip' }),
						E('span', { 'class': 'ef-only-light' }, ['SECTOR // TALOS-II']),
						E('span', { 'class': 'ef-only-dark' }, ['ORBIT // OMV DIJIANG'])
					]),
					E('div', { 'class': 'efc-poll-pill' }, [
						E('span', { 'class': 'efc-online-dot' }),
						E('span', {}, ['PROTOSYNC // ' + POLL_SECONDS + 'S'])
					])
				])
			]),
			E('div', { 'class': 'efc-spec-chips' }, [
				E('div', { 'class': 'efc-spec-chip' }, [
					E('span', { 'class': 'efc-spec-label' }, ['PROTOCOL CORE']),
					E('span', { 'class': 'efc-spec-value', 'title': unitInfo.rawTitle }, [unitInfo.display])
				]),
				E('div', { 'class': 'efc-spec-chip' }, [
					E('span', { 'class': 'efc-spec-label' }, ['OS PROTOCOL']),
					E('span', { 'class': 'efc-spec-value', 'title': release.revision ? (fwStr + ' (' + release.revision + ')') : fwStr }, [fwStr])
				]),
				E('div', { 'class': 'efc-spec-chip' }, [
					E('span', { 'class': 'efc-spec-label' }, ['KERNEL // ARCH']),
					E('span', { 'class': 'efc-spec-value', 'title': kernelStr }, [kernelStr])
				]),
				E('div', { 'class': 'efc-spec-chip' }, [
					E('span', { 'class': 'efc-spec-label' }, ['SYNC UPTIME']),
					this.els.uptimeChip
				])
			]),
			opButtons.length ? E('div', { 'class': 'efc-quick-ops' }, [
				E('span', { 'class': 'efc-quick-label' }, ['DIRECTIVES //'])
			].concat(opButtons)) : E([])
		]);

		// --- 2. 4-Column Live Telemetry KPI Strip ---
		this.els.cpuBadge = E('span', { 'class': 'efc-kpi-badge', 'style': 'display:none' });
		this.els.cpuVal = E('div', { 'class': 'efc-kpi-value' }, ['0%']);
		this.els.cpuSub = E('div', { 'class': 'efc-kpi-sub' }, ['LOAD 0.00 · 0.00 · 0.00']);
		this.els.cpuSpark = E('div', { 'class': 'efc-spark-wrap' });

		this.els.memBadge = E('span', { 'class': 'efc-kpi-badge' }, ['0%']);
		this.els.memVal = E('div', { 'class': 'efc-kpi-value' }, ['0 / 0 GiB']);
		this.els.memBar = createSegBar(0);
		this.els.memSub = E('div', { 'class': 'efc-kpi-sub' }, ['CACHED 0 B · AVAIL 0 B']);

		this.els.wanBadge = E('span', { 'class': 'efc-kpi-badge' }, ['WAN']);
		this.els.wanRx = E('span', { 'class': 'efc-wan-num' }, ['0 B/s']);
		this.els.wanTx = E('span', { 'class': 'efc-wan-num' }, ['0 B/s']);
		this.els.wanSpark = E('div', { 'class': 'efc-spark-wrap' });
		this.els.wanSub = E('div', { 'class': 'efc-kpi-sub' }, ['IPv4 -']);

		this.els.nodesBadge = E('span', { 'class': 'efc-kpi-badge' }, ['LAN']);
		this.els.nodesVal = E('div', { 'class': 'efc-kpi-value' }, ['0']);
		this.els.nodesLeaseVal = E('span', {}, ['0']);
		this.els.nodesCtVal = E('span', {}, ['0']);

		var kpiGrid = E('section', { 'class': 'efc-kpi-grid' }, [
			E('div', { 'class': 'efc-kpi-card' }, [
				E('div', { 'class': 'efc-kpi-head' }, [
					E('span', { 'class': 'efc-kpi-code' }, ['01 // CORE OUTPUT']),
					this.els.cpuBadge
				]),
				E('div', { 'class': 'efc-kpi-main' }, [this.els.cpuVal]),
				this.els.cpuSpark,
				this.els.cpuSub
			]),
			E('div', { 'class': 'efc-kpi-card' }, [
				E('div', { 'class': 'efc-kpi-head' }, [
					E('span', { 'class': 'efc-kpi-code' }, ['02 // MEMORY BUFFER']),
					this.els.memBadge
				]),
				E('div', { 'class': 'efc-kpi-main' }, [this.els.memVal]),
				this.els.memBar,
				this.els.memSub
			]),
			E('div', { 'class': 'efc-kpi-card' }, [
				E('div', { 'class': 'efc-kpi-head' }, [
					E('span', { 'class': 'efc-kpi-code' }, ['03 // TELE-PROTOCOL']),
					this.els.wanBadge
				]),
				E('div', { 'class': 'efc-wan-rates' }, [
					E('div', { 'class': 'efc-wan-rate-row' }, [
						E('span', { 'class': 'efc-wan-dir efc-wan-dir--rx' }, ['RX ↓']),
						this.els.wanRx
					]),
					E('div', { 'class': 'efc-wan-rate-row' }, [
						E('span', { 'class': 'efc-wan-dir efc-wan-dir--tx' }, ['TX ↑']),
						this.els.wanTx
					])
				]),
				this.els.wanSpark,
				this.els.wanSub
			]),
			E('div', { 'class': 'efc-kpi-card' }, [
				E('div', { 'class': 'efc-kpi-head' }, [
					E('span', { 'class': 'efc-kpi-code' }, ['04 // PROTOCOL NODES']),
					this.els.nodesBadge
				]),
				E('div', { 'class': 'efc-kpi-main' }, [this.els.nodesVal]),
				E('div', { 'class': 'efc-node-split' }, [
					E('div', { 'class': 'efc-node-stat' }, [
						E('span', {}, ['DHCP LEASES']),
						this.els.nodesLeaseVal
					]),
					E('div', { 'class': 'efc-node-stat' }, [
						E('span', {}, ['FLOW TRACK']),
						this.els.nodesCtVal
					])
				]),
				E('div', { 'class': 'efc-kpi-sub' }, [_('Active Talos-II subnet terminals')])
			])
		]);

		// --- 3. Physical Relays & Protocol Interfaces Panel ---
		this.els.portsStrip = E('div', { 'class': 'efc-ports-strip' });
		this.els.ifacesGrid = E('div', { 'class': 'efc-ifaces-grid' });
		this.els.netMeta = E('span', { 'class': 'efc-panel-meta' }, ['0 RELAYS · 0 INTERFACES']);

		var netPanel = E('section', { 'class': 'efc-panel' }, [
			E('div', { 'class': 'efc-panel-head' }, [
				E('div', { 'class': 'efc-panel-title-wrap' }, [
					E('span', { 'class': 'efc-panel-code' }, ['RELAY //']),
					E('h3', { 'class': 'efc-panel-title' }, [_('Physical Relays & Protocol Interfaces')])
				]),
				this.els.netMeta
			]),
			this.els.portsStrip,
			this.els.ifacesGrid
		]);

		// --- 4. AIC Protocol Modules Dock + Depot Storage ---
		this.els.appsGrid = E('div', { 'class': 'efc-apps-grid' });
		this.els.appsMeta = E('span', { 'class': 'efc-panel-meta' }, ['0 MODULES']);
		this.els.mountsList = E('div', { 'class': 'efc-mounts-list' });
		this.els.mountsMeta = E('span', { 'class': 'efc-panel-meta' }, ['0 VOLUMES']);

		var dockSection = E('section', { 'class': 'efc-two-col' }, [
			E('div', { 'class': 'efc-panel' }, [
				E('div', { 'class': 'efc-panel-head' }, [
					E('div', { 'class': 'efc-panel-title-wrap' }, [
						E('span', { 'class': 'efc-panel-code' }, ['AIC //']),
						E('h3', { 'class': 'efc-panel-title' }, [_('Protocol Modules & Services')])
					]),
					this.els.appsMeta
				]),
				this.els.appsGrid
			]),
			E('div', { 'class': 'efc-panel' }, [
				E('div', { 'class': 'efc-panel-head' }, [
					E('div', { 'class': 'efc-panel-title-wrap' }, [
						E('span', { 'class': 'efc-panel-code' }, ['DEPOT //']),
						E('h3', { 'class': 'efc-panel-title' }, [_('Protocol Storage Volumes')])
					]),
					this.els.mountsMeta
				]),
				this.els.mountsList
			])
		]);

		// --- 5. Live Field Terminal Roster ---
		var self = this;
		this.els.searchInput = E('input', {
			'type': 'search',
			'class': 'efc-search-input',
			'placeholder': _('Search callsign, IP or MAC…'),
			'aria-label': _('Filter active terminals')
		});
		this.els.searchInput.addEventListener('input', function() {
			self.clientSearchQuery = (self.els.searchInput.value || '').trim().toLowerCase();
			self.renderClientsTable();
		});

		this.els.filterBtn = E('button', {
			'type': 'button',
			'class': 'efc-filter-btn',
			'click': function() {
				self.clientFilterMode = (self.clientFilterMode === 'dhcp') ? 'all' : 'dhcp';
				self.renderClientsTable();
			}
		}, ['DHCP LEASES']);

		this.els.clientsMeta = E('span', { 'class': 'efc-panel-meta' }, ['0 SHOWN']);
		this.els.clientsTbody = E('tbody');

		var clientsPanel = E('section', { 'class': 'efc-panel' }, [
			E('div', { 'class': 'efc-panel-head' }, [
				E('div', { 'class': 'efc-panel-title-wrap' }, [
					E('span', { 'class': 'efc-panel-code' }, ['FIELD //']),
					E('h3', { 'class': 'efc-panel-title' }, [_('Active Terminal Roster')]),
					this.els.clientsMeta
				]),
				E('div', { 'class': 'efc-clients-toolbar' }, [
					this.els.filterBtn,
					this.els.searchInput
				])
			]),
			E('div', { 'class': 'efc-table-wrap' }, [
				E('table', { 'class': 'efc-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, [_('Callsign / Hostname')]),
							E('th', {}, [_('IPv4 Address')]),
							E('th', {}, [_('IPv6 Address')]),
							E('th', {}, [_('MAC Address')]),
							E('th', {}, [_('Sync Lease')])
						])
					]),
					this.els.clientsTbody
				])
			])
		]);

		this.rootEl = E('div', { 'class': 'ef-console' }, [
			heroEl,
			kpiGrid,
			netPanel,
			dockSection,
			clientsPanel
		]);

		this.applyTelemetrySnapshot({
			sysInfo: sysInfo,
			cpuUsage: cpuUsage,
			cpuInfo: cpuInfo,
			tempInfo: tempInfo,
			onlineUsers: onlineUsers,
			mountPoints: mountPoints,
			conntrack: conntrack,
			builtinPorts: builtinPorts,
			initList: initList,
			devices: devices,
			leases4: leases4,
			leases6: leases6,
			hostHints: hostHints,
			ifacesRaw: ifacesRaw,
			rcList: rcList
		}, true);

		poll.add(L.bind(this.refreshTelemetry, this), POLL_SECONDS);

		return this.rootEl;
	},

	refreshTelemetry: function() {
		if (this._polling) return Promise.resolve();
		if (!this.rootEl || !document.body.contains(this.rootEl)) return Promise.resolve();
		this._polling = true;

		return Promise.all([
			L.resolveDefault(callSystemInfo(), null),
			L.resolveDefault(callCPUUsage(), null),
			L.resolveDefault(callCPUInfo(), null),
			L.resolveDefault(callTempInfo(), null),
			L.resolveDefault(callOnlineUsers(), null),
			L.resolveDefault(callMountPoints(), null),
			L.resolveDefault(callConntrackList(), null),
			L.resolveDefault(callBuiltinEthernetPorts(), null),
			L.resolveDefault(callInitList(), null),
			L.resolveDefault(callNetworkDevices(), null),
			L.resolveDefault(callDHCPLeases(4), null),
			L.resolveDefault(callDHCPLeases(6), null),
			L.resolveDefault(callHostHints(), null),
			L.resolveDefault(callNetworkInterfaces(), null),
			L.resolveDefault(callRcList(), null)
		]).then(L.bind(function(res) {
			if (!this.rootEl || !document.body.contains(this.rootEl)) return;
			this.applyTelemetrySnapshot({
				sysInfo: res[0] || {},
				cpuUsage: res[1],
				cpuInfo: res[2],
				tempInfo: res[3],
				onlineUsers: res[4],
				mountPoints: res[5],
				conntrack: res[6],
				builtinPorts: res[7],
				initList: res[8],
				devices: res[9],
				leases4: res[10],
				leases6: res[11],
				hostHints: res[12],
				ifacesRaw: res[13],
				rcList: res[14]
			}, false);
		}, this)).finally(L.bind(function() {
			this._polling = false;
		}, this));
	},

	applyTelemetrySnapshot: function(snap, isInitial) {
		var sysInfo = snap.sysInfo || {};
		var devices = unwrapMap(snap.devices, null);
		var ifaces = unwrapArray(snap.ifacesRaw, 'interface');

		// Uptime
		dom.content(this.els.uptimeChip, formatUptime(sysInfo.uptime));

		// 01 // CPU & LOAD
		var cpu = parseCpuTelemetry(snap.cpuUsage, sysInfo, snap.cpuInfo);
		var tempC = parseTemperatureC(snap.tempInfo, cpu.infoStr);
		if (!isInitial) {
			this.cpuHistory.push(cpu.pct);
			if (this.cpuHistory.length > MAX_SPARK_POINTS)
				this.cpuHistory.shift();
		}
		dom.content(this.els.cpuVal, cpu.isLoadFallback ? cpu.load1.toFixed(2) : (cpu.pct + '%'));
		dom.content(this.els.cpuSub, 'LOAD %.2f · %.2f · %.2f'.format(cpu.load1, cpu.load5, cpu.load15));
		if (tempC != null) {
			this.els.cpuBadge.style.display = '';
			this.els.cpuBadge.setAttribute('data-tone', tempC >= 80 ? 'danger' : (tempC >= 65 ? 'warn' : 'ok'));
			dom.content(this.els.cpuBadge, tempC.toFixed(1) + '°C');
		} else {
			this.els.cpuBadge.style.display = 'none';
		}
		dom.content(this.els.cpuSpark, renderSparkSvg([{
			values: this.cpuHistory,
			stroke: 'var(--efc-cpu-stroke)',
			fill: 'var(--efc-cpu-fill)',
			fillOpacity: 0.22,
			dot: true,
			dotFill: '#FFE600'
		}], 100));

		// 02 // MEMORY
		var mem = L.isObject(sysInfo.memory) ? sysInfo.memory : {};
		var memTotal = Number(mem.total || 0);
		var memAvail = mem.available != null ? Number(mem.available) :
			((mem.free != null ? Number(mem.free) : 0) + (mem.buffered != null ? Number(mem.buffered) : 0));
		var memUsed = Math.max(0, memTotal - memAvail);
		var memPct = memTotal > 0 ? Math.min(100, Math.round((memUsed / memTotal) * 100)) : 0;
		this.els.memBadge.setAttribute('data-tone', memPct >= 90 ? 'danger' : (memPct >= 75 ? 'warn' : 'ok'));
		dom.content(this.els.memBadge, memPct + '%');
		dom.content(this.els.memVal, formatBytes(memUsed) + ' / ' + formatBytes(memTotal));
		updateSegBar(this.els.memBar, memPct);
		dom.content(this.els.memSub, 'CACHED ' + formatBytes(mem.cached || 0) + ' · AVAIL ' + formatBytes(memAvail));

		// 03 // WAN UPLINK
		var wan = resolveWanSummary(ifaces, devices);
		var now = Date.now();
		var rxRate = 0;
		var txRate = 0;
		if (!isInitial && this.prevWanSample && this.prevWanSample.devName === wan.devName) {
			var dt = (now - this.prevWanSample.ts) / 1000;
			if (dt > 0.2) {
				rxRate = Math.max(0, (wan.rxBytes - this.prevWanSample.rxBytes) / dt);
				txRate = Math.max(0, (wan.txBytes - this.prevWanSample.txBytes) / dt);
			}
		} else if (isInitial && this.rxHistory.length) {
			rxRate = this.rxHistory[this.rxHistory.length - 1] || 0;
			txRate = this.txHistory[this.txHistory.length - 1] || 0;
		}
		if (!isInitial) {
			this.rxHistory.push(rxRate);
			this.txHistory.push(txRate);
			if (this.rxHistory.length > MAX_SPARK_POINTS) this.rxHistory.shift();
			if (this.txHistory.length > MAX_SPARK_POINTS) this.txHistory.shift();
		}
		this.prevWanSample = {
			devName: wan.devName,
			rxBytes: wan.rxBytes,
			txBytes: wan.txBytes,
			ts: now
		};

		this.els.wanBadge.setAttribute('data-tone', wan.up ? 'ok' : 'warn');
		dom.content(this.els.wanBadge, (wan.devName || wan.ifaceName).toUpperCase() + (wan.up ? '' : ' OFF'));
		if (this.els.heroStatusBadge) {
			this.els.heroStatusBadge.setAttribute('data-state', wan.up ? 'online' : 'local');
			dom.content(this.els.heroStatusBadge, [
				E('span', { 'class': 'efc-online-dot' }),
				wan.up ? '[ PROTOSYNC · ONLINE ]' : '[ PROTOSYNC · LOCAL ]'
			]);
		}
		dom.content(this.els.wanRx, formatRate(rxRate) + ' (' + formatMbps(rxRate) + ')');
		dom.content(this.els.wanTx, formatRate(txRate) + ' (' + formatMbps(txRate) + ')');
		dom.content(this.els.wanSpark, renderSparkSvg([
			{ values: this.rxHistory, stroke: 'var(--efc-rx)', fill: 'var(--efc-rx)', fillOpacity: 0.14 },
			{ values: this.txHistory, stroke: 'var(--efc-tx)', fill: 'var(--efc-tx)', fillOpacity: 0.10 }
		], 1024));
		var wanText = 'IPv4 ' + (wan.ip4 || '-') + (wan.ip6 ? (' · v6 ' + wan.ip6) : '');
		this.els.wanSub.setAttribute('title', wanText);
		dom.content(this.els.wanSub, wanText);

		// 04 // PROTOCOL NODES
		var clientData = buildClientRows(snap.leases4, snap.leases6, snap.hostHints);
		this.latestClients = clientData;
		if (isInitial && clientData.dhcpRows.length === 0 && clientData.allRows.length > 0)
			this.clientFilterMode = 'all';

		var ctArr = unwrapArray(snap.conntrack, 'result');
		var onlineVal = (snap.onlineUsers && typeof snap.onlineUsers.onlineusers === 'number')
			? snap.onlineUsers.onlineusers
			: clientData.dhcpRows.length;
		dom.content(this.els.nodesVal, String(onlineVal));
		dom.content(this.els.nodesLeaseVal, String(clientData.dhcpRows.length));
		dom.content(this.els.nodesCtVal, String(ctArr.length));
		this.els.nodesBadge.setAttribute('data-tone', 'ok');
		dom.content(this.els.nodesBadge, clientData.allRows.length + ' REGISTERED');

		// Physical Relays + Protocol Interfaces
		var ports = resolvePhysicalPorts(unwrapArray(snap.builtinPorts, 'result'), devices, ifaces);
		var visibleIfaces = ifaces.filter(function(ifc) {
			return ifc && ifc['interface'] && ifc['interface'] !== 'loopback';
		});
		dom.content(this.els.netMeta, ports.length + ' RELAYS · ' + visibleIfaces.length + ' INTERFACES');

		dom.content(this.els.portsStrip, ports.length ? ports.map(function(p, idx) {
			var relayCode = 'R-' + String(idx + 1).padStart(2, '0');
			return E('div', { 'class': 'efc-port-card' + (p.up ? ' is-up' : '') }, [
				E('div', { 'class': 'efc-port-top' }, [
					E('span', { 'class': 'efc-port-id' }, [
						E('span', { 'class': 'efc-port-led' }),
						p.device
					]),
					E('span', { 'class': 'efc-port-badges' }, [
						E('span', { 'class': 'efc-port-idx' }, [relayCode]),
						E('span', { 'class': 'efc-port-role', 'data-role': p.role }, [p.role])
					])
				]),
				E('div', { 'class': 'efc-port-visual' }, [
					buildRj45Icon(),
					E('div', { 'style': 'min-width:0;flex:1;' }, [
						E('div', { 'class': 'efc-port-speed' }, [p.speedLabel]),
						E('div', { 'class': 'efc-port-bytes' }, [
							E('span', { 'class': 'efc-port-byte-row' }, ['↓ ' + formatBytes(p.rxBytes)]),
							E('span', { 'class': 'efc-port-byte-row' }, ['↑ ' + formatBytes(p.txBytes)])
						])
					])
				])
			]);
		}) : E('div', { 'class': 'efc-empty' }, [_('// NO PHYSICAL RELAYS REPORTED')]));

		dom.content(this.els.ifacesGrid, visibleIfaces.length ? visibleIfaces.map(function(ifc) {
			var devLabel = ifc.l3_device || ifc.device || '-';
			var devObj = (devLabel && devLabel !== '-' && devices && devices[devLabel]) ? devices[devLabel] : null;
			var ip4s = Array.isArray(ifc['ipv4-address']) ? ifc['ipv4-address'].map(function(a) {
				return a.address + '/' + a.mask;
			}) : [];
			var ip6s = Array.isArray(ifc['ipv6-address']) ? ifc['ipv6-address'].map(function(a) {
				return a.address + '/' + a.mask;
			}) : [];
			var pds = Array.isArray(ifc['ipv6-prefix']) ? ifc['ipv6-prefix'].map(function(p) {
				return p.address + '/' + p.mask;
			}) : [];
			if (!ip4s.length && devObj && Array.isArray(devObj.ipaddrs)) {
				ip4s = devObj.ipaddrs.map(function(a) {
					if (!a || !a.address) return '';
					var cidr = netmaskToPrefix(a.mask != null ? a.mask : a.netmask);
					return cidr != null ? (a.address + '/' + cidr) : a.address;
				}).filter(Boolean);
			}
			if (!ip6s.length && devObj && Array.isArray(devObj.ip6addrs)) {
				ip6s = devObj.ip6addrs.map(function(a) {
					if (!a || !a.address) return '';
					var cidr = netmaskToPrefix(a.mask != null ? a.mask : a.netmask);
					return cidr != null ? (a.address + '/' + cidr) : a.address;
				}).filter(Boolean);
			}
			var ip6Display = pds[0] || ip6s.filter(function(x) { return !/^fe80:/i.test(x); })[0] || ip6s[0] || '-';
			var roleTag = classifyIfaceRole(ifc['interface'], ifc.proto);

			var badgeChildren = [];
			if (roleTag) {
				badgeChildren.push(E('span', { 'class': 'efc-tag efc-tag--role' }, [roleTag]));
			}
			badgeChildren.push(E('span', { 'class': 'efc-tag' }, [String(ifc.proto || 'none').toUpperCase()]));
			badgeChildren.push(E('span', { 'class': 'efc-tag ' + (ifc.up ? 'efc-tag--up' : 'efc-tag--down') }, [ifc.up ? 'UP' : 'DOWN']));

			return E('div', { 'class': 'efc-iface-card' + (ifc.up ? ' is-up' : '') }, [
				E('div', { 'class': 'efc-iface-head' }, [
					E('span', { 'class': 'efc-iface-name' }, [ifc['interface']]),
					E('div', { 'class': 'efc-iface-badges' }, badgeChildren)
				]),
				E('div', { 'class': 'efc-iface-rows' }, [
					E('div', { 'class': 'efc-iface-row' }, [
						E('span', { 'class': 'efc-iface-row-k' }, ['DEV']),
						E('span', { 'class': 'efc-iface-row-v', 'title': devLabel }, [devLabel])
					]),
					E('div', { 'class': 'efc-iface-row' }, [
						E('span', { 'class': 'efc-iface-row-k' }, ['IPv4']),
						E('span', { 'class': 'efc-iface-row-v', 'title': ip4s.join(', ') || '-' }, [ip4s[0] || '-'])
					]),
					E('div', { 'class': 'efc-iface-row' }, [
						E('span', { 'class': 'efc-iface-row-k' }, ['IPv6']),
						E('span', { 'class': 'efc-iface-row-v', 'title': pds.concat(ip6s).join(', ') || '-' }, [ip6Display])
					]),
					E('div', { 'class': 'efc-iface-row' }, [
						E('span', { 'class': 'efc-iface-row-k' }, ['UPTIME']),
						E('span', { 'class': 'efc-iface-row-v' }, [ifc.up && ifc.uptime != null ? formatUptime(ifc.uptime) : '-'])
					])
				])
			]);
		}) : E('div', { 'class': 'efc-empty' }, [_('// NO PROTOCOL INTERFACES REPORTED')]));

		// AIC Protocol Modules Dock (LuCI Menu Apps + Headless Core Daemons)
		var rcMap = unwrapMap(snap.rcList, 'result');
		var initMap = unwrapMap(snap.initList, 'result');
		var apps = collectMergedModules(this.menuApps, rcMap, initMap, this.startupUrl);
		dom.content(this.els.appsMeta, apps.length + ' MODULES');
		dom.content(this.els.appsGrid, apps.length ? apps.map(function(app) {
			var svc = resolveServiceState(app.name, rcMap, initMap);
			var pillAttrs = { 'class': 'efc-app-status' };
			if (svc.state) pillAttrs['data-state'] = svc.state;
			var cardTag = app.url ? 'a' : 'div';
			var cardAttrs = {
				'class': 'efc-app-card' + (app.isDaemon ? ' is-daemon' : ''),
				'title': app.isDaemon ? ('Daemon: /etc/init.d/' + app.name) : app.title
			};
			if (app.url) cardAttrs['href'] = app.url;

			return E(cardTag, cardAttrs, [
				E('div', { 'class': 'efc-app-top' }, [
					E('span', { 'class': 'efc-app-cat' }, [app.category]),
					E('span', pillAttrs, [svc.label])
				]),
				E('div', { 'class': 'efc-app-name-row' }, [
					E('span', { 'class': 'efc-app-name', 'title': app.title }, [app.title]),
					E('span', { 'class': 'efc-app-arrow', 'aria-hidden': 'true' }, [app.url ? '↗' : '◆'])
				])
			]);
		}) : E('div', { 'class': 'efc-empty' }, [_('// NO OPTIONAL AIC MODULES DEPLOYED')]));

		// Depot Storage Volumes
		var mounts = resolveStorageMounts(unwrapArray(snap.mountPoints, 'result'), sysInfo);
		dom.content(this.els.mountsMeta, mounts.length + ' VOLUMES');
		dom.content(this.els.mountsList, mounts.length ? mounts.map(function(m) {
			return E('div', { 'class': 'efc-mount-item' }, [
				E('div', { 'class': 'efc-mount-top' }, [
					E('span', { 'class': 'efc-mount-head-left' }, [
						E('span', { 'class': 'efc-mount-path' }, [m.mount]),
						E('span', { 'class': 'efc-mount-role' }, [classifyMountRole(m.mount)])
					]),
					E('span', { 'class': 'efc-mount-dev', 'title': m.device }, [m.device])
				]),
				createSegBar(m.pct),
				E('div', { 'class': 'efc-mount-stats' }, [
					E('span', {}, [formatBytes(m.used) + ' / ' + formatBytes(m.size)]),
					E('span', {}, [m.pct + '%'])
				])
			]);
		}) : E('div', { 'class': 'efc-empty' }, [_('// NO DEPOT VOLUMES MOUNTED')]));

		// Active Terminal Roster (preserves search input & mode!)
		this.renderClientsTable();
	},

	renderClientsTable: function() {
		var data = this.latestClients || { dhcpRows: [], allRows: [] };
		var sourceRows = (this.clientFilterMode === 'all') ? data.allRows : data.dhcpRows;

		dom.content(this.els.filterBtn,
			this.clientFilterMode === 'all'
				? ('ALL TERMINALS (' + data.allRows.length + ')')
				: ('DHCP LEASES (' + data.dhcpRows.length + ')')
		);

		var q = this.clientSearchQuery || '';
		var filtered = q ? sourceRows.filter(function(r) {
			return r.hostname.toLowerCase().indexOf(q) !== -1 ||
				r.ip4.toLowerCase().indexOf(q) !== -1 ||
				(r.ip6 && r.ip6.toLowerCase().indexOf(q) !== -1) ||
				r.mac.toLowerCase().indexOf(q) !== -1;
		}) : sourceRows;

		dom.content(this.els.clientsMeta, filtered.length + ' / ' + sourceRows.length + ' ACTIVE');

		if (!filtered.length) {
			dom.content(this.els.clientsTbody, E('tr', {}, [
				E('td', { 'colspan': '5', 'style': 'text-align:center;color:var(--efc-ink-muted);padding:18px;font-family:var(--efc-font-mono);' }, [
					q ? _('// NO MATCHING TERMINALS IN SECTOR') : _('// NO ACTIVE TERMINALS DETECTED')
				])
			]));
			return;
		}

		dom.content(this.els.clientsTbody, filtered.map(function(r) {
			var hasName = r.hostname && r.hostname !== '-' && r.hostname !== '*';
			return E('tr', {}, [
				E('td', {}, [
					hasName
						? r.hostname
						: E('span', { 'class': 'efc-unit-anon' }, ['UNIDENTIFIED UNIT'])
				]),
				E('td', { 'class': 'efc-mono' }, [r.ip4 || '-']),
				E('td', { 'class': 'efc-mono' }, [r.ip6 || '-']),
				E('td', { 'class': 'efc-mono' }, [r.mac || '-']),
				E('td', { 'class': 'efc-mono' }, [formatLeaseRemaining(r.expires)])
			]);
		}));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
