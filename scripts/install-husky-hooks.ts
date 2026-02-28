#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';

const getProjectRoot = (): string => {
  return process.env.INIT_CWD || process.cwd();
};

const getSharedConfigPath = (): string => {
  return path.join(getProjectRoot(), 'node_modules', '@josh803316', 'shared-config');
};

const writeHookIfMissing = (filePath: string, content: string): void => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, {mode: 0o755});
    console.log(`Created ${path.basename(filePath)} hook`);
  } else {
    console.log(`${path.basename(filePath)} hook already exists, skipping`);
  }
};

const getHooks = (huskyDir: string): string[] => {
  try {
    return fs
      .readdirSync(huskyDir)
      .filter((file) => !file.startsWith('.') && !file.startsWith('_'))
      .filter((file) => fs.statSync(path.join(huskyDir, file)).isFile());
  } catch (error) {
    console.error(`Error reading .husky directory: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
};

const main = () => {
  const projectRoot = getProjectRoot();
  const sharedConfigPath = getSharedConfigPath();
  const targetDir = path.join(projectRoot, '.husky');

  console.log(`Installing husky hooks from @josh803316/shared-config...`);
  console.log(`Project root: ${projectRoot}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, {recursive: true});
  }

  const sharedHuskyDir = path.join(sharedConfigPath, '.husky');
  const hooks = getHooks(sharedHuskyDir);
  console.log(`Found ${hooks.length} hook(s) to install`);

  hooks.forEach((hook) => {
    const hookFilePath = path.join(targetDir, hook);
    const hookContent = `#!/bin/sh\nnode_modules/@josh803316/shared-config/.husky/${hook} "$@"\n`;
    writeHookIfMissing(hookFilePath, hookContent);
  });

  console.log('Done.');
};

main();
