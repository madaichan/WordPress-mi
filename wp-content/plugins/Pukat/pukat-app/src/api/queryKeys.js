export const queryKeys = {
  settings: ['settings'],

  campaigns: {
    all: ['campaigns'],
    list: (params = {}) => ['campaigns', 'list', params],
  },

  campaignRuns: {
    all: ['campaign-runs'],
    list: ['campaign-runs', 'list'],
  },

  gophish: {
    all: ['gophish'],
    status: ['gophish', 'status'],
    emailTemplates: ['gophish', 'email-templates'],
    landingPages: ['gophish', 'landing-pages'],
    smtpProfiles: ['gophish', 'smtp-profiles'],
    groups: ['gophish', 'groups'],
  },

  masterAssets: {
    all: ['master-assets'],
    emailTemplates: ['master-assets', 'email-templates'],
    landingPages: ['master-assets', 'landing-pages'],
    sendingProfiles: ['master-assets', 'sending-profiles'],
    dynamicDomains: ['master-assets', 'dynamic-domains'],
  },

  tables: {
    all: ['tables'],
    schema: (tableKey) => ['tables', tableKey, 'schema'],
    rows: (tableKey, params = {}) => ['tables', tableKey, 'rows', params],
  },

  playbooks: {
    all: ['playbooks'],
    list: ['playbooks', 'list'],
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
