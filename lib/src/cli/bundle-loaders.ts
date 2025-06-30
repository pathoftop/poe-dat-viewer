import { decompressSliceInBundle } from '../bundles/bundle.js'
import { getFileInfo, readIndexBundle } from '../bundles/index-bundle.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { default as fetch2 } from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { spawn } from 'child_process'

const BUNDLE_DIR = 'Bundles2'

export interface IFileLoader {
  getFileContents: (fullPath: string) => Promise<Uint8Array>
  tryGetFileContents: (fullPath: string) => Promise<Uint8Array | null>
  clearBundleCache: () => void
}

export class FileLoader {
  private bundleCache = new Map<string, ArrayBuffer>()

  constructor (
    private bundleLoader: IBundleLoader,
    private index: {
      bundlesInfo: Uint8Array
      filesInfo: Uint8Array
    }
  ) {}

  static async create (bundleLoader: IBundleLoader) {
    console.log('Loading bundles index...')

    const indexBin = await bundleLoader.fetchFile('_.index.bin')
    const indexBundle = decompressSliceInBundle(new Uint8Array(indexBin))
    const _index = readIndexBundle(indexBundle)

    return new FileLoader(bundleLoader, {
      bundlesInfo: _index.bundlesInfo,
      filesInfo: _index.filesInfo,
    })
  }

  private async fetchBundle (name: string) {
    let bundleBin = this.bundleCache.get(name)
    if (!bundleBin) {
      bundleBin = await this.bundleLoader.fetchFile(name)
      this.bundleCache.set(name, bundleBin)
    }
    return bundleBin
  }

  async getFileContents (fullPath: string): Promise<Uint8Array> {
    const contents = await this.tryGetFileContents(fullPath)
    if (!contents) {
      throw new Error(`File no longer exists: ${fullPath}`)
    }
    return contents
  }

  async tryGetFileContents (fullPath: string): Promise<Uint8Array | null> {
    const location = getFileInfo(fullPath, this.index.bundlesInfo, this.index.filesInfo)
    if (!location) return null

    const bundleBin = await this.fetchBundle(location.bundle)
    return decompressSliceInBundle(new Uint8Array(bundleBin), location.offset, location.size)
  }

  clearBundleCache () {
    this.bundleCache.clear()
  }
}

interface IBundleLoader {
  fetchFile: (name: string) => Promise<ArrayBuffer>
}

export class CdnBundleLoader {
  proxyAgent: HttpsProxyAgent<string> | undefined
  private constructor (
    private cacheDir: string,
    private patchVer: string,
    private proxy?: string,
  ) {
    if (this.proxy) {
      console.log(`Using proxy: ${this.proxy}`)
      this.proxyAgent = new HttpsProxyAgent(this.proxy)
    }
  }

  static async create (cacheRoot: string, patchVer: string, httpProxy?: string) {
    const cacheDir = path.join(cacheRoot, patchVer)
    try {
      await fs.access(cacheDir)
    } catch {
      console.log('Creating new bundle cache...')
      await fs.rm(cacheRoot, { recursive: true, force: true })
      await fs.mkdir(cacheDir, { recursive: true })
    }
    return new CdnBundleLoader(cacheDir, patchVer, httpProxy)
  }

  async fetchFile (name: string): Promise<ArrayBuffer> {
    const cachedFilePath = path.join(this.cacheDir, name.replace(/\//g, '@'))

    try {
      await fs.access(cachedFilePath)
      const bundleBin = await fs.readFile(cachedFilePath)
      return bundleBin
    } catch {}

    console.log(`Loading from CDN: ${name} ...`)

    const webpath = `/${this.patchVer}/${BUNDLE_DIR}/${name}`
    const response = await fetch2(
      webpath.startsWith('/4.')
        ? `https://patch-poe2.poecdn.com${webpath}`
        : `https://patch.poecdn.com${webpath}`, {
          agent: this.proxyAgent,
        })
    if (!response.ok) {
      console.error(`Failed to fetch ${name} from CDN.`)
      process.exit(1)
    }
    const bundleBin = await response.arrayBuffer()
    await fs.writeFile(cachedFilePath, Buffer.from(bundleBin, 0, bundleBin.byteLength))
    return bundleBin
  }
}

export class SteamBundleLoader {
  constructor(
    private gameDir: string
  ) {}

  async fetchFile (name: string): Promise<ArrayBuffer> {
    return await fs.readFile(path.join(this.gameDir, BUNDLE_DIR, name))
  }
}

export class OfficialFileLoader {
  constructor(
    private ggpkExtractor: GGPKExtractor
  ) {}

  static async create(bundleLoader: GGPKExtractor) {
    return new OfficialFileLoader(bundleLoader)
  }

  async getFileContents(fullPath: string): Promise<Uint8Array> {
    const contents = await this.tryGetFileContents(fullPath)
    if (!contents) {
      throw new Error(`File no longer exists: ${fullPath}`)
    }
    return contents
  }

  async tryGetFileContents(fullPath: string): Promise<Uint8Array | null> {
    return new Uint8Array(await this.ggpkExtractor.fetchFile(fullPath))
  }

  clearBundleCache() { }
}

export class GGPKExtractor {
  constructor(
    private cacheDir: string,
    private gameDir: string,
  ) {
  }

  static async create(cacheRoot: string, gameDir: string, mode: 'official' | 'tencent') {
    const patchVer = await this.patchVer(gameDir, mode)
    const cacheDir = path.join(cacheRoot, patchVer)
    try {
      await fs.access(cacheDir)
    } catch {
      console.log('Creating new extract cache...')
      await fs.rm(cacheRoot, { recursive: true, force: true })
      await fs.mkdir(cacheDir, { recursive: true })
    }
    return new GGPKExtractor(cacheDir, gameDir)
  }

  static async patchVer(gameDir: string, mode: 'official' | 'tencent'): Promise<string> {
    if (mode === 'official') {
      //TODO: implement official patch version fetching
      return "unknown"
    }else if(mode === 'tencent'){
      const versionFile = path.join(gameDir, 'TCLS/mmog_data.xml')
      try {
        await fs.access(versionFile)
        const versionContent = await fs.readFile(versionFile, { encoding: 'utf-8' })
        const match = versionContent.match(/<Version>(\d+\.\d+\.\d+\.\d+)<\/Version>/)
        if (match && match[1]) {
          return match[1]
        } else {
          throw new Error('Version not found in mmog_data.xml')
        }
      } catch (err) {
        console.error(`Failed to read version file: ${err}`)
        throw new Error('Could not determine patch version for Tencent mode.')
      }
    }else{
      throw new Error("Unreachable code")
    }
  }

  async fetchFile(name: string): Promise<ArrayBuffer> {
    const cachedFilePath = path.join(this.cacheDir, name.replace(/\//g, '@'))

    try {
      await fs.access(cachedFilePath)
      const content = await fs.readFile(cachedFilePath)
      return content
    } catch { }

    console.log(`Extracting from Content.ggpk: ${name} ...`)
    const contentGGPK = path.join(this.gameDir, 'Content.ggpk')
    await GGPKExtractor.extractBundledGGPK3(contentGGPK, name.toLowerCase(), cachedFilePath)

    await fs.access(cachedFilePath)
    const content = await fs.readFile(cachedFilePath)
    return content
  }

  static extractBundledGGPK3(
    contentGGPK: string,
    file: string,
    out: string
  ) {
    return new Promise<void>((resolve, reject) => {
      const extractor = spawn('ExtractBundledGGPK3', [contentGGPK, file, out], { stdio: ['ignore', 'inherit', 'inherit'] })
      extractor.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`extractor exited with code ${code}.`))
        }
      })
    })
  }
}