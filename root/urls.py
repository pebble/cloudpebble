from django.conf.urls import url, include

from root import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^i18n/', include('django.conf.urls.i18n'))
]
