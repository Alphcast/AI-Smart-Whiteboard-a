const fs = require('fs');
const path = require('path');

// 1. Patch vite-plugin-pwa for Vite 8 compatibility
const pwaTarget = path.resolve(__dirname, '../node_modules/vite-plugin-pwa/dist/index.js');
if (fs.existsSync(pwaTarget)) {
  let content = fs.readFileSync(pwaTarget, 'utf-8');
  let changed = false;

  if (content.includes('var require2 = createRequire(_dirname);')) {
    content = content.replace(
      'var require2 = createRequire(_dirname);',
      'var require2 = createRequire((_dirname && _dirname !== ".") ? _dirname : process.cwd());'
    );
    changed = true;
  }

  const brokenPkg = 'const { version } = JSON.parse(\n    readFileSync(resolve3(_dirname2, "../package.json"), "utf-8")\n  );';
  if (content.includes(brokenPkg)) {
    content = content.replace(
      brokenPkg,
      'let version = "2.0.0"; try { version = JSON.parse(readFileSync(resolve3(process.cwd(), "node_modules/vite-plugin-pwa/package.json"), "utf-8")).version; } catch {}'
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(pwaTarget, content);
    console.log('[patch-pwa] Successfully patched vite-plugin-pwa for Vite 8 compatibility.');
  }
}

// 2. Patch Vite client client.mjs to guard ws.send against undefined when websocket is not open
const viteClientTarget = path.resolve(__dirname, '../node_modules/vite/dist/client/client.mjs');
if (fs.existsSync(viteClientTarget)) {
  let clientContent = fs.readFileSync(viteClientTarget, 'utf-8');
  if (clientContent.includes('send(data) {\n\t\t\tws.send(JSON.stringify(data));\n\t\t}') ||
      clientContent.includes('send(data) { ws.send(JSON.stringify(data)); }') ||
      clientContent.includes('ws.send(JSON.stringify(data));')) {
    clientContent = clientContent.replace(
      'ws.send(JSON.stringify(data));',
      'if (ws && ws.readyState === 1) { ws.send(JSON.stringify(data)); }'
    );
    fs.writeFileSync(viteClientTarget, clientContent);
    console.log('[patch-pwa] Successfully patched Vite client.mjs ws.send guard.');
  }
}
