import { useEffect, useRef, useState } from 'react'
import { useRemoveEntityLogoMutation, useUploadEntityLogoMutation } from '../../hooks/mutations/useEntityMutations.js'
import Button from '../../components/UI/Button.jsx'
import UploadProgress from '../../components/UI/UploadProgress.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'

/**
 * Entity logo upload/replace/remove (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md
 * §15.4). Uploads immediately on file choice — separate from the profile
 * form's Save, since the file goes to its own endpoint. Type, size and
 * resolution are validated by the backend; its message is shown as-is.
 */
export default function EntityLogoField({ profile, canEdit }) {
  const fileInputRef = useRef(null)
  // { percent, phase: 'uploading' | 'processing', fileName, fileSize } while an upload runs.
  const [upload, setUpload] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  function resetInput() {
    setUpload(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadMutation = useUploadEntityLogoMutation({ onSuccess: resetInput, onError: resetInput })
  const removeMutation = useRemoveEntityLogoMutation({ onSuccess: () => setConfirmingRemove(false) })
  const isUploading = uploadMutation.isPending

  useEffect(() => {
    if (!isUploading) return undefined
    setElapsed(0)
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [isUploading])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    setUpload({ percent: 0, phase: 'uploading', fileName: file.name, fileSize: file.size })
    uploadMutation.mutate({
      id: profile.id,
      formData,
      onProgress: progressEvent => {
        const percent = progressEvent.total ? Math.min(100, Math.round((progressEvent.loaded * 100) / progressEvent.total)) : 0
        setUpload(current => current && { ...current, percent, phase: percent >= 100 ? 'processing' : 'uploading' })
      },
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt={`${profile.display_name || profile.entity_name} logo`} className="h-full w-full object-contain" />
          ) : (
            <i className="ti ti-building text-2xl text-gray-300" />
          )}
        </div>

        {canEdit && (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading || removeMutation.isPending}>
                {profile.logo_url ? 'Replace logo' : 'Upload logo'}
              </Button>
              {profile.logo_url && (
                <Button type="button" variant="ghost" onClick={() => setConfirmingRemove(true)} disabled={isUploading || removeMutation.isPending}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">PNG, JPEG or WebP. Resized to at most 512 px.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {upload && (
        <UploadProgress
          fileName={upload.fileName}
          fileSize={upload.fileSize}
          percent={upload.percent}
          phase={upload.phase}
          elapsedSeconds={elapsed}
        />
      )}

      {confirmingRemove && (
        <AlertConfirmation
          title="Remove logo?"
          message="The logo image will be deleted from this entity's profile."
          icon="ti-trash"
          tone="danger"
          confirmLabel="Remove"
          pendingLabel="Removing..."
          isPending={removeMutation.isPending}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => removeMutation.mutate(profile.id)}
        />
      )}
    </div>
  )
}
