import fs from 'node:fs/promises'
import path from 'node:path'
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool'

const [inputDir, outputDir] = process.argv.slice(2)

if (!inputDir || !outputDir) {
  throw new Error('Usage: audit-workbooks.mjs <input-dir> <output-dir>')
}

await fs.mkdir(outputDir, { recursive: true })

const files = (await fs.readdir(inputDir))
  .filter((name) => name.toLowerCase().endsWith('.xlsx'))
  .sort((a, b) => a.localeCompare(b, 'ar'))

const report = []

for (const fileName of files) {
  const inputPath = path.join(inputDir, fileName)
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath))
  const sheetItems = workbook.worksheets.items
  const workbookInspection = await workbook.inspect({
    kind: 'workbook,sheet,table',
    maxChars: 6000,
    tableMaxRows: 8,
    tableMaxCols: 12,
    tableMaxCellChars: 100,
  })
  const formulaInspection = await workbook.inspect({
    kind: 'formula',
    maxChars: 6000,
    options: { maxResults: 300 },
  })
  const errorInspection = await workbook.inspect({
    kind: 'match',
    searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
    options: { useRegex: true, maxResults: 300 },
    summary: 'final formula error scan',
  })

  const renderedSheets = []
  for (const sheet of sheetItems) {
    const preview = await workbook.render({
      sheetName: sheet.name,
      autoCrop: 'all',
      scale: 1.5,
      format: 'png',
    })
    const safeFile = path.parse(fileName).name.replaceAll('/', '-')
    const safeSheet = sheet.name.replaceAll('/', '-')
    const previewPath = path.join(outputDir, `${safeFile}__${safeSheet}.png`)
    await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()))
    renderedSheets.push({ name: sheet.name, previewPath })
  }

  report.push({
    fileName,
    sheetCount: sheetItems.length,
    sheets: renderedSheets,
    workbookInspection: workbookInspection.ndjson,
    formulaInspection: formulaInspection.ndjson,
    errorInspection: errorInspection.ndjson,
  })
}

await fs.writeFile(path.join(outputDir, 'workbook-audit.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.map(({ fileName, sheetCount, sheets }) => ({ fileName, sheetCount, sheets })), null, 2))
