import mjml2html from 'mjml'
import path from 'path'
import fs from 'fs/promises'
const input = 'templates'
const output = 'dist'

async function getHTLMFromMJML(filePath: string) {
  const fileContent = await fs.readFile(filePath, 'utf-8')
  return mjml2html(fileContent.toString(), { beautify: true, minify: false }).html
}

async function findEmailTemplateFiles(directory: string) {
  try {
    const items = await fs.readdir(directory, { withFileTypes: true })

    const fileNames = items
      .filter((file) => !file.isDirectory())
      .map((file) => `${directory}/${file.name}`)
    const folders = items.filter((item) => item.isDirectory())
    for (const folder of folders) {
      fileNames.push(...(await findEmailTemplateFiles(`${directory}/${folder.name}`)))
    }
    return fileNames
  } catch (e) {
    return []
  }
}

async function main() {
  const inputDir = path.resolve(`./${input}`)
  const outputDir = `./${output}`

  const filePaths = await findEmailTemplateFiles(inputDir)

  const mjmlTemplatePaths = filePaths.filter(
    (filePath) => path.extname(filePath).includes('mjml') && !filePath.includes('partials')
  )
  try {
    await fs.stat(outputDir)
    await fs.rm(outputDir, { recursive: true })
  } catch (e) {}

  for (const mjmlTemplatePath of mjmlTemplatePaths) {
    const extension = path.extname(mjmlTemplatePath)
    const fileName = path.basename(mjmlTemplatePath, extension)
    const mjmlTemplateParts = mjmlTemplatePath.replace(inputDir, outputDir).split('/')
    mjmlTemplateParts.pop()
    const htmlOutputPath = mjmlTemplateParts.join('/')
    await fs.mkdir(htmlOutputPath, { recursive: true })
    const htmlOutputFilePath = `${htmlOutputPath}/${fileName}.html`
    await fs.writeFile(htmlOutputFilePath, await getHTLMFromMJML(mjmlTemplatePath), 'utf-8')
  }
}

main().then(() => {
  console.warn('finished building templates')
})
