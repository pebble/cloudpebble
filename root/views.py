from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse
from django.utils import simplejson as json
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.views.decorators.http import require_safe, require_POST
from django.views.decorators.csrf import csrf_protect
from django.forms import ModelForm

def index(request):
    if request.user.is_authenticated():
        return redirect("/ide/")
    else:
        return render(request, 'root/index.html')