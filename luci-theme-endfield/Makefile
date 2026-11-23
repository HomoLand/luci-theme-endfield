include $(TOPDIR)/rules.mk

LUCI_TITLE:=Endfield Industrial Theme for LuCI 25.12
LUCI_PKGARCH:=all
PKG_VERSION:=0.2.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

define Package/luci-theme-endfield/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	sh /etc/uci-defaults/35_luci-theme-endfield && rm -f /etc/uci-defaults/35_luci-theme-endfield
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
	exit 0
}
endef

define Package/luci-theme-endfield/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	cur="$$(uci -q get luci.main.mediaurlbase || true)"
	case "$$cur" in
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
}
endef

define Package/luci-theme-endfield/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/35_luci-theme-endfield $(1)/etc/uci-defaults/35_luci-theme-endfield
	$(INSTALL_DIR) $(1)/usr/share/ucode/luci/template/themes/endfield
	$(CP) ./root/usr/share/ucode/luci/template/themes/endfield/* $(1)/usr/share/ucode/luci/template/themes/endfield/
	ln -snf endfield $(1)/usr/share/ucode/luci/template/themes/endfield-dark
	ln -snf endfield $(1)/usr/share/ucode/luci/template/themes/endfield-light
	$(INSTALL_DIR) $(1)/www/luci-static/endfield
	$(CP) ./root/www/luci-static/endfield/* $(1)/www/luci-static/endfield/
	ln -snf endfield $(1)/www/luci-static/endfield-dark
	ln -snf endfield $(1)/www/luci-static/endfield-light
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/endfield
	$(INSTALL_DATA) ./root/www/luci-static/resources/menu-endfield.js $(1)/www/luci-static/resources/menu-endfield.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/endfield/sysauth.js $(1)/www/luci-static/resources/view/endfield/sysauth.js
endef

# call BuildPackage - OpenWrt buildroot signature
