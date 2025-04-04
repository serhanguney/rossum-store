import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import path from 'path';
import fs from 'fs';
import { builtinModules } from 'module';

const extensionsDir = 'src/extensions';

if (!fs.existsSync(extensionsDir)) {
  console.error(`Directory "${extensionsDir}" not found.`);
  process.exit(1);
}

// Get all subdirectories inside `src/extensions/`
const extensions = fs.readdirSync(extensionsDir).filter((dir) => {
  const fullPath = path.join(extensionsDir, dir);
  return (
    fs.statSync(fullPath).isDirectory() &&
    fs.existsSync(path.join(fullPath, 'index.ts'))
  );
});

// Only Node.js built-ins will be external
const externalModules = builtinModules;

export default extensions.map((extension) => ({
  input: `src/extensions/${extension}/index.ts`,
  output: {
    file: `dist/${extension}/code.cjs`,
    format: 'cjs',
    exports: 'auto',
  },
  external: externalModules,
  plugins: [
    resolve({
      preferBuiltins: true,
    }),
    commonjs(),
    typescript(),
    json(),
    terser({
      format: {
        comments: false,
      },
      compress: {
        passes: 2,
        drop_console: true,
      },
    }),
  ],
  // Enable tree-shaking
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
  },
}));
