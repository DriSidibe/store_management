from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Category, Product, Unity


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
