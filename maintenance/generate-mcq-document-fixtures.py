#!/usr/bin/env python3
"""Generate deterministic, synthetic, selectable-text PDF and Word MCQ fixtures."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape

folder=Path("e2e/fixtures-generated")
folder.mkdir(parents=True,exist_ok=True)
lines=[
"1. What is two plus two?",
"A. 1",
"B. 2",
"C. 3",
"D. 4",
"Answer: D",
"Explanation: Adding two and two gives four.",
"2. An incomplete item?",
"A. one",
"B. two",
"C. three",
"D. four",
"Answer: A",
]
# Portable minimal valid PDF with proper byte offsets, without external Python packages.
def make_pdf():
    stream="BT /F1 12 Tf 42 770 Td 15 TL\n"
    for line in lines:
        safe=line.replace("\\","\\\\").replace("(","\\(").replace(")","\\)")
        stream+=f"({safe}) Tj T*\n"
    stream+="ET\n"
    pieces=[
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        ("<< /Length %d >>\nstream\n"%len(stream.encode()) + stream + "endstream").encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf=b"%PDF-1.4\n"; offsets=[0]
    for num,piece in enumerate(pieces,1):
        offsets.append(len(pdf)); pdf+=f"{num} 0 obj\n".encode()+piece+b"\nendobj\n"
    xref=len(pdf);pdf+=f"xref\n0 {len(pieces)+1}\n0000000000 65535 f \n".encode()
    for pos in offsets[1:]:pdf+=f"{pos:010d} 00000 n \n".encode()
    pdf+=f"trailer\n<< /Size {len(pieces)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    (folder/"sample-mcqs.pdf").write_bytes(pdf)

def make_docx():
    paragraphs="".join(f'<w:p><w:r><w:t xml:space="preserve">{escape(s)}</w:t></w:r></w:p>' for s in lines)
    document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>'
    ct='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    with ZipFile(folder/"sample-mcqs.docx","w",compression=ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",ct)
        z.writestr("_rels/.rels",rels)
        z.writestr("word/document.xml",document)
make_pdf()
make_docx()
print("Generated PDF and DOCX MCQ fixtures.")
