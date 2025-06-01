# CLI

本项目修改poe-dat-viewer的CLI代码以满足实际需求，修改内容包括：

- 支持使用http代理下载CDN文件和schema文件
- 默认缓存schema文件，删除解包目录下的`schema.min.js`以清理缓存
- tables不需要声明字段，默认导出所有字段
- 支持官方客户端和腾讯客户端

## 编译和安装

*参考`..\.github\workflows\lib.yml`*

首次执行时安装依赖：

```powershell
pnpm install
```

后续编译和安装：
```powershell
pnpm tsc
npm install -g
```

## 使用

### config.json

在存储解包文件的目录创建config.json（参考[ExportConfig](https://github.com/pathoftop/poe-dat-viewer/blob/master/lib/src/cli/ExportConfig.ts)）：

```json
{
  "mode": "official",
  "patch": "3.25.3.8",
  "gameDir": "D:\\Program Files (x86)\\Path of Exile",
  "files": [
    "Metadata/StatDescriptions/stat_descriptions.txt",
    "metadata/statdescriptions/passive_skill_stat_descriptions.txt",
    "metadata/statdescriptions/tincture_stat_descriptions.txt"
  ],
  "translations": ["English"],
  "tables": [
    {
      "name": "Characters"
    },
    {
      "name": "Ascendancy"
    }
  ],
  "httpProxy": "http://localhost:1081" 
}
```

### 执行

```
npm exec pathofexile-dat
```

## 其它

### ImageMagick依赖

在解包过程中，`.dds`文件会被转换为`.png`文件，这依赖于`ImageMagick`命令行程序。

手动下载[ImageMagick](https://imagemagick.org/script/download.php)，在执行解包命令前将其所在路径添加到PATH。

```
$env:PATH += ";D:\AppsInDisk\ImageMagick-7.1.1-47-portable-Q16-HDRI-x64"
```

### ExtractBundledGGPK3依赖

解包官方客户端和腾讯客户端依赖`ExtractBundledGGPK3`命令行程序。同样需要在执行解包命令前将其所在路径添加到PATH。

```
$env:PATH += ";D:\AppsInDisk\ExtractBundledGGPK3"
```