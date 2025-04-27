export interface ExportConfig {
  mode: 'cdn'|'stream'|'official'|'tencent',
  // can be found on https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt
  patch?: string
  // "...steamapps/common/Path of Exile"
  gameDir?: string
  files?: string[]
  translations?: string[]
  tables?: Array<{
    name: string
    columns?: string[]
  }>
  httpProxy?: string
}
