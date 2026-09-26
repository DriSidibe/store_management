from django.contrib.auth.models import User
from rest_framework.test import APITestCase


class AccountCreationTests(APITestCase):
    new_account = {'username': 'caissier', 'password': 'Un-mot-de-passe-solide-42'}

    def test_there_is_no_public_signup(self):
        response = self.client.post('/api/auth/register/', self.new_account)

        self.assertEqual(response.status_code, 404)
        self.assertFalse(User.objects.filter(username='caissier').exists())

    def test_only_an_admin_can_create_an_account(self):
        self.client.force_authenticate(User.objects.create_user('chef', password='x', is_staff=True))
        self.assertEqual(self.client.post('/api/auth/users/', self.new_account).status_code, 403)

        self.client.force_authenticate(User.objects.create_superuser('admin', password='x'))
        self.assertEqual(self.client.post('/api/auth/users/', self.new_account).status_code, 201)

        self.client.force_authenticate(None)
        login = self.client.post('/api/auth/token/', self.new_account)
        self.assertEqual(login.status_code, 200)
