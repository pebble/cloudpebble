from registration.backends.simple.views import RegistrationView
from django.shortcuts import render

class IdeRegistrationView(RegistrationView):
    def get_success_url(self, *args, **kwargs):
        return "/ide/"

def login_split(request):
    params = ''
    if 'next' in request.GET:
        params = '?next={0}'.format(request.GET['next'])
    return render(request, 'registration/login_split.html', {'params': params})
