#!/usr/bin/env python3
# Fügt tools/cp-sim-ui.js in das Sim-EFB-Modul (community/cockpit-efb-link) ein und erneuert layout.json / manifest.json.
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, 'community', 'cockpit-efb-link')
JS = os.path.join(PKG, 'html_ui/efb_ui/efb_apps/CockpitEfbLink/CockpitEfbLink.js')
ver = sys.argv[1] if len(sys.argv) > 1 else '0.8.0'
src = open(os.path.join(ROOT, 'tools', 'cp-sim-ui.js'), encoding='utf-8').read().replace("if (typeof module !== 'undefined') module.exports = { mountCopilotUi: mountCopilotUi };\n", '')
js = open(JS, encoding='utf-8').read()
js = re.sub(r'/\*CPUI-BEGIN\*/.*?/\*CPUI-END\*/\n', '', js, flags=re.S)
js = re.sub(r'/\* Cockpit EFB Link [\d.]+', '/* Cockpit EFB Link ' + ver, js, count=1)
js = re.sub(r'var VERSION = "[\d.]+";', 'var VERSION = "' + ver + '";', js, count=1)
marker = '  var status = import_msfs_sdk2.Subject.create('
assert marker in js
js = js.replace(marker, '/*CPUI-BEGIN*/\n' + src + '\n/*CPUI-END*/\n' + marker, 1)
# Ansicht: Status oben, darunter die Copilot-Einstellungen
a = js.index('  class CockpitLinkView extends AppView {'); b = js.index('  class CockpitLinkApp extends App {')
view = '''  class CockpitLinkView extends AppView {
    constructor(props) {
      super(props);
      this.cpRef = import_msfs_sdk2.FSComponent.createRef();
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        style: "background: #0b0f13; height: 100%; box-sizing: border-box; overflow: hidden;"
      }, /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        style: "padding: 10px 34px 0; font-size: 18px; color: #3be26a; background: #0b0f13;"
      }, status), /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        ref: this.cpRef,
        style: "height: calc(100% - 40px);"
      }));
    }
    onAfterRender(node) {
      try { super.onAfterRender(node); } catch (e) { }
      try { mountCopilotUi(this.cpRef.instance, BRIDGE, remoteLog); } catch (e) { remoteLog(`Copilot-Seite: ${e}`); }
    }
  }
'''
js = js[:a] + view + js[b:]
open(JS, 'w', encoding='utf-8').write(js)
# layout.json + manifest.json
lay = os.path.join(PKG, 'layout.json'); L = json.load(open(lay)); total = 0
for c in L['content']:
    f = os.path.join(PKG, c['path']); c['size'] = os.path.getsize(f); total += c['size']
json.dump(L, open(lay, 'w'), separators=(',', ':'))
man = os.path.join(PKG, 'manifest.json'); M = json.load(open(man)); M['package_version'] = ver; M['total_package_size'] = total
json.dump(M, open(man, 'w'), separators=(',', ':'))
print('ok', ver, total)
