import { useState } from 'react';
import { Search } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import useDebounce from '../../hooks/useDebounce';
import { AsyncView, PageHeader, Pagination, Tabs } from '../../components/ui';

/**
 * Reusable paginated admin table.
 * columns: [{ label, render: (row) => node, className }]
 * tabs: [[value, label]] mapped to `tabParam` query param.
 */
export default function AdminTable({ title, subtitle, fetcher, columns, tabs, tabParam = 'status', defaultTab = '', searchPlaceholder, actions, extraParams = {}, refreshKey, header }) {
  const [tab, setTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const params = { page, limit: 20, ...(tab ? { [tabParam]: tab } : {}), ...(dq ? { q: dq } : {}), ...extraParams };
  const { data, loading, error, refetch } = useFetch(() => fetcher(params), [tab, page, dq, refreshKey, JSON.stringify(extraParams)]);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {header?.(data)}
      {tabs && <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); setPage(1); }} />}
      {searchPlaceholder && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      )}
      <AsyncView loading={loading && !data} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ title: 'No records found' }}>
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr>{columns.map((c) => <th key={c.label} className={c.className}>{c.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {data?.items?.map((row) => <tr key={row._id} className="hover:bg-gray-50/60">{columns.map((c) => <td key={c.label} className={c.className}>{c.render(row, refetch)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </AsyncView>
    </>
  );
}
