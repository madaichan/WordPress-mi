import { useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useFlags, useFlagExamples } from '../../hooks/queries/useFlagQueries.js'
import { useUploadFlagExampleMutation, useDeleteFlagExampleMutation } from '../../hooks/mutations/useFlagMutations.js'
import Input from '../../components/UI/Input.jsx'
import Button from '../../components/UI/Button.jsx'
import Badge from '../../components/UI/Badge.jsx'

const ACCEPT = 'image/png,image/jpeg,image/webp'

/**
 * Container for one entity's Flag example gallery
 * (docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md §6). On My Profile the
 * backend always scopes to the user's own entity; `adminEntity` lets the admin
 * oversight view ask for a specific entity. The backend enforces who may
 * upload/delete — `canManage` only hides actions that would 403.
 */
export default function EntityFlagExamplesPanel({ canManage = false, adminEntity = null }) {
  const { data: flags = [] } = useFlags()
  const activeFlags = useMemo(() => flags.filter(f => f.is_active), [flags])
  const [selectedFlagId, setSelectedFlagId] = useState(null)
  const flagId = selectedFlagId ?? activeFlags[0]?.id ?? null

  const params = adminEntity ? { entity: adminEntity } : {}
  const { data, isLoading } = useFlagExamples(params)
  const examples = useMemo(() => data?.examples || [], [data])
  const maxBytes = data?.max_upload_bytes || 0

  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const fileInputRef = useRef(null)
  const uploadMutation = useUploadFlagExampleMutation({
    onSuccess: () => {
      setFile(null)
      setCaption('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })
  const deleteMutation = useDeleteFlagExampleMutation()

  const countByFlag = useMemo(() => {
    const counts = {}
    examples.forEach(e => { counts[e.flag_id] = (counts[e.flag_id] || 0) + 1 })
    return counts
  }, [examples])
  const visible = examples.filter(e => e.flag_id === flagId)
  const selectedFlag = activeFlags.find(f => f.id === flagId)

  function handleUpload() {
    if (!file) {
      toast.error('Choose an image first.')
      return
    }
    if (maxBytes && file.size > maxBytes) {
      toast.error(`The image is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`)
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('flag_id', String(flagId))
    if (caption.trim()) formData.append('caption', caption.trim())
    if (adminEntity) formData.append('entity', adminEntity)
    uploadMutation.mutate(formData)
  }

  function handleDelete(example) {
    if (!window.confirm('Delete this example? The image file is removed too.')) return
    deleteMutation.mutate(example.id)
  }

  if (activeFlags.length === 0) {
    return <p className="text-sm text-gray-400">No active Flag categories. An admin needs to create one first.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Annotated screenshots showing what each warning sign looks like in your email environment. Annotate images before uploading.
      </p>

      <div className="flex flex-wrap gap-2">
        {activeFlags.map(flag => (
          <button
            key={flag.id}
            type="button"
            onClick={() => setSelectedFlagId(flag.id)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              flag.id === flagId ? 'border-violet-500 bg-violet-50 text-violet-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {flag.label}
            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">{countByFlag[flag.id] || 0}</span>
          </button>
        ))}
      </div>

      {canManage && (
        <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3">
          <div className="text-xs font-semibold text-gray-700">Add a {selectedFlag?.label} example</div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-600"
          />
          <div className="flex gap-2">
            <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Short caption (optional)" maxLength={255} />
            <Button variant="primary" onClick={handleUpload} disabled={uploadMutation.isPending || !file}>
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
          <p className="text-[11px] text-gray-400">
            PNG, JPEG or WebP{maxBytes ? `, up to ${Math.floor(maxBytes / 1024 / 1024)} MB` : ''}
            {data?.max_megapixels ? ` and ${data.max_megapixels} megapixels` : ''}.
            {data?.max_dimension ? ` Larger images are resized to ${data.max_dimension} px on the longest side.` : ''}
          </p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">No {selectedFlag?.label} examples yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map(example => (
            <figure key={example.id} className="overflow-hidden rounded-lg border border-gray-100 bg-white">
              <a href={example.image_url} target="_blank" rel="noopener noreferrer">
                <img src={example.thumbnail_url} alt={example.caption || example.flag_label} className="h-32 w-full bg-gray-50 object-cover" loading="lazy" />
              </a>
              <figcaption className="flex items-start justify-between gap-2 p-2">
                <span className="text-xs text-gray-600">{example.caption || <span className="text-gray-300">No caption</span>}</span>
                {canManage && (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-danger hover:underline"
                    onClick={() => handleDelete(example)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {adminEntity && examples.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFlags.map(f => <Badge key={f.id} tone={f.color || 'gray'}>{f.label}: {countByFlag[f.id] || 0}</Badge>)}
        </div>
      )}
    </div>
  )
}
