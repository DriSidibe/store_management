import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ProtectedRoute, StaffRoute, SuperuserRoute } from './components/ProtectedRoute'
import ActivityLogPage from './pages/ActivityLogPage'
import AddProductPage from './pages/AddProductPage'
import ApprovisionningPage from './pages/ApprovisionningPage'
import BillingPage from './pages/BillingPage'
import AddProductToBillPage from './pages/AddProductToBillPage'
import CameraControlPage from './pages/CameraControlPage'
import CameraLivePage from './pages/CameraLivePage'
import CamerasListPage from './pages/CamerasListPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import CustomersPage from './pages/CustomersPage'
import ExistingBillsPage from './pages/ExistingBillsPage'
import FinalBillPage from './pages/FinalBillPage'
import LoginPage from './pages/LoginPage'
import LowStockPage from './pages/LowStockPage'
import MetricsPage from './pages/MetricsPage'
import MotionEyeDatesPage from './pages/MotionEyeDatesPage'
import MotionEyeMediaPage from './pages/MotionEyeMediaPage'
import MotionEyeViewerPage from './pages/MotionEyeViewerPage'
import ProductsPage from './pages/ProductsPage'
import ReceiptPage from './pages/ReceiptPage'
import SellProductPage from './pages/SellProductPage'
import SignupPage from './pages/SignupPage'
import SoldProductsPage from './pages/SoldProductsPage'
import StorefrontPage from './pages/StorefrontPage'
import UpdateProductPage from './pages/UpdateProductPage'
import UsersPage from './pages/UsersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/vitrine" element={<StorefrontPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/receipt/:saleId" element={<ReceiptPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/sell-product" element={<SellProductPage />} />
          <Route path="/selled-products" element={<SoldProductsPage />} />
          <Route path="/approvioning" element={<ApprovisionningPage />} />
          <Route path="/cameras" element={<CamerasListPage />} />
          <Route path="/cameras/:id" element={<CameraLivePage />} />
          <Route path="/low-stock" element={<LowStockPage />} />

          <Route element={<StaffRoute />}>
            <Route path="/add-product" element={<AddProductPage />} />
            <Route path="/update-product" element={<UpdateProductPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
          </Route>

          <Route element={<SuperuserRoute />}>
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/existing-bills" element={<ExistingBillsPage />} />
            <Route path="/add-product-to-bill/:billId" element={<AddProductToBillPage />} />
            <Route path="/final-bill/:billId" element={<FinalBillPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/activity-log" element={<ActivityLogPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/camera/control" element={<CameraControlPage />} />
            <Route path="/camera/viewer" element={<MotionEyeViewerPage />} />
            <Route path="/camera/viewer/:cameraId" element={<MotionEyeDatesPage />} />
            <Route path="/camera/viewer/:cameraId/:date" element={<MotionEyeMediaPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
