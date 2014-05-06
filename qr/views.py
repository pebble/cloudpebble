from django.http import HttpResponse

from StringIO import StringIO
import qrcode


def render(request):
    value = request.GET.get('v', '')
    size = int(request.GET.get('s', 4))
    border = int(request.GET.get('b', 2))
    qr = qrcode.QRCode(box_size=size, border=border, error_correction=qrcode.constants.ERROR_CORRECT_L)
    qr.add_data(value)
    img = qr.make_image()
    s = StringIO()
    img.save(s, kind='png')
    s.seek(0)
    return HttpResponse(s, content_type='image/png')
