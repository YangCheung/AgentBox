import JSZip from 'jszip'
import { parse as parseYaml } from 'yaml'

export interface SkillManifest {
  name?: string
  description?: string
}

export async function parseSkillManifest(file: File): Promise<SkillManifest | null> {
  const zip = await JSZip.loadAsync(file)

  // Find skill.md case-insensitively
  const entry = zip.file(/skill\.md$/i)[0]
  if (!entry) return null

  const text = await entry.async('string')

  // Parse YAML frontmatter between --- delimiters
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null

  try {
    const meta = parseYaml(match[1]) as Record<string, unknown>
    return {
      name: typeof meta.name === 'string' ? meta.name : undefined,
      description: typeof meta.description === 'string' ? meta.description : undefined,
    }
  } catch {
    return null
  }
}
