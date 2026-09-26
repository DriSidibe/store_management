import client from './client'

export function toFormData(obj) {
  const fd = new FormData()
  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    fd.append(key, value)
  })
  return fd
}

// --- Reference data -------------------------------------------------------

export const listUnits = () => client.get('/units/').then((r) => r.data)
export const listShelves = () => client.get('/shelves/').then((r) => r.data)
export const listCategories = () => client.get('/categories/').then((r) => r.data)
export const createCategory = (data) => client.post('/categories/', data).then((r) => r.data)
export const updateCategory = (id, data) => client.patch(`/categories/${id}/`, data).then((r) => r.data)
export const deleteCategory = (id) => client.delete(`/categories/${id}/`)

// --- Products ---------------------------------------------------------------

export const listProducts = (params) => client.get('/products/', { params }).then((r) => r.data)
export const getProduct = (productId) => client.get(`/products/${productId}/`).then((r) => r.data)
export const productsLookup = () => client.get('/products/lookup/').then((r) => r.data)
export const listLowStockProducts = (params) =>
  client.get('/products/low-stock/', { params }).then((r) => r.data)
export const createProduct = (data) =>
  client.post('/products/', toFormData(data)).then((r) => r.data)
export const updateProduct = (productId, data) =>
  client.patch(`/products/${productId}/`, toFormData(data)).then((r) => r.data)
export const deleteProduct = (productId) => client.delete(`/products/${productId}/`)
export const importProductsCsv = (file) =>
  client.post('/products/import-csv/', toFormData({ file })).then((r) => r.data)

// --- Public storefront (no auth) -------------------------------------------

export const listPublicProducts = (params) =>
  client.get('/public/products/', { params }).then((r) => r.data)
export const listPublicProductCompanies = () =>
  client.get('/public/products/companies/').then((r) => r.data)
export const listPublicProductCategories = () =>
  client.get('/public/products/categories/').then((r) => r.data)

// --- Sales --------------------------------------------------------------

export const listSales = (params) => client.get('/sales/', { params }).then((r) => r.data)
export const getSale = (id) => client.get(`/sales/${id}/`).then((r) => r.data)
export const dailySales = (date) =>
  client.get('/sales/daily/', { params: date ? { date } : {} }).then((r) => r.data)
export const createSale = (data) => client.post('/sales/', toFormData(data)).then((r) => r.data)
export const updateSale = (id, data) =>
  client.patch(`/sales/${id}/`, toFormData(data)).then((r) => r.data)
export const deleteSale = (id) => client.delete(`/sales/${id}/`)
// JSON (not form data) so a cleared field can be sent as null.
export const editSale = (id, data) => client.patch(`/sales/${id}/`, data).then((r) => r.data)
export const promoteSaleToProduct = (id, data) =>
  client.post(`/sales/${id}/promote-to-product/`, toFormData(data)).then((r) => r.data)

// --- Approvisionnement ----------------------------------------------------

export const listRavitaillement = () => client.get('/ravitaillement/').then((r) => r.data)
export const createRavitaillement = (data) =>
  client.post('/ravitaillement/', toFormData(data)).then((r) => r.data)
export const updateRavitaillement = (id, data) =>
  client.patch(`/ravitaillement/${id}/`, toFormData(data)).then((r) => r.data)
export const deleteRavitaillement = (id) => client.delete(`/ravitaillement/${id}/`)
// Without data: closes a request for a product already in the catalog.
// With the catalog form data: creates the product the request was for.
export const promoteRavitaillementToProduct = (id, data) =>
  client
    .post(`/ravitaillement/${id}/promote-to-product/`, data ? toFormData(data) : undefined)
    .then((r) => r.data)

export const listSupplierEntrances = () => client.get('/supplier-entrances/').then((r) => r.data)
export const createSupplierEntrance = (data) =>
  client.post('/supplier-entrances/', toFormData(data)).then((r) => r.data)

// --- Billing ---------------------------------------------------------------

export const listBills = () => client.get('/bills/').then((r) => r.data)
export const createBill = (customerName) =>
  client.post('/bills/', { customer_name: customerName }).then((r) => r.data)
export const listBillItems = (billId) => client.get(`/bills/${billId}/items/`).then((r) => r.data)
export const addBillItem = (billId, productId, quantity) =>
  client
    .post(`/bills/${billId}/items/`, { product_id: productId, quantity })
    .then((r) => r.data)
export const finalizeBill = (billId) =>
  client.get(`/bills/${billId}/finalize/`).then((r) => r.data)

// --- Customers ---------------------------------------------------------------

export const listCustomers = (params) => client.get('/customers/', { params }).then((r) => r.data)
export const getCustomer = (id) => client.get(`/customers/${id}/`).then((r) => r.data)
export const createCustomer = (data) => client.post('/customers/', data).then((r) => r.data)
export const updateCustomer = (id, data) => client.patch(`/customers/${id}/`, data).then((r) => r.data)
export const deleteCustomer = (id) => client.delete(`/customers/${id}/`)
export const customerHistory = (id) => client.get(`/customers/${id}/history/`).then((r) => r.data)

// --- Activity log -----------------------------------------------------------

export const listActivityLog = (params) =>
  client.get('/activity-log/', { params }).then((r) => r.data)

// --- Metrics & reports -------------------------------------------------------

export const fetchMetrics = () => client.get('/metrics/').then((r) => r.data)
export const fetchSalesTrend = (days = 30) =>
  client.get('/metrics/trend/', { params: { days } }).then((r) => r.data)
export const fetchTopProducts = (limit = 5) =>
  client.get('/metrics/top-products/', { params: { limit } }).then((r) => r.data)

export const globalSearch = (q) => client.get('/search/', { params: { q } }).then((r) => r.data)

export async function downloadReport(target, format = 'pdf', extraParams = {}) {
  const params = format === 'csv' ? { ...extraParams, export: 'csv' } : extraParams
  const response = await client.get(`/reports/${target}/`, { params, responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `${target}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Loads the PDF report into a hidden iframe and opens the browser's print
 * dialog directly - more reliable than opening a new tab, which modern
 * Chromium blocks from navigating to a blob: URL created by the opener. */
export async function printReport(target, extraParams = {}) {
  const response = await client.get(`/reports/${target}/`, { params: extraParams, responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }
  setTimeout(() => {
    iframe.remove()
    URL.revokeObjectURL(url)
  }, 60000)
}

// --- Users & permissions -----------------------------------------------------

export const listUsers = (params) => client.get('/auth/users/', { params }).then((r) => r.data)
export const createUser = (data) => client.post('/auth/users/', data).then((r) => r.data)
export const updateUser = (id, data) => client.patch(`/auth/users/${id}/`, data).then((r) => r.data)
export const deleteUser = (id) => client.delete(`/auth/users/${id}/`)

// --- Camera ---------------------------------------------------------------

export const listCameras = () => client.get('/camera/cameras/').then((r) => r.data)
export const getCamera = (id) => client.get(`/camera/cameras/${id}/`).then((r) => r.data)
export const createCamera = (data) => client.post('/camera/cameras/', data).then((r) => r.data)
export const updateCamera = (id, data) =>
  client.patch(`/camera/cameras/${id}/`, data).then((r) => r.data)
export const deleteCamera = (id) => client.delete(`/camera/cameras/${id}/`)
export const cameraStatus = (id) => client.get(`/camera/cameras/${id}/status/`).then((r) => r.data)
export const flipCamera = (id, type, enabled) =>
  client.post(`/camera/cameras/${id}/flip/`, { type, enabled }).then((r) => r.data)
export const saveCameraStream = (id) =>
  client.post(`/camera/cameras/${id}/save/`).then((r) => r.data)
export const startAllCameras = () => client.get('/camera/start-all/').then((r) => r.data)
export const stopAllCameras = () => client.get('/camera/stop-all/').then((r) => r.data)
export const saveSnapshot = (cameraId, snapshot) =>
  client.post('/camera/save-snapshot/', { camera_id: cameraId, snapshot }).then((r) => r.data)
export const listLocalRecordings = () => client.get('/camera/recordings/').then((r) => r.data)
export const listMotionEyeCameras = () => client.get('/camera/motioneye/').then((r) => r.data)
export const listMotionEyeDates = (cameraId) =>
  client.get(`/camera/motioneye/${cameraId}/`).then((r) => r.data)
export const listMotionEyeMedia = (cameraId, date) =>
  client.get(`/camera/motioneye/${cameraId}/${date}/`).then((r) => r.data)
