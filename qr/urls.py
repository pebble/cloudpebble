from django.conf.urls import patterns, url

from qr import views

urlpatterns = [
    url('$^', views.render, name='render')
]
