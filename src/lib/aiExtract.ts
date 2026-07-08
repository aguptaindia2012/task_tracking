export interface ExtractedTask {
  title: string
  description: string
  project: string
  assignee: string
  due_date: string
}

export interface ExtractPayload {
  instructions: string
  pastedText?: string
  file?: { name: string; type: string; dataBase64: string }
}

// Calls the serverless /api/extract endpoint, which runs Claude server-side.
export async function extractTasks(payload: ExtractPayload): Promise<ExtractedTask[]> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let data: { tasks?: ExtractedTask[]; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // fall through to the status-based error below
  }
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status}). The AI endpoint runs only on the deployed site, not the local dev server.`)
  }
  return data.tasks ?? []
}

// Read a File into base64 (without the data: URL prefix).
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}
