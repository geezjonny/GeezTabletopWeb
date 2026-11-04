import {readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){const entries=await readdir(path.join(root,dir),{withFileTypes:true});const groups=await Promise.all(entries.filter(e=>e.name!=='manifest.json').map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]));return groups.flat();}
await writeFile(path.join(root,'assets/manifest.json'),JSON.stringify((await walk('assets')).sort(),null,2)+'\n');
