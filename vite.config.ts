import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const taskCatalogPath = fileURLToPath(new URL('./src/generated/taskCatalog.json', import.meta.url))
const catalogAuditPath = fileURLToPath(new URL('./src/generated/catalogAudit.json', import.meta.url))
const taskGuidesPath = fileURLToPath(new URL('./src/generated/taskGuides.json', import.meta.url))

function portalSafeGeneratedData(): Plugin {
  const taskCatalogId = '\0portal-safe-task-catalog'
  const catalogAuditId = '\0portal-safe-catalog-audit'
  const taskGuidesId = '\0portal-short-task-guides'

  return {
    name: 'portal-safe-generated-data',
    enforce: 'pre',
    resolveId(source) {
      const cleanSource = source.split('?', 1)[0]
      if (cleanSource === './generated/taskCatalog.json' || cleanSource.endsWith('/generated/taskCatalog.json')) return taskCatalogId
      if (cleanSource === './generated/catalogAudit.json' || cleanSource.endsWith('/generated/catalogAudit.json')) return catalogAuditId
      if (cleanSource === './generated/taskGuides.json' || cleanSource.endsWith('/generated/taskGuides.json')) return taskGuidesId
      return null
    },
    load(id) {
      if (id === taskCatalogId) {
        const sourceCatalog = JSON.parse(readFileSync(taskCatalogPath, 'utf8')) as Array<Record<string, unknown>>
        const portalCatalog = sourceCatalog.map(({ coordinator: _coordinator, departmentHead: _departmentHead, department: _department, ...task }) => task)
        return `export default ${JSON.stringify(portalCatalog)}`
      }

      if (id === catalogAuditId) {
        const sourceAudit = JSON.parse(readFileSync(catalogAuditPath, 'utf8')) as {
          proposedRenames: unknown
          proposedTaxonomy: {
            taskTypes: Array<{ id: string; canonicalTitle: string; artifactKind: string }>
          }
          recordTypeMap: unknown
        }
        const portalAudit = {
          proposedRenames: sourceAudit.proposedRenames,
          proposedTaxonomy: {
            taskTypes: sourceAudit.proposedTaxonomy.taskTypes.map(({ id, canonicalTitle, artifactKind }) => ({ id, canonicalTitle, artifactKind })),
          },
          recordTypeMap: sourceAudit.recordTypeMap,
        }
        return `export default ${JSON.stringify(portalAudit)}`
      }

      if (id === taskGuidesId) {
        const sourceGuides = JSON.parse(readFileSync(taskGuidesPath, 'utf8')) as {
          guides: Array<{
            id: string
            nameAr: string
            roles: { directResponsible: string }
            finalOutput: string
            evidenceAttachments: string[]
            evidenceComponents: string[]
          }>
        }
        const guides = sourceGuides.guides.map((guide) => ({
          id: guide.id,
          nameAr: guide.nameAr,
          roles: { directResponsible: guide.roles.directResponsible },
          finalOutput: guide.finalOutput,
          evidenceAttachments: guide.evidenceAttachments,
          evidenceComponents: guide.evidenceComponents,
        }))
        return `export default ${JSON.stringify({ guides })}`
      }

      return null
    },
  }
}

export default defineConfig({
  plugins: [portalSafeGeneratedData(), react()],
})
