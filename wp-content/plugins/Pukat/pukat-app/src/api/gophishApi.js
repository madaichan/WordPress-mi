import { get } from './client.js'

export const gophishApi = {
  status:         () => get('/gophish/status'),
  emailTemplates: () => get('/gophish/templates/email'),
  landingPages:   () => get('/gophish/templates/landing'),
  smtpProfiles:   () => get('/gophish/smtp'),
  groups:         () => get('/gophish/groups'),
}

export default gophishApi
