"""Generate original, disposable PDF/DOCX fixtures using only Python's standard library."""
import sys,pathlib,zipfile,html
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
tag=sys.argv[1]
def q(n,text,opts,answer=None,explanation=None):
 lines=[f'{n}. {text} (POC-{tag})']+[f'{chr(65+i)}. {v}' for i,v in enumerate(opts)]
 if answer:lines.append('Answer: '+answer)
 if explanation:lines.append('Explanation: '+explanation)
 return lines
square=('What is the derivative of x^2 with respect to x?', ['2x','x','2','x^2'],'A','The power rule gives d(x^2)/dx = 2x.')
constant=('What is the derivative of the constant 7?', ['7','0','1','x'],'B','A constant does not change with x, so its derivative is zero.')
sine=('What is the derivative of sin x?', ['sin x','-sin x','cos x','-cos x'],'C','The derivative of sin x is cos x.')
pdf=sum([q(1,*square),q(2,*constant),q(3,*sine),q(4,'What is the derivative of x?', ['0','x','1','2'],'C'),q(5,*square)],[])
word=sum([q(1,'What is the derivative of e^x?', ['0','e^x','x','1'],'B','The exponential function e^x is its own derivative.'),q(2,'For x positive, what is the derivative of ln x?', ['x','ln x','1/x','0'],'C','The derivative of the natural logarithm is the reciprocal 1/x.'),q(3,*constant),q(4,'What is the derivative of cos x?', ['cos x','sin x','-sin x','-cos x'],None,'The derivative of cos x is negative sin x.'),q(5,'What is the derivative of x^3?', ['x^2','3x','3x^2'],'C','By the power rule, d(x^3)/dx is 3x^2.')],[])
# Simple one-page text PDF with a standard font; real PDF.js extraction is exercised.
def escape(s):return s.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
stream=('BT /F1 10 Tf 40 780 Td 14 TL\n'+'\n'.join('('+escape(line)+') Tj T*' for line in pdf)+'\nET').encode('ascii')
objs=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
buf=bytearray(b'%PDF-1.4\n');offset=[0]
for i,obj in enumerate(objs,1):offset.append(len(buf));buf+=f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
xref=len(buf);buf+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{x:010} 00000 n \n'.encode() for x in offset[1:]);buf+=f'trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode();(out/'poc-mcqs.pdf').write_bytes(buf)
with zipfile.ZipFile(out/'poc-mcqs.docx','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
 z.writestr('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
 z.writestr('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+''.join('<w:p><w:r><w:t xml:space="preserve">'+html.escape(line)+'</w:t></w:r></w:p>' for line in word)+'<w:sectPr/></w:body></w:document>')
(out/'pdf-text.txt').write_text('\n'.join(pdf));(out/'word-text.txt').write_text('\n'.join(word))
