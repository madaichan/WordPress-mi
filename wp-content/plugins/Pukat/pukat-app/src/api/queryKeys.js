export const queryKeys = {
  settings: ['settings'],

  campaigns: {
    all: ['campaigns'],
    list: (params = {}) => ['campaigns', 'list', params],
  },

  gophish: {
    all: ['gophish'],
    status: ['gophish', 'status'],
    emailTemplates: ['gophish', 'email-templates'],
    landingPages: ['gophish', 'landing-pages'],
    smtpProfiles: ['gophish', 'smtp-profiles'],
    groups: ['gophish', 'groups'],
  },

  reports: {
    all: ['reports'],
    riskScores: (params = {}) => ['reports', 'risk-scores', params],
    campaign: (campaignId) => ['reports', 'campaign', campaignId],
  },

  users: {
    all: ['users'],
    list: (params = {}) => ['users', 'list', params],
    auditLogs: (params = {}) => ['users', 'audit-logs', params],
  },
}
