import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  gophishSmtpProfileToUiProfile,
  getSmtpEncryptionClass,
  getSmtpStatusClasses,
} from '../../utils/smtpProfileHelpers.js'
import { useGophishSmtpProfiles } from '../../hooks/queries/useGophishQueries.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import useAppStore from '../../store/useAppStore.js'
import { filterAssetsForUser } from '../../utils/entityAssignmentHelpers.js'

const INITIAL_PROFILES = []

export default function SendingProfiles() {
  const { data: gophishProfiles = [], isLoading, isFetching, refetch } = useGophishSmtpProfiles()
  const currentUser = useAppStore(state => state.user)
  const [profiles, setProfiles] = useState(INITIAL_PROFILES)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const visibleProfiles = filterAssetsForUser(
      gophishProfiles.map(gophishSmtpProfileToUiProfile),
      currentUser
    )
    setProfiles(visibleProfiles)
  }, [currentUser, gophishProfiles])

  const filteredProfiles = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return profiles

    return profiles.filter(profile => (
      profile.name.toLowerCase().includes(term)
      || profile.host.toLowerCase().includes(term)
      || profile.from.toLowerCase().includes(term)
      || profile.entity.toLowerCase().includes(term)
      || profile.encryption.toLowerCase().includes(term)
    ))
  }, [profiles, query])

  async function syncGoPhish() {
    const result = await refetch()
    if (result.error) {
      toast.error(result.error.message || 'Failed to sync SMTP profiles.')
      return
    }
    toast.success('SMTP profiles synced with GoPhish.')
  }

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Sending profiles"
        subtitle="SMTP configuration for phishing simulation delivery through GoPhish"
        actions={
          <Button variant="outline" onClick={syncGoPhish} disabled={isFetching}>Sync GoPhish</Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/40 p-5">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Outbound Relay Pools</h3>
            <p className="mt-0.5 text-xs text-gray-500">Active mail relay connections linked to GoPhish</p>
          </div>
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search profiles..."
              className="w-60 rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-xs text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="p-4">Profile name</th>
                <th className="p-4">Host / Port</th>
                <th className="p-4">From address</th>
                <th className="p-4">Entity</th>
                <th className="p-4">Encryption</th>
                <th className="p-4">Status</th>
                <th className="p-4">Used</th>
                <th className="p-4">Last tested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-gray-400">Loading GoPhish SMTP profiles...</td>
                </tr>
              )}
              {!isLoading && filteredProfiles.map(profile => {
                const status = getSmtpStatusClasses(profile.status)

                return (
                  <tr key={profile.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{profile.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">{profile.host}</div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-gray-600">{profile.host}:{profile.port}</span>
                    </td>
                    <td className="p-4 text-gray-600">{profile.from}</td>
                    <td className="p-4">
                      <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', profile.entity ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700')}>
                        {profile.entity || 'No entity'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', getSmtpEncryptionClass(profile.encryption))}>{profile.encryption}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('h-[7px] w-[7px] flex-shrink-0 rounded-full', status.dot)} />
                        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', status.tag)}>{profile.status}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500">{profile.used}</td>
                    <td className="p-4 text-gray-500">{profile.lastTest}</td>
                  </tr>
                )
              })}
              {!isLoading && filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-gray-400">No SMTP profiles found in GoPhish.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 p-4">
          <span className="text-xs font-medium text-gray-500">{filteredProfiles.length} sending profiles</span>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <i className="ti ti-info-circle text-lg" />
        </div>
        <div>
          <h4 className="mb-1 text-sm font-bold text-gray-900">Sending profiles are managed from the WordPress admin panel</h4>
          <p className="text-xs leading-relaxed text-gray-500">
            This page is read-only. Creating, editing, deleting, or testing SMTP sending profiles is only available to Pukat Admins under WP Admin &rarr; Pukat &rarr; Master Sending Profiles.
          </p>
        </div>
      </div>
    </PageShell>
  )
}
