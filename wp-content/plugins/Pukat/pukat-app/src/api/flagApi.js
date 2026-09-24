import { get, post, put, del } from './client.js'

export const flagApi = {
  // Shared Flag categories (admin-managed)
  list:   ()         => get('/flags'),
  create: (data)     => post('/flags', data),
  update: (id, data) => put(`/flags/${id}`, data),
  delete: (id)       => del(`/flags/${id}`),

  // Per-entity example gallery. `entity` is only honored for admins.
  listExamples: (params = {}) => get('/flag-examples', { params }),
  // client.js defaults to Content-Type: application/json, which makes axios
  // serialize a FormData body to JSON (the file would be silently dropped).
  // Declaring multipart here makes axios keep the FormData and let the
  // browser set the boundary itself.
  uploadExample: (formData, onUploadProgress) => post('/flag-examples', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  deleteExample: (id) => del(`/flag-examples/${id}`),
}

export default flagApi
