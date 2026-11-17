import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { WasteAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { AsyncView, DemoBadge, PageHeader, Pagination, StatusBadge, Tabs } from '../../components/ui';
import { date, inr, num } from '../../utils/format';

const GROUPS = {
  all: undefined,
  active: 'Pending,Accepted,Collector Assigned,On The Way,Arrived,Weight Verified,Awaiting Customer Confirmation',
  completed: 'Completed',
  closed: 'Cancelled,Rejected',
};

export default function BookingsList({ preset = 'all', title = 'My bookings' }) {
  const { user } = useAuth();
  const { tick } = useNotifications();
  const [tab, setTab] = useState(preset);
  const [page, setPage] = useState(1);
  const status = GROUPS[tab];
  const { data, loading, error, refetch } = useFetch(() => WasteAPI.bookings({ status, page, limit: 10 }), [tab, page, tick]);
  const base = `/${user.role}/bookings`;
  const tabs = user.role === 'collector'
    ? [['all', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['closed', 'Cancelled']]
    : [['all', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['closed', 'Cancelled / Rejected']];

  return (
    <>
      <PageHeader title={title} subtitle={user.role === 'collector' ? 'Pickups you have accepted or been assigned.' : 'Track every pickup from request to receipt.'} actions={user.role === 'customer' && <Link to="/customer/sell-waste" className="btn-primary">New pickup</Link>} />
      <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); setPage(1); }} />
      <AsyncView loading={loading} error={error} onRetry={refetch} empty={!data?.items?.length} emptyProps={{ icon: ClipboardList, title: 'No bookings here', message: user.role === 'collector' ? 'Accept nearby requests to see them here.' : 'Book a pickup to get started.' }}>
        <div className="card divide-y divide-gray-50 overflow-hidden">
          {data?.items?.map((b) => (
            <Link key={b._id} to={`${base}/${b._id}`} className="flex flex-col gap-2 p-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.materialSummary?.map((m) => m.name).join(', ')}</p>
                <p className="text-xs text-gray-500">{b.bookingRef} · {date(b.preferredDate)} · {b.preferredTimeSlot} · {b.pickupAddress?.locality || b.pickupAddress?.city}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="font-semibold">{inr(b.finalPrice ?? b.estimatedPrice)}</p>
                  <p className="text-xs text-gray-400">{num(b.verifiedWeight ?? b.estimatedWeight)} kg {b.finalPrice == null ? '(est.)' : ''}</p>
                </div>
                <StatusBadge status={b.status} />
                <DemoBadge show={b.isDemo} />
                <ChevronRight className="hidden h-4 w-4 text-gray-300 sm:block" />
              </div>
            </Link>
          ))}
        </div>
        <Pagination pagination={data?.pagination} onPage={setPage} />
      </AsyncView>
    </>
  );
}
