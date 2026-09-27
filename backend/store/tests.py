from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from django.core.files.uploadedfile import SimpleUploadedFile

from .models import Bill, Category, Product, ProductPriceChange, Ravitaillement, Sell, Unity


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

    def test_received_units_are_added_to_an_existing_product_at_average_cost(self):
        product, rav = self.existing_product_request()

        response = self.client.post(self.url(rav), {'received_quantity': 10, 'unit_cost': 8})

        self.assertEqual(response.status_code, 200)
        product.refresh_from_db()
        # (4 x 1 + 10 x 8) / 14
        self.assertEqual((product.product_quantity, product.product_cp), (14, 6.0))
        rav.refresh_from_db()
        self.assertTrue(rav.is_deleted)
        self.assertEqual(Product.objects.count(), 1)

    def test_receiving_units_requires_their_purchase_price(self):
        product, rav = self.existing_product_request()

        for bad in ({'received_quantity': 10}, {'received_quantity': 10, 'unit_cost': -1}):
            self.assertEqual(self.client.post(self.url(rav), bad).status_code, 400)

        product.refresh_from_db()
        self.assertEqual(product.product_quantity, 4)

    def test_receiving_nothing_just_closes_the_request(self):
        product, rav = self.existing_product_request()

        self.assertEqual(self.client.post(self.url(rav), {'received_quantity': 0}).status_code, 200)

        product.refresh_from_db()
        self.assertEqual((product.product_quantity, product.product_cp), (4, 1))
        rav.refresh_from_db()
        self.assertTrue(rav.is_deleted)

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
        a = Sell.objects.create(product=product, quantity=2, total_price=300, unit_cost=100, sell_date='2026-09-12T08:00Z')
        b = Sell.objects.create(product=product, quantity=1, total_price=150, unit_cost=100, sell_date='2026-09-15T08:00Z')

        benefits = self.get(start='2026-09-10', end='2026-09-20').data['benefits']

        self.assertEqual(benefits[a.pk], [100.0, 100.0])
        self.assertEqual(benefits[b.pk], [50.0, 150.0])


class ProductRestockTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(User.objects.create_user('vendeur', password='x'))
        self.product = Product.objects.create(
            product_id='P1', product_name='Ciment', product_quantity=4, product_unity=Unity.objects.create(name='Sac'),
            product_company='X', product_cp=1000, product_sp=1500,
        )

    def restock(self, **data):
        return self.client.post(f'/api/products/{self.product.product_id}/restock/', data)

    def test_cost_becomes_the_weighted_average_with_the_stock_on_hand(self):
        response = self.restock(quantity=6, unit_cost=1500)

        self.assertEqual(response.status_code, 200, response.data)
        # (4 x 1000 + 6 x 1500) / 10
        self.assertEqual((response.data['product_quantity'], response.data['product_cp']), (10, 1300.0))
        self.assertEqual(response.data['product_sp'], 1500)

    def test_empty_or_negative_stock_takes_the_new_cost(self):
        for on_hand in (0, -3):
            Product.objects.filter(pk=self.product.pk).update(product_quantity=on_hand, product_cp=1000)

            response = self.restock(quantity=5, unit_cost=1200)

            self.assertEqual((response.data['product_quantity'], response.data['product_cp']), (on_hand + 5, 1200.0))

    def test_a_new_selling_price_can_be_set_with_the_restock(self):
        response = self.restock(quantity=6, unit_cost=1500, selling_price=2000)

        self.assertEqual((response.data['product_cp'], response.data['product_sp']), (1300.0, 2000))

    def test_empty_selling_price_keeps_the_current_one(self):
        response = self.restock(quantity=6, unit_cost=1500, selling_price='')

        self.assertEqual(response.data['product_sp'], 1500)

    def test_invalid_input_changes_nothing(self):
        for bad in ({}, {'quantity': 0, 'unit_cost': 10}, {'quantity': 'abc', 'unit_cost': 10},
                    {'quantity': 5}, {'quantity': 5, 'unit_cost': -1},
                    {'quantity': 5, 'unit_cost': 10, 'selling_price': -1},
                    {'quantity': 5, 'unit_cost': 10, 'selling_price': 'abc'}):
            self.assertEqual(self.restock(**bad).status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(
            (self.product.product_quantity, self.product.product_cp, self.product.product_sp), (4, 1000, 1500)
        )


class RecordedPriceTests(APITestCase):
    """A sale or bill keeps the prices it was made at: changing the product's
    prices afterwards must not rewrite past amounts or profits."""

    def setUp(self):
        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))
        self.product = Product.objects.create(
            product_id='P1', product_name='Ciment', product_quantity=10, product_unity=Unity.objects.create(name='Sac'),
            product_company='X', product_cp=100, product_sp=150,
        )

    def test_sale_profit_keeps_the_cost_at_sale_time(self):
        sale_id = self.client.post('/api/sales/', {
            'product': self.product.id, 'quantity': 2, 'total_price': 300, 'sell_date': '2026-09-20T10:00',
        }).data['id']
        self.assertEqual(float(Sell.objects.get(pk=sale_id).unit_cost), 100)

        self.client.post(f'/api/products/{self.product.product_id}/restock/', {'quantity': 8, 'unit_cost': 400})

        benefits = self.client.get('/api/sales/daily/', {'date': '2026-09-20'}).data['benefits']
        self.assertEqual(benefits[sale_id], [100.0, 100.0])
        self.assertEqual(float(self.client.get('/api/metrics/').data['total_profit']), 100)

    def test_bill_keeps_the_selling_price_at_billing_time(self):
        bill = Bill.objects.create(customer_name='Awa')
        self.client.post(f'/api/bills/{bill.id}/items/', {'product_id': 'P1', 'quantity': 2})

        Product.objects.filter(pk=self.product.pk).update(product_sp=999)

        final = self.client.get(f'/api/bills/{bill.id}/finalize/').data
        self.assertEqual(float(final['items'][0]['unit_price']), 150)
        self.assertEqual(float(final['grand_total']), 300)


class PriceHistoryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('chef', password='x', is_staff=True)
        self.client.force_authenticate(self.user)
        self.unit = Unity.objects.create(name='Sac')
        self.product = Product.objects.create(
            product_id='P1', product_name='Ciment', product_quantity=4, product_unity=self.unit,
            product_company='X', product_cp=1000, product_sp=1500,
        )

    def history(self):
        return self.client.get(f'/api/products/{self.product.product_id}/price-history/').data

    def test_creation_is_recorded(self):
        Category.objects.create(name='Maçonnerie')
        response = self.client.post('/api/products/', {
            'product_id_etg': 'A1', 'product_id_cas': '1', 'product_name': 'fer', 'product_unity': self.unit.id,
            'product_quantity': 3, 'product_company': 'X', 'product_cp': 400, 'product_sp': 500,
            'category': 'Maçonnerie',
        })

        self.assertEqual(response.status_code, 201, response.data)
        change = ProductPriceChange.objects.get(product__product_id=response.data['product_id'])
        self.assertEqual(change.reason, 'created')
        self.assertEqual((change.old_cost_price, change.new_cost_price), (None, 400))
        self.assertEqual(change.changed_by, self.user)

    def test_edit_records_old_and_new_prices_only_when_they_change(self):
        url = f'/api/products/{self.product.product_id}/'
        self.client.patch(url, {'product_description': 'sac de 50 kg'})
        self.assertEqual(self.history(), [])

        self.client.patch(url, {'product_sp': 1800})

        [change] = self.history()
        self.assertEqual(change['reason_display'], 'Modification')
        self.assertEqual((change['old_selling_price'], change['new_selling_price']), (1500, 1800))
        self.assertEqual((change['old_cost_price'], change['new_cost_price']), (1000, 1000))
        self.assertEqual(change['changed_by_username'], 'chef')

    def test_restock_records_the_new_average_cost_with_the_batch(self):
        self.client.post(f'/api/products/{self.product.product_id}/restock/', {'quantity': 6, 'unit_cost': 1500})

        [change] = self.history()
        self.assertEqual(change['reason'], 'restocked')
        self.assertEqual((change['old_cost_price'], change['new_cost_price']), (1000, 1300))
        self.assertEqual(change['new_selling_price'], 1500)
        self.assertEqual(change['note'], '+6 à 1500 FCFA')

    def test_selling_price_set_with_a_restock_is_in_the_same_entry(self):
        self.client.post(
            f'/api/products/{self.product.product_id}/restock/',
            {'quantity': 6, 'unit_cost': 1500, 'selling_price': 2000},
        )

        [change] = self.history()
        self.assertEqual((change['old_cost_price'], change['new_cost_price']), (1000, 1300))
        self.assertEqual((change['old_selling_price'], change['new_selling_price']), (1500, 2000))

    def test_csv_import_update_is_recorded(self):
        csv_file = SimpleUploadedFile('p.csv', b'product_id,product_cp\nP1,1100\n', content_type='text/csv')

        self.client.post('/api/products/import-csv/', {'file': csv_file})

        [change] = self.history()
        self.assertEqual((change['reason'], change['old_cost_price'], change['new_cost_price']), ('imported', 1000, 1100))

    def test_history_is_newest_first(self):
        url = f'/api/products/{self.product.product_id}/'
        self.client.patch(url, {'product_sp': 1600})
        self.client.patch(url, {'product_sp': 1700})

        self.assertEqual([c['new_selling_price'] for c in self.history()], [1700, 1600])
