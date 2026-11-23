include $(TOPDIR)/rules.mk

LUCI_TITLE:=Endfield Command Console for LuCI 25.12
LUCI_DESCRIPTION:=Universal ubus-driven gateway command console companion for LuCI 25.12
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all
PKG_VERSION:=0.3.2
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

define Package/luci-app-endfield-console/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
	[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1 || true
	exit 0
}
endef

define Package/luci-app-endfield-console/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
	[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1 || true
	exit 0
}
endef

define Package/luci-app-endfield-console/install
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-endfield-console.json $(1)/usr/share/luci/menu.d/luci-app-endfield-console.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-endfield-console.json $(1)/usr/share/rpcd/acl.d/luci-app-endfield-console.json
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/endfield
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/endfield/console.js $(1)/www/luci-static/resources/view/endfield/console.js
	$(INSTALL_DIR) $(1)/www/luci-static/endfield
	$(INSTALL_DATA) ./root/www/luci-static/endfield/console.css $(1)/www/luci-static/endfield/console.css
endef

# call BuildPackage - OpenWrt buildroot signature
