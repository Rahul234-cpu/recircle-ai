import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Loader } from './components/ui';
import { ROLE_HOME } from './utils/constants';

import Landing from './pages/Landing';
import { About, FAQ, HowItWorks, NotFound } from './pages/InfoPages';
import WasteCollection from './pages/WasteCollection';
import Marketplace from './pages/Marketplace';
import BrowseProducts from './pages/BrowseProducts';
import ProductDetails from './pages/ProductDetails';
import BecomeKabadiwala from './pages/BecomeKabadiwala';
import Contact from './pages/Contact';
import { Login, Register } from './pages/AuthPages';

import CustomerDashboard from './dashboards/customer/CustomerDashboard';
import SellWaste from './dashboards/customer/SellWaste';
import SellProduct from './dashboards/customer/SellProduct';
import MyListings from './dashboards/customer/MyListings';
import { EcoImpact, Wallet } from './dashboards/customer/WalletImpact';
import BuyerDashboard from './dashboards/buyer/BuyerDashboard';
import {
  Availability, CollectorDashboard, CollectorReviews, Earnings, NearbyRequests, ServiceAreas,
} from './dashboards/collector/CollectorPages';
import BookingsList from './dashboards/shared/BookingsList';
import BookingDetail from './dashboards/shared/BookingDetail';
import OrdersList from './dashboards/shared/OrdersList';
import OrderDetail from './dashboards/shared/OrderDetail';
import Messages from './dashboards/shared/Messages';
import { Complaints, Favourites, Profile, Settings } from './dashboards/shared/AccountPages';
import {
  AIActivity, AdminBookings, AdminComplaints, AdminDashboard, AdminListings, AdminOrders, AdminSettings, AdminTransactions,
  Analytics, CategoriesPage, ManageCollectors, ManageUsers, Rewards, ScrapRates,
} from './dashboards/admin/AdminPages';

/** Notification links like /orders/:id or /bookings/:id are role-agnostic; route them to the right dashboard. */
function RoleRedirect({ section }) {
  const { user, ready } = useAuth();
  const { id } = useParams();
  const { search } = useLocation();
  if (!ready) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  const map = { reviews: user.role === 'collector' ? 'reviews' : 'profile' };
  const target = `/${user.role}/${map[section] || section}${id ? `/${id}` : ''}${search}`;
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="waste-collection" element={<WasteCollection />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="products" element={<BrowseProducts />} />
        <Route path="products/:id" element={<ProductDetails />} />
        <Route path="become-ecopartner" element={<BecomeKabadiwala />} />
        <Route path="become-kabadiwala" element={<Navigate to="/become-ecopartner" replace />} />
        <Route path="contact" element={<Contact />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
      </Route>

      {/* Role-agnostic deep links (used by notifications) */}
      <Route path="bookings/:id" element={<RoleRedirect section="bookings" />} />
      <Route path="orders/:id" element={<RoleRedirect section="orders" />} />
      <Route path="orders" element={<RoleRedirect section="orders" />} />
      <Route path="messages" element={<RoleRedirect section="messages" />} />
      <Route path="reviews" element={<RoleRedirect section="reviews" />} />
      <Route path="complaints" element={<RoleRedirect section="complaints" />} />
      <Route path="dashboard" element={<RoleRedirect section="" />} />

      <Route path="customer" element={<ProtectedRoute roles={['customer']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<CustomerDashboard />} />
        <Route path="sell-waste" element={<SellWaste key="photo" mode="photo" />} />
        <Route path="book-collection" element={<SellWaste key="manual" mode="manual" />} />
        <Route path="bookings" element={<BookingsList />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="sell-product" element={<SellProduct key="new" />} />
        <Route path="sell-product/:id" element={<SellProduct key="edit" />} />
        <Route path="listings" element={<MyListings />} />
        <Route path="orders" element={<OrdersList />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="favourites" element={<Favourites />} />
        <Route path="messages" element={<Messages />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="impact" element={<EcoImpact />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="collector" element={<ProtectedRoute roles={['collector']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<CollectorDashboard />} />
        <Route path="requests" element={<NearbyRequests />} />
        <Route path="bookings" element={<BookingsList key="all" preset="all" title="My bookings" />} />
        <Route path="active" element={<BookingsList key="active" preset="active" title="Active collections" />} />
        <Route path="completed" element={<BookingsList key="completed" preset="completed" title="Completed collections" />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="service-areas" element={<ServiceAreas />} />
        <Route path="availability" element={<Availability />} />
        <Route path="reviews" element={<CollectorReviews />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="buyer" element={<ProtectedRoute roles={['buyer']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<BuyerDashboard />} />
        <Route path="orders" element={<OrdersList />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="favourites" element={<Favourites />} />
        <Route path="messages" element={<Messages />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<ManageUsers />} />
        <Route path="collectors" element={<ManageCollectors key="all" />} />
        <Route path="verification" element={<ManageCollectors key="pending" preset="pending" />} />
        <Route path="waste-categories" element={<CategoriesPage key="waste" kind="waste" />} />
        <Route path="product-categories" element={<CategoriesPage key="product" kind="product" />} />
        <Route path="scrap-rates" element={<ScrapRates />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        <Route path="listings" element={<AdminListings />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="ai-activity" element={<AIActivity />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="complaints" element={<AdminComplaints />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="home" element={<HomeRedirect />} />
      <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
    </Routes>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] : '/'} replace />;
}
