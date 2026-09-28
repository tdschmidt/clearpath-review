"""Generate the fictional ClearPath demo creative. No network or paid services."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import shutil
import hashlib
import json
import mimetypes

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'fixtures'
FONT = Path('/System/Library/Fonts/Supplemental')
for folder in ['loan/v1', 'loan/v2', 'loan/v3', 'card', 'mortgage', 'offers']:
    (OUT / folder).mkdir(parents=True, exist_ok=True)
CREAM, GREEN, INK, MUTED, LIME = '#F7F5EC', '#184C3E', '#203F35', '#56695F', '#DDECA5'

def font(size, serif=False, bold=False):
    name = ('Georgia Bold.ttf' if bold else 'Georgia.ttf') if serif else ('Arial Bold.ttf' if bold else 'Arial.ttf')
    return ImageFont.truetype(str(FONT / name), size)

def brand(d, y=65, color=GREEN):
    d.line([(66,y+35),(89,y+12),(112,y+35)], fill=color, width=8)
    d.line([(66,y+55),(89,y+32),(112,y+55)], fill=color, width=8)
    d.text((133,y+3), 'ClearPath', font=font(47,bold=True), fill=color)

def footer(d, text, y=893):
    for line in text:
        d.text((66,y), line, font=font(22), fill=MUTED)
        y += 31
    d.line((66,1015,1014,1015), fill='#D6DBCB', width=2)
    d.text((66,1033), 'FICTIONAL CAMPAIGN / TAKE-HOME DEMONSTRATION', font=font(16,bold=True), fill=MUTED)

def loan(version):
    im=Image.new('RGB',(1080,1080),CREAM); d=ImageDraw.Draw(im)
    brand(d)
    d.text((68,161),'PERSONAL LOANS',font=font(22,bold=True),fill=MUTED)
    d.text((66,216),"Make room for",font=font(83,serif=True),fill=INK)
    d.text((66,311),"what's next.",font=font(83,serif=True),fill=INK)
    d.text((68,437),'One personal loan.',font=font(30),fill=MUTED)
    d.text((68,481),'A little more breathing room.',font=font(30),fill=MUTED)
    # Abstract ascending path: intentionally diagrammatic, not a stock photo.
    d.rounded_rectangle((741,458,1014,827),radius=137,fill='#E5EBD9')
    for i,(x,y,w,h) in enumerate([(766,688,64,115),(842,612,64,191),(918,536,64,267)]):
        d.rounded_rectangle((x,y,x+w,y+h),radius=16,fill=['#C4D5B7','#A1BB98',GREEN][i])
    d.rounded_rectangle((66,573,683,654),radius=16,fill=LIME)
    d.text((91,596),'No origination fee.' if version==1 else 'Origination fee applies.',font=font(36,bold=True),fill=GREEN)
    d.rounded_rectangle((66,715,616,801),radius=43,fill=GREEN)
    d.text((99,739),'Explore your options',font=font(31,bold=True),fill=CREAM)
    d.line((555,758,578,758),fill=CREAM,width=3)
    d.line((567,747,578,758,567,769),fill=CREAM,width=3)
    d.text((68,837),'Sponsored by ClearPath',font=font(21,bold=True),fill=MUTED)
    foot=['Credit approval required. Terms vary by applicant.',
          'A personal loan creates a repayment obligation.',
          'Learn more at clearpath.example/personal-loans.']
    if version>1: foot[1]='The origination fee is deducted from loan proceeds.'
    footer(d,foot)
    im.save(OUT/f'loan/v{version}/social-ad.png')

loan(1); loan(2)
shutil.copyfile(OUT/'loan/v2/social-ad.png', OUT/'loan/v3/social-ad.png')

im=Image.new('RGB',(1080,1080),CREAM); d=ImageDraw.Draw(im); brand(d)
d.text((68,161),'CLEARPATH EVERYDAY CARD',font=font(22,bold=True),fill=MUTED)
d.text((66,213),'Simple by design.',font=font(81,serif=True),fill=INK)
d.text((69,332),'A credit card for everyday possibilities.',font=font(30),fill=MUTED)
d.rounded_rectangle((214,431,881,810),radius=30,fill='#D7DDD0')
d.rounded_rectangle((190,407,856,786),radius=30,fill=GREEN)
d.text((233,449),'ClearPath',font=font(36,bold=True),fill=CREAM)
d.rounded_rectangle((238,545,314,603),radius=11,fill=LIME)
d.line((263,545,263,603),fill=GREEN,width=2);d.line((289,545,289,603),fill=GREEN,width=2)
d.line((238,574,314,574),fill=GREEN,width=2)
d.text((235,698),'EVERYDAY',font=font(22,bold=True),fill=CREAM)
d.text((747,698),'DEMO',font=font(19),fill=CREAM)
footer(d,['No annual fee. Credit approval required.', 'This is a brand-awareness concept, not an application.', 'Fictional card image. Not a payment instrument.'])
im.save(OUT/'card/social-ad.png')

im=Image.new('RGB',(1080,1080),CREAM); d=ImageDraw.Draw(im); brand(d)
d.text((68,161),'MORTGAGE PREQUALIFICATION',font=font(22,bold=True),fill=MUTED)
d.text((66,221),'A clearer first step',font=font(75,serif=True),fill=INK)
d.text((66,311),'closer to home.',font=font(75,serif=True),fill=INK)
d.polygon([(659,552),(827,414),(995,552)],fill='#A6BC97')
d.rounded_rectangle((688,552,965,829),radius=16,fill='#E1E8D3')
d.rounded_rectangle((771,637,883,829),radius=56,fill=GREEN)
d.rectangle((771,690,883,829),fill=GREEN)
d.ellipse((851,724,862,735),fill=LIME)
d.text((68,499),'Begin with an estimate.',font=font(30),fill=MUTED)
d.text((68,545),'Plan your next conversation.',font=font(30),fill=MUTED)
d.rounded_rectangle((66,715,644,801),radius=43,fill=GREEN)
d.text((99,740),'Explore prequalification',font=font(31,bold=True),fill=CREAM)
d.text((68,837),'Sponsored by ClearPath',font=font(21,bold=True),fill=MUTED)
footer(d,['Prequalification is an estimate, not a commitment to lend.', 'Credit approval, verification, and underwriting required.', 'Learn more at clearpath.example/mortgage.'])
im.save(OUT/'mortgage/social-ad.jpg',quality=95,subsampling=0)

for name,file in [('Sans','Arial.ttf'),('SansBold','Arial Bold.ttf'),('Serif','Georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONT/file)))

def txt(c,x,y,s,size=11,font='Sans',color=INK):
    c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,s)

def page(c,eyebrow,number=1):
    c.setFillColor(HexColor(CREAM));c.rect(0,0,595,842,fill=1,stroke=0)
    txt(c,44,788,'ClearPath',24,'SansBold',GREEN)
    txt(c,44,750,eyebrow,9,'SansBold',MUTED)
    c.setStrokeColor(HexColor('#D6DBCB'));c.line(44,61,551,61)
    txt(c,44,41,'FICTIONAL / TAKE-HOME DEMONSTRATION ONLY',8,'SansBold',MUTED)
    txt(c,527,41,f'{number:02d}',8,'Sans',MUTED)

def wrap(c,text,x,y,width,size=11,leading=17,font='Sans',color=INK):
    line=''
    for word in text.split():
        test=(line+' '+word).strip()
        if pdfmetrics.stringWidth(test,font,size)>width and line:
            txt(c,x,y,line,size,font,color);y-=leading;line=word
        else:line=test
    if line:txt(c,x,y,line,size,font,color);y-=leading
    return y

def reference(filename,title,version,rows,disclosure):
    c=canvas.Canvas(str(OUT/f'offers/{filename}.pdf'),pagesize=(595,842))
    c.setTitle(f'ClearPath fictional offer reference - {title}')
    page(c,'INTERNAL OFFER REFERENCE / NOT CUSTOMER CREATIVE')
    txt(c,44,691,title,30,'Serif');txt(c,44,658,version+'  /  Valid Sep 1 - Nov 30, 2026',10,'SansBold',MUTED)
    y=600
    for label,value in rows:
        txt(c,44,y,label.upper(),8,'SansBold',MUTED)
        y=wrap(c,value,213,y,338,11,16)-21
        c.setStrokeColor(HexColor('#D6DBCB'));c.line(44,y+9,551,y+9)
    txt(c,44,y-8,'MARKETING CONTEXT',9,'SansBold',GREEN)
    y=wrap(c,disclosure,44,y-35,507,11,17)
    wrap(c,'Authored fixture supplied by the fictional ClearPath Product team. These facts are a demo reference, not a real offer, legal opinion, or automated compliance verdict.',44,min(y-36,180),507,10,16,color=MUTED)
    c.save()

reference('personal-loan','Personal loan / Standard','PL-2026.09 / v3',[
    ('Product','Unsecured, closed-end personal loan'),('Origination fee','Mandatory 5% of principal, deducted from proceeds.'),
    ('Internal example','$10,000 principal; $500 origination fee; $9,500 proceeds.'),('Eligibility','Individual credit approval required. Terms vary by applicant.'),
    ('Campaign use','Affiliate social creative and its named destination.'),('Reference owner','Fictional ClearPath Product team / Maya Chen review fixture')],
    'No zero-fee variant exists in this fictional offer. "No origination fee" conflicts with this reference. Customer creative in the revised sample states that a fee applies without advertising a payment, rate, APR, or numerical finance charge. No APR or payment calculation is implied by the internal proceeds example.')
reference('credit-card','Everyday credit card','CC-2026.09 / v2',[
    ('Product','General-purpose consumer credit card'),('Annual fee','$0 annual fee for the fictional Everyday product.'),
    ('Eligibility','Credit approval required; no guaranteed approval claim.'),('Campaign use','Static brand-awareness social image; no application CTA.'),
    ('Excluded claims','No purchase APR, reward, introductory-rate or limit claim.'),('Reference owner','Fictional ClearPath Product team / Maya Chen review fixture')],
    'This sample concerns a brand-awareness image, not a card application or solicitation package. Any later application, pricing claim, rewards claim, or destination needs its own applicable terms and review. This reference does not supply missing application disclosures.')
reference('mortgage','Mortgage prequalification','MTG-2026.09 / v1',[
    ('Product','Mortgage prequalification estimate'),('Meaning','An estimate; not approval or a commitment to lend.'),
    ('Conditions','Credit approval, verification, and underwriting required.'),('Campaign use','Affiliate social image linked to a prequalification page.'),
    ('Excluded claims','No rate, APR, down payment or monthly payment advertised.'),('Reference owner','Fictional ClearPath Product team / Maya Chen review fixture')],
    'The campaign must preserve the distinction between a preliminary estimate and an actual lending decision. A destination URL alone is not a rendition of the page consumers will see. The seeded case is waiting for that rendered destination.')

c=canvas.Canvas(str(OUT/'loan/v3/destination.pdf'),pagesize=(595,842))
c.setTitle('ClearPath personal loan destination - fictional desktop rendition')
page(c,'DESTINATION RENDITION / DESKTOP / OCTOBER CAMPAIGN')
txt(c,44,704,"Make room for",38,'Serif');txt(c,44,657,"what's next.",38,'Serif')
wrap(c,'A personal loan can help you take your next step. Explore your options and review the terms offered to you.',44,604,375,13,20,color=MUTED)
c.setFillColor(HexColor(LIME));c.roundRect(44,459,507,74,12,fill=1,stroke=0)
txt(c,64,501,'Origination fee applies.',17,'SansBold',GREEN)
txt(c,64,478,'The fee is deducted from your loan proceeds.',11,'Sans',GREEN)
c.setFillColor(HexColor(GREEN));c.roundRect(44,369,272,49,24,fill=1,stroke=0)
txt(c,69,388,'Explore your loan options',12,'SansBold',CREAM)
txt(c,44,320,'A clear view before your next step',18,'Serif')
wrap(c,'Credit approval is required. Terms vary by applicant. Review your personalized disclosures before deciding whether to borrow.',44,290,492,12,19)
wrap(c,'This rendition captures the proposed destination for the accompanying social creative. The button is illustrative and does not submit an application.',44,187,507,10,16,color=MUTED)
txt(c,44,111,'clearpath.example/personal-loans',10,'SansBold',MUTED)
c.showPage();page(c,'DESTINATION RENDITION / TERMS AND NEXT STEPS',2)
txt(c,44,690,'Before you borrow',32,'Serif')
y=625
for title,body in [
    ('Understand the fee','An origination fee applies and is deducted from loan proceeds. Your personalized disclosures state the fee and the amount you will receive.'),
    ('Review your own terms','Eligibility and terms depend on your application. Review the APR, finance charge, payment schedule, and other applicable disclosures before accepting a loan.'),
    ('Make an informed decision','A personal loan creates a repayment obligation. Consider whether the payment fits your budget and compare the terms available to you.')]:
    txt(c,44,y,title,16,'SansBold',GREEN); y=wrap(c,body,44,y-28,485,12,20)-43
wrap(c,'Fictional website rendition created for a product demonstration. Not a real loan offer or an application. This file captures the exact sample content submitted for review; the example URL is not a live website.',44,186,507,10,16,color=MUTED)
txt(c,44,111,'clearpath.example/personal-loans / end of rendition',10,'SansBold',MUTED)
c.save()
(OUT/'unsupported-evidence.txt').write_text('FICTIONAL DEMO EVIDENCE\n\nPartner note: the landing page is not final. This plain-text note is supporting context, not a rendered destination and not a replacement creative.\n\nUse this file to demonstrate an unsupported preview/manual intake path.\n')
metadata = {}
for path in sorted(OUT.rglob('*')):
    if path.is_file() and path.suffix in {'.png', '.jpg', '.pdf', '.txt'}:
        data = path.read_bytes()
        metadata[str(path.relative_to(ROOT))] = {
            'name': path.name, 'mime': mimetypes.guess_type(path.name)[0] or 'application/octet-stream',
            'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        }
(ROOT/'fixtures/asset-metadata.json').write_text(json.dumps(metadata, indent=2)+'\n')
print('Generated campaign images, three internal offer references, and a two-page destination PDF.')
