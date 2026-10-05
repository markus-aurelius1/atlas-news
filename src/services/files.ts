import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNative } from '@/lib/platform'

/** Save a text file: a download on the web, a share sheet on native (so it can go to Drive, Files, email…). */
export async function saveTextFile(filename: string, contents: string, mime = 'text/plain'): Promise<void> {
  if (isNative) {
    const res = await Filesystem.writeFile({ path: filename, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Save or share your export' }).catch(() => {})
    return
  }
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Ask the user for a file and read it as text. Resolves null if cancelled. */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return resolve(null)
      resolve({ name: file.name, text: await file.text() })
    }
    input.addEventListener('cancel', () => {
      input.remove()
      resolve(null)
    })
    document.body.appendChild(input)
    input.click()
  })
}

export const stamp = () => new Date().toISOString().slice(0, 10)
