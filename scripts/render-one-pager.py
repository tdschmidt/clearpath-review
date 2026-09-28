"""Render the repository's product rationale as a single-page PDF (reportlab)."""
from pathlib import Path
import re
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, FrameBreak

root = Path(__file__).resolve().parents[1]
output = root / 'output/pdf/clearpath-product-one-pager.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
source = (root / 'docs/product-one-pager.md').read_text()
green = colors.HexColor('#2e513f')
styles = {
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=9.7, leading=13.2, textColor=colors.HexColor('#26332e'), spaceAfter=9),
    'heading': ParagraphStyle('heading', fontName='Helvetica-Bold', fontSize=10.2, leading=13, textColor=green, spaceBefore=7, spaceAfter=7),
    'sources': ParagraphStyle('sources', fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=green, spaceBefore=4),
}
def markup(text):
    text = text.replace('—', '-').replace('–', '-').replace('’', "'")
    text = escape(text)
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    def link(match):
        label, url = match.groups()
        if not url.startswith('https:'):
            url = 'https://github.com/tdschmidt/clearpath-review/blob/main/docs/' + url
        return f'<link href="{url}" color="#2e513f"><u>{label}</u></link>'
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)

def decorate(canvas, doc):
    canvas.setFillColor(green)
    canvas.rect(0, 785, 612, 7, fill=1, stroke=0)
    canvas.setFont('Helvetica-Bold', 25)
    canvas.drawString(42, 741, 'ClearPath Review')
    canvas.setFont('Helvetica', 9)
    canvas.drawRightString(570, 745, 'PRODUCT RATIONALE / TAKE-HOME')
    subtitle = Paragraph('A workspace for reviewing financial marketing, returning corrections,<br/>and recording exactly what was approved.', ParagraphStyle('subtitle', fontName='Helvetica', fontSize=11, leading=15, textColor=green))
    subtitle.wrapOn(canvas, 528, 40)
    subtitle.drawOn(canvas, 42, 698)
    canvas.setStrokeColor(colors.HexColor('#d7e1da'))
    canvas.line(42, 683, 570, 683)
    canvas.line(42, 42, 570, 42)
    canvas.setFillColor(green)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(42, 27, 'Fictional company. Working prototype; limitations stated explicitly.')
    canvas.drawRightString(570, 27, 'ClearPath Review  /  1')

doc = BaseDocTemplate(str(output), pagesize=(612, 792), title='ClearPath Review - Product rationale', author='ClearPath Review project')
frames = [Frame(42, 53, 252, 622, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0), Frame(318, 53, 252, 622, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)]
doc.addPageTemplates(PageTemplate(id='one-page', frames=frames, onPage=decorate))
story = []
body = source[source.index('## Problem'):]
for block in body.split('\n\n'):
    block = block.strip()
    if not block:
        continue
    if block.startswith('## '):
        if block.startswith('## Research'):
            story.append(FrameBreak())
        story.append(Paragraph(markup(block[3:]), styles['heading']))
    elif block.startswith('- '):
        for item in block.split('\n- '):
            story.append(Paragraph(markup(item.removeprefix('- ')), styles['body']))
    else:
        story.append(Paragraph(markup(block), styles['sources'] if block.startswith('[1:') else styles['body']))
doc.build(story)
print(output)
