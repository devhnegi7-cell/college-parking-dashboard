import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

const [html, css, js, worker] = await Promise.all(
  ['web/index.html', 'web/design.css', 'web/dashboard.js', 'worker/index.js'].map(path => readFile(path, 'utf8'))
);
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js',
  'const page = ' + JSON.stringify(html) + ';\nconst stylesheet = ' + JSON.stringify(css)
  + ';\nconst client = ' + JSON.stringify(js) + ';\n' + worker);
try {
  await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
