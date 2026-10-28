from django.urls import path
from . import views as v
urlpatterns = [path("auth/login", v.login), path("auth/me", v.me), path("dashboard/summary", v.summary),
  path("<str:col>", v.Col.as_view()), path("<str:col>/<str:id>", v.Item.as_view()), path("<str:col>/<str:id>/<str:action>", v.Act.as_view())]
