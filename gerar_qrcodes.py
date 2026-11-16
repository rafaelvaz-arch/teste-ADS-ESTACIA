import os
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Cria a pasta onde as imagens serão salvas
os.makedirs("qrcodes_impressao", exist_ok=True)

# Códigos exatos das vagas cadastradas no Supabase
vagas = ["A-145", "A-102", "A-103", "A-104"]

for codigo in vagas:
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(codigo)
    qr.make(fit=True)
    img_qr = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    # Cria uma borda branca embaixo para escrever o nome da vaga
    largura, altura = img_qr.size
    canvas = Image.new("RGB", (largura, altura + 60), "white")
    canvas.paste(img_qr, (0, 0))

    draw = ImageDraw.Draw(canvas)
    texto = f"VAGA {codigo}"
    try:
        fonte = ImageFont.load_default(size=24)
        draw.text((largura // 2, altura + 25), texto, fill="black", font=fonte, anchor="mm")
    except TypeError:
        draw.text((largura // 2 - 40, altura + 15), texto, fill="black")

    canvas.save(f"qrcodes_impressao/{codigo}.png")

print("QR Codes gerados com sucesso na pasta qrcodes_impressao!")