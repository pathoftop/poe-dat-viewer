#!/usr/bin/env node

import * as loaders from './bundle-loaders.js'
import { exportFiles } from './export-files.js'
import { exportTables } from './export-tables.js'
import type { ExportConfig } from './ExportConfig.js'
import * as fs from 'fs/promises'
import * as path from 'path'

;(async function main () {
  const config: ExportConfig = JSON.parse(
    await fs.readFile(path.join(process.cwd(), '/config.json'), { encoding: 'utf-8' }))

  let loader: loaders.IFileLoader
  if (config.mode === 'cdn') {
    if (!config.patch) {
      console.error('Should specify "patch" in config.json.')
      process.exit(1)
    }
    loader = await loaders.FileLoader.create(
      await loaders.CdnBundleLoader.create(path.join(process.cwd(), '/.cache'), config.patch, config.httpProxy))
  } else if (config.mode === 'steam') {
    if (!config.gameDir) {
      console.error('Should specify "gameDir" in config.json.')
      process.exit(1)
    }
    loader = await loaders.FileLoader.create(
      new loaders.SteamBundleLoader(config.gameDir!))
  } else if (config.mode === 'official'|| config.mode === 'tencent') {
    if (!config.gameDir) {
      console.error('Should specify "gameDir" in config.json.')
      process.exit(1)
    }
    loader = await loaders.OfficialFileLoader.create(
      await loaders.GGPKExtractor.create(path.join(process.cwd(), '/.cache'), config.gameDir!, config.mode))
  } else {
    console.error('Should specify "mode" in config.json.')
    process.exit(1)
  }

  await exportFiles(config, path.join(process.cwd(), 'files'), loader)
  await exportTables(config, path.join(process.cwd(), 'tables'), loader)
})()
