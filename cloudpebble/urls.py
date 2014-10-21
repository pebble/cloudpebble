from django.conf.urls import patterns, include, url
from django.conf.urls.static import static
from django.conf import settings

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'cloudpebble.views.home', name='home'),
    # url(r'^cloudpebble/', include('cloudpebble.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
     #url(r'^admin/', include(admin.site.urls)),
     url(r'^ide/', include('ide.urls', namespace='ide')),
     url(r'^accounts/', include('auth.urls')), # Namespacing this breaks things.
     url(r'^qr/', include('qr.urls', namespace='qr')),
     url(r'^$', include('root.urls', namespace='root')),
     url(r'', include('social.apps.django_app.urls', namespace='social')),
     url(r'^i18n/', include('django.conf.urls.i18n'))
)
