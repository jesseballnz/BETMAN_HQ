import Link from 'next/link';
import MetricCard, { PageTitle } from '@/components/MetricCard';
import { fetchCoreAuthSummary, type ProvisionedUser } from '@/lib/betmanCore';
import UserActions from './UserActions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 35;
const USER_FILTERS = ['signups', 'active', 'trials', 'paid'] as const;
type UserFilter = typeof USER_FILTERS[number];

interface UsersPageProps {
  searchParams?: {
    q?: string;
    page?: string;
    user?: string;
    filter?: string;
  };
}

function fmtDate(value: string | undefined): string {
  return value ? new Date(value).toLocaleString('en-NZ') : '-';
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function boolValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeUser(value: unknown): ProvisionedUser | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const email = textValue(row.email).toLowerCase();
  if (!email) return null;

  return {
    email,
    name: textValue(row.name),
    accountStatus: textValue(row.accountStatus),
    planType: textValue(row.planType),
    subscriptionStatus: textValue(row.subscriptionStatus),
    subscriptionActive: boolValue(row.subscriptionActive),
    createdAt: textValue(row.createdAt),
    verifiedAt: textValue(row.verifiedAt),
    passwordPending: boolValue(row.passwordPending),
    accessExpiresAt: textValue(row.accessExpiresAt),
    trialStartedAt: textValue(row.trialStartedAt),
    trialExpiresAt: textValue(row.trialExpiresAt),
    source: textValue(row.source),
    campaign: textValue(row.campaign),
    country: textValue(row.country),
    bettorType: textValue(row.bettorType),
    bettingFrequency: textValue(row.bettingFrequency),
  };
}

function includesQuery(user: ProvisionedUser, query: string): boolean {
  return [user.email, user.name, user.planType, user.subscriptionStatus, user.source, user.campaign]
    .some((value) => String(value || '').toLowerCase().includes(query));
}

function normalizeFilter(value: string | undefined): UserFilter | null {
  return USER_FILTERS.includes(value as UserFilter) ? value as UserFilter : null;
}

function isTrialUser(user: ProvisionedUser): boolean {
  return Boolean(user.trialStartedAt);
}

function isPaidUser(user: ProvisionedUser): boolean {
  if (!user.subscriptionActive) return false;
  const plan = String(user.planType || '').trim().toLowerCase();
  return !['tester', 'trial', 'free'].includes(plan);
}

function isActiveUser(user: ProvisionedUser): boolean {
  return user.accountStatus === 'active' || Boolean(user.subscriptionActive);
}

function matchesFilter(user: ProvisionedUser, filter: UserFilter | null): boolean {
  if (filter === 'active') return isActiveUser(user);
  if (filter === 'trials') return isTrialUser(user);
  if (filter === 'paid') return isPaidUser(user);
  return true;
}

function filterLabel(filter: UserFilter | null): string {
  if (filter === 'active') return 'Active Accounts';
  if (filter === 'trials') return 'Trial Accounts';
  if (filter === 'paid') return 'Paid Customers';
  if (filter === 'signups') return 'Signups';
  return 'Provisioned Customers';
}

function userDetailRows(user: ProvisionedUser): Array<[string, string | boolean | undefined]> {
  return [
    ['Email', user.email],
    ['Name', user.name],
    ['Account status', user.accountStatus],
    ['Plan', user.planType],
    ['Subscription', user.subscriptionStatus],
    ['Subscription active', user.subscriptionActive],
    ['Created', fmtDate(user.createdAt)],
    ['Verified', fmtDate(user.verifiedAt)],
    ['Password setup pending', user.passwordPending],
    ['Access expires', fmtDate(user.accessExpiresAt)],
    ['Trial started', fmtDate(user.trialStartedAt)],
    ['Trial expires', fmtDate(user.trialExpiresAt)],
    ['Source', user.source],
    ['Campaign', user.campaign],
    ['Country', user.country],
    ['Bettor type', user.bettorType],
    ['Betting frequency', user.bettingFrequency],
  ];
}

function displayValue(value: string | boolean | undefined): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value || '-';
}

function pageHref(page: number, query: string, filter: UserFilter | null): string {
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (query) params.set('q', query);
  params.set('page', String(page));
  return `/users?${params.toString()}`;
}

function userHref(email: string, query: string, filter: UserFilter | null): string {
  const params = new URLSearchParams();
  params.set('user', email);
  if (filter) params.set('filter', filter);
  if (query) params.set('q', query);
  return `/users?${params.toString()}`;
}

function UserDetail({ user }: { user: ProvisionedUser }) {
  return (
    <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{user.name || user.email}</h2>
          {user.name && <p className="text-sm text-slate-400">{user.email}</p>}
        </div>
        <UserActions email={user.email} />
      </div>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {userDetailRows(user).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-gray-950/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 break-words text-sm text-slate-200">{displayValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const summary = await fetchCoreAuthSummary().catch(() => null);
  const users = (summary?.provisionedUsers || [])
    .map(normalizeUser)
    .filter((user): user is ProvisionedUser => user !== null);

  const query = String(searchParams?.q || '').trim().toLowerCase();
  const filter = normalizeFilter(searchParams?.filter);
  const filteredByType = users.filter((user) => matchesFilter(user, filter));
  const filteredUsers = query ? filteredByType.filter((user) => includesQuery(user, query)) : filteredByType;
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(String(searchParams?.page || '1'), 10);
  const currentPage = Math.min(pageCount, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  const visibleUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedEmail = String(searchParams?.user || '').toLowerCase();
  const selectedUser = users.find((user) => user.email.toLowerCase() === selectedEmail) || null;
  const activeUsers = users.filter(isActiveUser).length;
  const trialUsers = users.filter(isTrialUser).length;
  const paidUsers = users.filter(isPaidUser).length;

  return (
    <div>
      <PageTitle subtitle="Provisioned Core customers and account state">Users</PageTitle>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Link href="/users?filter=signups" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400">
          <MetricCard title="Provisioned" value={users.length.toString()} subtitle="Core account rows" accent="blue" />
        </Link>
        <Link href="/users?filter=active" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <MetricCard title="Active" value={activeUsers.toString()} subtitle="Active or subscribed" accent="green" />
        </Link>
        <Link href="/users?filter=trials" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <MetricCard title="Trials" value={trialUsers.toString()} subtitle="Trial account rows" accent="green" />
        </Link>
        <Link href="/users?filter=paid" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400">
          <MetricCard title="Paid" value={paidUsers.toString()} subtitle="Paying customer rows" accent="gold" />
        </Link>
      </div>

      {selectedUser && <UserDetail user={selectedUser} />}

      <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-200">{filterLabel(filter)}</h2>
            <p className="mt-1 text-xs text-slate-500">Click a user to inspect their account.</p>
          </div>
          <span className="text-sm tabular-nums text-slate-400">
            {filteredUsers.length}{query || filter ? ` of ${users.length}` : ''} users
          </span>
        </div>

        <form method="get" className="mb-5 flex gap-2">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={searchParams?.q || ''}
            type="search"
            placeholder="Search name, email, plan, source or campaign"
            className="w-full max-w-xl rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-gray-950">Search</button>
          {(query || filter) && (
            <Link href={filter && query ? `/users?filter=${filter}` : '/users'} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-slate-300">
              Clear
            </Link>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-slate-400">
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Plan</th>
                <th className="px-3 py-2 text-left">Subscription</th>
                <th className="px-3 py-2 text-left">Verified</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.email} className="border-b border-gray-800 text-sm hover:bg-gray-800/50">
                  <td className="px-3 py-3">
                    <Link className="block font-semibold text-emerald-300 hover:text-emerald-200" href={userHref(user.email, query, filter)}>
                      {user.name || user.email}
                      {user.name && <span className="block text-xs font-normal text-slate-500">{user.email}</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{user.planType || '-'}</td>
                  <td className="px-3 py-3 text-slate-300">{user.subscriptionStatus || '-'}</td>
                  <td className="px-3 py-3 text-slate-300">{fmtDate(user.verifiedAt)}</td>
                  <td className="px-3 py-3 text-slate-300">{user.source || '-'}</td>
                  <td className="px-3 py-3 text-slate-300">{fmtDate(user.createdAt)}</td>
                </tr>
              ))}
              {!visibleUsers.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">No provisioned users available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">
              Page {currentPage} of {pageCount}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link href={pageHref(currentPage - 1, query, filter)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-slate-300">
                  Previous
                </Link>
              )}
              {currentPage < pageCount && (
                <Link href={pageHref(currentPage + 1, query, filter)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-slate-300">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
