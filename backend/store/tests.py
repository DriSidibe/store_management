from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Category, Product, Ravitaillement, Sell, Unity


class CategoryApiTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user('chef', password='x', is_staff=True)
        self.seller = User.objects.create_user('vendeur', password='x')
        self.unit = Unity.objects.create(name='Sac')

    def create_product(self, **overrides):
        data = {
            'product_id_etg': 'A1', 'product_id_cas': '1', 'product_name': 'ciment',
            'product_unity': self.unit.id, 'product_quantity': 3, 'product_company': 'CIMAF',
            'product_cp': 4000, 'product_sp': 5000, **overrides,
        }
        return self.client.post('/api/products/', data)

    def test_list_is_unpaginated_sorted_and_counts_live_products(self):
        elec = Category.objects.create(name='Électricité')
        Category.objects.create(name='Bois')
        common = dict(product_unity=self.unit, product_quantity=1, product_company='X', product_cp=1, product_sp=1)
        Product.objects.create(product_id='p1', product_name='Câble', product_category=elec, **common)
        Product.objects.create(product_id='p2', product_name='Prise', product_category=elec, is_deleted=True, **common)

        self.client.force_authenticate(self.seller)
        response = self.client.get('/api/categories/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [(c['name'], c['products_count']) for c in response.data],
            [('Bois', 0), ('Électricité', 1)],
        )

    def test_only_staff_can_modify(self):
        self.client.force_authenticate(self.seller)
        self.assertEqual(self.client.post('/api/categories/', {'name': 'Plomberie'}).status_code, 403)

        self.client.force_authenticate(self.staff)
        response = self.client.post('/api/categories/', {'name': '  Plomberie   sanitaire '})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Plomberie sanitaire')
        self.assertEqual(response.data['products_count'], 0)

    def test_rejects_case_insensitive_duplicates_but_allows_renaming_itself(self):
        category = Category.objects.create(name='Maçonnerie')
        self.client.force_authenticate(self.staff)

        response = self.client.post('/api/categories/', {'name': 'maçonnerie'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['name'][0]), 'Cette catégorie existe déjà.')

        response = self.client.patch(f'/api/categories/{category.id}/', {'name': 'MAÇONNERIE'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'MAÇONNERIE')

    def test_product_uses_an_existing_category_case_insensitively(self):
        category = Category.objects.create(name='Électricité')
        self.client.force_authenticate(self.staff)

        response = self.create_product(category='électricité')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Product.objects.get().product_category, category)

    def test_product_rejects_an_unknown_category_without_creating_it(self):
        self.client.force_authenticate(self.staff)

        response = self.create_product(category='Inconnue')

        self.assertEqual(response.status_code, 400)
        self.assertIn('category', response.data)
        self.assertFalse(Category.objects.exists())
        self.assertFalse(Product.objects.exists())


class RavitaillementReceiveTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user('chef', password='x', is_staff=True))
        self.unit = Unity.objects.create(name='Sac')
        self.category = Category.objects.create(name='Maçonnerie')

    def url(self, rav):
        return f'/api/ravitaillement/{rav.id}/promote-to-product/'

    def existing_product_request(self):
        product = Product.objects.create(
            product_id='p1', product_name='Ciment', product_unity=self.unit, product_quantity=4,
            product_company='X', product_cp=1, product_sp=1,
        )
        return product, Ravitaillement.objects.create(product=product, commanded_quantity='1 paquet')

    def test_received_units_are_added_to_an_existing_product(self):
        product, rav = self.existing_product_request()

        response = self.client.post(self.url(rav), {'received_quantity': 10})

        self.assertEqual(response.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(product.product_quantity, 14)
        rav.refresh_from_db()
        self.assertTrue(rav.is_deleted)
        self.assertEqual(Product.objects.count(), 1)

    def test_existing_product_requires_a_valid_received_quantity(self):
        product, rav = self.existing_product_request()

        for bad in ({}, {'received_quantity': 'abc'}, {'received_quantity': -2}):
            self.assertEqual(self.client.post(self.url(rav), bad).status_code, 400)

        product.refresh_from_db()
        self.assertEqual(product.product_quantity, 4)
        rav.refresh_from_db()
        self.assertFalse(rav.is_deleted)

    def test_new_product_requires_the_catalog_details(self):
        rav = Ravitaillement.objects.create(product_name='Fer de 8', commanded_quantity='50')

        response = self.client.post(self.url(rav))

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.exists())
        rav.refresh_from_db()
        self.assertFalse(rav.is_deleted)

    def test_new_product_is_created_with_its_category_and_request_closed(self):
        rav = Ravitaillement.objects.create(product_name='fer de 8', commanded_quantity='50')

        response = self.client.post(self.url(rav), {
            'product_id_etg': 'B2', 'product_id_cas': '4', 'product_unity': self.unit.id,
            'product_quantity': 50, 'product_company': 'SOTACI', 'product_cp': 2500,
            'product_sp': 3000, 'category': 'Maçonnerie',
        })

        self.assertEqual(response.status_code, 201, response.data)
        product = Product.objects.get()
        self.assertEqual((product.product_name, product.product_category), ('Fer De 8', self.category))
        rav.refresh_from_db()
        self.assertTrue(rav.is_deleted)


class SaleStockTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))
        unit = Unity.objects.create(name='Sac')
        common = dict(product_unity=unit, product_company='X', product_cp=1, product_sp=1)
        self.cement = Product.objects.create(product_id='p1', product_name='Ciment', product_quantity=10, **common)
        self.iron = Product.objects.create(product_id='p2', product_name='Fer', product_quantity=5, **common)

    def sell(self, **data):
        return self.client.post('/api/sales/', {'sell_date': '2026-09-26T10:00', 'total_price': 1000, **data})

    def stock(self, product):
        product.refresh_from_db()
        return product.product_quantity

    def test_selling_a_product_decreases_its_stock(self):
        response = self.sell(product=self.cement.id, quantity=3)

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.stock(self.cement), 7)

    def test_sale_beyond_stock_is_refused_and_nothing_is_recorded(self):
        response = self.sell(product=self.cement.id, quantity=11)

        self.assertEqual(response.status_code, 400)
        self.assertIn('il en reste 10', str(response.data['quantity']))
        self.assertEqual(self.stock(self.cement), 10)
        self.assertFalse(Sell.objects.exists())

    def test_off_catalog_sale_touches_no_stock(self):
        response = self.sell(product_name='Clou', quantity=50)

        self.assertEqual(response.status_code, 201)
        self.assertEqual((self.stock(self.cement), self.stock(self.iron)), (10, 5))

    def test_editing_quantity_adjusts_stock_by_the_difference(self):
        sale_id = self.sell(product=self.cement.id, quantity=3).data['id']

        self.client.patch(f'/api/sales/{sale_id}/', {'quantity': 5})
        self.assertEqual(self.stock(self.cement), 5)
        self.client.patch(f'/api/sales/{sale_id}/', {'quantity': 1})
        self.assertEqual(self.stock(self.cement), 9)

    def test_moving_or_linking_a_sale_moves_the_stock(self):
        sale_id = self.sell(product=self.cement.id, quantity=3).data['id']
        self.client.patch(f'/api/sales/{sale_id}/', {'product': self.iron.id})
        self.assertEqual((self.stock(self.cement), self.stock(self.iron)), (10, 2))

        adhoc_id = self.sell(product_name='Fer de 8', quantity=2).data['id']
        self.client.patch(f'/api/sales/{adhoc_id}/', {'product': self.iron.id})
        self.assertEqual(self.stock(self.iron), 0)

    def test_deleting_a_sale_gives_the_units_back(self):
        sale_id = self.sell(product=self.cement.id, quantity=4).data['id']

        self.assertEqual(self.client.delete(f'/api/sales/{sale_id}/').status_code, 204)

        self.assertEqual(self.stock(self.cement), 10)

    def test_sales_from_before_stock_tracking_are_left_alone(self):
        legacy = Sell.objects.create(product=self.cement, quantity=3, total_price=1000, sell_date='2026-01-01T10:00Z')

        self.client.patch(f'/api/sales/{legacy.id}/', {'quantity': 4})
        self.client.delete(f'/api/sales/{legacy.id}/')

        self.assertEqual(self.stock(self.cement), 10)


class SaleEditPermissionTests(APITestCase):
    def setUp(self):
        unit = Unity.objects.create(name='Sac')
        self.product = Product.objects.create(
            product_id='p1', product_name='Ciment', product_quantity=10, product_unity=unit,
            product_company='X', product_cp=1, product_sp=1,
        )
        self.sale = Sell.objects.create(product_name='Ciment', quantity=2, total_price=1000, sell_date='2026-09-26T10:00Z')
        self.url = f'/api/sales/{self.sale.id}/'

    def test_seller_can_link_a_sale_but_not_edit_it(self):
        self.client.force_authenticate(User.objects.create_user('vendeur', password='x'))

        self.assertEqual(self.client.patch(self.url, {'total_price': 1}).status_code, 403)
        self.assertEqual(self.client.patch(self.url, {'product': self.product.id}).status_code, 200)

    def test_admin_can_edit_a_sale(self):
        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))

        response = self.client.patch(self.url, {'total_price': 1500, 'customer_name': 'Awa', 'quantity': 3})

        self.assertEqual(response.status_code, 200, response.data)
        self.sale.refresh_from_db()
        self.assertEqual((float(self.sale.total_price), self.sale.customer_name, self.sale.quantity), (1500.0, 'Awa', 3))


class SaleCancelPermissionTests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user('auteur', password='x')
        self.sale = Sell.objects.create(
            product_name='Ciment', quantity=1, total_price=1000, sell_date='2026-09-26T10:00Z', sold_by=self.author,
        )
        self.url = f'/api/sales/{self.sale.id}/'

    def cancel_as(self, user):
        self.client.force_authenticate(user)
        return self.client.delete(self.url).status_code

    def test_another_seller_cannot_cancel(self):
        self.assertEqual(self.cancel_as(User.objects.create_user('autre', password='x')), 403)
        self.sale.refresh_from_db()
        self.assertFalse(self.sale.is_deleted)

    def test_author_can_cancel(self):
        self.assertEqual(self.cancel_as(self.author), 204)

    def test_admin_can_cancel_any_sale(self):
        self.assertEqual(self.cancel_as(User.objects.create_superuser('admin', password='x')), 204)


class SalesPeriodTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user('vendeur', password='x'))
        for day, price in [('2026-09-10', 100), ('2026-09-12', 200), ('2026-09-15', 400), ('2026-09-20', 800)]:
            Sell.objects.create(product_name='Clou', quantity=1, total_price=price, sell_date=f'{day}T10:00Z')

    def get(self, **params):
        return self.client.get('/api/sales/daily/', params)

    def test_period_includes_both_ends(self):
        response = self.get(start='2026-09-12', end='2026-09-15')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['sales']), 2)
        self.assertEqual(float(response.data['total']), 600)
        self.assertEqual((response.data['start'], response.data['end']), ('2026-09-12', '2026-09-15'))

    def test_single_date_still_works(self):
        response = self.get(date='2026-09-20')

        self.assertEqual([float(s['total_price']) for s in response.data['sales']], [800])

    def test_invalid_or_reversed_period_is_a_clear_400(self):
        self.assertEqual(self.get(start='2026-09-15', end='2026-09-12').status_code, 400)
        self.assertEqual(self.get(start='15/09/2026', end='2026-09-20').status_code, 400)

    def test_running_profit_is_cumulative_over_the_period(self):
        unit = Unity.objects.create(name='Sac')
        product = Product.objects.create(
            product_id='p1', product_name='Ciment', product_quantity=10, product_unity=unit,
            product_company='X', product_cp=100, product_sp=150,
        )
        a = Sell.objects.create(product=product, quantity=2, total_price=300, sell_date='2026-09-12T08:00Z')
        b = Sell.objects.create(product=product, quantity=1, total_price=150, sell_date='2026-09-15T08:00Z')

        benefits = self.get(start='2026-09-10', end='2026-09-20').data['benefits']

        self.assertEqual(benefits[a.pk], [100.0, 100.0])
        self.assertEqual(benefits[b.pk], [50.0, 150.0])
