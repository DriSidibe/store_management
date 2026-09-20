from django.contrib.auth.models import User
from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.exceptions import InvalidToken

from store.permissions import IsSuperUser
from store.utils import log_activity

from .serializers import RegisterSerializer, UserManagementSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """Creates a user and immediately returns JWT tokens, like the old
    signup view which logged the user in right after signup."""
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=201)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                raise InvalidToken('Invalid or already blacklisted refresh token.')
        return Response(status=205)


class UserViewSet(viewsets.ModelViewSet):
    """User & permissions administration (superuser only) - lets an admin
    manage accounts and roles (staff/superuser/active) without the Django
    admin site."""
    queryset = User.objects.all().order_by('username')
    serializer_class = UserManagementSerializer
    permission_classes = [IsSuperUser]

    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(self.request, 'created', 'User', user.username)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance == self.request.user:
            data = serializer.validated_data
            if data.get('is_superuser') is False or data.get('is_active') is False:
                raise ValidationError(
                    "Vous ne pouvez pas retirer vos propres droits superuser ou désactiver votre compte."
                )
        user = serializer.save()
        log_activity(self.request, 'updated', 'User', user.username)

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise ValidationError("Vous ne pouvez pas supprimer votre propre compte.")
        log_activity(self.request, 'deactivated', 'User', instance.username)
        instance.is_active = False
        instance.save(update_fields=['is_active'])
