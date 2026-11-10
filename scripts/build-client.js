const path = require('path');
const { build } = require('esbuild');

build({
  entryPoints: [path.join(__dirname, '..', 'src', 'neon-auth-client.js')],
  outfile: path.join(__dirname, '..', 'public', 'js', 'neon-auth-client.bundle.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
