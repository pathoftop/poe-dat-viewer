export interface ExportConfig {
  mode: 'cdn'|'steam'|'official'|'tencent',
  // can be found on https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt
  // if mode is not "steam", patch is required
  patch?: string
  // "...steamapps/common/Path of Exile"
  // if mode is not "cdn", gameDir is required
  gameDir?: string
  files?: string[]
  translations?: string[]
  tables?: Array<{
    name: string
    // if null or empty, export all columns
    columns?: string[]
  }>
  // "http://localhost:7890"
  // http proxy to download cdn files and schema
  httpProxy?: string
}
