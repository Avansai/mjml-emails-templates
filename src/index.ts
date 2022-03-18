import mjml2html from 'mjml'
import path from 'path'
import fs from 'fs/promises'

async function getHTLMFromMJML(filePath: string) {
  const fileContent = await fs.readFile(filePath, 'utf-8')
  return mjml2html(fileContent.toString()).html
}

type EmailDict = {
  name: string
  content: string
}

async function buildEmailDict(path: string): Promise<EmailDict> {
  const htmlContent = await getHTLMFromMJML(path)
  const templateNameParts = path.split('/')
  const templateName = templateNameParts.reverse()[0].split('.')[0]
  return { name: templateName, content: htmlContent }
}

async function findEmailTemplateFiles(directory: string) {
  const items = await fs.readdir(directory, { withFileTypes: true })
  const fileNames = items
    .filter((file) => !file.isDirectory())
    .map((file) => `${directory}/${file.name}`)
  const folders = items.filter((item) => item.isDirectory())
  for (const folder of folders) {
    fileNames.push(...(await findEmailTemplateFiles(`${directory}/${folder.name}`)))
  }

  return fileNames
}

type MJMLTemplatesByLocale = {
  en: EmailDict[]
  fr: EmailDict[]
}

async function main() {
  const templatesDirectory = path.join(__dirname, 'templates')
  const filePaths = await findEmailTemplateFiles(templatesDirectory)
  const mjmlTemplatePaths = filePaths.filter(
    (emailTemplate) =>
      path.extname(emailTemplate).includes('mjml') && !emailTemplate.includes('partials')
  )

  const mjmlTemplatePathsByLocale: MJMLTemplatesByLocale = { en: [], fr: [] }

  for (const path of mjmlTemplatePaths) {
    if (path.includes('/en/')) {
      mjmlTemplatePathsByLocale.en.push(await buildEmailDict(path))
    } else if (path.includes('/fr/')) {
      mjmlTemplatePathsByLocale.fr.push(await buildEmailDict(path))
    }
  }
  const srcParentPath = path.dirname('../src')
  const basePath = path.join(__dirname, path.basename(srcParentPath))

  try {
    await fs.stat(`${basePath}/dist`)
    await fs.rm(`${basePath}/dist`, { recursive: true })
  } catch (e) {}

  for (const key of Object.keys(mjmlTemplatePathsByLocale)) {
    for (const templateDict of mjmlTemplatePathsByLocale[key]) {
      const outputDirectory = `${basePath}/dist/${key}/${templateDict.name}`
      await fs.mkdir(outputDirectory, { recursive: true })

      const match = /<title>[^<>]*<\/title>/.exec(templateDict.content)
      if (match) {
        const subject = match[0].replace(/(<([^>]+)>)/g, '')
        const txtOutputFilePath = `${outputDirectory}/subject.txt`
        await fs.writeFile(txtOutputFilePath, subject.trim(), 'utf-8')
      }

      const htmlOutputFilePath = `${outputDirectory}/body.html`
      await fs.writeFile(htmlOutputFilePath, templateDict.content, 'utf-8')
    }
  }
}

main().then(() => {
  console.warn('finished building templates')
})
