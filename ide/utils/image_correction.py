import itertools
import shutil

import png


def _get_mapping(correct=False):
    mapping = {
        (0, 0, 0): (0, 0, 0),
        (0, 30, 65): (0, 0, 85),
        (0, 67, 135): (0, 0, 170),
        (0, 104, 202): (0, 0, 255),
        (43, 74, 44): (0, 85, 0),
        (39, 81, 79): (0, 85, 85),
        (22, 99, 141): (0, 85, 170),
        (0, 125, 206): (0, 85, 255),
        (94, 152, 96): (0, 170, 0),
        (92, 155, 114): (0, 170, 85),
        (87, 165, 162): (0, 170, 170),
        (76, 180, 219): (0, 170, 255),
        (142, 227, 145): (0, 255, 0),
        (142, 230, 158): (0, 255, 85),
        (138, 235, 192): (0, 255, 170),
        (132, 245, 241): (0, 255, 255),
        (74, 22, 27): (85, 0, 0),
        (72, 39, 72): (85, 0, 85),
        (64, 72, 138): (85, 0, 170),
        (47, 107, 204): (85, 0, 255),
        (86, 78, 54): (85, 85, 0),
        (84, 84, 84): (85, 85, 85),
        (79, 103, 144): (85, 85, 170),
        (65, 128, 208): (85, 85, 255),
        (117, 154, 100): (85, 170, 0),
        (117, 157, 118): (85, 170, 85),
        (113, 166, 164): (85, 170, 170),
        (105, 181, 221): (85, 170, 255),
        (158, 229, 148): (85, 255, 0),
        (157, 231, 160): (85, 255, 85),
        (155, 236, 194): (85, 255, 170),
        (149, 246, 242): (85, 255, 255),
        (153, 53, 63): (170, 0, 0),
        (152, 62, 90): (170, 0, 85),
        (149, 86, 148): (170, 0, 170),
        (143, 116, 210): (170, 0, 255),
        (157, 91, 77): (170, 85, 0),
        (157, 96, 100): (170, 85, 85),
        (154, 112, 153): (170, 85, 170),
        (149, 135, 213): (170, 85, 255),
        (175, 160, 114): (170, 170, 0),
        (174, 163, 130): (170, 170, 85),
        (171, 171, 171): (170, 170, 170),
        (167, 186, 226): (170, 170, 255),
        (201, 232, 157): (170, 255, 0),
        (201, 234, 167): (170, 255, 85),
        (199, 240, 200): (170, 255, 170),
        (195, 249, 247): (170, 255, 255),
        (227, 84, 98): (255, 0, 0),
        (226, 88, 116): (255, 0, 85),
        (225, 106, 163): (255, 0, 170),
        (222, 131, 220): (255, 0, 255),
        (230, 110, 107): (255, 85, 0),
        (230, 114, 124): (255, 85, 85),
        (227, 127, 167): (255, 85, 170),
        (225, 148, 223): (255, 85, 255),
        (241, 170, 134): (255, 170, 0),
        (241, 173, 147): (255, 170, 85),
        (239, 181, 184): (255, 170, 170),
        (236, 195, 235): (255, 170, 255),
        (255, 238, 171): (255, 255, 0),
        (255, 241, 181): (255, 255, 85),
        (255, 246, 211): (255, 255, 170),
        (255, 255, 255): (255, 255, 255),
    }
    if correct:
        mapping = {v: k for k, v in mapping.items()}
    return mapping


def _to_pixels(data, n=4):
    return [list(itertools.izip_longest(*[iter(row)] * n)) for row in data]


def _is_corrected(pixels):
    mapping = _get_mapping(correct=False)
    uncorrected = set(mapping.values())
    corrected = set(mapping.keys())
    is_corrected = is_uncorrected = True
    for row in pixels:
        for p in row:
            no_alpha = (p[0], p[1], p[2])
            if no_alpha not in corrected:
                is_corrected = False
            if no_alpha not in uncorrected:
                is_uncorrected = False
            if not is_corrected and not is_uncorrected:
                return None
    return is_corrected


def _convert(file_from, file_out, correct=None):
    im = png.Reader(file_from)
    w, h, data, info = im.read()
    if info['bitdepth'] != 8 or info['planes'] < 3 or info['greyscale']:
        raise ValueError(_("Invalid PNG format for screenshot"))
    n = info['planes']
    pixels = _to_pixels(data, n)
    corrected = _is_corrected(pixels)
    if corrected == correct:
        file_from.seek(0)
        file_out.write(file_from.read())
    else:
        output_pixels = []
        mapping = _get_mapping(correct=correct)
        for row in pixels:
            out_row = []
            for p in row:
                rgb = p[:3]
                mapped = mapping.get(rgb, rgb)
                out_row += mapped
                if n == 4:
                    out_row.append(p[3])
            output_pixels.append(out_row)
        writer = png.Writer(w, h, bitdepth=8, alpha=True, greyscale=False)
        writer.write(file_out, output_pixels)


def uncorrect(file_from, file_out):
    return _convert(file_from, file_out, correct=False)
