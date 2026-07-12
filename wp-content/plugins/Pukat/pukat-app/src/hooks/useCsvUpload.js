import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import toast from 'react-hot-toast'

/**
 * useCsvUpload.js
 *
 * CSV drop-zone + parse + row validation, extracted from the repeated
 * Papa.parse + useDropzone pattern in Preparation.jsx and Campaigns.jsx
 * (Step1). Defaults replicate Preparation.jsx's current behavior exactly
 * (email-required row validation, its exact toast wording) so it can be
 * wired in with zero option overrides; other callers with different
 * wording/validation pass their own via options.
 *
 * Not wired to any page yet — this is a standalone addition.
 *
 * @param {Object} [options]
 * @param {(row: Object) => boolean} [options.validateRow] - Returns true if a parsed row is valid. Default: requires an `email` field containing "@".
 * @param {(row: Object, index: number) => string} [options.invalidRowMessage] - Message pushed to csvErrors for a rejected row.
 * @param {(validCount: number, errorCount: number) => string} [options.successMessage] - Toast shown after a successful parse.
 * @param {(err: Error) => string} [options.parseErrorMessage] - Toast shown when Papa.parse itself errors.
 * @param {Object} [options.accept] - Dropzone accept map. Default: CSV mime/extension.
 * @param {number} [options.maxFiles] - Dropzone maxFiles. Default: 1.
 * @param {Array} [options.csvData] - Controlled csvData value. Pass together with options.setCsvData when the caller needs csvData to live in its own (or a parent's) state, e.g. Campaigns.jsx Step1 sharing it with Step3. Omit both to let the hook own the state internally (Preparation.jsx's usage).
 * @param {Function} [options.setCsvData] - Setter paired with options.csvData for controlled usage.
 * @returns {{ csvData: Array, setCsvData: Function, csvErrors: string[], setCsvErrors: Function, getRootProps: Function, getInputProps: Function, isDragActive: boolean }}
 */
export function useCsvUpload(options = {}) {
  const {
    validateRow = (row) => !!row.email && row.email.includes('@'),
    invalidRowMessage = (row, index) => `Row ${index + 2}: invalid email "${row.email}"`,
    successMessage = (validCount, errorCount) =>
      `Loaded ${validCount} valid targets.${errorCount ? ` (${errorCount} rows skipped)` : ''}`,
    parseErrorMessage = (err) => `CSV parse error: ${err.message}`,
    accept = { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles = 1,
    csvData: controlledCsvData,
    setCsvData: controlledSetCsvData,
  } = options

  const [internalCsvData, setInternalCsvData] = useState([])
  const csvData = controlledCsvData ?? internalCsvData
  const setCsvData = controlledSetCsvData ?? setInternalCsvData
  const [csvErrors, setCsvErrors] = useState([])

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors = []
        const rows = result.data.filter((row, i) => {
          if (!validateRow(row)) {
            errors.push(invalidRowMessage(row, i))
            return false
          }
          return true
        })
        setCsvData(rows)
        setCsvErrors(errors)
        toast.success(successMessage(rows.length, errors.length))
      },
      error: (err) => toast.error(parseErrorMessage(err)),
    })
  }, [validateRow, invalidRowMessage, successMessage, parseErrorMessage, setCsvData])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, maxFiles })

  return { csvData, setCsvData, csvErrors, setCsvErrors, getRootProps, getInputProps, isDragActive }
}
